import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OwnerHeader } from '../../components/ClientNavigation';
import { mapConfig } from '../Map/mapConfig';
import { obtenerSolicitudesCampo, obtenerFichaCampo, tomarSolicitudCampo, resolverSolicitudCampo } from '../../features/territory/territoryService';
import { REVIEW_STATES, REVIEW_TABS, REVIEW_CHECKS, canReview, minimumDataErrors, validateDecision, formatReviewDate, validCoordinates } from '../../features/fieldReviews/fieldReviewsModel.mjs';
import './FieldReviewsPage.css';

const baseButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-solid px-4 py-2 text-sm font-semibold no-underline transition disabled:opacity-50';
const button = `${baseButton} border-[#d4dfcc] bg-white text-[#163e2c] hover:bg-[#edf2e7]`;
const primary = `${baseButton} border-[#163e2c] bg-[#163e2c] text-white hover:bg-[#285940]`;
const decisionLabels = { aprobar: 'Aprobar solicitud', correccion: 'Solicitar correcciones', rechazar: 'Rechazar solicitud' };

function StateTag({ state }) {
  const colors = {
    enviada: 'bg-[#fcf1d2] text-[#75581d]', en_revision: 'bg-[#e5eef6] text-[#315c7b]',
    correccion: 'bg-[#fff0df] text-[#8a5129]', aprobada: 'bg-[#e9f1df] text-[#375d29]',
    rechazada: 'bg-[#f6e9e3] text-[#89442f]',
  };
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${colors[state] || 'bg-[#f0f0ea]'}`}>{REVIEW_STATES[state] || 'Estado no disponible'}</span>;
}

export default function FieldReviewsPage({ user, sessionReady = true, onLogout }) {
  return <div className="field-review min-h-screen bg-[#f8f7f1]"><OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="mx-auto max-w-6xl p-10" role="status">Comprobando tu sesión.</main> : ![3,4].includes(Number(user?.roleId)) ? <main className="mx-auto max-w-xl p-10"><h1 className="text-3xl font-bold">Solicitudes de campo</h1><p className="my-5 leading-relaxed">Este panel requiere una cuenta de coordinador o trabajador de campo activa. El administrador asigna las zonas desde Asignaciones.</p><a className={button} href={user ? '#explorar' : '#login'}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a></main> : <RealWorkspace key={user.id} user={user}/>}
  </div>;
}

function RealWorkspace({ user }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('pendientes');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const live = useRef(false);
  const request = useRef(0);
  const heading = useRef(null);
  useEffect(() => { live.current = true; return () => { live.current = false; request.current = -1; }; }, []);
  useEffect(() => {
    let active = true;
    obtenerSolicitudesCampo(user.id, { estado: status, busqueda: query, offset: page * 20 }).then(value => {
      if (!active) return;
      setData(value); setError('');
      if (page > 0 && page * 20 >= value.total) { setPage(0); setLoading(true); }
    }).catch(failure => { if (active) { setData(null); setSelected(null); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, status, query, page, revision]);
  useEffect(() => { if (selected) heading.current?.focus(); }, [selected]);
  function refresh() { request.current++; setSelected(null); setDetailLoading(false); setData(null); setLoading(true); setError(''); setRevision(value => value + 1); }
  function changeStatus(value) { refresh(); setStatus(value); setPage(0); }
  async function open(id) {
    const version = ++request.current;
    setSelected(null); setDetailLoading(true); setError('');
    try { const detail = await obtenerFichaCampo(user.id, id); if (live.current && request.current === version) setSelected(detail); }
    catch (failure) { if (live.current && request.current === version) { setError(failure.message); if (failure.code === 'ACCESS_DENIED') setData(null); } }
    finally { if (live.current && request.current === version) setDetailLoading(false); }
  }
  async function transition(action, values) {
    if (lock.current || !selected) throw new Error('Espera a que termine la operación actual.');
    lock.current = true; setBusy(true); setError('');
    const id = selected.id;
    try {
      if (action === 'tomar') await tomarSolicitudCampo(user.id, id);
      else await resolverSolicitudCampo(user.id, id, action === 'correccion' ? 'solicitar_correccion' : action, values.note);
      if (!live.current) return;
      setNotice(action === 'tomar' ? 'Solicitud tomada en Supabase. Actualizando la ficha.' : 'Decisión registrada en Supabase. La publicación pública es un paso posterior.');
      refresh();
      if (action === 'tomar') await open(id);
    } catch (failure) {
      if (live.current) {
        setError(failure.message);
        if (failure.uncertain || failure.code === 'ACCESS_DENIED') { setSelected(null); setData(null); }
      }
      throw failure;
    } finally { lock.current = false; if (live.current) setBusy(false); }
  }
  const effectiveUser = { ...user, roleId: data?.rol_id ?? user.roleId };
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 20));
  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#96732b]">Trabajo de campo</p><h1 className="text-3xl font-extrabold">Solicitudes de mis zonas</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#65745e]">Consulta las solicitudes reales de las zonas que el administrador asignó a tu cuenta.</p></div><button type="button" className={button} disabled={loading || busy} onClick={refresh}>{loading ? 'Actualizando…' : 'Actualizar bandeja'}</button></div>
    {notice && <p className="mb-5 rounded-xl bg-[#eaf2df] p-4 text-sm" role="status">{notice}</p>}
    {error && <div className="mb-5 rounded-xl bg-[#fff0e5] p-4 text-sm" role="alert"><p>{error}</p><p className="mt-2">Actualiza para comprobar el estado actual. No se repiten operaciones automáticamente.</p></div>}
    {loading ? <p role="status" className="py-10">Consultando Supabase.</p> : data && <>
      <section className="mb-6 rounded-2xl bg-[#edf3e6] p-5" aria-label="Zonas asignadas"><h2 className="text-sm font-bold">Tus zonas activas</h2><p className="mt-2 text-sm leading-relaxed">{data.zonas.length ? data.zonas.map(zone => zone.nombre).join(' · ') : 'No tienes zonas activas asignadas. El administrador general debe asignarte una zona para recibir solicitudes.'}</p>{Number(effectiveUser.roleId) === 3 && <p className="mt-3 text-xs">Como coordinador puedes consultar las solicitudes. Las decisiones corresponden al trabajador de campo.</p>}</section>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Estados de solicitudes">{REVIEW_TABS.map(tab => <button key={tab.id} type="button" disabled={busy} aria-pressed={status === tab.id} className={`rounded-2xl border border-solid p-4 text-left ${status === tab.id ? 'border-[#64814d] bg-[#eaf1e1]' : 'border-[#dbe3d2] bg-white'}`} onClick={() => changeStatus(tab.id)}><span className="block text-sm text-[#68765e]">{tab.label}</span><span className="mt-2 block text-3xl font-bold">{data.contadores[tab.id]}</span></button>)}</section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-3xl border border-solid border-[#dce4d4] bg-white p-5"><h2 className="mb-4 text-xl font-bold">Bandeja de solicitudes</h2><form onSubmit={event => { event.preventDefault(); refresh(); setQuery(search); setPage(0); }}><label htmlFor="field-search" className="mb-2 block text-sm font-semibold">Buscar nombre o identificador</label><input id="field-search" className="review-field" type="search" maxLength={160} value={search} onChange={event => setSearch(event.target.value)}/><button className={`${button} my-3`} type="submit" disabled={busy}>Buscar</button></form><p className="mb-4 text-xs text-[#68765e]">{data.total} solicitudes encontradas</p><div className="grid gap-3">{data.solicitudes.map(row => <article key={row.id} className="rounded-2xl border border-solid border-[#e0e6d8] p-4"><StateTag state={row.estado}/><h3 className="mt-3 text-lg font-bold">{row.nombre}</h3><p className="mt-2 text-sm text-[#68765e]">{row.localidad} · {row.municipio}</p><p className="mt-2 text-xs text-[#68765e]">{row.id.slice(0,8)} · Intento {row.numero_intento} · {formatReviewDate(row.fecha_envio)}</p><button className={`${button} mt-4 w-full`} type="button" disabled={busy} onClick={() => { void open(row.id); }}>Leer ficha</button></article>)}{!data.solicitudes.length && <p className="rounded-xl bg-[#f3f5ed] p-5 text-sm leading-relaxed">No hay solicitudes para estos filtros en tus zonas asignadas.</p>}</div><nav className="mt-5 flex items-center gap-3" aria-label="Páginas de solicitudes"><button className={button} type="button" disabled={busy || page === 0} onClick={() => { refresh(); setPage(page - 1); }}>Anterior</button><span className="text-xs">{page + 1} de {pages}</span><button className={button} type="button" disabled={busy || page + 1 >= pages} onClick={() => { refresh(); setPage(page + 1); }}>Siguiente</button></nav></section>
        <section className="min-w-0 rounded-3xl border border-solid border-[#dce4d4] bg-white p-5 sm:p-7" aria-label="Ficha de solicitud">{detailLoading ? <p role="status">Consultando la ficha y los permisos actuales.</p> : selected ? <RequestDetails key={selected.id + ':' + selected.estado} record={selected} user={effectiveUser} headingRef={heading} onClose={() => setSelected(null)} onDecision={(decision,values) => transition(decision,values)} onTake={() => transition('tomar')} busy={busy}/> : <div className="py-14 text-center"><h2 className="text-xl font-bold">Selecciona una solicitud</h2><p className="mt-3 text-sm leading-relaxed text-[#68765e]">Abre una ficha de la bandeja para revisar los datos y, si eres su trabajador revisor, registrar una decisión.</p></div>}</section>
      </div>
    </>}
  </main>;
}

function RequestDetails({ record, user, headingRef, onClose, onDecision, onTake, busy }) {
  const [checks, setChecks] = useState({});
  const [decision, setDecision] = useState(null);
  const errors = minimumDataErrors(record);
  const editable = canReview(record, user);
  const total = record.abejas.reduce((sum, bee) => sum + bee.cajas + bee.jobones, 0);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold tracking-wider text-[#7b866f]">FICHA · {record.folio}</span><button type="button" className={button} onClick={onClose}>Cerrar ficha</button></div>
    <h2 id="request-details-title" ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">{record.nombre}</h2><div className="mb-6 mt-3 flex flex-wrap items-center gap-3"><StateTag state={record.estado}/><span className="text-xs text-[#69785f]">Intento {record.numeroIntento} · {formatReviewDate(record.enviadoEn)}</span></div>
    <dl className="grid gap-4 rounded-2xl bg-[#f4f6f0] p-5 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold text-[#6a795f]">Localidad</dt><dd className="ml-0 mt-1 font-semibold">{record.localidad}</dd></div><div><dt className="text-xs font-semibold text-[#6a795f]">Municipio</dt><dd className="ml-0 mt-1 font-semibold">{record.municipio}</dd></div><div><dt className="text-xs font-semibold text-[#6a795f]">Colonias declaradas</dt><dd className="ml-0 mt-1 font-semibold">{total} en cajas tecnificadas y jobones</dd></div><div><dt className="text-xs font-semibold text-[#6a795f]">Actividades</dt><dd className="ml-0 mt-1">{[record.vendeMiel && 'Venta de miel', record.recibeVisitas && 'Recibe visitas'].filter(Boolean).join(' · ') || 'Sin actividades indicadas'}</dd></div></dl>
    <section className="mt-7"><h3 className="text-base font-bold">Descripción y referencia</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#65745e]">{record.descripcion || 'Sin descripción.'}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#65745e]">{record.referencia || 'Sin referencia de ubicación.'}</p></section>
    <section className="mt-7"><h3 className="text-base font-bold">Especies y cantidades</h3>{record.abejas.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-solid border-[#e0e6d9]"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">Especies declaradas por el cliente</caption><thead className="bg-[#f2f5ed] text-xs text-[#68775f]"><tr><th scope="col" className="p-3">Especie</th><th scope="col" className="p-3">Cajas</th><th scope="col" className="p-3">Jobones</th></tr></thead><tbody>{record.abejas.map(bee => <tr key={bee.especieId} className="border-0 border-t border-solid border-[#e0e6d9]"><th scope="row" className="p-3 font-medium italic">{bee.nombre}</th><td className="p-3">{bee.cajas}</td><td className="p-3">{bee.jobones}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[#935335]">No se declararon especies.</p>}</section>
    <section className="mt-7"><h3 className="mb-3 text-base font-bold">Ubicación declarada</h3>{validCoordinates(record.coordenadas) ? <><ReviewMap coordinates={record.coordenadas} name={record.nombre}/><p className="mt-3 text-xs text-[#68775f]">Latitud {record.coordenadas[0].toFixed(6)} · Longitud {record.coordenadas[1].toFixed(6)} · Captura: {record.metodoCaptura === 'gps' ? 'GPS' : 'mapa'}</p></> : <p className="rounded-xl bg-[#fff5df] p-4 text-sm text-[#805b22]">Falta la ubicación. Solicita al cliente que complete el punto antes de aprobar.</p>}</section>
    <section className="mt-7 rounded-xl bg-[#f4f5ee] p-4"><h3 className="text-sm font-bold">Fotografías</h3><p className="mt-2 text-sm leading-relaxed text-[#68775f]">La carga y consulta de fotografías del registro todavía está pendiente de integración. Esta ficha muestra los datos reales disponibles.</p></section>
    {record.comentarioRevision && <section className="mt-7 rounded-2xl bg-[#f3f5ed] p-5"><h3 className="text-sm font-bold">Comentario de revisión</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{record.comentarioRevision}</p>{record.revisadoEn && <p className="mt-3 text-xs text-[#68775f]">{formatReviewDate(record.revisadoEn)}</p>}</section>}
    {Number(user.roleId) === 4 && record.estado === 'enviada' && !record.trabajadorRevisorId && <button type="button" className={`${primary} mt-6`} disabled={busy} onClick={() => { void onTake().catch(() => {}); }}>Tomar solicitud e iniciar revisión</button>}
    {editable ? <section className="mt-8 border-0 border-t border-solid border-[#e0e6d8] pt-7"><h3 className="text-lg font-bold">Validación de datos mínimos</h3><p className="mt-2 text-sm leading-relaxed text-[#68775f]">Confirma cada punto después de revisar la ficha. Todas las decisiones requieren un comentario.</p>
      {errors.length > 0 && <div className="mt-4 rounded-xl bg-[#fff4df] p-4 text-sm text-[#805b22]"><p className="font-semibold">Faltan datos para aprobar:</p><ul className="mb-0 mt-2 list-disc space-y-1 pl-5">{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      <fieldset className="m-0 mt-5 grid min-w-0 gap-3 border-0 p-0"><legend className="sr-only">Lista de comprobación para aprobar</legend>{REVIEW_CHECKS.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#f5f7f1] p-3 text-sm leading-relaxed"><input type="checkbox" checked={checks[item.id] === true} onChange={event => setChecks(previous => ({ ...previous, [item.id]: event.target.checked }))}/><span>{item.label}</span></label>)}</fieldset>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy || errors.length > 0 || !REVIEW_CHECKS.every(item => checks[item.id] === true)} onClick={() => setDecision('aprobar')}>Aprobar solicitud</button><button type="button" className={button} disabled={busy} onClick={() => setDecision('correccion')}>Solicitar correcciones</button><button type="button" className={`${button} !text-[#9c4c36]`} disabled={busy} onClick={() => setDecision('rechazar')}>Rechazar</button></div>
    </section> : <p className="mt-7 rounded-xl bg-[#f2f5ec] p-4 text-sm leading-relaxed text-[#607254]">{record.estado === 'correccion' ? 'El cliente debe corregir su registro y volver a enviarlo antes de una nueva revisión.' : record.estado === 'aprobada' ? 'Solicitud aprobada. Actualiza Explorar o Mapa para consultar la ficha publicada.' : Number(user.roleId) === 3 ? 'El coordinador consulta las solicitudes de sus zonas. La resolución corresponde al trabajador de campo.' : record.estado === 'en_revision' ? 'La solicitud está tomada por otro trabajador. Solo su revisor puede resolverla.' : record.estado === 'enviada' ? 'Toma la solicitud para habilitar la revisión.' : 'La revisión terminó. Puedes consultar el comentario registrado.'}</p>}
    {decision && <DecisionDialog record={record} user={user} decision={decision} checks={checks} onCancel={() => setDecision(null)} onConfirm={async values => { await onDecision(decision, values); setDecision(null); }}/>} 

  </>;
}

