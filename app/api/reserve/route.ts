import { deleteReceipt, getReceipt, putReceipt, receiptPathPattern, remoteStorage } from '@/lib/storage';
import { BodyError, boundedBody, clientIp, config, consumeLimit, db, digest, expireReservations, fail, json, readJson, ready, sameOrigin } from '@/lib/raffle';
import { detectMime, idPattern, MAX_FILE_BYTES, price, tokenPattern, validateParticipant } from '@/lib/raffle-core';
type Existing = {id:string;total:number;numbers:string;expires:number;token_hash:string;fingerprint:string;status:string;receipt:string};
const publicRequest = (row: Existing) => ({id:row.id,total:row.total,numbers:JSON.parse(row.numbers),expires:row.expires,status:row.status});
export async function POST(req: Request) {
  if(!sameOrigin(req)) return json({error:'Solicitud no permitida.'},403);
  if(process.env.VERCEL && !remoteStorage())return json({error:'Las reservas esperan la configuración del almacenamiento privado.'},503);
  let uploaded = '';
  try {
    const edgeRate = await consumeLimit('reserve-ip',clientIp(req),20,60_000);
    if(!edgeRate.allowed) return json({error:'Demasiados envíos. Esperá un minuto y reintentá.'},429,{'Retry-After':String(edgeRate.retry)});
    let form: FormData;
    if(req.headers.get('Content-Type')?.includes('application/json')) {
      if(!remoteStorage())return json({error:'Tipo de envío no disponible.'},400);
      const body=await readJson(req); form=new FormData();
      for(const key of ['id','code','name','phone','receiptPath','mime'])form.set(key,String(body[key]||''));
      form.set('numbers',JSON.stringify(body.numbers));
    } else {
      const bytes=await boundedBody(req);
      try { form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type') || ''}}).formData(); }
      catch { return json({error:'No se pudo leer el formulario. Volvé a adjuntar tu comprobante.'},400); }
    }
    const id = String(form.get('id') || '');
    const token = String(form.get('code') || '');
    if(!idPattern.test(id) || !tokenPattern.test(token)) return json({error:'Código de solicitud inválido. Recargá la página.'},400);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').replace(/\D/g,'');
    let numbers: unknown;
    try { numbers = JSON.parse(String(form.get('numbers') || '[]')); }
    catch { return json({error:'Selección inválida.'},400); }
    const c = await config();
    try { validateParticipant(name,phone,numbers,c.start); }
    catch(e) { return json({error:(e as Error).message},400); }
    numbers.sort((a,b)=>a-b);
    const tokenHash=await digest(token);
    const path=String(form.get('receiptPath')||'');
    let fileBytes: Uint8Array,declaredMime: string;
    if(remoteStorage()) {
      if(!receiptPathPattern.test(path) || !path.startsWith('receipts/'+id+'/'+tokenHash+'/')) return json({error:'Comprobante inválido para esta solicitud.'},400);
      const object=await getReceipt(path);
      if(!object || object instanceof Uint8Array)return json({error:'No se encontró el comprobante privado. Volvé a cargarlo.'},400);
      fileBytes=await boundedBody({body:object,headers:new Headers()} as Request,MAX_FILE_BYTES);
      declaredMime=String(form.get('mime')||'');
    } else {
      const file=form.get('receipt');
      if(!(file instanceof File) || !file.size || file.size>MAX_FILE_BYTES)return json({error:'Adjuntá un comprobante JPG, PNG o PDF de hasta 5 MB.'},400);
      fileBytes=new Uint8Array(await file.arrayBuffer());declaredMime=file.type;
    }
    const mime=detectMime(fileBytes);
    if(!mime || mime!==declaredMime)return json({error:'El contenido no coincide con un JPG, PNG o PDF válido.'},400);
    const fingerprint = await digest(JSON.stringify([name,phone,numbers,await digest(fileBytes)]));
    await expireReservations();
    const existing = await db().prepare('SELECT * FROM requests WHERE id=?').bind(id).first<Existing>();
    if(existing) {
      if(existing.token_hash!==tokenHash || existing.fingerprint!==fingerprint)
        return json({error:'Este envío ya se usó con otros datos. Consultá tu código o iniciá una nueva solicitud.'},409);
      return json({request:publicRequest(existing)});
    }
    if(!ready(c)) return json({error:'Las reservas no están habilitadas.'},409);
    const rate = await consumeLimit('reserve-phone',phone,3,60_000);
    if(!rate.allowed) return json({error:'Esperá un minuto antes de enviar otra solicitud.'},429,{'Retry-After':String(rate.retry)});
    uploaded = remoteStorage() ? path : 'receipts/'+id+'/'+tokenHash+'/'+crypto.randomUUID();
    if(!remoteStorage())await putReceipt(uploaded,fileBytes);
    const created = Date.now();
    const expires = created+c.reservationHours*60*60_000;
    const total = price(numbers.length);
    try {
      await db().batch([
        db().prepare('INSERT INTO requests(id,name,phone,total,status,receipt,mime,created,token_hash,fingerprint,numbers,expires) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id,name,phone,total,'pending',uploaded,mime,created,tokenHash,fingerprint,JSON.stringify(numbers),expires),
        ...numbers.map(n=>db().prepare('INSERT INTO tickets(number,request_id) VALUES(?,?)').bind(n,id)),
      ]);
    } catch(e) {
      // Check commit outcome before deleting an object: a lost DB response must not destroy its receipt.
      const winner = await db().prepare('SELECT * FROM requests WHERE id=?').bind(id).first<Existing>();
      // Keep an uploaded private Blob for retries with changed numbers after a conflict.
      if(!remoteStorage() && (!winner || winner.receipt !== uploaded)) await deleteReceipt(uploaded);
      if(winner && winner.token_hash===tokenHash && winner.fingerprint===fingerprint) return json({request:publicRequest(winner)});
      const occupied = await db().prepare('SELECT number FROM tickets WHERE number IN (?,?)').bind(numbers[0],numbers[1]??numbers[0]).all<{number:number}>();
      if(occupied.results.length) return json({error:'Alguno de tus números acaba de reservarse. Conservamos tu selección; quitá los ocupados y elegí otros.',conflicts:occupied.results.map(t=>t.number)},409);
      if(!ready(await config())) return json({error:'La organización cerró las reservas. Tus datos se conservan.'},409);
      return fail(e);
    }
    return json({request:{id,total,numbers,expires,status:'pending'}},201);
  } catch(e) {
    // Unknown database outcome: keep the object for reconciliation instead of deleting a possibly committed receipt.
    return e instanceof BodyError ? json({error:e.message},e.status) : fail(e);
  }
}