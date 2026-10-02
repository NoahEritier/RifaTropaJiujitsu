'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ticket, ShieldCheck, Check, Copy, ChevronDown } from 'lucide-react';
import { detectMime, MAX_FILE_BYTES, money, type PublicData } from '@/lib/raffle-core';

type Confirmation = { id: string; total: number; numbers: number[]; expires: number; code: string };
type Attempt = { id: string; code: string };
function newAttempt(): Attempt {
  return { id: crypto.randomUUID(), code: Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>n.toString(16).padStart(2,'0')).join('') };
}
export default function Page() {
  const [data,setData]=useState<PublicData|null>(null);
  const [selected,select]=useState<number[]>([]);
  const [error,setError]=useState('');
  const [loadError,setLoadError]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);
  const [copied,setCopied]=useState(false);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [progress,setProgress]=useState(0);
  const [checkingFile,setCheckingFile]=useState(false);
  const [recovery,setRecovery]=useState('');
  const attempt=useRef<Attempt|null>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const fileVersion=useRef(0);
  const submitting=useRef(false);
  const xhrRef=useRef<XMLHttpRequest|null>(null);
  const load=useCallback(async()=>{
    try {
      const r=await fetch('/api/public',{cache:'no-store'});
      const d=await r.json() as PublicData & {error?:string};
      if(!r.ok) throw Error(d.error||'No se pudo actualizar la disponibilidad.');
      setData(d); setLoadError('');
    } catch(e) { setLoadError((e as Error).message); }
  },[]);
  useEffect(()=>{
    void Promise.resolve().then(load);
    const timer=setInterval(()=>void load(),15000);
    return ()=>{clearInterval(timer);xhrRef.current?.abort();};
  },[load]);
  useEffect(()=>{
    let active=true, url='';
    queueMicrotask(()=>{if(!active)return;if(file)url=URL.createObjectURL(file);setPreview(url);});
    return ()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[file]);
  async function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input=e.currentTarget, candidate=input.files?.[0], version=++fileVersion.current;
    setFile(null); setError('');
    if(!candidate) return;
    setCheckingFile(true);
    try {
      if(candidate.size===0||candidate.size>MAX_FILE_BYTES) throw Error('El comprobante debe pesar hasta 5 MB y no estar vacío.');
      const mime=detectMime(new Uint8Array(await candidate.slice(0,8).arrayBuffer()));
      if(!mime||mime!==candidate.type) throw Error('Elegí un JPG, PNG o PDF válido. El contenido y el formato deben coincidir.');
      if(version===fileVersion.current) setFile(candidate);
    } catch(e) {
      if(version===fileVersion.current){input.value='';setError((e as Error).message);}
    } finally {if(version===fileVersion.current)setCheckingFile(false);}
  }
  const c=data?.config, tickets=data?.tickets||[];
  const total=selected.length===2?20000:selected.length*12000;
  const conflicts=selected.filter(n=>n<(c?.start??1)||n>(c?.start??1)+99||tickets.some(t=>t.number===n));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(submitting.current||!file||!selected.length||conflicts.length) return;
    submitting.current=true;setBusy(true);setError('');setProgress(0);
    attempt.current??=newAttempt();
    const current=attempt.current;
    const form=new FormData(e.currentTarget);
    form.set('receipt',file);form.set('numbers',JSON.stringify(selected));
    form.set('id',current.id);form.set('code',current.code);
    // Display the code after any ambiguous network outcome; retries reuse this same code.
    setRecovery(current.code);
    try {
      const result=await new Promise<{id:string;total:number;numbers:number[];expires:number}>((resolve,reject)=>{
        const xhr=new XMLHttpRequest();xhrRef.current=xhr;
        xhr.open('POST','/api/reserve');xhr.timeout=120000;
        xhr.upload.onprogress=event=>{if(event.lengthComputable)setProgress(Math.round(event.loaded/event.total*100));};
        xhr.onerror=()=>reject(Error('Se cortó la conexión. Conservamos tu formulario. Consultá tu código antes de volver a transferir y reintentá el mismo envío.'));
        xhr.ontimeout=()=>reject(Error('El envío tardó demasiado. Consultá tu código para verificar si se recibió; podés reintentar sin volver a pagar.'));
        xhr.onabort=()=>reject(Error('Se interrumpió el envío. Consultá tu código antes de iniciar otra solicitud.'));
        xhr.onload=()=>{
          if(xhr.status===413){reject(Error('El comprobante supera el límite de envío. Usá un archivo de hasta 5 MB.'));return;}
          try {
            const d=JSON.parse(xhr.responseText);
            if(xhr.status<200||xhr.status>=300) reject(Error(d.error||'No se pudo registrar la solicitud.'));
            else resolve(d.request);
          } catch {reject(Error('No se pudo leer la respuesta. Consultá tu código y reintentá el mismo envío.'));}
        };
        xhr.send(form);
      });
      setConfirmation({...result,code:current.code});
      attempt.current=null;setRecovery('');select([]);setFile(null);
      formRef.current?.reset();
      await load();
    } catch(e) {setError((e as Error).message);await load();}
    finally {submitting.current=false;xhrRef.current=null;setBusy(false);}
  }
  return <>
    <header className="site-header"><Link className="brand" href="/"><span className="brand-icon">T</span><span>TROPA <small>JIU JITSU · DOLORES</small></span></Link><a className="header-note" href="/consulta">Consultar mi solicitud</a></header>
    <main className="layout">
      <aside className="prize">
        <div className="eyebrow"><span/> APOYÁ A TROPA TEAM</div>
        <h1>Un número.<br/><em>Un gran premio.</em></h1><p className="intro">Nos ayudás a seguir creciendo.</p>
        <a href="/afiche.jpg" target="_blank" rel="noreferrer" className="poster-link"><img src="/afiche.jpg" alt="Afiche de la rifa Tropa Jiu Jitsu: televisor Noblex de 50 pulgadas, un número $12.000, dos números $20.000, premio opcional $500.000"/></a>
        <div className="prize-details"><span className="eyebrow">PREMIO PRINCIPAL</span><h2>Smart TV Noblex 50″</h2><p>4K UHD · Roku TV · Dolby Audio</p><div className="alternative">Opción de premio en efectivo <strong>$500.000</strong></div></div>
        <details><summary>Información del sorteo <ChevronDown size={18}/></summary>
          <p><b>Organiza:</b> Gimnasio Tropa Team, Dolores.</p><p><b>Fecha:</b> {c?.date||'A confirmar'}</p>
          <p className="preline"><b>Mecanismo:</b> {c?.mechanism||'A confirmar'}</p>
          <p className="preline"><b>Premio opcional:</b> {c?.optionalPrize||'Condiciones a confirmar antes de abrir.'}</p>
          <p className="preline"><b>Condiciones:</b> {c?.rules||'Las reservas se habilitarán al completar la información.'}</p>
          <p>Las reservas pendientes duran {c?.reservationHours??48} horas desde el envío. Si no se aprueba el pago en ese plazo, vencen y los números se liberan. Los pagos aprobados conservan sus números. Si ya transferiste y tu reserva venció, contactá a la organización para resolver la transferencia.</p>
        </details>
      </aside>
      <section className="workspace">
        <div className="topline"><span className="eyebrow">100 NÚMEROS</span><span className="stage">{data?.active?'Reservas abiertas':'En preparación'}</span></div>
        <h2 className="workspace-title">Elegí tus números</h2><p className="muted">Uno para participar. Dos para aprovechar la promo.</p>
        <div className="price-row"><div><span>1 NÚMERO</span><strong>$12.000</strong></div><div className="promo"><span>2 NÚMEROS <b>PROMO</b></span><strong>$20.000</strong></div></div>
        {data&&!data.active&&<div className="notice"><ShieldCheck size={20}/><div><b>Estamos preparando la rifa.</b><p>Podés explorar los números. Esperá la apertura para transferir y solicitar una reserva.</p></div></div>}
        <div className="grid-heading"><h3><span className="step">1</span> Disponibilidad</h3><span>{data?`${100-tickets.length} disponibles`:'Actualizando…'}</span></div>
        <div className="legend"><span><i className="free"/>Disponible</span><span><i className="chosen"/>Elegido ✓</span><span><i className="pending"/>Reservado ◷</span><span><i className="approved"/>Pagado ✓</span></div>
        {c&&!c.numberingConfirmed&&<p className="small">Numeración provisional: {c.start===0?'00 al 99':'1 al 100'}. Pendiente de confirmar.</p>}
        {loadError&&<div className="error" role="alert">{loadError} <button type="button" onClick={()=>void load()}>Actualizar disponibilidad</button></div>}
        <div className="number-grid" aria-label="Números del sorteo">
          {Array.from({length:100},(_,i)=>i+(c?.start??1)).map(n=>{
            const t=tickets.find(x=>x.number===n),chosen=selected.includes(n);
            const label=t?(t.status==='approved'?'pagado':'reservado'):chosen?'elegido':'disponible';
            return <button type="button" key={n} disabled={!data||busy||(!!t&&!chosen)}
              className={`number ${t?.status||''} ${chosen&&!t?'selected':''} ${chosen&&t?'conflict':''}`}
              aria-pressed={chosen} aria-label={`Número ${String(n).padStart(2,'0')}, ${label}${chosen&&t?', quitá este número de tu selección':''}`}
              onClick={()=>{setError('');if(chosen)select(s=>s.filter(x=>x!==n));else if(selected.length<2)select(s=>[...s,n]);else setError('Podés elegir hasta dos números por solicitud.');}}>
              {String(n).padStart(2,'0')}<span className="ticket-mark" aria-hidden="true">{t?(t.status==='approved'?'✓':'◷'):chosen?'✓':''}</span>
            </button>;
          })}
        </div>
        {conflicts.length>0&&<div className="error" role="alert">No están disponibles los números {conflicts.map(n=>String(n).padStart(2,'0')).join(', ')}. Conservamos tu selección: quitá esos números y elegí otros. <button type="button" disabled={busy} onClick={()=>select(s=>s.filter(n=>!conflicts.includes(n)))}>Quitar números no disponibles</button></div>}
        <div className="selection" aria-live="polite"><Ticket size={23}/><div><span>TUS NÚMEROS</span><strong>{selected.length?selected.map(n=>String(n).padStart(2,'0')).join(' · '):'Elegí uno o dos'}</strong></div><div className="selection-total"><span>TOTAL</span><strong>{money(total)}</strong></div></div>
        <form ref={formRef} onSubmit={submit}>
          <h3><span className="step">2</span> Tus datos</h3>
          <div className="fields"><label>Nombre y apellido<input name="name" autoComplete="name" placeholder="Tu nombre completo" minLength={3} maxLength={100} required disabled={!data?.active||busy}/></label><label>WhatsApp<input name="phone" type="tel" autoComplete="tel" placeholder="País + código de área + número" pattern="[+0-9 ()-]{8,25}" required disabled={!data?.active||busy}/></label></div>
          <h3><span className="step">3</span> Pago y comprobante</h3>
          {c?.alias&&data?.active?<div className="payment"><span>ALIAS PARA TRANSFERIR</span><div><strong>{c.alias}</strong><button type="button" className="icon-button" aria-label="Copiar alias" onClick={async()=>{try{await navigator.clipboard.writeText(c.alias);setCopied(true);}catch{setError('No se pudo copiar. Copiá el alias manualmente.');}}}>{copied?<Check size={18}/>:<Copy size={18}/>}</button></div><p>Titular: {c.holder}</p><p>Transferí {money(total)} después de elegir tus números. El comprobante se revisa antes de confirmar la participación.</p></div>:<div className="payment"><b>Pagos aún no habilitados</b><p>Esperá la apertura para transferir.</p></div>}
          <label className="upload">Comprobante de transferencia<input name="receipt" type="file" accept="image/jpeg,image/png,application/pdf" onChange={chooseFile} required disabled={!data?.active||busy}/><small>JPG, PNG o PDF · hasta 5 MB. {checkingFile?'Validando archivo…':''}</small></label>
          {file&&preview&&<div className="receipt-preview">{file.type==='application/pdf'?<a href={preview} target="_blank" rel="noreferrer">Abrir vista previa del PDF: {file.name}</a>:<img src={preview} alt="Vista previa de tu comprobante"/>}<p className="small">{file.name} · {(file.size/1_000_000).toFixed(2)} MB</p></div>}
          <p className="small">Plazo de revisión: {c?.reservationHours??48} horas desde el envío. Luego se liberan las reservas pendientes. Los pagos aprobados conservan sus números. Si ya transferiste, contactá a la organización ante cualquier vencimiento o conflicto.</p>
          <label className="consent"><input type="checkbox" required disabled={!data?.active||busy}/><span>Leí las condiciones y el plazo de reserva. Entiendo que mi participación se confirma cuando la organización aprueba el pago.</span></label>
          {busy&&<div className="upload-progress" role="status"><progress max={100} value={progress}/><p>{progress<100?`Enviando comprobante: ${progress}%`:'Comprobante enviado. Registrando la reserva…'}</p></div>}
          {error&&<div className="error" role="alert">{error}</div>}
          {recovery&&!busy&&<div className="recovery"><p>Guardá este código privado para comprobar si se recibió el envío. No vuelvas a transferir.</p><code>{recovery}</code><a href="/consulta" target="_blank" rel="noreferrer">Consultar estado</a></div>}
          <button className="primary" type="submit" disabled={!data?.active||!selected.length||!file||busy||checkingFile||conflicts.length>0}>{busy?'Enviando solicitud…':data?.active?'Solicitar reserva':'Reservas aún no habilitadas'}</button>
          <p className="small center">Los números se reservan al enviar la solicitud. Elegirlos por sí solo no los bloquea.</p>
        </form>
        <p className="contact"><a href="/consulta">Consultar una solicitud con mi código privado</a></p>
        {c?.phone&&<p className="contact">¿Tenés una consulta? <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer">Escribinos por WhatsApp</a></p>}
      </section>
    </main>
    <footer>TROPA TEAM · DOLORES <a href="/admin">Administración</a></footer>
    {confirmation&&<div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="success-title" className="modal" tabIndex={-1}>
      <ShieldCheck size={42}/><h2 id="success-title">Solicitud recibida</h2>
      <p>Tus números: <b>{confirmation.numbers.map(n=>String(n).padStart(2,'0')).join(' · ')}</b></p><p>Total: {money(confirmation.total)}</p>
      <p className="small">Vence: {new Date(confirmation.expires).toLocaleString('es-AR')}</p>
      <div className="recovery"><b>Guardá tu código privado</b><code>{confirmation.code}</code><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(confirmation.code);setCopied(true);}catch{setError('Copiá el código manualmente.');}}}>Copiar código</button><a href="/consulta" target="_blank" rel="noreferrer">Consultar estado</a></div>
      <div className="notice">Tu comprobante está pendiente de revisión. La organización debe aprobar el pago dentro del plazo para confirmar tu participación.</div>
      <button autoFocus className="primary" onClick={()=>setConfirmation(null)}>Ya guardé mi código</button>
    </section></div>}
  </>;
}