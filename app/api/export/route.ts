import { authorize, db, expireReservations, fail, json, privateHeaders } from '@/lib/raffle';
import { csvCell, statusLabels, type RequestStatus } from '@/lib/raffle-core';
export async function GET(req: Request) {
  try {
    if(!await authorize(req)) return json({error:'Ingresá a Administración.'},401);
    await expireReservations();
    const type = new URL(req.url).searchParams.get('type') || 'participants';
    if(!['participants','numbers','payments'].includes(type)) return json({error:'Exportación inválida.'},400);
    let header: string[];
    let records: unknown[][];
    if(type==='numbers') {
      header=['Número','Solicitud','Estado'];
      const rows = await db().prepare('SELECT t.number,r.id,r.status FROM tickets t JOIN requests r ON r.id=t.request_id ORDER BY t.number').all<{number:number;id:string;status:RequestStatus}>();
      const settings = await db().prepare("SELECT json_extract(value,'$.start') AS start FROM settings WHERE id=1").first<{start:number}>();
      records=Array.from({length:100},(_,i)=>{
        const number=i+(settings?.start??1),row=rows.results.find(r=>r.number===number);
        return [String(number).padStart(2,'0'),row?.id||'',row?statusLabels[row.status]:'Disponible'];
      });
    } else {
      header=type==='payments'?['Solicitud','Participante','Importe ARS','Estado','Creada','Vence']:['Solicitud','Nombre','WhatsApp','Números solicitados','Importe ARS','Estado','Creada','Vence'];
      const rows = await db().prepare('SELECT id,name,phone,numbers,total,status,created,expires FROM requests ORDER BY created,id').all<{id:string;name:string;phone:string;numbers:string;total:number;status:RequestStatus;created:number;expires:number}>();
      records=rows.results.map(r=>{
        const time=[statusLabels[r.status],new Date(r.created).toISOString(),r.expires?new Date(r.expires).toISOString():''];
        return type==='payments'?[r.id,r.name,r.total,...time]:[r.id,r.name,r.phone,JSON.parse(r.numbers).map((n:number)=>String(n).padStart(2,'0')).join(' / '),r.total,...time];
      });
    }
    const csv='\uFEFF'+[header,...records].map(row=>row.map(csvCell).join(',')).join('\r\n');
    return new Response(csv,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="rifa-'+type+'.csv"'}});
  } catch(e) { return fail(e); }
}