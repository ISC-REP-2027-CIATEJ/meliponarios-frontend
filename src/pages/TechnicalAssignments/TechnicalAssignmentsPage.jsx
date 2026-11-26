import { panelCoordinacion } from '../../features/technicalAssignments/bandejaCoordinacion.mjs';
import VisitWorkflow, { Asignar, Revision, Publicacion } from './VisitWorkflow';
import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { supabase } from '../../lib/supabase';
import { crearFlujoVisitas } from '../../features/technicalAssignments/visitWorkflow.mjs';
import {
  asignarMeliponarioTecnico, cancelarAsignacionTecnica,
} from '../../features/technicalAssignments/technicalAssignmentsService';
import '../FieldReviews/FieldReviewsPage.css';

const visitas = crearFlujoVisitas(supabase);
const nombreCompleto = persona => [persona?.nombre, persona?.apellidos].filter(Boolean).join(' ') || 'Nombre no disponible';
async function cargarCoordinador(userId) {
  const sesion = await supabase.auth.getUser();
  if (sesion.error || sesion.data?.user?.id !== userId) throw new Error('Vuelve a iniciar sesión con la cuenta coordinadora.');
  return panelCoordinacion(visitas);
}

const button = 'km-button';
const primary = 'km-button km-button--primary';
const card = 'km-panel km-inset';
const formatDate = value => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(value))
  : 'Sin fecha disponible';

export default function TechnicalAssignmentsPage({ user, sessionReady, onLogout }) {
  const role = Number(user?.roleId);
  return <div className="field-review km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main role="status" className="mx-auto max-w-7xl p-10">Comprobando tu sesión.</main>
      : ![3, 4].includes(role) ? <main className="mx-auto max-w-xl p-10">
        <h1 className="text-3xl font-bold">Asignaciones técnicas</h1>
        <p className="my-5 leading-relaxed">Este espacio requiere una cuenta activa de coordinador o trabajador de campo.</p>
        <a href={user ? '#explorar' : '#login'} className={button}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a>
      </main> : <EntradaVisitas key={`${user.id}:${role}`} user={user} coordinator={role === 3}/>}
  </div>;
}

function EntradaVisitas({ user, coordinator }) {
  return coordinator ? <Workspace user={user}/> : <VisitWorkflow/>;
}

