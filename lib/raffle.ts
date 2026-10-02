import { env } from 'cloudflare:workers';
import { defaults, MAX_BODY_BYTES, type RaffleConfig } from './raffle-core';
export { defaults, ready, price } from './raffle-core';
export function db() {
  if (!env.DB) throw new Error('Database unavailable');
  return env.DB;
}
export async function config(): Promise<RaffleConfig> {
  const row = await db().prepare('SELECT value FROM settings WHERE id=1').first<{value:string}>();
  return row ? { ...defaults, ...JSON.parse(row.value) } : { ...defaults };
}
export const privateHeaders = {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
export function json(data: unknown, status = 200, headers: Record<string,string> = {}) {
  return Response.json(data, { status, headers: { ...privateHeaders, ...headers } });
}
export function fail(error: unknown) {
  // Never log form data, secret codes, personal details or receipt paths.
  console.error('Raffle operation failed:', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'No pudimos completar la operación. Tus datos y tu selección se conservan; volvé a intentar.' }, 503);
}
export function sameOrigin(req: Request) {
  return req.headers.get('Origin') === new URL(req.url).origin
    && req.headers.get('Sec-Fetch-Site') !== 'cross-site';
}
export async function digest(value: string | Uint8Array) {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}
export function secret() {
  const key = env.ADMIN_KEY;
  if (!key || key.length < 32 || key.startsWith('replace-')) throw new Error('Admin secret not configured');
  return key;
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2,'0')).join('');
}
export async function consumeLimit(scope: string, subject: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = await digest(secret() + ':' + scope + ':' + subject);
  const row = await db().prepare(
    'INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count,reset_at'
  ).bind(key, now + windowMs, now, now).first<{count:number;reset_at:number}>();
  return { allowed: !!row && row.count <= limit, retry: Math.max(1, Math.ceil(((row?.reset_at ?? now + windowMs) - now)/1000)) };
}
export function clientIp(req: Request) {
  // Trust only the edge-provided address; do not trust arbitrary X-Forwarded-For.
  return req.headers.get('CF-Connecting-IP') || 'local';
}
export async function authorize(req: Request) {
  const cookie = req.headers.get('Cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('raffle_admin='))?.slice(13);
  if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) return false;
  const hash = await digest(secret() + ':session:' + cookie);
  return !!await db().prepare('SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires>?').bind(hash,Date.now()).first();
}
export function sessionCookie(req: Request, token: string, maxAge = 14400) {
  return 'raffle_admin=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge
    + (new URL(req.url).protocol === 'https:' ? '; Secure' : '');
}
export async function expireReservations() {
  await db().batch([
    db().prepare("UPDATE requests SET status='expired' WHERE status='pending' AND expires<=?").bind(Date.now()),
    db().prepare('DELETE FROM admin_sessions WHERE expires<=?').bind(Date.now()),
    db().prepare('DELETE FROM rate_limits WHERE reset_at<=?').bind(Date.now()),
  ]);
}
export async function boundedBody(req: Request, max = MAX_BODY_BYTES) {
  const length = Number(req.headers.get('Content-Length') || 0);
  if (length > max) throw new BodyError('El envío supera el tamaño permitido.', 413);
  if (!req.body) throw new BodyError('La solicitud está vacía.', 400);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > max) { await reader.cancel(); throw new BodyError('El envío supera el tamaño permitido.', 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}
export class BodyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export async function readJson(req: Request) {
  try { const value: unknown = JSON.parse(new TextDecoder().decode(await boundedBody(req,16_000))); if(!value || typeof value !== 'object' || Array.isArray(value)) throw new BodyError('Solicitud inválida.'); return value as Record<string,unknown>; }
  catch (e) { if (e instanceof BodyError) throw e; throw new BodyError('El contenido enviado no es válido.'); }
}