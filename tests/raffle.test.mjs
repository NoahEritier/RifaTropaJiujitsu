import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { defaults, parseConfig, ready, price, validateParticipant, detectMime, csvCell } from '../lib/raffle-core.ts';

const configured={...defaults,alias:'rifa.test',holder:'Tropa Team',phone:'5492245000000',date:'Cuando se complete la venta',mechanism:'Sorteo anunciado en vivo',optionalPrize:'El ganador elige TV o efectivo',rules:'Condiciones de prueba',numberingConfirmed:true,open:true};
const migration0=readFileSync(new URL('../drizzle/0000_early_nico_minoru.sql',import.meta.url),'utf8');
const migration1=readFileSync(new URL('../drizzle/0001_secure_reservations.sql',import.meta.url),'utf8');
function database(path=':memory:'){
  const db=new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;');
  db.exec(migration0);db.exec(migration1);db.exec(readFileSync('drizzle/0003_multiple_numbers.sql','utf8'));
  db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify(configured));
  return db;
}
function insert(db,id,numbers,{total=price(numbers.length),expires=Date.now()+3600000}={}){
  db.exec('BEGIN IMMEDIATE');
  try{
    const now=Date.now();
    db.prepare('INSERT INTO requests(id,name,phone,total,status,receipt,mime,created,token_hash,fingerprint,numbers,expires) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,'Participante','5492245000000',total,'pending','object-'+id,'image/png',now,id,id,JSON.stringify(numbers),expires);
    for(const n of numbers)db.prepare('INSERT INTO tickets(number,request_id) VALUES(?,?)').run(n,id);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
test('precios exactos y cantidades inválidas',()=>{
  assert.equal(price(1),12000);assert.equal(price(2),20000);
  assert.equal(price(3),32000);assert.equal(price(4),40000);assert.equal(price(99),992000);assert.equal(price(100),1000000);
  for(const n of [0,101,-1,1.5,NaN,Infinity])assert.throws(()=>price(n));
});
test('apertura requiere todos los datos y numeración confirmada',()=>{
  assert.equal(ready(defaults),false);assert.equal(ready(configured),true);
  for(const field of ['alias','holder','phone','date','mechanism','optionalPrize','rules'])
    assert.throws(()=>parseConfig({...configured,[field]:''}));
  assert.throws(()=>parseConfig({...configured,numberingConfirmed:false}));
  assert.throws(()=>parseConfig({...configured,reservationHours:0}));
  assert.throws(()=>parseConfig({...configured,reservationHours:721}));
});
test('ambas numeraciones, límites y números repetidos',()=>{
  validateParticipant('Persona','5492245000000',[0,99],0);
  validateParticipant('Persona','5492245000000',[1,100],1);
  validateParticipant('Persona','5492245000000',Array.from({length:100},(_,i)=>i+1),1);
  for(const numbers of [[0],[101],[1,1],[],Array.from({length:101},(_,i)=>i+1),[1.5],['1']])
    assert.throws(()=>validateParticipant('Persona','5492245000000',numbers,1));
});
test('detecta firmas y rechaza formatos falsificados',()=>{
  assert.equal(detectMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(detectMime(new Uint8Array([255,216,255])),'image/jpeg');
  assert.equal(detectMime(new TextEncoder().encode('%PDF-1.7')),'application/pdf');
  assert.equal(detectMime(new Uint8Array([137,80,78,71])),'');
  assert.equal(detectMime(new TextEncoder().encode('<script>alert(1)</script>')),'');
});
test('CSV escapa comillas y neutraliza fórmulas',()=>{
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  for(const value of ['=1+1',' +cmd','@formula','-100','\t=SUM(A1)'])
    assert.ok(csvCell(value).startsWith('"\''));assert.equal(csvCell(12000),'"12000"');
});
test('un conflicto revierte toda la reserva y no ocupa el segundo número',()=>{
  const db=database();try{
    insert(db,'first',[1]);
    assert.throws(()=>insert(db,'second',[1,2]));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE number=2').get().n,0);
  }finally{db.close();}
});
test('el servidor y la base rechazan importe alterado',()=>{
  const db=database();try{assert.throws(()=>insert(db,'cheap',[1,2],{total:1}));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,0);}finally{db.close();}
});
test('la base bloquea numeración y su desconfirmación desde la primera solicitud',()=>{
  const db=database();try{
    insert(db,'first',[1]);db.prepare("UPDATE requests SET status='rejected' WHERE id='first'").run();
    assert.throws(()=>db.prepare('UPDATE settings SET value=?').run(JSON.stringify({...configured,start:0})));
    assert.throws(()=>db.prepare('UPDATE settings SET value=?').run(JSON.stringify({...configured,numberingConfirmed:false})));
    assert.throws(()=>db.exec('DELETE FROM settings'));
    db.prepare('UPDATE settings SET value=?').run(JSON.stringify({...configured,open:false}));
  }finally{db.close();}
});
test('cierre simultáneo y selección fuera de rango no admiten reservas',()=>{
  const db=database();try{
    assert.throws(()=>insert(db,'outside',[0]));
    db.prepare('UPDATE settings SET value=?').run(JSON.stringify({...configured,open:false}));
    assert.throws(()=>insert(db,'closed',[1]));
  }finally{db.close();}
});
test('rechazar libera números, conserva historial y evita aprobar después',()=>{
  const db=database();try{
    insert(db,'first',[1,2]);
    db.prepare("UPDATE requests SET status='rejected' WHERE id='first' AND status='pending'").run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n,0);
    assert.equal(db.prepare("SELECT numbers FROM requests WHERE id='first'").get().numbers,'[1,2]');
    assert.throws(()=>db.prepare("UPDATE requests SET status='approved' WHERE id='first'").run());
    insert(db,'second',[1]);
  }finally{db.close();}
});
test('vencer pendientes nunca libera números aprobados',()=>{
  const db=database();try{
    insert(db,'pending',[1]);insert(db,'paid',[2]);
    db.prepare("UPDATE requests SET status='approved' WHERE id='paid'").run();
    db.prepare('UPDATE requests SET expires=?').run(Date.now()-1000);
    db.prepare("UPDATE requests SET status='expired' WHERE status='pending' AND expires<=?").run(Date.now());
    assert.deepEqual(db.prepare('SELECT number FROM tickets ORDER BY number').all().map(r=>r.number),[2]);
    assert.equal(db.prepare("SELECT status FROM requests WHERE id='paid'").get().status,'approved');
    assert.throws(()=>db.prepare("UPDATE requests SET status='approved' WHERE id='pending'").run());
  }finally{db.close();}
});
test('migración conserva solicitudes y números históricos existentes',()=>{
  const db=new DatabaseSync(':memory:');try{
    db.exec(migration0);
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?)').run('legacy','Nombre','12345678',12000,'pending','legacy-key','image/png',1000);
    db.prepare('INSERT INTO tickets VALUES(?,?)').run(1,'legacy');
    db.exec(migration1);
    const row=db.prepare('SELECT numbers,expires,token_hash FROM requests').get();
    assert.equal(row.numbers,'[1]');assert.equal(row.expires,172801000);assert.equal(row.token_hash,null);
  }finally{db.close();}
});
test('dos conexiones simultáneas: gana una reserva completa, sin duplicados',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'rifa-race-')),path=join(directory,'race.sqlite');
  const db=database(path);db.close();
  const run=(id,numbers)=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./reservation-worker.mjs',import.meta.url),{workerData:{path,id,numbers}});
    worker.once('message',resolve);worker.once('error',reject);
  });
  try{
    const results=await Promise.all([run('alice',[7,8]),run('bob',[7,9])]);
    assert.equal(results.filter(r=>r.ok).length,1);
    const verify=new DatabaseSync(path);
    try{
      assert.equal(verify.prepare('SELECT COUNT(*) AS n FROM requests').get().n,1);
      assert.equal(verify.prepare('SELECT COUNT(*) AS n FROM tickets').get().n,2);
      const winner=results.find(r=>r.ok);
      assert.ok(verify.prepare('SELECT request_id FROM tickets').all().every(t=>t.request_id===winner.id));
    }finally{verify.close();}
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('compras múltiples: precio por pares, aprobación de 100 números y conflicto en el tercero revierte todo',()=>{
 const db=database();try{
  insert(db,'taken',[3]);
  assert.throws(()=>insert(db,'conflict',[1,2,3]));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tickets WHERE number IN(1,2)').get().n,0);
  insert(db,'three',[10,11,12]);assert.equal(db.prepare("SELECT total FROM requests WHERE id='three'").get().total,32000);
  db.exec("UPDATE requests SET status='rejected' WHERE id IN('taken','three')");
  insert(db,'all',Array.from({length:100},(_,i)=>i+1));
  assert.equal(db.prepare("SELECT total FROM requests WHERE id='all'").get().total,1000000);
  db.exec("UPDATE requests SET status='approved' WHERE id='all'");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tickets WHERE request_id='all'").get().n,100);
 }finally{db.close();}
});
