import { getReceipt } from '@/lib/storage';
import { authorize, db, fail, json, privateHeaders } from '@/lib/raffle';
import { idPattern } from '@/lib/raffle-core';
export async function GET(req: Request) {
  try {
    if(!await authorize(req)) return json({error:'Ingresá a Administración.'},401);
    const id = new URL(req.url).searchParams.get('id') || '';
    if(!idPattern.test(id)) return json({error:'Solicitud inválida.'},400);
    const row = await db().prepare('SELECT receipt,mime FROM requests WHERE id=?').bind(id).first<{receipt:string;mime:string}>();
    if(!row) return json({error:'Comprobante no encontrado.'},404);
    const object = await getReceipt(row.receipt);
    if(!object) return json({error:'Comprobante no encontrado.'},404);
    const ext = row.mime==='application/pdf' ? 'pdf' : row.mime==='image/png' ? 'png' : 'jpg';
    return new Response(object as BodyInit,{headers:{...privateHeaders,'Content-Type':row.mime,'Content-Disposition':'attachment; filename="comprobante.'+ext+'"','Content-Security-Policy':"default-src 'none'; sandbox"}});
  } catch(e) { return fail(e); }
}