import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
const playwrightModule=process.env.PLAYWRIGHT_MODULE_PATH;
const {chromium}=await import(playwrightModule?pathToFileURL(playwrightModule).href:'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Prueba sólo local.');
const key=readFileSync('.env.local','utf8').match(/ADMIN_KEY\s*=\s*"([^"]+)"/)?.[1];
const dbPath='.data/state/database.sqlite';
let db=new DatabaseSync(dbPath);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,0,'Sólo correr con base vacía.');
const initialRow=db.prepare('SELECT value FROM settings WHERE id=1').get();
const original=initialRow?JSON.parse(initialRow.value):null;db.close();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1365,height:900}});
const page=await context.newPage(),errors=[];
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
page.on('pageerror',e=>errors.push(e.message));
const ids=[];
mkdirSync('.sites-runtime/qa',{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=','base64');
try {
  await page.goto(base);await page.getByText('100 disponibles',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Reservas aún no habilitadas'}).isDisabled(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.sites-runtime/qa/desktop-closed.png',fullPage:true});console.log('OK: escritorio, 100 números y reservas cerradas');
  for(const width of [360,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desborde en '+width);
  }
  await page.screenshot({path:'.sites-runtime/qa/mobile-closed.png',fullPage:true});console.log('OK: celulares 360 y 390 px sin desborde horizontal');
  const admin=await context.newPage();
  await admin.goto(base+'/admin');await admin.getByLabel('Clave de administración').fill(key);await admin.getByRole('button',{name:'Ingresar',exact:true}).click();
  await admin.getByRole('heading',{name:'Configuración del sorteo'}).waitFor();
  for(const [label,value] of [
    ['Alias de transferencia','test.no.transferir'],['Titular','PRUEBA DE INTERFAZ'],['WhatsApp con código de país','5492245000000'],['Fecha o condición de realización','Prueba local'],
    ['Mecanismo del sorteo','Prueba en vivo'],['Condiciones del premio opcional','El ganador elige TV o efectivo'],['Condiciones de participación','Prueba sin pagos reales'],
  ])await admin.getByLabel(label,{exact:true}).fill(value);
  await admin.getByLabel('Confirmar la numeración antes de abrir.').check();
  await admin.getByLabel('Habilitar reservas y pagos.').check();
  await admin.getByRole('button',{name:'Guardar configuración'}).click();await admin.getByText('Cambios guardados.').waitFor();
  await page.reload();await page.getByRole('button',{name:'Número 01, disponible',exact:true}).click();
  await page.getByLabel('Nombre y apellido').fill('Participante QA');
  await page.getByLabel('WhatsApp',{exact:true}).fill('5492245000019');
  await page.locator('input[type=file]').setInputFiles({name:'comprobante.png',mimeType:'image/png',buffer:Buffer.alloc(5000001)});
  await page.getByText('El comprobante debe pesar hasta 5 MB y no estar vacío.').waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'falso.png',mimeType:'image/png',buffer:Buffer.from('<script>bad</script>')});
  await page.getByText('Elegí un JPG, PNG o PDF válido. El contenido y el formato deben coincidir.').waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'comprobante.png',mimeType:'image/png',buffer:png});
  await page.getByAltText('Vista previa de tu comprobante').waitFor();
  await page.getByRole('checkbox').check();
  await page.route('**/api/reserve',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fallo de prueba: reintentá el envío.'})}));
  await page.getByRole('button',{name:'Solicitar reserva',exact:true}).click();
  await page.getByText('Fallo de prueba: reintentá el envío.').waitFor();
  assert.equal(await page.getByLabel('Nombre y apellido').inputValue(),'Participante QA');
  assert.equal(await page.getByRole('button',{name:'Número 01, elegido',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('input[type=file]').evaluate(e=>e.files.length),1);
  console.log('OK: formatos, tamaño, vista previa y conservación completa ante error');
  await page.unroute('**/api/reserve');
  const responsePromise=page.waitForResponse(r=>r.url()===base+'/api/reserve'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Solicitar reserva',exact:true}).click();
  const response=await responsePromise,body=await response.json();
  assert.equal(response.status(),201);assert.equal(body.request.total,12000);ids.push(body.request.id);
  await page.getByRole('heading',{name:'Solicitud recibida'}).waitFor();
  const code=await page.locator('.modal code').textContent();
  await page.getByRole('button',{name:'Ya guardé mi código'}).click();
  await admin.getByRole('button',{name:'Actualizar',exact:true}).click();
  await admin.getByRole('heading',{name:'Participante QA',exact:true}).waitFor();
  assert.equal(await admin.getByRole('combobox',{name:'Numeración',exact:true}).isDisabled(),true);
  admin.once('dialog',dialog=>dialog.accept());
  await admin.getByRole('button',{name:'Aprobar pago',exact:true}).click();
  await admin.getByRole('article').getByText('Aprobada',{exact:true}).waitFor();
  const lookup=await context.newPage();await lookup.goto(base+'/consulta');await lookup.getByLabel('Código privado').fill(code);
  await lookup.getByRole('button',{name:'Consultar estado'}).click();await lookup.getByRole('heading',{name:'Aprobada',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Número 01, pagado',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Número 01, pagado',exact:true}).isDisabled(),true);
  await page.screenshot({path:'.sites-runtime/qa/mobile-approved.png',fullPage:true});console.log('OK: reserva, aprobación y consulta privada desde el navegador');
  await admin.setViewportSize({width:390,height:844});
  assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await admin.screenshot({path:'.sites-runtime/qa/mobile-admin.png',fullPage:true});
  const downloadPromise=admin.waitForEvent('download');
  await admin.getByRole('button',{name:'Exportar Participantes CSV',exact:true}).click();await downloadPromise;
  await admin.getByRole('button',{name:'Salir',exact:true}).click();await admin.getByLabel('Clave de administración').waitFor();
  assert.deepEqual(errors,[],'Errores JS del navegador');console.log('OK: panel móvil, exportación, salida y sin errores JavaScript');
} finally {
  await context.close();await browser.close();
  db=new DatabaseSync(dbPath);const objects=[];
  try{
    db.exec('BEGIN IMMEDIATE');
    for(const id of ids){
      const row=db.prepare('SELECT receipt FROM requests WHERE id=?').get(id);if(row)objects.push(row.receipt);
      db.prepare('DELETE FROM tickets WHERE request_id=?').run(id);db.prepare('DELETE FROM requests WHERE id=?').run(id);
    }
    if(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n===0){
      if(original)db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(original));
      else db.exec('DELETE FROM settings WHERE id=1');
    }
    db.exec('COMMIT');
    db.prepare('DELETE FROM rate_limits WHERE key=?').run(createHash('sha256').update(key+':login:local').digest('hex'));
  }finally{db.close();}
  for(const object of objects)unlinkSync('.data/state/'+object);
  console.log('Configuración inicial restaurada; solicitudes de QA eliminadas.');
}