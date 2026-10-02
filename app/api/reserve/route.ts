import {env} from 'cloudflare:workers';
import {config,db,json,fail,ready,sameOrigin} from '@/lib/raffle';
export async function POST(req:Request){let key='';let stored=false;try{
if(!sameOrigin(req))return json({error:'Solicitud no permitida'},403);
if(Number(req.headers.get('content-length')||0)>5500000)return json({error:'El comprobante debe pesar menos de 5 MB.'},413);
const c=await config();if(!ready(c))return json({error:'Las reservas todavía no están habilitadas.'},409);
const f=await req.formData();const id=String(f.get('id')||'');if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Solicitud inválida'},400);
const existing=await db().prepare('SELECT id,total FROM requests WHERE id = ?').bind(id).first();if(existing)return json({request:existing});
const name=String(f.get('name')||'').trim();const phone=String(f.get('phone')||'').replace(/\D/g,'');const numbers=JSON.parse(String(f.get('numbers')||'[]'));
if(name.length<3||name.length>100||phone.length<8||phone.length>15||!Array.isArray(numbers)||numbers.length<1||numbers.length>2||new Set(numbers).size!==numbers.length||numbers.some((n:unknown)=>!Number.isInteger(n)||Number(n)<c.start||Number(n)>c.start+99))return json({error:'Revisá tus datos y elegí uno o dos números.'},400);
const recent=await db().prepare('SELECT COUNT(*) AS n FROM requests WHERE phone = ? AND created > ?').bind(phone,Date.now()-60000).first<{n:number}>();if((recent?.n||0)>=3)return json({error:'Esperá un minuto antes de enviar otra solicitud.'},429);
const file=f.get('receipt');if(!(file instanceof File)||file.size===0||file.size>5000000)return json({error:'Adjuntá un comprobante de hasta 5 MB.'},400);
const bytes=new Uint8Array(await file.arrayBuffer());const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,5))==='%PDF-'?'application/pdf':'';
if(!mime)return json({error:'Usá un archivo JPG, PNG o PDF.'},400);if(!env.BUCKET)throw Error('Storage unavailable');
key=`receipts/${id}/${crypto.randomUUID()}`;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});stored=true;const total=numbers.length===2?20000:12000;
try{await db().batch([db().prepare('INSERT INTO requests (id,name,phone,total,status,receipt,mime,created) VALUES (?,?,?,?,?,?,?,?)').bind(id,name,phone,total,'pending',key,mime,Date.now()),...numbers.map((n:number)=>db().prepare('INSERT INTO tickets (number,request_id) VALUES (?,?)').bind(n,id))]);}catch(e){await env.BUCKET.delete(key);stored=false;console.error(e);const already=await db().prepare('SELECT id,total FROM requests WHERE id=?').bind(id).first();if(already)return json({request:already});return json({error:'Alguno de los números acaba de reservarse. Actualizá la grilla y elegí otro.'},409);}
return json({request:{id,total,numbers}},201);
}catch(e){if(stored&&env.BUCKET)await env.BUCKET.delete(key).catch(()=>{});return fail(e);}}
