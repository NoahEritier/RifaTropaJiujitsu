import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
const db=new DatabaseSync(workerData.path);
db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');
try{
  db.exec('BEGIN IMMEDIATE');
  const now=Date.now();
  db.prepare('INSERT INTO requests(id,name,phone,total,status,receipt,mime,created,token_hash,fingerprint,numbers,expires) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(workerData.id,'Participante','5492245000000',20000,'pending','test-object','image/png',now,workerData.id,workerData.id,JSON.stringify(workerData.numbers),now+3600000);
  for(const n of workerData.numbers)db.prepare('INSERT INTO tickets(number,request_id) VALUES(?,?)').run(n,workerData.id);
  db.exec('COMMIT');parentPort.postMessage({ok:true,id:workerData.id});
}catch{
  db.exec('ROLLBACK');parentPort.postMessage({ok:false,id:workerData.id});
}finally{db.close();}