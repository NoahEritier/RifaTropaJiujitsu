import {env} from 'cloudflare:workers';
export const defaults={alias:'',holder:'',phone:'',date:'',rules:'',start:1,numberingConfirmed:false,open:false};
export function db(){if(!env.DB)throw Error('Base de datos no disponible');return env.DB;}
export async function config(){const row=await db().prepare('SELECT value FROM settings WHERE id = 1').first<{value:string}>();return row?{...defaults,...JSON.parse(row.value)}:defaults;}
export function ready(c:typeof defaults){return Boolean(c.open&&c.alias&&c.holder&&c.phone&&c.date&&c.rules&&c.numberingConfirmed);}
export function admin(req:Request){const key=(env as unknown as {ADMIN_KEY?:string}).ADMIN_KEY;return !!key&&req.headers.get('Authorization')===`Bearer ${key}`;}
export function sameOrigin(req:Request){const origin=req.headers.get('Origin');return origin===new URL(req.url).origin;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function fail(e:unknown){console.error(e);return json({error:'No pudimos completar la operación. Volvé a intentar.'},503);}
