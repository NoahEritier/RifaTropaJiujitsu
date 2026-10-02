import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Database} from '../lib/database.ts';
import {getReceipt,receiptPathPattern} from '../lib/storage.ts';
async function fixture(work) {
  const directory=mkdtempSync(join(tmpdir(),'rifa-next-'));
  const db=new Database(undefined,undefined,join(directory,'state.sqlite'));
  try {await db.prepare('CREATE TABLE tickets(number INTEGER PRIMARY KEY, owner TEXT NOT NULL)').run();await work(db);}
  finally {db.close();rmSync(directory,{recursive:true,force:true});}
}
test('adapter exposes exact update counts for final-state protection',()=>fixture(async db=>{
  assert.equal((await db.prepare('INSERT INTO tickets VALUES(?,?)').bind(7,'one').run()).meta.changes,1);
  assert.equal((await db.prepare('UPDATE tickets SET owner=? WHERE number=?').bind('two',7).run()).meta.changes,1);
  assert.equal((await db.prepare('UPDATE tickets SET owner=? WHERE number=?').bind('two',8).run()).meta.changes,0);
  assert.equal((await db.prepare('SELECT * FROM tickets WHERE number=?').bind(7).first()).owner,'two');
}));
test('failed batch rolls back all numbers, preserving a concurrent winner',()=>fixture(async db=>{
  await db.prepare('INSERT INTO tickets VALUES(?,?)').bind(7,'winner').run();
  await assert.rejects(db.batch([db.prepare('INSERT INTO tickets VALUES(?,?)').bind(8,'loser'),db.prepare('INSERT INTO tickets VALUES(?,?)').bind(7,'loser')]));
  assert.deepEqual((await db.prepare('SELECT number,owner FROM tickets ORDER BY number').all()).results.map(row=>({...row})),[{number:7,owner:'winner'}]);
}));
test('unconfigured Vercel never falls back to an ephemeral local database',async()=>{
  const previous=process.env.VERCEL;process.env.VERCEL='1';const db=new Database();
  try{await assert.rejects(db.prepare('SELECT 1').all(),/Persistent database/);}finally{if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;db.close();}
});
test('receipt paths reject traversal and arbitrary remote URLs',async()=>{
  for(const path of ['../.env.local','https://attacker.example/file','receipts/../../file']) {
    assert.equal(receiptPathPattern.test(path),false);await assert.rejects(getReceipt(path),/Invalid receipt path/);
  }
});