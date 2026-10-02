import {env} from 'cloudflare:workers';
import {admin,config,db,json,fail,sameOrigin,defaults} from '@/lib/raffle';
export async function GET(req:Request){if(!admin(req))return json({error:'Clave incorrecta'},401);try{const c=await config();const r=await db().prepare('SELECT r.*, GROUP_CONCAT(t.number) AS numbers FROM requests r LEFT JOIN tickets t ON t.request_id = r.id GROUP BY r.id ORDER BY r.created DESC LIMIT 200').all();return json({config:c,requests:r.results});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!admin(req)||!sameOrigin(req))return json({error:'Acceso no permitido'},403);try{const p:any=await req.json();
if(p.action==='settings'){const old=await config();const c={...defaults};for(const k of ['alias','holder','phone','date','rules'] as const)c[k]=String(p.config[k]||'').trim().slice(0,k==='rules'?2000:200);c.start=p.config.start===0?0:1;c.numberingConfirmed=p.config.numberingConfirmed===true;c.open=p.config.open===true;
const used=await db().prepare('SELECT COUNT(*) AS n FROM requests').first<{n:number}>();if(used?.n&&c.start!==old.start)return json({error:'No se puede cambiar la numeración después de recibir solicitudes.'},409);
if(c.open&&(!c.alias||!c.holder||!c.phone||!c.date||!c.rules||!c.numberingConfirmed))return json({error:'Completá todos los datos y confirmá la numeración antes de abrir.'},400);
await db().prepare('INSERT INTO settings (id,value) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(JSON.stringify(c)).run();return json({ok:true});}
if(!['approve','reject'].includes(p.action))return json({error:'Acción inválida'},400);
const row=await db().prepare('SELECT * FROM requests WHERE id=?').bind(String(p.id)).first<{status:string,receipt:string}>();if(!row)return json({error:'Solicitud no encontrada'},404);
if(row.status!=='pending')return json({error:'La solicitud ya fue procesada.'},409);
if(p.action==='approve')await db().prepare("UPDATE requests SET status='approved' WHERE id=? AND status='pending'").bind(p.id).run();
else {await db().batch([db().prepare("DELETE FROM tickets WHERE request_id=? AND EXISTS(SELECT 1 FROM requests WHERE id=? AND status='pending')").bind(p.id,p.id),db().prepare("UPDATE requests SET status='rejected' WHERE id=? AND status='pending'").bind(p.id)]);}
return json({ok:true});}catch(e){return fail(e);}}
