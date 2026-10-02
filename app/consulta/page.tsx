'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { money, statusLabels, tokenPattern, type RequestStatus } from '@/lib/raffle-core';
type Result = {status:RequestStatus;total:number;numbers:number[];created:number;expires:number};
const subscribe=()=>()=>{};
export default function Consulta() {
  const hydrated=useSyncExternalStore(subscribe,()=>true,()=>false);
  const [code,setCode]=useState(''),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent) {
    e.preventDefault();setError('');setResult(null);
    if(!tokenPattern.test(code.trim())){setError('Pegá el código privado de 64 caracteres que recibiste al enviar tu solicitud.');return;}
    setBusy(true);
    try {
      const response=await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.trim()})});
      const body=await response.json() as {error?:string;request:Result};if(!response.ok)throw Error(body.error);setResult(body.request);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="admin"><Link className="back" href="/">Volver a la rifa</Link><h1>Consultar mi solicitud</h1>
    <section className="admin-card"><p>Tu código es privado: permite consultar el estado de tu solicitud. No lo compartas. No se muestran nombres, teléfonos ni comprobantes.</p>
      <form onSubmit={submit}><label>Código privado<input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={64} required disabled={!hydrated||busy}/></label><button className="primary" disabled={!hydrated||busy}>{!hydrated?'Cargando consulta…':busy?'Consultando…':'Consultar estado'}</button></form>
      {error&&<div className="error" role="alert">{error}</div>}
      {result&&<div className="lookup-result" role="status"><h2>{statusLabels[result.status]}</h2><p>Números solicitados: <b>{result.numbers.map(n=>String(n).padStart(2,'0')).join(' · ')}</b></p><p>Importe: {money(result.total)}</p><p>Enviada: {new Date(result.created).toLocaleString('es-AR')}</p>
        {result.status==='pending'&&<p>Tu comprobante está en revisión. La reserva vence el {new Date(result.expires).toLocaleString('es-AR')}. La participación se confirma al aprobar el pago.</p>}
        {result.status==='approved'&&<p>El pago fue aprobado y tus números están confirmados.</p>}
        {(result.status==='expired'||result.status==='rejected')&&<p>Los números fueron liberados. Si ya transferiste, contactá a la organización desde la página principal antes de iniciar otra solicitud.</p>}
      </div>}
    </section></main>;
}