function Modal({ titleId, extraClass = '', onCancel, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className={extraClass} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onCancel(); }}>{children}</dialog>;
}

function DecisionDialog({ record, user, decision, checks, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const values = { note, checks };
    const errors = validateDecision(record, user, decision, values);
    if (errors.length) { setError(errors[0]); return; }
    lock.current = true; setSaving(true);
    try { await onConfirm(values); }
    catch (failure) { if (live.current) setError(failure.message || 'No se pudo confirmar la decisión. Actualiza antes de reintentar.'); }
    finally { lock.current = false; if (live.current) setSaving(false); }
  }
  return <Modal titleId="review-decision-title" onCancel={() => { if (!lock.current) onCancel(); }}><form onSubmit={submit}><p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#9b782a]">REVISIÓN EN SUPABASE</p><h3 id="review-decision-title" className="text-2xl font-extrabold">{decisionLabels[decision]}</h3><p className="mt-4 break-words text-sm leading-relaxed">{record.nombre} · {record.folio}</p><p className="my-4 rounded-xl bg-[#f2f6eb] p-4 text-sm leading-relaxed">{decision === 'correccion' ? 'El cliente podrá consultar las observaciones, corregir su registro y reenviarlo.' : decision === 'aprobar' ? 'Al confirmar se aprobará la solicitud y se publicará su ficha con los datos revisados. Las observaciones de revisión permanecerán privadas.' : 'Se conservará el motivo del rechazo para su consulta.'}</p><label htmlFor="review-note" className="mb-2 block text-sm font-semibold">Comentario de revisión (obligatorio)</label><textarea autoFocus id="review-note" className="review-field" maxLength={2000} value={note} disabled={saving} onChange={event => { setNote(event.target.value); setError(''); }} aria-describedby="review-note-help"/><p id="review-note-help" className="mt-2 text-xs text-[#69785f]">De 10 a 2000 caracteres. Explica la decisión y los datos que se deben corregir, si corresponde.</p>{error && <p role="alert" className="mt-4 text-sm text-[#9d4932]">{error}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={saving} onClick={onCancel}>Cancelar</button><button type="submit" className={primary} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar decisión'}</button></div></form></Modal>;
}

