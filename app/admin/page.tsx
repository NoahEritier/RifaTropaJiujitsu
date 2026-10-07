'use client';
import Link from 'next/link';
import DrawWheel from '@/components/draw-wheel';
import { useCallback, useEffect, useState } from 'react';
import { money, statusLabels, type RaffleConfig, type Reservation, type RequestStatus } from '@/lib/raffle-core';
type AdminData = {
  config:RaffleConfig; requests:Reservation[]; numberingLocked:boolean; page:number; count:number;
  summary:{totalRequests:number;pendingCount:number;approvedCount:number;pendingAmount:number;approvedAmount:number};
};
export default function Admin() {
  const [key,setKey]=useState(''),[data,setData]=useState<AdminData|null>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[initializing,setInitializing]=useState(true);
  const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[query,setQuery]=useState(''),[state,setState]=useState(''),[page,setPage]=useState(1);
  const refresh=useCallback(async()=>{
    const params=new URLSearchParams({q:query,status:state,page:String(page)});
    const response=await fetch('/api/admin?'+params,{cache:'no-store'});
    const body=await response.json() as AdminData & {error?:string};
    if(response.status===401){setData(null);return;}
    if(!response.ok)throw Error(body.error);
    setData(body);
  },[query,state,page]);
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(refresh).catch(e=>{if(active)setMsg(e.message);}).finally(()=>{if(active)setInitializing(false);});
    return ()=>{active=false;};
  },[refresh]);
  async function login(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setMsg('');
    try {
      const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
      const body=await response.json() as AdminData & {error?:string};if(!response.ok)throw Error(body.error);
      setKey('');await refresh();
    }catch(e){setMsg((e as Error).message);}finally{setBusy(false);}
  }
  async function action(payload:unknown) {
    if(busy)return;setBusy(true);setMsg('');
    try {
      const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.json() as AdminData & {error?:string};if(response.status===401)setData(null);if(!response.ok)throw Error(body.error);
      await refresh();setMsg('Cambios guardados.');
    }catch(e){setMsg((e as Error).message);}finally{setBusy(false);}
  }
  async function logout() {
    setBusy(true);
    try {const response=await fetch('/api/session',{method:'DELETE'});if(!response.ok)throw Error('No se pudo cerrar la sesión.');setData(null);setKey('');setMsg('Sesión cerrada.');}
    catch(e){setMsg((e as Error).message);}finally{setBusy(false);}
  }
  async function download(path:string,filename:string) {
    try {
      const response=await fetch(path);
      if(!response.ok){if(response.status===401)setData(null);throw Error('No se pudo descargar el archivo. Revisá tu sesión y volvé a intentar.');}
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    }catch(e){setMsg((e as Error).message);}
  }
  function set<K extends keyof RaffleConfig>(field:K,value:RaffleConfig[K]){setData(old=>old?{...old,config:{...old.config,[field]:value}}:null);}
  const textFields: [keyof Pick<RaffleConfig,'alias'|'holder'|'phone'|'date'>,string][]=[
    ['alias','Alias de transferencia'],['holder','Titular'],['phone','WhatsApp con código de país'],['date','Fecha o condición de realización'],
  ];
  return <main className="admin"><Link className="back" href="/">Volver a la rifa</Link><span className="eyebrow">TROPA TEAM · PANEL PRIVADO</span><h1>Administración</h1>
    {initializing?<p role="status">Comprobando sesión…</p>:!data?<form className="admin-card" onSubmit={login}><h2>Ingresá con tu clave</h2><label>Clave de administración<input type="password" value={key} onChange={e=>setKey(e.target.value)} required autoComplete="current-password" maxLength={256}/></label><button className="primary" disabled={busy}>Ingresar</button><p className="small">La sesión dura cuatro horas. Cinco intentos por dirección cada 15 minutos.</p></form>:<>
      <div className="admin-bar"><span>{data.summary.pendingCount||0} solicitudes pendientes</span><button disabled={busy} onClick={()=>void Promise.resolve().then(refresh).catch(e=>setMsg(e.message))}>Actualizar</button><button disabled={busy} onClick={()=>void logout()}>Salir</button></div>
      <div className="summary-grid"><div><span>Pagos aprobados</span><strong>{money(data.summary.approvedAmount)}</strong><small>{data.summary.approvedCount||0} solicitudes</small></div><div><span>Pagos pendientes</span><strong>{money(data.summary.pendingAmount)}</strong><small>{data.summary.pendingCount||0} solicitudes</small></div></div>
      <section className="admin-card"><h2>Configuración del sorteo</h2><form onSubmit={e=>{e.preventDefault();void action({action:'settings',config:data.config});}}>
        <div className="fields">{textFields.map(([field,label])=><label key={field}>{label}<input value={data.config[field]} disabled={busy} onChange={e=>set(field,e.target.value)} maxLength={200}/></label>)}</div>
        <label>Mecanismo del sorteo<textarea value={data.config.mechanism} disabled={busy} onChange={e=>set('mechanism',e.target.value)} placeholder="Cómo se elige el número ganador y dónde se publica el resultado" maxLength={2000}/></label>
        <label>Condiciones del premio opcional<textarea value={data.config.optionalPrize} disabled={busy} onChange={e=>set('optionalPrize',e.target.value)} placeholder="Quién elige entre TV o efectivo, importe y condiciones de entrega" maxLength={2000}/></label>
        <label>Condiciones de participación<textarea value={data.config.rules} disabled={busy} onChange={e=>set('rules',e.target.value)} placeholder="Participación, pagos, rechazos, vencimientos y resolución de transferencias ya realizadas" maxLength={2000}/></label>
        <div className="fields"><label>Numeración<select aria-label="Numeración" value={data.config.start} disabled={busy||data.numberingLocked} onChange={e=>set('start',Number(e.target.value))}><option value={1}>1 al 100</option><option value={0}>00 al 99</option></select></label><label>Plazo de reserva pendiente (horas)<input type="number" min={1} max={720} step={1} value={data.config.reservationHours} disabled={busy} onChange={e=>set('reservationHours',Number(e.target.value))} required/></label></div>
        <p className="small">El nuevo plazo se aplica a las nuevas solicitudes. Las existentes conservan su vencimiento. Las reservas vencidas se liberan al actualizar o realizar cualquier operación; los pagos aprobados no vencen.</p>
        {data.numberingLocked&&<p className="notice">La numeración está bloqueada porque ya se recibieron solicitudes.</p>}
        <label className="consent"><input type="checkbox" checked={data.config.numberingConfirmed} disabled={busy||data.numberingLocked} onChange={e=>set('numberingConfirmed',e.target.checked)}/><span>Confirmar la numeración antes de abrir.</span></label>
        <label className="consent"><input type="checkbox" checked={data.config.open} disabled={busy} onChange={e=>set('open',e.target.checked)}/><span>Habilitar reservas y pagos.</span></label><button className="primary" disabled={busy}>Guardar configuración</button>
      </form></section>
      <DrawWheel/><section className="admin-card"><h2>Solicitudes y pagos</h2><p className="muted">Verificá la acreditación en la cuenta antes de aprobar. Rechazar libera los números.</p>
        <form className="filter-bar" onSubmit={e=>{e.preventDefault();setQuery(search.trim());setState(filter);setPage(1);}}><label>Buscar nombre, teléfono o número<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/></label><label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).map(([status,label])=><option key={status} value={status}>{label}</option>)}</select></label><button type="submit" disabled={busy}>Buscar</button></form>
        <div className="actions">{[['participants','Participantes'],['numbers','Números'],['payments','Pagos']].map(([type,label])=><button key={type} onClick={()=>void download('/api/export?type='+type,'rifa-'+type+'.csv')}>Exportar {label} CSV</button>)}</div>
        <p className="small">{data.count} resultados · Página {data.page} de {Math.max(1,Math.ceil(data.count/50))}</p>
        {!data.requests.length?<div className="empty">No hay solicitudes para esta búsqueda.</div>:data.requests.map(r=><article key={r.id} className="request">
          <div className="request-head"><h3>{r.name}</h3><span className={`status ${r.status}`}>{statusLabels[r.status as RequestStatus]}</span></div>
          <p>WhatsApp: {r.phone}</p><p><b>Números solicitados: {(JSON.parse(r.numbers) as number[]).map(n=>String(n).padStart(2,'0')).join(' · ')||'Sin registro histórico'}</b> · {money(r.total)}</p>
          {(r.status==='rejected'||r.status==='expired')&&<p className="small">Estos números fueron liberados y pueden pertenecer a otras solicitudes.</p>}
          <p className="small">{new Date(r.created).toLocaleString('es-AR')} · {r.id}</p>{r.status==='pending'&&<p className="small">Vence: {new Date(r.expires).toLocaleString('es-AR')}</p>}
          <div className="actions"><button disabled={busy} onClick={()=>void download('/api/receipt?id='+encodeURIComponent(r.id),'comprobante-'+r.id)}>Descargar comprobante</button>
            {r.status==='pending'&&<><button disabled={busy} onClick={()=>{if(confirm(`¿Confirmás que se acreditó el pago de ${r.name} por ${money(r.total)}?`))void action({action:'approve',id:r.id});}}>Aprobar pago</button><button disabled={busy} onClick={()=>{if(confirm('¿Rechazar la solicitud y liberar sus números?'))void action({action:'reject',id:r.id});}}>Rechazar y liberar</button></>}
          </div></article>)}
        <div className="actions"><button disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button disabled={busy||page*50>=data.count} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
      </section>
    </>}
    {msg&&<div className="admin-message" role="status">{msg}</div>}
  </main>;
}