import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
mkdirSync('.sites-runtime',{recursive:true});
if (!existsSync('.sites-runtime/execution-profile.json'))
  writeFileSync('.sites-runtime/execution-profile.json',JSON.stringify({executionProfile:'portable'}));
if (!existsSync('.dev.vars'))
  writeFileSync('.dev.vars','# Clave privada de desarrollo. No subir a Git.\nADMIN_KEY="'+randomBytes(32).toString('hex')+'"\n',{mode:0o600});
if (!/ADMIN_KEY\s*=\s*["']?[^\r\n"']{32,}/.test(readFileSync('.dev.vars','utf8')))
  throw new Error('Definí ADMIN_KEY con al menos 32 caracteres en .dev.vars.');
const result=spawnSync(process.execPath,[
  '--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js',
  'd1','migrations','apply','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state',
],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
console.log('Base de datos lista. Comprobantes privados en .wrangler/state. Clave local en .dev.vars (no se imprime).');
console.log('Ejecutá npm run dev y abrí http://localhost:5173. Configurá el sorteo desde /admin.');