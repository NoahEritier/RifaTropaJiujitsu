import {randomInt} from 'node:crypto';
import {authorize,config,db,fail,json,sameOrigin} from '@/lib/raffle';
import {insertDrawSql,type DrawResult} from '@/lib/draw-core';
export const runtime='nodejs';
async function result(){return db().prepare('SELECT winner,created,start FROM raffle_draw WHERE id=1').first<DrawResult>();}
export async function GET(req:Request){
  try{
    if(!await authorize(req))return json({error:'Ingresá a Administración.'},401);
    const c=await config();
    const count=await db().prepare("SELECT COUNT(*) AS count FROM tickets t JOIN requests r ON r.id=t.request_id WHERE r.status='approved' AND t.number BETWEEN ? AND ?").bind(c.start,c.start+99).first<{count:number}>();
    return json({approved:count?.count||0,start:c.start,result:await result()});
  }catch(e){return fail(e);}
}
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:'Acceso no permitido.'},403);
  try{
    if(!await authorize(req))return json({error:'Ingresá a Administración.'},401);
    const existing=await result();if(existing)return json({result:existing});
    const c=await config();
    const winner=c.start+randomInt(100);
    await db().batch([
      db().prepare(insertDrawSql).bind(Date.now(),c.start,winner,c.start,c.start+99,c.start),
      db().prepare("UPDATE settings SET value=json_set(value,'$.open',json('false')) WHERE id=1 AND EXISTS(SELECT 1 FROM raffle_draw)"),
    ]);
    const saved=await result();
    if(!saved)return json({error:'El sorteo requiere los 100 números con pagos aprobados y la numeración confirmada.'},409);
    return json({result:saved});
  }catch(e){return fail(e);}
}
