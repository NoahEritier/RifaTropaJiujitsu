import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5175';
const dir=process.env.LOCAL_DATA_DIR;
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||!dir?.startsWith('.data/qa-'))throw Error('Ruleta: únicamente base local aislada .data/qa-*');
const key=readFileSync('.env.local','utf8').match(/ADMIN_KEY\s*=\s*"([^"]+)"/)?.[1];
const db=new DatabaseSync(dir+'/database.sqlite');
const seeded=db.prepare('SELECT count(*) AS n FROM requests').get().n;assert.ok(seeded===0||seeded===100);if(seeded===100){assert.equal(db.prepare('SELECT count(*) AS n FROM raffle_draw').get().n,0);assert.equal(db.prepare("SELECT count(*) AS n FROM requests WHERE name LIKE 'QA %'").get().n,100);db.exec("UPDATE requests SET status='pending'");}
const cfg={alias:'test.no.transferir',holder:'PRUEBA SIN PAGOS REALES',phone:'5492245000000',date:'PRUEBA',mechanism:'Ruleta de prueba',optionalPrize:'TV o efectivo',rules:'Datos ficticios',start:0,numberingConfirmed:true,open:true,reservationHours:48};
db.prepare('INSERT INTO settings VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(cfg));
for(let n=0;seeded===0&&n<100;n++){
 const id=randomUUID(),now=Date.now();
 db.prepare('INSERT INTO requests(id,name,phone,total,status,receipt,mime,created,token_hash,fingerprint,numbers,expires) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'QA '+n,'5492245000000',12000,'pending','receipts/'+id+'/'+ '0'.repeat(64)+'/'+randomUUID(),'image/png',now,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),JSON.stringify([n]),now+172800000);
 db.prepare('INSERT INTO tickets VALUES(?,?)').run(n,id);
}
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const context=await browser.newContext({viewport:{width:1365,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const headers={Origin:base};mkdirSync('.sites-runtime/qa',{recursive:true});
try{
 await page.goto(base+'/admin');await page.getByLabel('Clave de administración').fill(key);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.getByRole('heading',{name:'Ruleta de la rifa'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Sortear y guardar ganador'}).isDisabled(),true);
 assert.equal((await context.request.post(base+'/api/draw',{headers})).status(),409);
 db.exec("UPDATE requests SET status='approved' WHERE id IN (SELECT request_id FROM tickets WHERE number<99)");
 assert.equal((await context.request.post(base+'/api/draw',{headers})).status(),409);
 db.exec("UPDATE requests SET status='approved' WHERE id=(SELECT request_id FROM tickets WHERE number=99)");
 await page.getByRole('button',{name:'Actualizar resultado'}).click();
 await page.getByRole('button',{name:'Sortear y guardar ganador'}).waitFor();
 await page.getByRole('button',{name:'Ensayar animación'}).click();
 await page.getByText('Ensayo · sin validez',{exact:true}).waitFor();assert.equal(db.prepare('SELECT count(*) AS n FROM raffle_draw').get().n,0);
 await page.setViewportSize({width:360,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.sites-runtime/qa/wheel-mobile-demo.png',fullPage:true});
 console.log('OK: ruleta móvil; ensayo no guarda; 99 pagos no habilitan definitivo');
 await page.setViewportSize({width:1365,height:900});page.on('dialog',dialog=>dialog.accept());
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/draw')&&r.request().method()==='POST');
 const [,other]=await Promise.all([page.getByRole('button',{name:'Sortear y guardar ganador'}).click(),context.request.post(base+'/api/draw',{headers})]);
 const first=await responsePromise;assert.equal(first.status(),200);assert.equal(other.status(),200);const a=await first.json(),b=await other.json();assert.deepEqual(a.result,b.result);
 await page.getByText('Número ganador',{exact:true}).waitFor();assert.equal(db.prepare('SELECT count(*) AS n FROM raffle_draw').get().n,1);
 const final=db.prepare('SELECT * FROM raffle_draw').get();assert.equal(JSON.parse(final.snapshot).length,100);assert.ok(final.winner>=0&&final.winner<=99);
 assert.equal(JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value).open,false);
 console.log('OK: UI + API + SQLite; dos sorteos simultáneos devuelven un ganador único y cierran reservas');
 await page.reload();await page.getByText('Número ganador',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Sortear y guardar ganador'}).isDisabled(),true);
 await page.screenshot({path:'.sites-runtime/qa/wheel-desktop-result.png',fullPage:true});
 assert.equal((await context.request.post(base+'/api/admin',{headers,data:{action:'settings',config:cfg}})).status(),400);
 const repeated=await context.request.post(base+'/api/draw',{headers});assert.deepEqual((await repeated.json()).result,a.result);
 const wrong=await context.request.post(base+'/api/draw',{headers:{Origin:'https://invalid.example'}});assert.equal(wrong.status(),403);
 assert.equal((await fetch(base+'/api/draw')).status,401);
 assert.equal((await context.request.delete(base+'/api/session',{headers})).status(),200);
 assert.equal((await context.request.post(base+'/api/draw',{headers})).status(),401);
 assert.deepEqual(errors,[]);console.log('OK: persistencia al recargar, no repetición, no reapertura, origen y sesión; sin errores JS');
 // Una imagen real para verificar que el respaldo también restaure archivos.
 mkdirSync(dir+'/receipts/qa',{recursive:true});writeFileSync(dir+'/receipts/qa/fixture.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=','base64'));
}finally{db.close();await browser.close();}
