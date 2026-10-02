import assert from 'node:assert/strict';
import { readFileSync, unlinkSync } from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Estas pruebas sólo admiten el entorno local.');
const key=readFileSync('.env.local','utf8').match(/ADMIN_KEY\s*=\s*"([^"]+)"/)?.[1];
assert.ok(key,'Falta la clave local');
const ip='local';
let cookie='';
let original;
const ids=[],codes=[];
const headers={'Origin':base,'CF-Connecting-IP':ip};
async function api(path,{body,method='GET',authenticated=true,...extra}={}){
  const response=await fetch(base+path,{
    method,headers:{...headers,...(authenticated&&cookie?{Cookie:cookie}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...extra.headers},
    ...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),
  });
  const result=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text();
  return {response,body:result};
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=','base64');
function attempt(numbers,phone='5492245000001'){
  const id=randomUUID(),code=randomBytes(32).toString('hex');ids.push(id);codes.push(code);
  return {id,code,numbers,phone};
}
function form(a,{name='Participante de prueba',mime='image/png',bytes=png,total='1'}={}){
  const f=new FormData();f.set('id',a.id);f.set('code',a.code);f.set('name',name);f.set('phone',a.phone);
  f.set('numbers',JSON.stringify(a.numbers));f.set('total',total);
  f.set('receipt',new File([bytes],'prueba.png',{type:mime}));return f;
}
function localDatabase(){return new DatabaseSync('.data/state/database.sqlite');}
async function settings(c){return api('/api/admin',{method:'POST',body:{action:'settings',config:c}});}
function ok(label){console.log('OK:',label);}
try{
  assert.equal((await api('/api/admin',{authenticated:false})).response.status,401);
  assert.equal((await api('/api/receipt?id='+randomUUID(),{authenticated:false})).response.status,401);
  assert.equal((await api('/api/export',{authenticated:false})).response.status,401);ok('panel, comprobantes y CSV privados');
  const login=await api('/api/session',{method:'POST',body:{key}});
  assert.equal(login.response.status,200);
  const setCookie=login.response.headers.get('set-cookie');assert.ok(setCookie.includes('HttpOnly'));assert.ok(setCookie.includes('SameSite=Strict'));
  cookie=setCookie.split(';')[0];
  const before=await api('/api/admin');assert.equal(before.body.count,0,'No correr contra una base con participantes');original=before.body.config;
  assert.equal(original.open,false,'No correr si las reservas ya están abiertas');ok('sesión privada y base de pruebas vacía');
  const c={...original,alias:'test.no.transferir',holder:'DATOS DE PRUEBA',phone:'5492245000000',date:'PRUEBA LOCAL',mechanism:'Prueba de sorteo',optionalPrize:'Prueba de opción',rules:'Prueba técnica, sin pagos reales',numberingConfirmed:true,start:0,open:true,reservationHours:48};
  assert.equal((await settings({...c,mechanism:''})).response.status,400);
  assert.equal((await settings(c)).response.status,200);
  assert.equal((await settings({...c,start:1})).response.status,200);
  assert.equal((await settings(c)).response.status,200);ok('ambas numeraciones antes de solicitudes y requisitos de apertura');
  const alice=attempt([7,8]),bob=attempt([7,9],'5492245000002');
  const race=await Promise.all([api('/api/reserve',{method:'POST',body:form(alice)}),api('/api/reserve',{method:'POST',body:form(bob)})]);
  assert.equal(race.filter(r=>r.response.status===201).length,1);
  assert.equal(race.filter(r=>r.response.status===409).length,1);
  const winner=race[0].response.status===201?alice:bob,winnerResult=race.find(r=>r.response.status===201);
  assert.equal(winnerResult.body.request.total,20000);ok('concurrencia real SQLite y almacenamiento privado y precio alterado ignorado');
  const double=await Promise.all([api('/api/reserve',{method:'POST',body:form(winner)}),api('/api/reserve',{method:'POST',body:form(winner)})]);
  assert.ok(double.every(r=>r.response.status===200));assert.ok(double.every(r=>r.body.request.id===winner.id));ok('doble envío idempotente');
  const changed=await api('/api/reserve',{method:'POST',body:form(winner,{name:'Otra persona'})});
  assert.equal(changed.response.status,409);
  const stolen=await api('/api/reserve',{method:'POST',body:form({...winner,code:randomBytes(32).toString('hex')})});
  assert.equal(stolen.response.status,409);ok('un código ajeno o datos distintos no reutilizan la solicitud');
  assert.equal((await settings({...c,start:1})).response.status,409);
  assert.equal((await settings({...c,numberingConfirmed:false})).response.status,400);ok('numeración bloqueada tras solicitudes');
  const invalid=attempt([10],'5492245000003');
  assert.equal((await api('/api/reserve',{method:'POST',body:form(invalid,{bytes:Buffer.from('<script>bad</script>')})})).response.status,400);
  assert.equal((await api('/api/reserve',{method:'POST',body:form(invalid,{bytes:Buffer.alloc(5000001)})})).response.status,400);ok('formato y límite de comprobantes');
  const large=attempt([13],'5492245000006'),largeBytes=Buffer.alloc(5_000_000);png.copy(largeBytes);
  const big=await api('/api/reserve',{method:'POST',body:form(large,{bytes:largeBytes})});
  assert.equal(big.response.status,201);assert.equal((await api('/api/admin',{method:'POST',body:{action:'reject',id:large.id}})).response.status,200);ok('comprobante de 5 MB permitido');
  const lookup=await api('/api/status',{method:'POST',body:{code:winner.code},authenticated:false});
  assert.equal(lookup.body.request.status,'pending');assert.equal(lookup.body.request.name,undefined);assert.equal(lookup.body.request.phone,undefined);
  assert.equal((await api('/api/status',{method:'POST',body:{code:randomBytes(32).toString('hex')},authenticated:false})).response.status,404);ok('consulta privada sin datos personales');
  const receipt=await fetch(base+'/api/receipt?id='+winner.id,{headers:{Cookie:cookie}});
  assert.equal(receipt.status,200);assert.equal(receipt.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await receipt.arrayBuffer()),png);ok('comprobante persistido y descargable sólo con sesión');
  assert.equal((await api('/api/admin',{method:'POST',body:{action:'approve',id:winner.id}})).response.status,200);
  assert.equal((await api('/api/admin',{method:'POST',body:{action:'reject',id:winner.id}})).response.status,409);
  assert.equal((await api('/api/status',{method:'POST',body:{code:winner.code}})).body.request.status,'approved');ok('aprobación y estado final protegido');
  const single=attempt([11],'5492245000004');
  const one=await api('/api/reserve',{method:'POST',body:form(single)});
  assert.equal(one.response.status,201);assert.equal(one.body.request.total,12000);
  assert.equal((await api('/api/admin',{method:'POST',body:{action:'reject',id:single.id}})).response.status,200);
  const publicResult=await api('/api/public');
  assert.equal(publicResult.body.tickets.some(t=>t.number===11),false);ok('un número $12000 y rechazo libera');
  const expiring=attempt([12],'5492245000005');
  assert.equal((await api('/api/reserve',{method:'POST',body:form(expiring)})).response.status,201);
  const local=localDatabase();
  local.prepare('UPDATE requests SET expires=? WHERE id IN (?,?)').run(Date.now()-10000,expiring.id,winner.id);local.close();
  const expired=await api('/api/public');
  assert.equal(expired.body.tickets.some(t=>t.number===12),false);
  assert.equal(expired.body.tickets.filter(t=>winner.numbers.includes(t.number)&&t.status==='approved').length,2);
  assert.equal((await api('/api/status',{method:'POST',body:{code:expiring.code}})).body.request.status,'expired');
  assert.equal((await api('/api/admin',{method:'POST',body:{action:'approve',id:expiring.id}})).response.status,409);ok('vencimiento libera pendientes y conserva aprobados');
  for(const q of ['Participante','5492245','07']){
    const result=await api('/api/admin?q='+q+'&status=approved');assert.equal(result.body.count,1);
  }
  const summary=(await api('/api/admin')).body.summary;
  assert.equal(summary.approvedAmount,20000);assert.equal(summary.pendingAmount,0);ok('búsqueda por nombre, teléfono y número; resumen global');
  for(const type of ['participants','numbers','payments']){
    const csv=await api('/api/export?type='+type);assert.equal(csv.response.status,200);assert.ok(csv.body.includes('20000')||type==='numbers');
  }ok('exportaciones CSV');
  assert.equal((await api('/api/admin',{method:'POST',body:{action:'settings',config:c},headers:{Origin:'https://evil.example'}})).response.status,403);ok('protección de origen');
  const logout=await api('/api/session',{method:'DELETE'}); assert.equal(logout.response.status,200,JSON.stringify(logout.body));
  assert.equal((await api('/api/admin')).response.status,401);ok('cerrar sesión invalida cookie');
  for(let i=0;i<4;i++)assert.equal((await api('/api/session',{method:'POST',body:{key:'incorrecta'}})).response.status,401);
  assert.equal((await api('/api/session',{method:'POST',body:{key:'incorrecta'}})).response.status,429);ok('protección de cinco intentos de ingreso');
  console.log('Pruebas HTTP completas: aprobadas.');
}finally{
  if(original){
    const local=localDatabase();const objects=[];
    try{
      for(const id of ids){
        const row=local.prepare('SELECT receipt FROM requests WHERE id=?').get(id);
        if(row)objects.push(row.receipt);
      }
      local.exec('BEGIN IMMEDIATE');
      for(const id of ids){local.prepare('DELETE FROM tickets WHERE request_id=?').run(id);local.prepare('DELETE FROM requests WHERE id=?').run(id);}
      if(local.prepare('SELECT COUNT(*) AS n FROM requests').get().n===0)local.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(original));
      local.exec('COMMIT');
      const subjects=[['login',ip],['reserve-ip',ip],['lookup',ip],...['5492245000001','5492245000002','5492245000003','5492245000004','5492245000005','5492245000006'].map(p=>['reserve-phone',p])];
      for(const [scope,subject] of subjects)local.prepare('DELETE FROM rate_limits WHERE key=?').run(createHash('sha256').update(key+':'+scope+':'+subject).digest('hex'));
      if(cookie)local.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(createHash('sha256').update(key+':session:'+cookie.slice(13)).digest('hex'));
    }finally{local.close();}
    for(const object of objects)unlinkSync('.data/state/'+object);
    console.log('Datos temporales eliminados; configuración inicial restaurada.');
  }
}