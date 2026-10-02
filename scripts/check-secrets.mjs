import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const git=(...args)=>{
  const result=spawnSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),...args],{encoding:'utf8',maxBuffer:20_000_000});
  if(result.status!==0)throw Error(result.stderr||'Git no disponible');
  return result.stdout;
};
const paths=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
const rules=[
  ['archivo privado',/(^|\/)(\.dev\.vars[^/]*|\.env(?!\.example$)[^/]*|[^/]+\.(pem|key|p12|pfx|sqlite|db))$/i],
  ['clave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['token de GitHub',/\bgh[pousr]_[a-zA-Z0-9]{30,}/],
  ['clave de AWS',/\bAKIA[0-9A-Z]{16}\b/],
  ['clave de API',/\bsk-(?:proj-)?[a-zA-Z0-9_-]{40,}/],
  ['clave literal de Administración',/ADMIN_KEY\s*[:=]\s*["'][a-zA-Z0-9]{32,}["']/],
];
let found=false;
for(const path of new Set(paths)){
  let source='';
  try{source=readFileSync(path,'utf8');}catch{continue;}
  for(const [label,pattern] of rules){
    if((label==='archivo privado'?pattern.test(path):pattern.test(source))){
      console.error('Revisar '+path+': '+label);found=true;
    }
  }
}
const historical=/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[a-zA-Z0-9]{30,}|AKIA[0-9A-Z]{16}|sk-(proj-)?[a-zA-Z0-9_-]{40,}/;
for(const commit of git('rev-list','--all').trim().split('\n').filter(Boolean)){
  const result=spawnSync('git',['-c','safe.directory='+process.cwd().replaceAll('\\','/'),'grep','-I','-l','-E','-e',historical.source,commit],{encoding:'utf8',maxBuffer:20_000_000});
  if(result.status===0){console.error('Posible secreto en historial:',result.stdout.trim());found=true;}
  else if(result.status!==1)throw Error('No se pudo verificar el historial.');
}
if(found)process.exitCode=1;else console.log('Sin claves detectadas en archivos publicables ni en el historial de Git. Revisión por patrones; no garantiza detectar todo secreto.');