import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const state=process.env.LOCAL_DATA_DIR || '.data/state';
mkdirSync(state+'/receipts',{recursive:true});
let environment=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
if(!/^ADMIN_KEY=/m.test(environment)) {
  const prior=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8').match(/ADMIN_KEY\s*=\s*"([^"\r\n]{32,})"/)?.[1]:null;
  environment+='\nADMIN_KEY="'+(prior||randomBytes(32).toString('hex'))+'"\n';
  writeFileSync('.env.local',environment,{mode:0o600});
}
const adminKey=environment.match(/^ADMIN_KEY\s*=\s*["']?([^"'\r\n]+)/m)?.[1];
if(!adminKey || adminKey.length<32 || adminKey.startsWith('replace-'))throw Error('ADMIN_KEY debe tener al menos 32 caracteres aleatorios en .env.local.');
const database=new DatabaseSync(state+'/database.sqlite');
database.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS __rifa_migrations(name TEXT PRIMARY KEY);');
for(const name of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort()) {
  if(database.prepare('SELECT name FROM __rifa_migrations WHERE name=?').get(name))continue;
  database.exec('BEGIN IMMEDIATE');
  try {database.exec(readFileSync('drizzle/'+name,'utf8'));database.prepare('INSERT INTO __rifa_migrations VALUES(?)').run(name);database.exec('COMMIT');}
  catch(error){database.exec('ROLLBACK');throw error;}
}
database.close();
console.log('Base SQLite y comprobantes privados listos en '+state+'. Clave en .env.local; no se imprime.');
console.log('Ejecutá npm run dev y abrí http://127.0.0.1:5173.');