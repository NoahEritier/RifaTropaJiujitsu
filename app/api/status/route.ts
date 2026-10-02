import { BodyError, clientIp, consumeLimit, db, digest, expireReservations, fail, json, readJson, sameOrigin } from '@/lib/raffle';
import { tokenPattern } from '@/lib/raffle-core';
export async function POST(req: Request) {
  if(!sameOrigin(req)) return json({error:'Solicitud no permitida.'},403);
  try {
    const rate = await consumeLimit('lookup',clientIp(req),20,60_000);
    if(!rate.allowed) return json({error:'Esperá un minuto antes de volver a consultar.'},429,{'Retry-After':String(rate.retry)});
    const body = await readJson(req);
    if(typeof body.code!=='string' || !tokenPattern.test(body.code)) return json({error:'Código inválido.'},400);
    await expireReservations();
    const row = await db().prepare('SELECT status,total,numbers,created,expires FROM requests WHERE token_hash=?')
      .bind(await digest(body.code)).first<{numbers:string}>();
    if(!row) return json({error:'No encontramos una solicitud con ese código.'},404);
    return json({request:{...row,numbers:JSON.parse(row.numbers)}});
  } catch(e) { return e instanceof BodyError ? json({error:e.message},e.status) : fail(e); }
}