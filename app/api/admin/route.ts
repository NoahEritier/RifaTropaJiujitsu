import { remoteStorage } from '@/lib/storage';
import { authorize, BodyError, config, db, expireReservations, fail, json, readJson, sameOrigin } from '@/lib/raffle';
import { idPattern, parseConfig } from '@/lib/raffle-core';
export async function GET(req: Request) {
  try {
    if(!await authorize(req)) return json({error:'Ingresá a Administración.'},401);
    await expireReservations();
    const url = new URL(req.url);
    const search = (url.searchParams.get('q') || '').trim().slice(0,100);
    const status = url.searchParams.get('status') || '';
    if(status && !['pending','approved','rejected','expired'].includes(status)) return json({error:'Estado inválido.'},400);
    const page = Math.max(1,Math.min(100000,Number(url.searchParams.get('page')) || 1));
    const where = "WHERE (?='' OR r.status=?) AND (?='' OR instr(lower(r.name),lower(?))>0 OR instr(r.phone,?)>0 OR EXISTS(SELECT 1 FROM json_each(r.numbers) n WHERE CAST(n.value AS INTEGER)=CAST(? AS INTEGER) AND ? GLOB '[0-9]*'))";
    const params = [status,status,search,search,search,search,/^\d+$/.test(search)?search:''];
    const rows = await db().prepare('SELECT r.id,r.name,r.phone,r.total,r.status,r.numbers,r.created,r.expires FROM requests r '+where+' ORDER BY r.created DESC,r.id LIMIT 50 OFFSET ?')
      .bind(...params,(Math.floor(page)-1)*50).all();
    const count = await db().prepare('SELECT COUNT(*) AS count FROM requests r '+where).bind(...params).first<{count:number}>();
    const summary = await db().prepare("SELECT COUNT(*) AS totalRequests, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pendingCount, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approvedCount, COALESCE(SUM(CASE WHEN status='pending' THEN total ELSE 0 END),0) AS pendingAmount, COALESCE(SUM(CASE WHEN status='approved' THEN total ELSE 0 END),0) AS approvedAmount FROM requests").first();
    const locked = await db().prepare('SELECT 1 AS used FROM requests LIMIT 1').first();
    return json({config:await config(),requests:rows.results,summary,numberingLocked:!!locked,page:Math.floor(page),count:count?.count||0});
  } catch(e) { return fail(e); }
}
export async function POST(req: Request) {
  if(!sameOrigin(req)) return json({error:'Acceso no permitido.'},403);
  try {
    if(!await authorize(req)) return json({error:'Ingresá a Administración.'},401);
    const body = await readJson(req);
    await expireReservations();
    if(body.action==='settings') {
      let c;
      try { c = parseConfig(body.config); } catch(e) { return json({error:(e as Error).message},400); }
      if(c.open && await db().prepare('SELECT 1 FROM raffle_draw WHERE id=1').first())return json({error:'El sorteo ya terminó. No se pueden reabrir reservas.'},400);
      if(c.open && process.env.VERCEL && !remoteStorage())return json({error:'Configurá el almacenamiento privado antes de abrir reservas.'},400);
      const old = await config();
      const used = await db().prepare('SELECT 1 FROM requests LIMIT 1').first();
      if(used && (c.start!==old.start || !c.numberingConfirmed))
        return json({error:'La numeración queda bloqueada después de recibir la primera solicitud, incluso si vence o se rechaza.'},409);
      try {
        await db().prepare('INSERT INTO settings(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(JSON.stringify(c)).run();
      } catch(e) {
        const locked = await db().prepare('SELECT 1 FROM requests LIMIT 1').first();
        if(locked && (c.start!==(await config()).start || !c.numberingConfirmed)) return json({error:'Llegó una solicitud mientras guardabas. La numeración ya está bloqueada.'},409);
        return fail(e);
      }
      return json({ok:true});
    }
    if(!['approve','reject'].includes(String(body.action)) || typeof body.id!=='string' || !idPattern.test(body.id))
      return json({error:'Acción inválida.'},400);
    const next = body.action==='approve' ? 'approved' : 'rejected';
    const result = await db().prepare("UPDATE requests SET status=? WHERE id=? AND status='pending' AND expires>?")
      .bind(next,body.id,Date.now()).run();
    if(!result.meta.changes) return json({error:'La solicitud ya fue procesada o venció. Actualizá la lista.'},409);
    return json({ok:true});
  } catch(e) { return e instanceof BodyError ? json({error:e.message},e.status) : fail(e); }
}