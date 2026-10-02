import './sites-env.mjs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const config=fileURLToPath(new URL('../dist/server/wrangler.json',import.meta.url));
const secrets=fileURLToPath(new URL('../.dev.vars',import.meta.url));
if(!existsSync(config))throw Error('Primero ejecutá npm run build.');
if(!existsSync(secrets))throw Error('Primero ejecutá npm run local:setup.');
// Pass only the filename, never a secret value. Nothing is copied into dist/.
const child=spawn(process.execPath,[
  '--import',new URL('./sites-env.mjs',import.meta.url).href,
  fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),
  'dev','--config',config,'--env-file',secrets,'--local','--persist-to','.wrangler/state',
  '--ip','127.0.0.1','--inspector-port','0',...process.argv.slice(2),
],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});