import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {insertDrawSql} from '../lib/draw-core.ts';
function fixture(start=0){
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE requests(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE tickets(number INTEGER PRIMARY KEY,request_id TEXT REFERENCES requests(id));CREATE TABLE settings(id INTEGER PRIMARY KEY,value TEXT);");
 db.exec(readFileSync('drizzle/0002_raffle_draw.sql','utf8'));
 db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({start,numberingConfirmed:true,open:true}));
 for(let i=0;i<100;i++){db.prepare('INSERT INTO requests VALUES(?,?)').run('r'+i,'approved');db.prepare('INSERT INTO tickets VALUES(?,?)').run(start+i,'r'+i);}
 return db;
}
test('definitivo incluye 100 aprobados, admite 00 y guarda snapshot; doble envío no vuelve a sortear',()=>{
 const db=fixture();try{assert.equal(db.prepare(insertDrawSql).run(1,0,0,0,99,0).changes,1);assert.equal(db.prepare(insertDrawSql).run(2,0,99,0,99,0).changes,0);const d=db.prepare('SELECT * FROM raffle_draw').get();assert.equal(d.winner,0);assert.equal(JSON.parse(d.snapshot).length,100);assert.throws(()=>db.exec('DELETE FROM raffle_draw'),/draw_immutable/);assert.throws(()=>db.exec('UPDATE raffle_draw SET winner=1'),/draw_immutable/);assert.throws(()=>db.prepare('UPDATE settings SET value=?').run(JSON.stringify({start:0,open:true})),/draw_finished/);}finally{db.close();}
});
test('no sortea con pendientes o numeración distinta; numeración 1–100 incluye 100',()=>{
 const db=fixture(1);try{db.exec("UPDATE requests SET status='pending' WHERE id='r0'");assert.equal(db.prepare(insertDrawSql).run(1,1,100,1,100,1).changes,0);db.exec("UPDATE requests SET status='approved' WHERE id='r0'");assert.equal(db.prepare(insertDrawSql).run(1,0,99,0,99,0).changes,0);assert.equal(db.prepare(insertDrawSql).run(1,1,100,1,100,1).changes,1);}finally{db.close();}
});
