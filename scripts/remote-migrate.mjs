import { createClient } from '@libsql/client/web';
import { readFileSync, readdirSync } from 'node:fs';
const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
if(!url||!authToken)throw Error('Configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en un archivo de entorno privado.');
const client=createClient({url,authToken});
try {
  await client.execute('CREATE TABLE IF NOT EXISTS __rifa_migrations(name TEXT PRIMARY KEY)');
  for(const name of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort()) {
    const known=await client.execute({sql:'SELECT name FROM __rifa_migrations WHERE name=?',args:[name]});
    if(known.rows.length)continue;
    const transaction=await client.transaction('write');
    try {
      await transaction.executeMultiple(readFileSync('drizzle/'+name,'utf8'));
      await transaction.execute({sql:'INSERT INTO __rifa_migrations(name) VALUES(?)',args:[name]});
      await transaction.commit();console.log('Migración aplicada:',name);
    } catch(error) {await transaction.rollback();throw error;}finally{transaction.close();}
  }
} finally {client.close();}