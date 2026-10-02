import {config,db,json,fail,ready} from '@/lib/raffle';
export async function GET(){try{const c=await config();const rows=await db().prepare('SELECT t.number, r.status FROM tickets t JOIN requests r ON r.id = t.request_id').all();return json({config:c,active:ready(c),tickets:rows.results});}catch(e){return fail(e);}}
