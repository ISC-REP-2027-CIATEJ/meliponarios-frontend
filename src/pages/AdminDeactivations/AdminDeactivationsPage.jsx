import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { supabase,comprobarConfiguracion } from '../../lib/supabase';
import { crearBajasApi } from '../../features/adminDeactivations/bajasApi.mjs';
import { instanteVisible } from '../../features/visits/fechasVisita.mjs';
import { obtenerFichaPublica } from '../../features/publicMeliponarios/publicService';
import '../FieldReviews/FieldReviewsPage.css';

const api=crearBajasApi(supabase);
export default function AdminDeactivationsPage({user,sessionReady,onLogout}) {
  return <div className="field-review km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady?<main className="km-container km-workspace" role="status">Comprobando sesión…</main>
      :Number(user?.roleId)!==1?<main className="km-container km-workspace"><h1 className="km-page-title">Solicitudes de baja</h1>
        <p className="my-4">Este espacio requiere una cuenta activa de administrador general.</p><a href={user?'#explorar':'#login'} className="km-button">Continuar</a></main>
        :<Bandeja key={user.id} user={user}/>}
  </div>;
}
function Bandeja({user}) {
  const [estado,cambiar]=useState({cargando:true,filas:[],error:''});
  const [version,actualizar]=useState(0);
  const [busqueda,buscar]=useState('');
  const [pagina,ir]=useState(0);
  const [seleccion,abrir]=useState(null);
  const dialogo=useRef(null);
  const [decision,elegirDecision]=useState('');
  const [comentario,escribir]=useState('');
  const [ocupado,esperar]=useState(false);
  const [incierto,marcar]=useState(false);
  const [errorOperacion,fallar]=useState('');
  const candado=useRef(false);
  const vivo=useRef(false);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
  useEffect(()=>{
    let vigente=true;
    Promise.resolve().then(()=>{comprobarConfiguracion();return api.pendientes(user.id);})
      .then(filas=>{if(vigente)cambiar({cargando:false,filas,error:''});})
      .catch(error=>{if(vigente)cambiar({cargando:false,filas:[],error:error.message});});
    return()=>{vigente=false;};
  },[user.id,version]);
  useEffect(()=>{if(seleccion)dialogo.current?.showModal();},[seleccion]);
  useEffect(()=>{
    if(!seleccion)return;
    function proteger(e){
      if(e.type==='beforeunload'){if(ocupado||comentario){e.preventDefault();e.returnValue='';}}
      else if(ocupado || (comentario && !seleccion.resolucion && !window.confirm('¿Salir sin terminar la resolución?'))) e.preventDefault();
    }
    window.addEventListener('beforeunload',proteger);
    window.addEventListener('kaabmap:before-owner-leave',proteger);
    return()=>{window.removeEventListener('beforeunload',proteger);window.removeEventListener('kaabmap:before-owner-leave',proteger);};
  },[seleccion,ocupado,comentario]);
  function abrirSolicitud(s){elegirDecision('');escribir('');marcar(false);fallar('');abrir(s);}
  function cerrar(){
    if(candado.current)return;
    if(comentario&&!seleccion?.resolucion&&!window.confirm('¿Cerrar sin terminar la resolución?'))return;
    abrir(null);
  }
  async function resolver(e){
    e.preventDefault();
    if(candado.current||incierto||!seleccion)return;
    const efecto=decision==='aprobar'?'La solicitud quedará aprobada y el meliponario pasará a Inactivo.':'La solicitud quedará rechazada.';
    if(!window.confirm(efecto+' ¿Confirmar la resolución de '+seleccion.nombre+'?'))return;
    candado.current=true;esperar(true);fallar('');
    try{
      await api.resolver(user.id,seleccion.id,decision,comentario);
      if(!vivo.current)return;
      abrir({...seleccion,resolucion:decision,comentario});
      cambiar(prev=>({...prev,filas:prev.filas.filter(s=>s.id!==seleccion.id)}));
    }catch(error){if(vivo.current){fallar(error.message);marcar(true);}}
    finally{candado.current=false;if(vivo.current)esperar(false);}
  }
  async function comprobarResolucion(){
    if(candado.current)return;
    candado.current=true;esperar(true);fallar('');
    try{
      const filas=await api.pendientes(user.id);
      if(!vivo.current)return;
      cambiar({cargando:false,filas,error:''});
      if(filas.some(s=>s.id===seleccion.id)){
        marcar(false);fallar('La solicitud sigue pendiente. Revisa tus datos antes de volver a confirmar.');
      }else{
        abrir({...seleccion,resolucion:'resultado-por-confirmar'});
        fallar('La solicitud dejó de aparecer entre las pendientes. El resultado de esa resolución requiere consultarse con el responsable del backend.');
      }
    }catch(error){if(vivo.current)fallar(error.message);}
    finally{candado.current=false;if(vivo.current)esperar(false);}
  }
  function refrescar(){if(candado.current)return;abrir(null);cambiar({cargando:true,filas:[],error:''});actualizar(v=>v+1);}
  const filas=estado.filas.filter(s=>[s.nombre,s.cliente,s.motivo].join(' ').toLocaleLowerCase('es-MX').includes(busqueda.trim().toLocaleLowerCase('es-MX')));
  const ultima=Math.max(0,Math.ceil(filas.length/12)-1);
  const actual=Math.min(pagina,ultima);
  return <main className="km-container km-workspace">
    <header className="km-work-banner km-page-heading"><div><h1 className="km-page-title">Solicitudes de baja</h1>
      <p className="mt-3 text-sm text-muted">Consulta los registros que sus propietarios solicitaron desactivar.</p></div>
      <button className="km-button" disabled={estado.cargando||ocupado} onClick={refrescar}>Actualizar solicitudes</button></header>
    <section className="km-panel km-inset">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Pendientes {(estado.cargando||estado.error)?'—':estado.filas.length}</h2>
        <label className="text-sm font-semibold">Buscar meliponario o propietario<input type="search" className="review-field mt-2" value={busqueda} onChange={e=>{buscar(e.target.value);ir(0);}}/></label>
      </div>
      {estado.cargando?<p role="status">Consultando solicitudes…</p>:estado.error?<p role="alert">{estado.error}</p>:<>
        <div className="grid gap-4 md:grid-cols-2">{filas.slice(actual*12,actual*12+12).map(s=><article className="km-record-inset grid gap-3 p-5" key={s.id}>
          <span className="text-sm text-muted">Solicitud pendiente</span><h3 className="text-lg font-bold">{s.nombre}</h3>
          <p>{s.cliente}</p><p className="text-sm text-muted">{instanteVisible(s.fecha)}</p>
          <p className="line-clamp-3 whitespace-pre-wrap">{s.motivo}</p>
          <button className="km-button justify-self-start" onClick={()=>abrirSolicitud(s)}>Ver solicitud</button>
        </article>)}</div>
        {!filas.length&&<p className="rounded-xl bg-soft p-4">{busqueda?'Sin coincidencias.':'No hay solicitudes de baja pendientes.'}</p>}
        {ultima>0&&<nav className="mt-5 flex gap-3" aria-label="Páginas de solicitudes">
          <button className="km-button" disabled={!actual} onClick={()=>ir(actual-1)}>Anterior</button><span>{actual+1} de {ultima+1}</span>
          <button className="km-button" disabled={actual===ultima} onClick={()=>ir(actual+1)}>Siguiente</button></nav>}
      </>}
    </section>
    {seleccion&&<dialog ref={dialogo} aria-labelledby="baja-detalle-titulo" onCancel={e=>{e.preventDefault();cerrar();}}>
      <h2 id="baja-detalle-titulo" className="text-2xl font-bold">{seleccion.nombre}</h2>
      <p className="mt-3">{seleccion.cliente}</p><p className="mt-2 text-sm">{instanteVisible(seleccion.fecha)}</p>
      <h3 className="mt-5 font-bold">Motivo de la solicitud</h3><p className="my-3 whitespace-pre-wrap">{seleccion.motivo}</p>
      {seleccion.resolucion ? <p role="status" className="my-4 rounded-xl bg-soft p-4">{seleccion.resolucion==='aprobar'
        ?'Solicitud aprobada. La función actualiza el meliponario a Inactivo. Comprueba su visibilidad pública.'
          :seleccion.resolucion==='rechazar'?'Solicitud rechazada y comentario guardado.':'La solicitud ya no está en la bandeja pendiente.'}</p>
        :<form onSubmit={resolver} className="my-5 grid gap-4">
          <label>Decisión<select required className="review-field mt-2" value={decision} disabled={ocupado||incierto} onChange={e=>elegirDecision(e.target.value)}>
            <option value="">Selecciona una decisión</option><option value="aprobar">Aprobar la solicitud de baja</option><option value="rechazar">Rechazar la solicitud</option>
          </select></label>
          <label>Comentario de resolución<textarea required minLength={10} maxLength={1000} className="review-field mt-2" value={comentario} disabled={ocupado||incierto} onChange={e=>escribir(e.target.value)}/></label>
          <p className="text-sm text-muted">Escribe entre 10 y 1000 caracteres. Al aprobar, el estado operativo pasa a Inactivo.</p>
          <button className="km-button km-button--primary justify-self-start" disabled={ocupado||incierto||!decision||Array.from(comentario.trim()).length<10}>Confirmar resolución</button>
          {incierto&&<button type="button" className="km-button justify-self-start" disabled={ocupado} onClick={comprobarResolucion}>Comprobar solicitud</button>}
        </form>}
      {seleccion.comentario&&<p className="my-3 whitespace-pre-wrap">{seleccion.comentario}</p>}
      {errorOperacion&&<p role="alert" className="my-3 text-[#944c32]">{errorOperacion}</p>}
      <ConsultaPublica key={seleccion.id+':'+(seleccion.resolucion||'pendiente')} registro={seleccion.registro}/>
      <button className="km-button mt-5" disabled={ocupado} onClick={cerrar}>Cerrar</button>
    </dialog>}
  </main>;
}
function ConsultaPublica({registro}) {
  const [resultado,mostrar]=useState(null);
  const [ocupado,esperar]=useState(false);
  const [error,fallar]=useState('');
  async function comprobar(){
    if(ocupado)return;
    esperar(true);mostrar(null);fallar('');
    try{mostrar(Boolean(await obtenerFichaPublica(registro)));}catch(e){fallar(e.message);}finally{esperar(false);}
  }
  return <div className="mt-5"><button className="km-button" disabled={ocupado} onClick={comprobar}>Comprobar ficha pública</button>
    {resultado!==null&&<p className="mt-3">{resultado?<a href={'#meliponario/'+registro}>Ficha visible para visitantes</a>:'Ficha ausente de la consulta pública.'}</p>}
    {error&&<p role="alert" className="mt-3">{error}</p>}
  </div>;
}
