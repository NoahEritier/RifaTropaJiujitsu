import { remoteStorage } from '@/lib/storage';
import { config, db, expireReservations, fail, json, ready } from '@/lib/raffle';
export async function GET() {
  try {
    await expireReservations();
    const c = await config();
    const rows = await db().prepare("SELECT t.number,r.status FROM tickets t JOIN requests r ON r.id=t.request_id WHERE r.status IN ('pending','approved')").all();
    return json({remoteUploads:remoteStorage(),config:c,active:ready(c),tickets:rows.results});
  } catch(e) { return fail(e); }
}