function Workspace({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState('pendientes');
  const [abierta, abrir] = useState(null);
  const [publica, setPublica] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    cargarCoordinador(user.id).then(value => { if (active) { setData(value); setError(''); } })
      .catch(failure => { if (active) { setData(null); setOperation(null); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, revision]);

  function refresh() {
    if (lock.current) return;
    setData(null); setOperation(null); abrir(null); setError(''); setLoading(true);
    setRevision(value => value + 1);
  }
  async function ejecutar(accion, mensaje, comprobar = null) {
    if (lock.current || !data || loading || error) return;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setPublica(null);
    try {
      await accion();
      if (!live.current) return;
      setNotice(mensaje); setPublica(comprobar);
      setOperation(null); abrir(null); setData(null); setLoading(true); setRevision(value => value + 1);
    } catch (failure) {
      if (live.current) { setError(failure.message); setOperation(null); abrir(null); setData(null); }
    } finally { lock.current = false; if (live.current) setBusy(false); }
  }
  function save(values) {
    if (!operation) return;
    if (operation.type === 'cancelar') {
      return ejecutar(() => cancelarAsignacionTecnica(user.id, { asignacionId: operation.row.id, motivo: values.motivo }),
        'Cancelación confirmada. Se conserva el historial.');
    }
    return ejecutar(() => asignarMeliponarioTecnico(user.id, {
      meliponarioId: operation.row.meliponarioId, trabajadorId: values.trabajadorId, motivo: values.motivo,
    }), 'Trabajador actualizado. Consulta las asignaciones vigentes y el historial.');
  }

  const assignments = data?.assignments || [];
  const rows = tab === 'pendientes' ? data?.pending || []
    : tab === 'revisiones' ? data?.revisiones || []
      : assignments.filter(row => tab === 'asignadas' ? row.vigente === true : row.vigente === false);
  const filtros = [
    ['pendientes', 'Por asignar', data?.pending.length || 0],
    ['asignadas', 'Asignaciones vigentes', assignments.filter(row => row.vigente === true).length],
    ['revisiones', 'Fichas técnicas', data?.revisiones.length || 0],
    ['historial', 'Historial', assignments.filter(row => row.vigente === false).length],
  ];
  const titulo = filtros.find(([id]) => id === tab)[1];
  const search = query.trim().toLocaleLowerCase('es-MX');
  const filtered = rows.filter(row => [row.nombre, row.localidad, row.municipio, row.trabajadorNombre].filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(search));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  return <main className="km-container km-workspace">
    <div className="km-work-banner km-page-heading">
      <div>
        <h1 className="km-page-title">Coordinación de meliponarios</h1>
        <a className="km-button mt-3" href="#agenda-visitas">Agenda e historial de visitas</a>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">Asigna equipo y trabajador, consulta las visitas vigentes y revisa las fichas técnicas desde este espacio.</p>
      </div>
      <button type="button" className={button} disabled={loading || busy} onClick={refresh}>{loading ? 'Actualizando…' : 'Actualizar registros'}</button>
    </div>
    {notice && <p role="status" className="mb-5 break-words rounded-2xl bg-soft p-4 text-sm">{notice}</p>}
    {error && <div role="alert" className="mb-5 rounded-2xl bg-[#fff0e5] p-5 text-sm"><p>{error}</p><p className="mt-2">Actualiza para comprobar el resultado antes de intentar otra operación.</p></div>}
    {publica && <Publicacion registro={publica}/>}
    {loading ? <p role="status" className="py-10">Consultando tus asignaciones en Supabase.</p> : data && <>
      {data.avisos?.map(aviso => <p key={aviso} role="status" className="mb-2">{aviso}</p>)}
      <>
        <section className="mb-6 rounded-2xl bg-soft p-5" aria-label="Zonas del coordinador">
          <h2 className="text-sm font-bold">Zonas de los registros consultados</h2><p className="mt-2 text-sm">{data.zones.length ? data.zones.map(zone => zone.nombre).join(' · ') : 'Sin zonas en los registros consultados.'}</p>
        </section>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Bandejas de coordinación">
          {filtros.map(([id, label, total]) =>
            <button key={id} type="button" disabled={busy} aria-pressed={tab === id} className="km-panel km-queue-filter" onClick={() => { setTab(id); setQuery(''); setPage(1); abrir(null); }}>
              <span className="block text-sm">{label}</span><span className="mt-2 block text-3xl font-bold">{data.fuentes[id] ? total : '—'}</span>
            </button>)}
        </div>
      </>
      <section className={card} aria-label="Listado de meliponarios">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold">{titulo}</h2><p className="mt-2 text-sm text-muted">{data.fuentes[tab] ? filtered.length + ' registros' : 'Consulta pendiente'}</p></div>
          <div className="w-full sm:w-80"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-search">Buscar meliponario, localidad o trabajador</label>
            <input id="technical-search" className="review-field" type="search" maxLength={160} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></div>
        </div>
        {tab === 'pendientes' && <p className="mb-5 rounded-xl bg-soft p-4 text-sm leading-relaxed">Elige un meliponario con aprobación básica, después su equipo y el trabajador que realizará la primera visita.</p>}
        {tab === 'revisiones' && <p className="mb-5 rounded-xl bg-soft p-4 text-sm">Aquí aparecen las fichas técnicas que devuelve el backend para tu cuenta y cobertura. El trabajador captura y envía sus datos desde la app para que puedas revisarlos.</p>}
        {tab === 'revisiones' ? <div className="grid gap-4">{visible.map(row => <article key={row.id} className="km-record-inset p-5">
          <h3 className="text-xl font-bold">{row.nombre}</h3>
          <p className="mt-2 text-sm text-muted">{[row.trabajadorNombre, row.localidad, row.estado.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p>
          <button type="button" className={button + ' mt-4'} disabled={busy} aria-expanded={abierta === row.id}
            onClick={() => abrir(abierta === row.id ? null : row.id)}>{abierta === row.id ? 'Cerrar ficha' : 'Revisar ficha técnica'}</button>
          {abierta === row.id && <div className="mt-5"><Revision fila={row} ocupado={busy} ejecutar={ejecutar}/></div>}
        </article>)}</div> : <>
        <div className="grid gap-4 lg:grid-cols-2">{visible.map(row => <article key={row.id} className="km-record-inset p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-bosque">{tab === 'pendientes' ? 'Aprobación básica' : row.vigente ? 'Asignación vigente' : (row.estado || 'Historial').replaceAll('_', ' ')}</p>
          <h3 className="text-xl font-bold">{row.nombre}</h3>
          {row.localidad && <p className="mt-2 text-sm text-muted">{[row.localidad, row.municipio].filter(Boolean).join(' · ')}</p>}
          {row.trabajadorNombre && <p className="mt-2 break-all text-xs text-muted">Trabajador: {row.trabajadorNombre}</p>}
          {row.asignadaEn && <p className="mt-3 text-sm">Asignación registrada: {formatDate(row.asignadaEn)}</p>}
          {row.motivo && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{row.motivo}</p>}
          {row.estado === 'cancelada' && <><p className="mt-3 text-sm">Cancelada: {formatDate(row.canceladaEn)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{row.motivoCancelacion}</p></>}
          {tab === 'pendientes' && <button type="button" className={`${primary} mt-5`} disabled={busy} aria-expanded={abierta === row.id} onClick={() => abrir(abierta === row.id ? null : row.id)}>{abierta === row.id ? 'Cerrar selección' : 'Asignar equipo y trabajador'}</button>}
          {tab === 'pendientes' && abierta === row.id && <div className="mt-5">
            <Asignar registro={row} user={user} ocupado={busy} ejecutar={ejecutar}/>
          </div>}
          {row.cancelable && <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className={button} disabled={busy} onClick={() => setOperation({ type: 'reasignar', row })}>Cambiar trabajador</button>
            <button type="button" className={`${button} !text-[#944c32]`} disabled={busy} onClick={() => setOperation({ type: 'cancelar', row })}>Cancelar asignación</button>
          </div>}
        </article>)}</div>
        </>}
        {!visible.length && <p className="rounded-xl bg-[#f3f5ed] p-5 text-sm leading-relaxed">{
          !data.fuentes[tab] ? 'No se pudo completar esta consulta. Pulsa Actualizar registros para volver a intentarlo.'
            : query.trim() ? 'No hay coincidencias para esta búsqueda.'
              : tab === 'revisiones' ? 'No hay fichas técnicas en esta bandeja. Una asignación por sí sola aún no incluye una ficha enviada. Las fichas ya aprobadas pueden dejar de aparecer en la bandeja pendiente.'
                : 'No hay registros en esta bandeja para tu cobertura actual.'}</p>}
        <nav className="mt-5 flex items-center gap-3" aria-label="Páginas de meliponarios asignados">
          <button type="button" className={button} disabled={currentPage === 1 || busy} onClick={() => setPage(currentPage - 1)}>Anterior</button>
          <span className="text-sm">{currentPage} de {pages}</span>
          <button type="button" className={button} disabled={currentPage === pages || busy} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
        </nav>
      </section>
      <section className="mt-6 rounded-2xl bg-soft p-5" aria-label="Siguiente etapa del registro">
        <h2 className="text-sm font-bold">La publicación requiere la validación técnica</h2>
        <p className="mt-2 text-sm leading-relaxed">Asignar un meliponario no aprueba su ficha técnica ni lo publica. Para publicar se necesita registro básico aprobado, formulario técnico aprobado, teléfono de contacto, GPS válido y meliponario activo.</p>
      </section>
    </>}
    {operation && <OperationDialog operation={operation} busy={busy} onCancel={() => { if (!lock.current) setOperation(null); }} onConfirm={save}/>}
  </main>;
}

function OperationDialog({ operation, busy, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const [worker, setWorker] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const cancel = operation.type === 'cancelar';
  const title = cancel ? 'Cancelar asignación técnica' : 'Cambiar trabajador asignado';
  useEffect(() => {
    const element = dialog.current; element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  const [personas, setPersonas] = useState(null);
  useEffect(() => {
    if (cancel) return;
    let active = true;
    visitas.candidatos(operation.row.meliponarioId)
      .then(rows => { if (active) setPersonas(rows.filter(p => p.usuario_id !== operation.row.trabajadorId)
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX'))); })
      .catch(() => { if (active) { setPersonas([]); setError('No pudimos cargar los trabajadores elegibles. Cierra y vuelve a abrir la selección.'); } });
    return () => { active = false; };
  }, [cancel, operation.row.meliponarioId, operation.row.trabajadorId]);
  const elegido = personas?.find(p => p.usuario_id === worker);
  function submit(event) {
    event.preventDefault();
    if (busy) return;
    const workerId = worker.trim();
    const size = Array.from(reason.trim()).length;
    if (!cancel && !elegido) { setError('Elige un trabajador de tu equipo disponible para esta visita.'); return; }
    if (!cancel && workerId.toLowerCase() === operation.row.trabajadorId?.toLowerCase()) { setError('Selecciona un trabajador diferente al asignado actualmente.'); return; }
    if (size < 10 || size > 1000) { setError('Escribe un motivo de 10 a 1000 caracteres.'); return; }
    setError('');
    if (!preview) { setPreview(true); return; }
    void onConfirm({ trabajadorId: workerId, motivo: reason.trim() });
  }
  return <dialog ref={dialog} aria-labelledby="technical-operation-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <form onSubmit={submit}>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-bosque">Coordinación de campo</p>
      <h2 id="technical-operation-title" className="text-2xl font-extrabold">{title}</h2>
      <p className="mt-4 text-lg font-bold">{operation.row.nombre}</p>
      {!preview ? <>
        {!cancel && <div className="mt-5"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-worker">Trabajador de campo</label>
          <select autoFocus id="technical-worker" className="review-field" value={worker} required disabled={busy || !personas?.length} onChange={e => setWorker(e.target.value)}>
            <option value="">{!personas ? 'Consultando trabajadores…' : personas.length ? 'Elige por nombre' : 'Sin trabajadores elegibles'}</option>
            {personas?.map(p => <option key={p.usuario_id} value={p.usuario_id}>{nombreCompleto(p)}</option>)}</select>
          {personas?.length === 0 && !error && <p className="mt-2 text-sm text-muted">No hay otro trabajador disponible en tu equipo para este meliponario.</p>}
        </div>}
        <div className="mt-5"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-reason">Motivo (obligatorio)</label>
          <textarea autoFocus={cancel} id="technical-reason" className="review-field" value={reason} minLength={10} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} required aria-describedby="technical-reason-help"/>
          <p id="technical-reason-help" className="mt-2 text-xs text-muted">De 10 a 1000 caracteres. Se conserva como parte de la asignación.</p>
        </div>
      </> : <div className="mt-5 rounded-2xl bg-soft p-4 text-sm leading-relaxed">
        {!cancel && <p className="break-all"><strong>Trabajador:</strong> {nombreCompleto(elegido)}</p>}
        <p className="mt-3 whitespace-pre-wrap break-words"><strong>Motivo:</strong> {reason.trim()}</p>
        <p className="mt-4">{cancel ? 'Se cancelará esta asignación. El registro se conservará en el historial.' : 'Supabase cancelará la asignación vigente y registrará al nuevo trabajador en una sola operación.'}</p>
        {!cancel && <p className="mt-3">Esta operación no agenda una fecha ni publica el meliponario.</p>}
      </div>}
      {error && <p className="mt-4 text-sm text-[#944c32]" role="alert">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={button} disabled={busy} onClick={onCancel}>Cerrar</button>
        {preview && <button type="button" className={button} disabled={busy} onClick={() => setPreview(false)}>Editar datos</button>}
        <button type="submit" className={primary} disabled={busy || (!cancel && !elegido)}>{busy ? 'Guardando…' : preview ? 'Confirmar operación' : 'Revisar antes de guardar'}</button>
      </div>
    </form>
  </dialog>;
}
