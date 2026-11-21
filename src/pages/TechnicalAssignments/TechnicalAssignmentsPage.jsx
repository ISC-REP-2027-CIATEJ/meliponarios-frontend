import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { validId } from '../../features/territory/territoryApi.mjs';
import {
  obtenerAsignacionesCoordinador, obtenerMeliponariosAsignados,
  asignarMeliponarioTecnico, cancelarAsignacionTecnica,
} from '../../features/technicalAssignments/technicalAssignmentsService';
import '../FieldReviews/FieldReviewsPage.css';

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
      </main> : <Workspace key={`${user.id}:${role}`} user={user} coordinator={role === 3}/>}
  </div>;
}

function Workspace({ user, coordinator }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState('pendientes');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    const read = coordinator ? obtenerAsignacionesCoordinador : obtenerMeliponariosAsignados;
    read(user.id).then(value => { if (active) { setData(value); setError(''); } })
      .catch(failure => { if (active) { setData(null); setOperation(null); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, coordinator, revision]);

  function refresh() {
    if (lock.current) return;
    setData(null); setOperation(null); setError(''); setLoading(true);
    setRevision(value => value + 1);
  }
  async function save(values) {
    if (lock.current || !operation || !data) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const id = operation.type === 'cancelar'
        ? await cancelarAsignacionTecnica(user.id, { asignacionId: operation.row.id, motivo: values.motivo })
        : await asignarMeliponarioTecnico(user.id, {
          meliponarioId: operation.row.meliponarioId, trabajadorId: values.trabajadorId, motivo: values.motivo,
        });
      if (!live.current) return;
      setNotice(operation.type === 'cancelar'
        ? `Cancelación confirmada. Se conserva el historial de la asignación ${id}.`
        : `Asignación confirmada en Supabase: ${id}. Actualizando los registros.`);
      setOperation(null); setData(null); setLoading(true); setRevision(value => value + 1);
    } catch (failure) {
      if (live.current) { setError(failure.message); setOperation(null); setData(null); }
    } finally { lock.current = false; if (live.current) setBusy(false); }
  }

  const assignments = coordinator ? data?.assignments || [] : [];
  const rows = coordinator
    ? tab === 'pendientes' ? data?.pending || [] : assignments.filter(row => tab === 'asignadas' ? row.estado === 'asignada' : row.estado === 'cancelada')
    : data || [];
  const search = query.trim().toLocaleLowerCase('es-MX');
  const filtered = rows.filter(row => [row.nombre, row.localidad, row.municipio, row.meliponarioId, row.trabajadorId].filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(search));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  return <main className="km-container km-workspace">
    <nav aria-label="Trabajo de campo" className="km-tab-strip km-workspace-bar">
      <a href="#campo/solicitudes" className={button}>Solicitudes básicas</a>
      <a href="#campo/asignaciones-tecnicas" className={primary} aria-current="page">{coordinator ? 'Asignación de meliponarios' : 'Meliponarios asignados'}</a>
    </nav>
    <div className="km-work-banner km-page-heading">
      <div>
        <h1 className="km-page-title">{coordinator ? 'Asignación de meliponarios' : 'Meliponarios asignados'}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{coordinator
          ? 'Asigna un trabajador de la zona después de la aprobación básica. El trabajador organizará su visita y la revisión técnica será un paso posterior.'
          : 'Consulta los meliponarios que el coordinador te asignó para verificar sus datos y realizar la captura técnica.'}</p>
      </div>
      <button type="button" className={button} disabled={loading || busy} onClick={refresh}>{loading ? 'Actualizando…' : 'Actualizar registros'}</button>
    </div>
    {notice && <p role="status" className="mb-5 break-words rounded-2xl bg-soft p-4 text-sm">{notice}</p>}
    {error && <div role="alert" className="mb-5 rounded-2xl bg-[#fff0e5] p-5 text-sm"><p>{error}</p><p className="mt-2">Actualiza para comprobar el resultado antes de intentar otra operación.</p></div>}
    {loading ? <p role="status" className="py-10">Consultando tus asignaciones en Supabase.</p> : data && <>
      {coordinator && <>
        <section className="mb-6 rounded-2xl bg-soft p-5" aria-label="Zonas del coordinador">
          <h2 className="text-sm font-bold">Tus zonas activas</h2><p className="mt-2 text-sm">{data.zones.length ? data.zones.map(zone => zone.nombre).join(' · ') : 'No tienes zonas activas asignadas. Solicita al administrador que revise tu cobertura.'}</p>
        </section>
        <div className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Bandejas de asignación">
          {[['pendientes', 'Básicas aprobadas por asignar', data.pending.length], ['asignadas', 'Asignaciones vigentes', assignments.filter(row => row.estado === 'asignada').length], ['historial', 'Asignaciones canceladas', assignments.filter(row => row.estado === 'cancelada').length]].map(([id, label, total]) =>
            <button key={id} type="button" disabled={busy} aria-pressed={tab === id} className="km-panel km-queue-filter" onClick={() => { setTab(id); setPage(1); }}>
              <span className="block text-sm">{label}</span><span className="mt-2 block text-3xl font-bold">{total}</span>
            </button>)}
        </div>
      </>}
      <section className={card} aria-label="Listado de meliponarios">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold">{coordinator ? tab === 'pendientes' ? 'Por asignar' : tab === 'asignadas' ? 'Meliponarios con trabajador' : 'Historial de cancelaciones' : 'Tu bandeja de asignaciones'}</h2><p className="mt-2 text-sm text-muted">{filtered.length} registros</p></div>
          <div className="w-full sm:w-80"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-search">Buscar nombre, localidad o identificador</label>
            <input id="technical-search" className="review-field" type="search" maxLength={160} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></div>
        </div>
        {coordinator && tab === 'pendientes' && <p className="mb-5 rounded-xl bg-soft p-4 text-sm leading-relaxed">Se muestran las aprobaciones más recientes entre las solicitudes consultables. Al asignar se comprobará nuevamente la aprobación vigente y la cobertura del trabajador.</p>}
        <div className="grid gap-4 lg:grid-cols-2">{visible.map(row => <article key={row.id} className="km-record-inset p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-bosque">{coordinator ? tab === 'pendientes' ? 'Aprobación básica' : row.estado === 'asignada' ? 'Asignación vigente' : 'Asignación cancelada' : 'Asignado por coordinación'}</p>
          <h3 className="text-xl font-bold">{row.nombre}</h3>
          {row.localidad && <p className="mt-2 text-sm text-muted">{[row.localidad, row.municipio].filter(Boolean).join(' · ')}</p>}
          <p className="mt-3 break-all text-xs text-muted">Meliponario: {row.meliponarioId}</p>
          {row.trabajadorId && <p className="mt-2 break-all text-xs text-muted">Trabajador: {row.trabajadorId}</p>}
          {row.asignadaEn && <p className="mt-3 text-sm">Asignación registrada: {formatDate(row.asignadaEn)}</p>}
          {row.motivo && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{row.motivo}</p>}
          {row.estado === 'cancelada' && <><p className="mt-3 text-sm">Cancelada: {formatDate(row.canceladaEn)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{row.motivoCancelacion}</p></>}
          {coordinator && tab === 'pendientes' && <button type="button" className={`${primary} mt-5`} disabled={busy} onClick={() => setOperation({ type: 'asignar', row })}>Asignar trabajador</button>}
          {coordinator && row.estado === 'asignada' && <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className={button} disabled={busy} onClick={() => setOperation({ type: 'reasignar', row })}>Cambiar trabajador</button>
            <button type="button" className={`${button} !text-[#944c32]`} disabled={busy} onClick={() => setOperation({ type: 'cancelar', row })}>Cancelar asignación</button>
          </div>}
          {!coordinator && <p className="mt-4 rounded-xl bg-[#f3f5ed] p-3 text-sm">La asignación no incluye una fecha de visita. La agenda y el formulario técnico están pendientes de habilitar.</p>}
        </article>)}</div>
        {!visible.length && <p className="rounded-xl bg-[#f3f5ed] p-5 text-sm leading-relaxed">{query.trim() ? 'No hay registros para esta búsqueda.' : coordinator ? 'No hay registros en esta bandeja para tus zonas actuales.' : 'No tienes meliponarios asignados en tus zonas vigentes. El coordinador debe asignarte un registro con aprobación básica.'}</p>}
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
  const title = cancel ? 'Cancelar asignación técnica' : operation.type === 'reasignar' ? 'Cambiar trabajador asignado' : 'Asignar meliponario';
  useEffect(() => {
    const element = dialog.current; element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  function submit(event) {
    event.preventDefault();
    if (busy) return;
    const workerId = worker.trim();
    const size = Array.from(reason.trim()).length;
    if (!cancel && !validId(workerId)) { setError('Copia el identificador completo del trabajador proporcionado por el administrador.'); return; }
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
      <p className="mt-4 text-lg font-bold">{operation.row.nombre}</p><p className="mt-2 break-all text-xs text-muted">{operation.row.meliponarioId}</p>
      {!preview ? <>
        {!cancel && <div className="mt-5"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-worker">Identificador del trabajador</label>
          <input autoFocus id="technical-worker" className="review-field" value={worker} maxLength={36} disabled={busy} onChange={event => setWorker(event.target.value)} required autoComplete="off" spellCheck={false} aria-describedby="technical-worker-help"/>
          <p id="technical-worker-help" className="mt-2 text-xs leading-relaxed text-muted">Pide al administrador el identificador de un trabajador de esta zona. La cuenta debe estar activa y tener cobertura vigente.</p>
        </div>}
        <div className="mt-5"><label className="mb-2 block text-sm font-semibold" htmlFor="technical-reason">Motivo (obligatorio)</label>
          <textarea autoFocus={cancel} id="technical-reason" className="review-field" value={reason} minLength={10} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} required aria-describedby="technical-reason-help"/>
          <p id="technical-reason-help" className="mt-2 text-xs text-muted">De 10 a 1000 caracteres. Se conserva como parte de la asignación.</p>
        </div>
      </> : <div className="mt-5 rounded-2xl bg-soft p-4 text-sm leading-relaxed">
        {!cancel && <p className="break-all"><strong>Trabajador:</strong> {worker.trim()}</p>}
        <p className="mt-3 whitespace-pre-wrap break-words"><strong>Motivo:</strong> {reason.trim()}</p>
        <p className="mt-4">{cancel ? 'Se cancelará esta asignación. El registro se conservará en el historial.' : operation.type === 'reasignar' ? 'Supabase cancelará la asignación vigente y registrará al nuevo trabajador en una sola operación.' : 'Se registrará la asignación. El trabajador podrá consultarla al actualizar su bandeja.'}</p>
        {!cancel && operation.type !== 'reasignar' && <p className="mt-3">Si otro coordinador ya asignó este meliponario, al confirmar se sustituirá esa asignación por la indicada aquí.</p>}
        {!cancel && <p className="mt-3">Esta operación no agenda una fecha ni publica el meliponario.</p>}
      </div>}
      {error && <p className="mt-4 text-sm text-[#944c32]" role="alert">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={button} disabled={busy} onClick={onCancel}>Cerrar</button>
        {preview && <button type="button" className={button} disabled={busy} onClick={() => setPreview(false)}>Editar datos</button>}
        <button type="submit" className={primary} disabled={busy}>{busy ? 'Guardando…' : preview ? 'Confirmar operación' : 'Revisar antes de guardar'}</button>
      </div>
    </form>
  </dialog>;
}
