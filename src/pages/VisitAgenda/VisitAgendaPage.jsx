import { useCallback, useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { crearVisitasApi } from '../../features/visits/visitasApi.mjs';
import { avanzar, fechaVisible, instanteVisible, horaVisible, hoyMexico, rangoVisible, sumarDias, tiposVisita } from '../../features/visits/fechasVisita.mjs';
import '../FieldReviews/FieldReviewsPage.css';
import './VisitAgendaPage.css';

const api=crearVisitasApi(supabase);
const boton='km-button';
const primario='km-button km-button--primary';
const etiqueta=valor=>String(valor || 'Pendiente').replaceAll('_',' ');

function useConsulta(cargar,version) {
  const [resultado,guardar]=useState(null);
  useEffect(()=>{
    let vigente=true;
    Promise.resolve().then(()=>{comprobarConfiguracion();return cargar();})
      .then(data=>{if(vigente)guardar({cargar,version,data});})
      .catch(error=>{if(vigente)guardar({cargar,version,error:error.message});});
    return ()=>{vigente=false;};
  },[cargar,version]);
  return resultado?.cargar===cargar && resultado.version===version ? resultado : {};
}
function Lectura({resultado,children}) {
  if(resultado.error)return <p role="alert" className="my-4 rounded-xl bg-[#fff0e5] p-4">{resultado.error}</p>;
  if(resultado.data===undefined)return <p role="status" className="my-4">Consultando visitas…</p>;
  return children(resultado.data);
}

export default function VisitAgendaPage({user,sessionReady,onLogout}) {
  const rol=Number(user?.roleId);
  return <div className="field-review km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main role="status" className="km-container km-workspace">Comprobando sesión…</main>
      : ![3,4,5].includes(rol) ? <main className="km-container km-workspace"><h1 className="km-page-title">Agenda de visitas</h1>
        <p className="my-4">Entra con una cuenta de cliente, trabajador o coordinador para consultar su agenda.</p>
        <a className={boton} href={user?'#explorar':'#login'}>Continuar</a></main>
        : <Agenda key={user.id+':'+rol} user={user} rol={rol}/>}
  </div>;
}
function Agenda({user,rol}) {
  const [seccion,cambiarSeccion]=useState('calendario');
  const [vista,cambiarVista]=useState('mes');
  const [fecha,cambiarFecha]=useState(hoyMexico);
  const [version,actualizar]=useState(0);
  const [busqueda,buscar]=useState('');
  const [evento,abrirEvento]=useState(null);
  const [programar,abrirProgramacion]=useState(null);
  const [aviso,avisar]=useState('');
  const rango=rangoVisible(fecha,vista==='semana'?'semana':'mes');
  const calendario=useConsulta(useCallback(()=>api.calendario(user.id,rol,rango.inicio,rango.fin),[user.id,rol,rango.inicio,rango.fin]),version);
  const asignadas=useConsulta(useCallback(()=>rol===4?api.asignadas(user.id):Promise.resolve([]),[user.id,rol]),version);
  function refrescar() {abrirEvento(null);actualizar(n=>n+1);}
  function guardarProgramacion(mensaje) {abrirProgramacion(null);avisar(mensaje);refrescar();}
  function mover(pasos) {abrirEvento(null);cambiarFecha(f=>avanzar(f,pasos,vista==='semana'?'semana':'mes'));}
  const filtrar=filas=>filas.filter(v=>[v.nombre,v.localidad,v.trabajador].filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(busqueda.trim().toLocaleLowerCase('es-MX')));
  return <main className="km-container km-workspace">
    <header className="km-work-banner km-page-heading"><div><h1 className="km-page-title">{rol===5?'Visitas a mis meliponarios':'Agenda de visitas'}</h1>
      <p className="mt-3 text-sm text-muted">{rol===4?'Organiza el día y la hora de tus visitas asignadas.':'Consulta las visitas y su programación.'}</p></div>
      <button className={boton} onClick={refrescar}>Actualizar agenda</button></header>
    <nav className="km-tab-strip km-workspace-bar" aria-label="Vistas de visitas">
      <button className={seccion==='calendario'?primario:boton} onClick={()=>{cambiarSeccion('calendario');abrirEvento(null);}}>Calendario</button>
      {rol===4 && <button className={seccion==='asignadas'?primario:boton} onClick={()=>cambiarSeccion('asignadas')}>Mis asignaciones</button>}
      {rol===3 && <button className={seccion==='historial'?primario:boton} onClick={()=>cambiarSeccion('historial')}>Historial por meliponario</button>}
      {rol===3 && <a className={boton} href="#campo/asignaciones-tecnicas">Coordinación de meliponarios</a>}
      {rol===5 && <a className={boton} href="#mis-meliponarios">Mis meliponarios</a>}
    </nav>
    {aviso && <p role="status" className="mb-4 rounded-xl bg-soft p-4">{aviso}</p>}
    {seccion==='historial' ? <Historial user={user} version={version} inicialRegistro={evento?.registro}/> : <section className="km-panel km-inset">
      <label className="mb-4 block text-sm font-semibold">Buscar meliponario{rol===3?' o trabajador':''}
        <input className="review-field mt-2" type="search" value={busqueda} onChange={e=>buscar(e.target.value)}/></label>
      {seccion==='asignadas' ? <Asignadas resultado={asignadas} filtrar={filtrar} abrir={abrirProgramacion}/> : <>
        <div className="visitas-toolbar"><div className="flex flex-wrap gap-2">
          <button className={boton} onClick={()=>mover(-1)}>Anterior</button>
          <button className={boton} onClick={()=>{abrirEvento(null);cambiarFecha(hoyMexico());}}>Hoy</button>
          <button className={boton} onClick={()=>mover(1)}>Siguiente</button></div>
          <h2 className="font-bold">{fechaVisible(rango.inicio)} – {fechaVisible(rango.fin)}</h2>
          <div className="flex gap-2">{[['mes','Mes'],['semana','Semana'],['lista','Lista']].map(([valor,nombre])=><button key={valor} className={vista===valor?primario:boton} aria-pressed={vista===valor} onClick={()=>{abrirEvento(null);cambiarVista(valor);}}>{nombre}</button>)}</div></div>
        <Lectura resultado={calendario}>{filas=>{
          const visibles=filtrar(filas);
          return <>
            {!visibles.length && <p className="my-4 rounded-xl bg-soft p-4">No hay visitas programadas en este intervalo. Las visitas aparecen cuando el trabajador guarda una fecha.</p>}
            {vista!=='lista' && <div className={'visitas-grid visitas-grid--'+vista}>
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><div className="visitas-dia-semana" key={d}>{d}</div>)}
              {Array.from({length:vista==='semana'?7:42},(_,i)=>sumarDias(rango.inicio,i)).map(d=><div className="visitas-dia" key={d}>
                <span className={d===hoyMexico()?'visitas-hoy':''}>{Number(d.slice(-2))}</span>
                {visibles.filter(v=>v.fecha===d).map(v=><button key={v.id} className="visitas-evento" onClick={()=>abrirEvento(v)}><strong>{v.nombre}</strong><span>{horaVisible(v.hora)}</span></button>)}
              </div>)}
            </div>}
            <div className={vista==='lista'?'grid gap-3':'visitas-lista-movil'}>{visibles.map(v=><button className="km-record-inset p-4 text-left" key={v.id} onClick={()=>abrirEvento(v)}>
              <strong>{v.nombre}</strong><p>{fechaVisible(v.fecha)} · {horaVisible(v.hora)}</p>
              <p className="text-sm">{tiposVisita[v.tipo] || etiqueta(v.tipo)}{v.trabajador?' · '+v.trabajador:''}</p>
            </button>)}</div>
          </>;
        }}</Lectura>
        {evento && <article className="km-record-inset mt-5 grid gap-3 p-5" aria-label="Detalle de visita">
          <h3 className="text-xl font-bold">{evento.nombre}</h3><p>{fechaVisible(evento.fecha)} · {horaVisible(evento.hora)}</p>
          <p>{tiposVisita[evento.tipo] || etiqueta(evento.tipo)}</p>{evento.localidad && <p>{evento.localidad}</p>}
          {evento.trabajador && <p>Trabajador · {evento.trabajador}</p>}<p>Asignación · {etiqueta(evento.estado)}</p>
          {rol!==5 && <p>Ficha técnica · {etiqueta(evento.formulario)}</p>}
          {evento.motivo && <p className="whitespace-pre-wrap">{evento.motivo}</p>}
          <button className={boton+' justify-self-start'} onClick={()=>abrirEvento(null)}>Cerrar detalle</button>
          {rol===3 && <button className={boton+' justify-self-start'} onClick={()=>cambiarSeccion('historial')}>Consultar historial</button>}
        </article>}
      </>}
    </section>}
    {programar && <Programar user={user} visita={programar} cerrar={()=>abrirProgramacion(null)} guardado={guardarProgramacion}/>}
  </main>;
}
function Asignadas({resultado,filtrar,abrir}) {
  const [filtro,cambiar]=useState('sin-fecha');
  return <><h2 className="mb-4 text-xl font-bold">Mis visitas asignadas</h2>
    <div className="mb-4 flex flex-wrap gap-2">{[['sin-fecha','Por programar'],['programadas','Con fecha'],['correcciones','Con correcciones']].map(([id,nombre])=>
      <button key={id} className={filtro===id?primario:boton} aria-pressed={filtro===id} onClick={()=>cambiar(id)}>{nombre}</button>)}</div>
    <Lectura resultado={resultado}>{filas=>{
      const visibles=filtrar(filas).filter(v=>filtro==='sin-fecha'?!v.fecha:filtro==='programadas'?Boolean(v.fecha):Boolean(v.correccion));
      return <div className="grid gap-4">{!visibles.length && <p>No hay visitas en esta sección.</p>}{visibles.map(v=><article className="km-record-inset grid gap-3 p-5" key={v.id}>
        <h3 className="text-lg font-bold">{v.nombre}</h3><p>{tiposVisita[v.tipo] || etiqueta(v.tipo)} · {v.localidad}</p>
        <p>{v.fecha?fechaVisible(v.fecha)+' · '+horaVisible(v.hora):'Fecha pendiente'}</p><p>Ficha técnica · {etiqueta(v.formulario)}</p>
        {v.motivo && <p>{v.motivo}</p>}{v.correccion && <p className="rounded-xl bg-soft p-3">Corrección solicitada · {v.correccion}</p>}
        <button className={primario+' justify-self-start'} onClick={()=>abrir(v)}>{v.fecha?'Cambiar programación':'Programar visita'}</button>
      </article>)}</div>;
    }}</Lectura>
  </>;
}
function Historial({user,version,inicialRegistro}) {
  const [registro,elegir]=useState(inicialRegistro || '');
  const registros=useConsulta(useCallback(()=>api.registrosCoordinador(user.id),[user.id]),version);
  const visitas=useConsulta(useCallback(()=>registro?api.visitasAnteriores(user.id,registro):Promise.resolve([]),[user.id,registro]),version);
  const horarios=useConsulta(useCallback(()=>registro?api.horarios(user.id,registro):Promise.resolve([]),[user.id,registro]),version);
  return <section className="km-panel km-inset">
    <h2 className="text-xl font-bold">Historial por meliponario</h2>
    <Lectura resultado={registros}>{filas=><label className="my-4 block text-sm font-semibold">Meliponario
      <select className="review-field mt-2" value={registro} onChange={e=>elegir(e.target.value)}><option value="">Selecciona un meliponario</option>
        {filas.map(r=><option key={r.id} value={r.id}>{r.nombre}{r.localidad?' · '+r.localidad:''}</option>)}</select>
    </label>}</Lectura>
    {registro && <div className="grid gap-6">
      <section><h3 className="my-4 text-lg font-bold">Historial de visitas técnicas</h3><Lectura resultado={visitas}>{filas=>
        <div className="grid gap-3">{!filas.length && <p>Sin asignaciones en el historial consultado.</p>}{filas.map(v=><article className="km-record-inset p-4" key={v.id}>
          <p className="font-bold">{tiposVisita[v.tipo] || etiqueta(v.tipo)}</p>
          <p>Trabajador · {v.trabajador || 'Nombre no disponible'}</p>
          <p>Asignación · {etiqueta(v.estado)}</p><p>Ficha técnica · {etiqueta(v.formulario)}</p>
          <p>Asignada el {instanteVisible(v.fecha)}</p>
          {v.enviada && <p>Ficha enviada el {instanteVisible(v.enviada)}</p>}
          {v.aprobada && <p>Aprobada el {instanteVisible(v.aprobada)}</p>}{v.motivo && <p>{v.motivo}</p>}
        </article>)}</div>}</Lectura></section>
      <section><h3 className="my-4 text-lg font-bold">Cambios de programación</h3><Lectura resultado={horarios}>{filas=>
        <div className="grid gap-3">{!filas.length && <p>Sin cambios de programación registrados.</p>}{filas.map((v,i)=><article className="km-record-inset grid gap-2 p-4" key={v.id+v.cambio+i}>
          <p className="font-bold">{tiposVisita[v.tipo] || etiqueta(v.tipo)}</p><p>Trabajador · {v.trabajador || 'Nombre no disponible'}</p>
          <p>{v.anterior?'Anterior · '+fechaVisible(v.anterior)+' · '+horaVisible(v.horaAnterior):'Programación inicial'}</p>
          <p>Nueva · {fechaVisible(v.fecha)} · {horaVisible(v.hora)}</p>
          {v.actor && <p>Registró el cambio · {v.actor}</p>}<p>Registrado el {instanteVisible(v.cambio)}</p>{v.motivo && <p>{v.motivo}</p>}
        </article>)}</div>}</Lectura></section>
    </div>}
  </section>;
}
function Programar({user,visita,cerrar,guardado}) {
  const [fecha,elegirFecha]=useState(visita.fecha || hoyMexico());
  const [hora,elegirHora]=useState(visita.hora?.slice(0,5) || '');
  const [motivo,escribir]=useState('');
  const [ocupado,esperar]=useState(false);
  const [incierto,marcar]=useState(false);
  const [error,fallar]=useState('');
  const dialogo=useRef(null);
  const candado=useRef(false);
  useEffect(()=>{const d=dialogo.current;d.showModal();return()=>{if(d.open)d.close();};},[]);
  function salir() {
    if(candado.current)return;
    if((fecha!==visita.fecha || hora!==(visita.hora?.slice(0,5)||'') || motivo) && !window.confirm('¿Cerrar la programación sin terminar?'))return;
    cerrar();
  }
  useEffect(()=>{
    const proteger=e=>{e.preventDefault();if(e.type==='beforeunload')e.returnValue='';};
    window.addEventListener('beforeunload',proteger);
    window.addEventListener('kaabmap:before-owner-leave',proteger);
    return()=>{window.removeEventListener('beforeunload',proteger);window.removeEventListener('kaabmap:before-owner-leave',proteger);};
  },[]);
  async function ejecutar(comprobar) {
    if(candado.current || (!comprobar && incierto))return;
    if(!comprobar && !window.confirm('¿Guardar la visita de '+visita.nombre+' para el '+fechaVisible(fecha)+' · '+horaVisible(hora)+'?'))return;
    candado.current=true;esperar(true);fallar('');
    try{
      if(comprobar){
        const filas=await api.asignadas(user.id);
        const actual=filas.find(f=>f.id===visita.id);
        if(!actual)throw new Error('La visita ya no aparece en tus asignaciones activas. Cierra y actualiza la agenda.');
        if(actual.fecha===fecha && (actual.hora?.slice(0,5)||'')===hora){guardado('Programación comprobada.');return;}
        marcar(false);fallar('La fecha guardada es '+fechaVisible(actual.fecha)+' · '+horaVisible(actual.hora)+'. Revisa tu selección antes de guardar.');
      }else{
        await api.programar(user.id,visita.id,fecha,hora,motivo);
        guardado('Programación guardada. Las otras cuentas pueden actualizar su agenda.');
      }
    }catch(e){fallar(e.message);if(e.incierto)marcar(true);}
    finally{candado.current=false;esperar(false);}
  }
  return <dialog ref={dialogo} aria-labelledby="programar-visita-titulo" onCancel={e=>{e.preventDefault();salir();}}>
    <form onSubmit={e=>{e.preventDefault();ejecutar(false);}} className="grid gap-4">
      <h2 id="programar-visita-titulo" className="text-2xl font-bold">{visita.fecha?'Cambiar programación':'Programar visita'}</h2>
      <p className="font-semibold">{visita.nombre}</p>
      <label>Fecha de visita<input className="review-field mt-2" type="date" required min={hoyMexico()} value={fecha} disabled={ocupado||incierto} onChange={e=>elegirFecha(e.target.value)}/></label>
      <label>Hora opcional<input className="review-field mt-2" type="time" value={hora} disabled={ocupado||incierto} onChange={e=>elegirHora(e.target.value)}/></label>
      <label>Motivo del cambio, opcional<textarea className="review-field mt-2" minLength={10} maxLength={1000} value={motivo} disabled={ocupado||incierto} onChange={e=>escribir(e.target.value)}/></label>
      {error && <p role="alert" className="text-[#944c32]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={boton} disabled={ocupado} onClick={salir}>Cerrar</button>
        {incierto && <button type="button" className={boton} disabled={ocupado} onClick={()=>ejecutar(true)}>Comprobar programación</button>}
        <button className={primario} disabled={ocupado||incierto}>{ocupado?'Guardando…':'Guardar programación'}</button>
      </div>
    </form>
  </dialog>;
}
