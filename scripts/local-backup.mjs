import { cp, mkdir, readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join, isAbsolute } from 'node:path';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
process.chdir(root);
const [mode,target]=process.argv.slice(2);
if(!['create','restore'].includes(mode))throw Error('Uso: node scripts/local-backup.mjs create | restore backups/<carpeta>');
const port=Number(process.env.LOCAL_PORT||5173);
const running=await new Promise(resolveResult=>{
  const socket=connect({host:'127.0.0.1',port});
  socket.once('connect',()=>{socket.destroy();resolveResult(true);});
  socket.once('error',()=>resolveResult(false));
});
if(running)throw Error('Detené la página local antes del respaldo o la recuperación. LOCAL_PORT permite indicar otro puerto.');
const state=resolve(root,process.env.LOCAL_DATA_DIR || '.data/state'),backupRoot=resolve(root,'backups');
const lockHash=createHash('sha256').update(await readFile('pnpm-lock.yaml')).digest('hex');
function inside(base,path) {const rel=relative(base,path);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);}
async function inventory(base,directory='') {
  const files=[];
  for(const entry of await readdir(join(base,directory),{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isSymbolicLink())throw Error('El respaldo no admite enlaces simbólicos.');
    if(entry.isDirectory())files.push(...await inventory(base,path));
    else if(entry.isFile()){
      const bytes=await readFile(join(base,path));
      files.push({path:path.replaceAll('\\','/'),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
if(mode==='create'){
  await stat(state);
  const folder=join(backupRoot,new Date().toISOString().replaceAll(/[:.]/g,'-'));
  await mkdir(folder,{recursive:true});
  await cp(state,join(folder,'state'),{recursive:true,errorOnExist:true,force:false});
  await writeFile(join(folder,'manifest.json'),JSON.stringify({
    version:1,created:new Date().toISOString(),node:process.version,lockHash,
    files:await inventory(join(folder,'state')),
  },null,2));
  console.log('Respaldo completo de base y comprobantes:',relative(root,folder));
}else{
  if(!target)throw Error('Indicá la carpeta del respaldo.');
  const folder=resolve(root,target);
  if(!inside(backupRoot,folder))throw Error('El respaldo debe estar dentro de backups/.');
  const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
  if(manifest.version!==1||manifest.lockHash!==lockHash)throw Error('El respaldo pertenece a otra versión de dependencias. Recuperá con el mismo lockfile.');
  if(JSON.stringify(await inventory(join(folder,'state')))!==JSON.stringify(manifest.files))throw Error('El respaldo está incompleto o fue modificado.');
  const stage=resolve(root,'.data/restored-'+Date.now());
  if(!inside(resolve(root,'.data'),state)||!inside(resolve(root,'.data'),stage))throw Error('Destino de recuperación inválido.');
  await cp(join(folder,'state'),stage,{recursive:true,errorOnExist:true,force:false});
  let previous='';
  try{await stat(state);previous=resolve(root,'.data/previous-'+Date.now());await rename(state,previous);}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(stage,state);}catch(e){if(previous)await rename(previous,state);throw e;}
  console.log('Respaldo recuperado. El estado anterior quedó preservado en',previous||'(no existía)');
}