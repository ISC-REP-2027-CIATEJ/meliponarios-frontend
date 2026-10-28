import { useEffect, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { obtenerAsignaciones, asignarZona, finalizarAsignacion } from '../../features/territory/territoryService';
import '../FieldReviews/FieldReviewsPage.css';

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-solid border-[#d4decc] bg-white px-4 py-2 text-sm font-semibold text-[#163e2c] no-underline hover:bg-[#edf2e7] disabled:opacity-50';
const primary = `${button} !border-[#163e2c] !bg-[#163e2c] !text-white`;
const empty = { usuarios: [], zonas: [], asignaciones: [] };
const name = row => [row.nombre, row.apellidos].filter(Boolean).join(' ');
const role = id => Number(id) === 3 ? 'Coordinador de campo' : Number(id) === 4 ? 'Trabajador de campo' : 'Otro rol';
const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(value)) : 'Sin fecha de finalización';

export default function AdminAssignmentsPage({ user, sessionReady, onLogout }) {
  return <div className="field-review min-h-screen bg-[#f8f7f1]"><OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="mx-auto max-w-6xl p-10" role="status">Comprobando sesión.</main> : Number(user?.roleId) !== 1 ? <main className="mx-auto max-w-xl p-10"><h1 className="text-3xl font-bold">Asignaciones requiere administrador general</h1><a className={`${button} mt-5`} href={user ? '#explorar' : '#login'}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a></main> : <Workspace key={user.id} userId={user.id}/>}</div>;
}

