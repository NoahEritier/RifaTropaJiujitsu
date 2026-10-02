import { authorize, boundedBody, BodyError, clientIp, consumeLimit, db, digest, fail, json, randomToken, sameOrigin, secret, sessionCookie } from '@/lib/raffle';
export async function GET(req: Request) {
  try { return await authorize(req) ? json({ok:true}) : json({error:'Ingresá a Administración.'},401); }
  catch(e) { return fail(e); }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({error:'Acceso no permitido.'},403);
  try {
    const rate = await consumeLimit('login',clientIp(req),5,15*60_000);
    if (!rate.allowed) return json({error:'Demasiados intentos. Esperá 15 minutos antes de volver a ingresar.'},429,{'Retry-After':String(rate.retry)});
    let body: {key?:unknown};
    try { body = JSON.parse(new TextDecoder().decode(await boundedBody(req,1024))); }
    catch(e) { if(e instanceof BodyError) throw e; return json({error:'Solicitud inválida.'},400); }
    if (!body || typeof body !== 'object' || typeof body.key !== 'string' || body.key.length > 256) return json({error:'Clave incorrecta.'},401);
    const [expected,actual] = await Promise.all([digest(secret()),digest(body.key)]);
    let mismatch = 0;
    for(let i=0;i<expected.length;i++) mismatch |= expected.charCodeAt(i)^actual.charCodeAt(i);
    if (mismatch) return json({error:'Clave incorrecta.'},401);
    const token = randomToken();
    await db().prepare('INSERT INTO admin_sessions(token_hash,expires) VALUES(?,?)')
      .bind(await digest(secret()+':session:'+token),Date.now()+4*60*60_000).run();
    return json({ok:true},200,{'Set-Cookie':sessionCookie(req,token)});
  } catch(e) { return e instanceof BodyError ? json({error:e.message},e.status) : fail(e); }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({error:'Acceso no permitido.'},403);
  try {
    const token = req.headers.get('Cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('raffle_admin='))?.slice(13);
    if(token) await db().prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(secret()+':session:'+token)).run();
    return json({ok:true},200,{'Set-Cookie':sessionCookie(req,'',0)});
  } catch(e) { return fail(e); }
}