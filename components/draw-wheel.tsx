'use client';
import {useEffect,useRef,useState} from 'react';
import type {DrawResult,DrawState} from '@/lib/draw-core';
const label=(n:number)=>String(n).padStart(2,'0');
export default function DrawWheel(){
  const [data,setData]=useState<DrawState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[spinning,setSpinning]=useState(false),[rotation,setRotation]=useState(0),[demo,setDemo]=useState<number|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    let active=true;
    void fetch('/api/draw',{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);if(active)setData(b);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;if(timer.current)clearTimeout(timer.current);};
  },[]);
  function animate(winner:number,start:number){
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSpinning(true);
    setRotation(old=>Math.ceil(old/360)*360+360*7-(winner-start)*3.6);
    timer.current=setTimeout(()=>{setSpinning(false);timer.current=null;},reduced?0:5200);
  }
  function rehearse(){
    if(busy||spinning||!data)return;
    const bytes=crypto.getRandomValues(new Uint32Array(1));const winner=data.start+(bytes[0]%100);
    setDemo(winner);animate(winner,data.start);
  }
  async function draw(){
    if(busy||spinning||!data||data.result)return;
    if(!confirm('¿Realizar el sorteo definitivo? Se guardará un único ganador y no podrá repetirse.'))return;
    setBusy(true);setError('');setDemo(null);
    try{
      const response=await fetch('/api/draw',{method:'POST'});
      const body=await response.json() as {result:DrawResult;error?:string};
      if(!response.ok)throw Error(body.error);
      setData(old=>old?{...old,result:body.result}:null);animate(body.result.winner,body.result.start);
    }catch(e){
      setError((e as Error).message+' Actualizá el resultado antes de volver a intentar.');
      try{await refresh();}catch{/* El resultado persistido se recupera al actualizar. */}
    }finally{setBusy(false);}
  }
  async function refresh(){
    setError('');
    const response=await fetch('/api/draw',{cache:'no-store'}),body=await response.json();
    if(!response.ok)throw Error(body.error);setData(body);
  }
  const start=data?.start||0;
  const visibleRotation=data?.result && !spinning && rotation===0 ? -(data.result.winner-data.result.start)*3.6 : rotation;
  const winner=data?.result?.winner??demo;
  return <section className="admin-card draw-card"><span className="eyebrow">SORTEO EN VIVO</span><h2>Ruleta de la rifa</h2>
    <p className="muted">Cada número tiene la misma probabilidad. El sorteo definitivo requiere los 100 pagos aprobados y guarda un único resultado.</p>
    <div className="wheel-wrap"><span className="wheel-pointer" aria-hidden="true">▼</span>
      <svg className="draw-wheel" viewBox="0 0 400 400" role="img" aria-label="Ruleta con los 100 números" style={{transform:`rotate(${visibleRotation}deg)`}}>
        {Array.from({length:100},(_,i)=>{
          const a=(i*3.6-1.8-90)*Math.PI/180,b=((i+1)*3.6-1.8-90)*Math.PI/180;
          return <g key={i}><path d={`M200 200 L${200+190*Math.cos(a)} ${200+190*Math.sin(a)} A190 190 0 0 1 ${200+190*Math.cos(b)} ${200+190*Math.sin(b)} Z`} fill={i%2?'#191c21':'#b61926'}/>
            <text x="200" y="26" textAnchor="middle" fill="white" fontSize="8" transform={`rotate(${i*3.6} 200 200)`}>{label(start+i)}</text></g>;
        })}
        <circle cx="200" cy="200" r="65" fill="#fff"/><text x="200" y="198" textAnchor="middle" fontSize="18" fontWeight="700">TROPA</text><text x="200" y="220" textAnchor="middle" fontSize="12">JIU JITSU</text>
      </svg>
    </div>
    <div className="draw-result" role="status" aria-live="polite">{spinning?'Girando…':winner!==null?<><span>{data?.result?'Número ganador':'Ensayo · sin validez'}</span><strong>{label(winner)}</strong>{data?.result&&<small>{new Date(data.result.created).toLocaleString('es-AR')}</small>}</>:'Listo para ensayar'}</div>
    <p className="small">{data?data.approved:0}/100 números con pago aprobado. {data?.result?'Resultado definitivo guardado.':'Los ensayos no modifican las reservas ni el resultado.'}</p>
    <div className="actions"><button disabled={!data||busy||spinning||!!data.result} onClick={rehearse}>Ensayar animación</button><button className="primary" disabled={!data||busy||spinning||data.approved!==100||!!data.result} onClick={()=>void draw()}>Sortear y guardar ganador</button><button disabled={busy||spinning} onClick={()=>void refresh().catch(e=>setError(e.message))}>Actualizar resultado</button></div>
    {data?.result&&!spinning&&<button onClick={()=>void navigator.clipboard.writeText(`Rifa Tropa Jiu Jitsu · Número ganador: ${label(data.result!.winner)}. Sorteo: ${new Date(data.result!.created).toLocaleString('es-AR')}.`).catch(()=>setError('No se pudo copiar. Copiá el número mostrado.'))}>Copiar resultado para WhatsApp</button>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