function ReviewMap({ coordinates, name }) {
  const host = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const [lat, lng] = coordinates;
  useEffect(() => {
    const map = L.map(host.current, { zoomAnimation: false, scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 12);
    let loaded = false;
    let active = true;
    const tiles = L.tileLayer(mapConfig.url, { attribution: mapConfig.attribution, maxZoom: mapConfig.maxZoom }).addTo(map);
    tiles.on('tileload', () => { loaded = true; });
    tiles.on('tileerror', () => { if (active) setError(true); });
    const marker = L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#174f3b', fillOpacity: 1 }).addTo(map);
    const label = document.createElement('span'); label.textContent = name;
    marker.bindTooltip(label);
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false })); observer.observe(host.current);
    const timer = setTimeout(() => { if (active && !loaded) setError(true); }, 12000);
    return () => { active = false; clearTimeout(timer); observer.disconnect(); tiles.off(); marker.unbindTooltip(); map.remove(); };
  }, [lat, lng, name, attempt]);
  return <div className="relative isolate"><div ref={host} role="region" aria-label="Ubicación del meliponario para revisión" className="h-64 overflow-hidden rounded-2xl border border-solid border-[#d8e1ce] bg-[#e8eee3]"/>{error && <div className="absolute bottom-6 left-3 right-3 z-[800] rounded-xl bg-white p-3 text-xs shadow" role="status">No se pudo cargar todo el mapa. Las coordenadas siguen disponibles.<button type="button" className="ml-2 min-h-11 border-0 bg-transparent font-semibold text-[#174f3b] underline" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Reintentar</button></div>}</div>;
}
