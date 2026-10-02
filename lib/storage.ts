import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { get, del } from '@vercel/blob';
export const remoteStorage = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const receiptPathPattern = /^receipts\/[a-f0-9-]{36}\/[a-f0-9]{64}\/[a-f0-9-]{36}$/;
function localPath(path: string) {
  if(!receiptPathPattern.test(path)) throw Error('Invalid receipt path');
  if(process.env.VERCEL || process.env.NODE_ENV==='production' && !process.env.ALLOW_LOCAL_DATA) throw Error('Persistent storage not configured');
  const root=resolve('.data/state'),target=resolve(root,path),rel=relative(root,target);
  if(rel.startsWith('..')||isAbsolute(rel)) throw Error('Invalid receipt path');
  return target;
}
export async function putReceipt(path: string, bytes: Uint8Array) {
  const target=localPath(path); await mkdir(dirname(target),{recursive:true});
  await writeFile(target,bytes,{flag:'wx',mode:0o600});
}
export async function getReceipt(path: string) {
  if(!receiptPathPattern.test(path)) throw Error('Invalid receipt path');
  if(remoteStorage()) {
    const result=await get(path,{access:'private',useCache:false});
    return result?.statusCode===200 ? result.stream : null;
  }
  try { return new Uint8Array(await readFile(localPath(path))); }
  catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export async function deleteReceipt(path: string) {
  if(!receiptPathPattern.test(path))throw Error('Invalid receipt path');
  if(remoteStorage()) {await del(path);return;}
  try {await unlink(localPath(path));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}