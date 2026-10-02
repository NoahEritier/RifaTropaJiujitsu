import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { BodyError, config, consumeLimit, clientIp, digest, json, readJson, ready, sameOrigin } from '@/lib/raffle';
import { idPattern, tokenPattern, MAX_FILE_BYTES } from '@/lib/raffle-core';
import { receiptPathPattern, remoteStorage } from '@/lib/storage';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    if(!remoteStorage()) return json({error:'Almacenamiento privado no configurado.'},503);
    const body=await readJson(req);
    if(body.type!=='blob.generate-client-token' && body.type!=='blob.upload-completed') return json({error:'Solicitud inválida.'},400);
    if(body.type==='blob.generate-client-token' && !sameOrigin(req))return json({error:'Acceso no permitido.'},403);
    const result=await handleUpload({request:req,body:body as unknown as HandleUploadBody,
      onBeforeGenerateToken:async(pathname,payload)=>{
        const data=JSON.parse(payload||'{}') as {id?:string;code?:string};
        if(!data.id || !idPattern.test(data.id) || !data.code || !tokenPattern.test(data.code) || !receiptPathPattern.test(pathname)
          || !pathname.startsWith('receipts/'+data.id+'/'+await digest(data.code)+'/')) throw new BodyError('Código de comprobante inválido.');
        if(!ready(await config()))throw new BodyError('Las reservas no están habilitadas.',409);
        if(!(await consumeLimit('upload',clientIp(req),4,60_000)).allowed)throw new BodyError('Esperá un minuto antes de cargar otro comprobante.',429);
        return {allowedContentTypes:['image/jpeg','image/png','application/pdf'],maximumSizeInBytes:MAX_FILE_BYTES,validUntil:Date.now()+10*60_000,
          addRandomSuffix:false,allowOverwrite:false};
      },
      // handleUpload validates the signed provider callback; it does not approve payments.
      onUploadCompleted:async()=>{},
    });
    return json(result);
  } catch(error) {
    return error instanceof BodyError ? json({error:error.message},error.status) : json({error:'No se pudo autorizar la carga. Conservamos tu formulario; reintentá.'},400);
  }
}