function Workspace({ userId }) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [usuarioId, setUsuarioId] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [filter, setFilter] = useState('vigentes');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const dialog = useRef(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    obtenerAsignaciones(userId).then(value => { if (active) { setData(value); setError(''); setBlocked(false); } })
      .catch(failure => { if (active) { setData(empty); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, revision]);
  useEffect(() => {
    const element = dialog.current;
    if (modal && !element.open) element.showModal();
    if (!modal && element.open) element.close();
  }, [modal]);
  function refresh() { setLoading(true); setData(empty); setError(''); setRevision(value => value + 1); }
  const target = data.usuarios.find(row => row.id === usuarioId);
  const zone = data.zonas.find(row => row.id === zonaId);
  const filtered = useMemo(() => data.asignaciones.filter(row =>
    (filter === 'todas' || (filter === 'vigentes' ? row.vigente : !row.vigente)) &&
    `${name(row)} ${row.zona}`.toLocaleLowerCase('es-MX').includes(search.trim().toLocaleLowerCase('es-MX'))), [data, filter, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  function confirmCreate(event) {
    event.preventDefault();
    if (loading || saving || error || blocked || !target || !zone?.activo || !zone.localidades.length) return;
    setModal({ type: 'crear', usuario: target, zona: zone, values: { id: draftId, usuarioId, zonaId, observaciones } });
  }
  async function save() {
    if (lock.current || !modal || blocked) return;
    lock.current = true; setSaving(true); setError('');
    try {
      if (modal.type === 'crear') await asignarZona(userId, modal.values);
      else await finalizarAsignacion(userId, modal.row.id);
      if (!mounted.current) return;
      setNotice(modal.type === 'crear' ? 'Asignación guardada en Supabase. Actualizando el listado.' : 'Asignación finalizada en Supabase. Se conserva en el historial.');
      if (modal.type === 'crear') { setUsuarioId(''); setZonaId(''); setObservaciones(''); setDraftId(crypto.randomUUID()); }
      setModal(null); refresh();
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure.message); setModal(null);
      if (failure.uncertain || failure.code === 'ACCESS_DENIED') { setBlocked(true); setData(empty); }
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }
  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
    <nav className="mb-7 flex flex-wrap gap-3" aria-label="Administración"><a className={button} href="#administracion/usuarios">Usuarios</a><a className={primary} href="#administracion/asignaciones" aria-current="page">Asignaciones</a></nav>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#94752c]">Administración general</p><h1 className="text-3xl font-extrabold">Asignaciones de zonas</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66755e]">Asigna las zonas de consulta de los coordinadores y las zonas de revisión de los trabajadores de campo.</p></div><button type="button" className={button} disabled={loading || saving} onClick={refresh}>{loading ? 'Actualizando…' : 'Actualizar asignaciones'}</button></div>
    {notice && <p role="status" className="mb-5 rounded-2xl bg-[#e9f2df] p-4 text-sm">{notice}</p>}
    {error && <div role="alert" className="mb-5 rounded-2xl bg-[#fff0e5] p-5 text-sm"><p>{error}</p><p className="mt-2">Actualiza antes de intentar otra operación. La sesión y los permisos se vuelven a comprobar en Supabase.</p></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
      <section className="rounded-3xl border border-solid border-[#dde4d5] bg-white p-6"><h2 className="text-xl font-bold">Nueva asignación</h2><p className="mt-3 text-sm leading-relaxed text-[#66755e]">El permiso abarca las localidades activas incluidas en la zona elegida.</p><form className="mt-5 grid gap-5" onSubmit={confirmCreate}>
        <div><label htmlFor="assignment-user" className="mb-2 block text-sm font-semibold">Coordinador o trabajador</label><select id="assignment-user" className="review-field" value={usuarioId} disabled={loading || saving || blocked || Boolean(error)} required onChange={event => setUsuarioId(event.target.value)}><option value="">Selecciona una cuenta</option>{data.usuarios.map(row => <option key={row.id} value={row.id}>{name(row)} · {role(row.rol_id)}</option>)}</select></div>
        <div><label htmlFor="assignment-zone" className="mb-2 block text-sm font-semibold">Zona</label><select id="assignment-zone" className="review-field" value={zonaId} disabled={loading || saving || blocked || Boolean(error)} required onChange={event => setZonaId(event.target.value)}><option value="">Selecciona una zona</option>{data.zonas.map(row => <option key={row.id} value={row.id} disabled={!row.activo || !row.localidades.length}>{row.nombre}{!row.activo ? ' · Inactiva' : !row.localidades.length ? ' · Sin localidades activas' : ''}</option>)}</select></div>
        {zone && <div className="rounded-2xl bg-[#f2f6eb] p-4 text-sm"><p className="font-semibold">Localidades de la zona</p><ul className="mb-0 mt-3 max-h-52 list-disc space-y-2 overflow-auto pl-5">{zone.localidades.map(local => <li key={local.id}>{local.nombre} · {local.municipio}</li>)}</ul></div>}
        <div><label htmlFor="assignment-notes" className="mb-2 block text-sm font-semibold">Observaciones (opcional)</label><textarea id="assignment-notes" className="review-field" maxLength={2000} value={observaciones} disabled={loading || saving || blocked || Boolean(error)} onChange={event => setObservaciones(event.target.value)}/></div>
        <button type="submit" className={primary} disabled={loading || saving || blocked || Boolean(error) || !target || !zone?.activo || !zone.localidades.length}>Asignar zona</button>
      </form>{!loading && !error && !data.usuarios.length && <p className="mt-4 text-sm text-[#806023]">No hay coordinadores o trabajadores activos. Crea sus cuentas desde Usuarios.</p>}{!loading && !error && !data.zonas.length && <p className="mt-4 text-sm text-[#806023]">El catálogo de zonas está vacío. Se necesita registrar su cobertura en el backend.</p>}</section>
      <section className="min-w-0 rounded-3xl border border-solid border-[#dde4d5] bg-white p-6"><h2 className="text-xl font-bold">Asignaciones registradas</h2><div className="my-5 grid gap-3 sm:grid-cols-2"><div><label htmlFor="assignment-search" className="mb-2 block text-sm font-semibold">Buscar cuenta o zona</label><input type="search" id="assignment-search" className="review-field" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></div><div><label htmlFor="assignment-status" className="mb-2 block text-sm font-semibold">Mostrar</label><select id="assignment-status" className="review-field" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="vigentes">Vigentes</option><option value="finalizadas">No vigentes</option><option value="todas">Todas</option></select></div></div>
        {loading ? <p role="status">Leyendo asignaciones desde Supabase.</p> : !error && <><p className="mb-4 text-xs text-[#68765e]">{filtered.length} asignaciones</p><div className="grid gap-3">{visible.map(row => <article key={row.id} className="rounded-2xl border border-solid border-[#e0e6d8] p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{name(row)}</h3><p className="mt-1 text-xs text-[#68765e]">{role(row.rol_id)}</p></div><span className="text-xs font-bold text-[#64773f]">{row.vigente ? 'Vigente' : 'No vigente'}</span></div><p className="mt-3 text-sm font-semibold">{row.zona}{!row.zona_activa && ' · Zona inactiva'}</p><p className="mt-2 text-xs text-[#68765e]">Desde {date(row.fecha_inicio)}</p><p className="mt-1 text-xs text-[#68765e]">{row.fecha_fin ? `Hasta ${date(row.fecha_fin)}` : 'Sin fecha de finalización'}</p>{row.observaciones && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-[#68765e]">{row.observaciones}</p>}{row.vigente && <button type="button" className={`${button} mt-4`} disabled={saving || blocked} onClick={() => setModal({ type: 'finalizar', row })}>Finalizar asignación</button>}</article>)}{!visible.length && <p className="rounded-xl bg-[#f3f5ed] p-5 text-sm">No hay asignaciones para estos filtros.</p>}</div><nav className="mt-5 flex items-center gap-3" aria-label="Páginas de asignaciones"><button type="button" className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span className="text-xs">{currentPage} de {pages}</span><button type="button" className={button} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav></>}
      </section>
    </div>
    <dialog ref={dialog} aria-labelledby="assignment-confirm-title" onCancel={event => { event.preventDefault(); if (!lock.current) setModal(null); }}><h2 id="assignment-confirm-title" className="text-2xl font-bold">{modal?.type === 'crear' ? 'Confirmar asignación' : 'Finalizar asignación'}</h2>{modal && <p className="mt-4 text-sm leading-relaxed">{modal.type === 'crear' ? `${name(modal.usuario)} tendrá acceso a las localidades de ${modal.zona.nombre} con su rol de ${role(modal.usuario.rol_id)}.` : `${name(modal.row)} dejará de recibir acceso por esta asignación a ${modal.row.zona}. Su registro se conserva en el historial.`}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button className={button} type="button" disabled={saving} onClick={() => setModal(null)}>Cancelar</button><button className={primary} type="button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Confirmar'}</button></div></dialog>
  </main>;
}
