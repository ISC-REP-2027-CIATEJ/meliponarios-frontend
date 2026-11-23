import RealSubmission from './RealSubmission';
import OwnerPublication from './OwnerPublication';
import OwnerPhotos from './OwnerPhotos';
import { useEffect, useRef, useState } from 'react';
import Icon from '../Explore/Icon';
import { OwnerHeader } from '../../components/ClientNavigation';
import { actividad, crearFormulario, isCliente, validarAbeja, validarFormulario } from '../../features/ownerMeliponarios/model';
import OwnerMap from './OwnerMap';
import OwnerProducts from './OwnerProducts';
import ProductosDelCatalogo from './ProductosDelCatalogo';
import './OwnerPage.css';
import { validarFormularioRemoto } from '../../features/ownerMeliponarios/registroSupabase.mjs';
import { obtenerCatalogosReales, obtenerLocalidadesReales, obtenerRegistrosReales, guardarBorradorReal } from '../../features/ownerMeliponarios/registroRemoto';

const primary = 'km-button km-button--primary';
const secondary = 'km-button';
const quiet = 'km-button km-button--quiet';

function FieldError({ id, children }) { return children ? <p id={id} className="mt-2 text-sm leading-relaxed text-[#9c422c]">{children}</p> : null; }
function Tag({ data }) { const tag = actividad(data); return <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold" style={{ backgroundColor: tag.fondo, color: tag.texto }}><span className="size-2 rounded-full" style={{ backgroundColor: tag.color }}/>{tag.label}</span>; }
function StateTag({ record }) {
  const etiquetas = { borrador: 'Borrador', correccion: 'En corrección', enviada: 'Enviada', en_revision: 'En revisión', aprobada: 'Registro básico aprobado', rechazada: 'Rechazada', enviado_demo: 'Solicitud de prueba · solo lectura', sin_solicitud: 'Estado no disponible' };
  return <span className={`rounded-full px-3 py-2 text-xs font-semibold ${['borrador','correccion'].includes(record.estado) ? 'bg-[#f7eac4] text-[#785a19]' : 'bg-[#e6eef7] text-[#305c80]'}`}>{etiquetas[record.estado] || 'Estado no disponible'}</span>;
}
function DemoNotice() { return <div className="mb-7 flex items-start gap-3 rounded-2xl border border-solid border-[#eadbb0] bg-[#fff8e6] p-4 text-sm leading-relaxed text-[#765d23]"><span aria-hidden="true" className="mt-0.5"><Icon name="bee"/></span><p><strong>Vista previa para practicar.</strong> Los catálogos son ejemplos. Tus borradores se guardan en este navegador y el envío es una simulación; todavía no se envía una solicitud al centro.</p></div>; }
function Section({ id, number, title, description, children }) { return <section id={id} className="km-panel km-inset"><div className="mb-6 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft text-sm font-bold text-bosque">{number}</span><div><h2 className="text-xl font-bold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{description}</p></div></div>{children}</section>; }
function dateLabel(value) { return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Fecha no disponible'; }
function validPoint(value) { return Array.isArray(value) && value.length === 2 && value.every(x => typeof x === 'number' && Number.isFinite(x)) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180; }

export default function OwnerMeliponariosPage({ route, user, sessionReady, onLogout }) {
  return <div className="owner-page km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout} current="registros"/>
    {!sessionReady ? <main className="mx-auto max-w-6xl px-5 py-16"><p role="status">Comprobando tu sesión…</p></main> : !isCliente(user) ? <main className="mx-auto max-w-xl px-5 py-20 text-center"><span className="mx-auto mb-6 grid size-20 place-items-center rounded-full bg-[#e6ecdd] text-bosque"><Icon name="bee" size={42}/></span><h1 className="text-3xl font-extrabold">{user ? 'Este espacio es para cuentas Cliente' : 'Tu meliponario tiene un lugar aquí'}</h1><p className="my-5 text-base leading-relaxed text-muted">{user ? 'Puedes continuar explorando los meliponarios públicos desde tu cuenta actual.' : 'Inicia sesión con tu cuenta Cliente para registrar y consultar tus meliponarios.'}</p><div className="flex flex-wrap justify-center gap-3">{!user && <a href="#login" className={primary}>Iniciar sesión</a>}<a href="#explorar" className={secondary}>Volver a Explorar</a>{!user && <a href="#register" className={quiet}>Crear cuenta<Icon name="arrow" size={16}/></a>}</div></main> : <RemoteWorkspace key={user.id} route={route} user={user}/>}
  </div>;
}

function RemoteNotice() {
  return <div role="note" className="mb-7 rounded-2xl border border-solid border-[#b9d3ad] bg-[#edf5e7] p-4 text-sm leading-relaxed text-[#315239]"><strong>Guardado real en Supabase.</strong> En este paso puedes guardar y recuperar tus borradores privados. Nombre y localidad son obligatorios; las abejas y la ubicación pueden completarse después. La localidad necesita una zona de atención activa de Yucatán. Guarda el borrador y usa Enviar a revisión. El control de publicación está disponible en cada registro guardado. En Productos puedes elegir del catálogo y guardar la disponibilidad de cada producto.</div>;
}

function RemoteWorkspace({ route, user }) {
  const [data, setData] = useState({ loading: true, catalog: null, records: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const live = useRef(true);
  useEffect(() => {
    let active = true;
    live.current = true;
    Promise.all([obtenerCatalogosReales(user.id), obtenerRegistrosReales(user.id)]).then(([catalog,records]) => {
      if (active) setData({ loading: false, catalog, records, error: '' });
    }).catch(error => { if (active) setData(previous => ({ ...previous, loading: false, error: error.message || 'No pudimos recuperar tu espacio en Supabase.' })); });
    return () => { active = false; live.current = false; };
  }, [user.id, attempt]);
  function refresh() { setData(previous => ({ ...previous, loading: true, error: '' })); setAttempt(n => n + 1); }
  async function save(form, id, enviar, catalogActual) {
    if (enviar) throw new Error('Esta entrega conecta el guardado de borradores; el envío real todavía no está habilitado.');
    const savedId = await guardarBorradorReal(user.id, form, id, catalogActual);
    const previous = data.records.find(item => item.id === savedId);
    let saved = { ...form, id: savedId, ownerId: user.id, fuente: 'supabase', productos: [], estado: 'sin_solicitud', creadoEn: previous?.creadoEn || '', actualizadoEn: previous?.actualizadoEn || '', enviadoEn: previous?.enviadoEn || null, localidadNombre: catalogActual.localidades.find(item => item.id === form.localidadId)?.nombre || '', recuperacionPendiente: true };
    try {
      const records = await obtenerRegistrosReales(user.id);
      const recovered = records.find(item => item.id === savedId);
      if (!recovered) throw new Error('No se recibió el registro al volver a consultar.');
      saved = recovered;
      if (live.current) { setData(previousData => ({ ...previousData, records, error: '' })); setMessage('Borrador guardado y recuperado desde Supabase. Puedes continuar después desde tu cuenta.'); }
    } catch {
      if (live.current) {
        setData(previousData => ({ ...previousData, records: [saved, ...previousData.records.filter(item => item.id !== savedId)] }));
        setMessage('Supabase confirmó el guardado, pero no pudimos volver a leer el registro. Se conserva su ID para evitar una nueva alta. Actualiza Mis meliponarios antes de comprobar los datos guardados.');
      }
    }
    return saved;
  }
  function publicationSaved(id, visibilidad) {
    setData(previous => ({ ...previous, records: previous.records.map(item => item.id === id ? { ...item, visibilidad } : item) }));
  }
  let recordId = null;
  if (route.startsWith('mi-meliponario/')) { try { recordId = decodeURIComponent(route.slice('mi-meliponario/'.length)); } catch { recordId = ''; } }
  const record = recordId ? data.records.find(item => item.id === recordId) : null;
  return <main className="km-container km-workspace">
    {message && <p role="status" className="mb-5 rounded-2xl bg-soft p-4 text-sm font-semibold">{message}</p>}
    {data.error && <div role="alert" className="mb-6 rounded-2xl border border-solid border-[#e4b59f] bg-[#fff3ed] p-5"><h1 className="text-xl font-bold">No pudimos actualizar desde Supabase</h1><p className="my-4">{data.error}</p><button type="button" className={secondary} onClick={refresh}>Volver a cargar</button><p className="mt-3 text-xs">Tus registros se conservan en tu cuenta. Puedes volver a intentar la consulta.</p></div>}
    {data.loading ? <p role="status" className="py-12 text-center">Consultando tu cuenta y tus registros en Supabase…</p> : data.catalog && (route === 'mis-meliponarios' ? <OwnerList remote records={data.records} catalog={data.catalog} onRefresh={refresh}/> : route.startsWith('mi-meliponario/') && !record ? <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-bold">No encontramos este registro en tu cuenta</h1><p className="my-5">Comprueba que estés usando la cuenta propietaria del meliponario.</p><a href="#mis-meliponarios" className={secondary}>Mis meliponarios</a></div> : <OwnerForm key={record?.id || 'nuevo'} remote onSubmitted={refresh} onPublicacionGuardada={publicationSaved} userId={user.id} record={record} catalog={data.catalog} onSave={save} storageBlocked={false}/>)}
  </main>;
}

function OwnerList({ records, catalog, onRefresh, onDelete, remote = false }) {
  const [filter, setFilter] = useState('todos');
  const [mapView, setMapView] = useState(false);
  const visible = records.filter(record => filter === 'todos' || record.estado === filter).toSorted((a,b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
  const mapped = visible.filter(record => validPoint(record.coordenadas));
  function location(record) { return [record.localidadNombre || catalog.localidades.find(item => item.id === record.localidadId)?.nombre, catalog.municipios.find(item => item.id === record.municipioId)?.nombre].filter(Boolean).join(' · ') || 'Ubicación por completar'; }
  return <>
    <div className="km-work-banner km-page-heading"><div><h1 className="km-page-title">Mis meliponarios</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-[#66735e]">Un lugar para cada meliponario que cuidas. Empieza un registro, guarda tus avances y retómalos a tu ritmo.</p></div><a href="#nuevo-meliponario" className={primary}><span className="text-xl" aria-hidden="true">+</span>Nuevo meliponario</a></div>
    {remote ? <RemoteNotice/> : <DemoNotice/>}
    <div className="mb-7 grid gap-3 sm:grid-cols-3">{[[records.length,remote ? 'Registros en Supabase' : 'Registros en este navegador'],[records.filter(r => ['borrador','correccion'].includes(r.estado)).length,'Borradores para continuar'],[records.filter(r => remote ? !['borrador','correccion','sin_solicitud'].includes(r.estado) : r.estado === 'enviado_demo').length,remote ? 'Solicitudes registradas' : 'Solicitudes de prueba']].map(([value,label]) => <div key={label} className="km-panel flex items-center gap-4 px-5 py-4"><span className="text-3xl font-extrabold text-bosque">{value}</span><p className="text-sm leading-relaxed text-muted">{label}</p></div>)}</div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="km-tab-strip" aria-label="Filtrar mis registros">{(remote ? [['todos','Todos'],['borrador','Borradores'],['correccion','En corrección'],['enviada','Enviadas'],['en_revision','En revisión'],['aprobada','Aprobadas'],['rechazada','Rechazadas']] : [['todos','Todos'],['borrador','Borradores'],['enviado_demo','Solicitudes de prueba']]).map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={secondary}>{label}</button>)}</div><div className="flex flex-wrap gap-2"><button className={quiet} type="button" onClick={onRefresh}>Actualizar lista</button><button className={secondary} type="button" aria-pressed={mapView} onClick={() => setMapView(value => !value)}><Icon name={mapView ? 'bee' : 'map'}/>{mapView ? 'Ver tarjetas' : 'Ver ubicaciones'}</button></div></div>
    {!visible.length ? <section className="rounded-3xl border border-dashed border-[#cbd7c0] bg-white px-6 py-16 text-center"><span className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-[#edf2e6] text-bosque"><Icon name="bee" size={40}/></span><h2 className="text-2xl font-bold">{records.length ? 'Todavía no hay registros en esta sección' : 'Tu primer meliponario comienza aquí'}</h2><p className="mx-auto mb-6 mt-3 max-w-lg text-base leading-relaxed text-muted">{records.length ? 'Prueba otro filtro para encontrar tus borradores.' : 'Puedes tener varios meliponarios y guardar cada borrador por separado. No necesitas completar todo de una vez.'}</p>{!records.length && <a href="#nuevo-meliponario" className={primary}>Registrar mi primer meliponario<Icon name="arrow" size={18}/></a>}</section> : mapView ? <section className="km-panel km-inset"><h2 className="mb-2 text-xl font-bold">El mapa de tus registros</h2><p className="mb-5 text-sm leading-relaxed text-muted">{remote ? 'Esta vista es para tu cuenta. Solo las fichas aprobadas y publicadas aparecen en Explorar.' : 'Esta vista es privada para tu cuenta. Una solicitud de prueba no representa una aprobación pública.'}</p><OwnerMap records={mapped} readOnly onOpen={id => { window.location.hash = `mi-meliponario/${encodeURIComponent(id)}`; }}/><p className="mt-4 text-sm text-muted">{mapped.length} {mapped.length === 1 ? 'registro con ubicación' : 'registros con ubicación'} · {visible.length - mapped.length} por ubicar</p><div className="mt-4 flex flex-wrap gap-3" aria-label="Actividades">{[{vendeMiel:true,recibeVisitas:false},{vendeMiel:false,recibeVisitas:true},{vendeMiel:true,recibeVisitas:true}].map(item => <Tag key={actividad(item).key} data={item}/>)}</div><div className="mt-5 flex flex-wrap gap-2">{visible.map(record => <a key={record.id} href={`#mi-meliponario/${encodeURIComponent(record.id)}`} className={secondary}>{record.nombre || 'Borrador sin nombre'}<Icon name="arrow" size={16}/></a>)}</div></section> : <div className="grid gap-5 md:grid-cols-2">{visible.map(record => <article key={record.id} className="overflow-hidden rounded-3xl border border-solid border-line bg-white shadow-sm"><div className="owner-cover flex min-h-32 items-center justify-between gap-3 px-6 py-5"><span className="grid size-16 place-items-center rounded-2xl bg-white/80 text-[#658151]"><Icon name="bee" size={38}/></span><div className="flex flex-wrap items-center justify-end gap-2"><StateTag record={record}/>{remote && <span className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold">Visibilidad: {record.visibilidad === 'publico' ? 'pública' : 'privada'}</span>}</div></div><div className="p-6"><Tag data={record}/><h2 className="mt-4 text-xl font-bold">{record.nombre || 'Borrador sin nombre'}</h2><p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-[#687760]"><Icon name="pin" size={17}/>{location(record)}</p><p className="mt-3 text-sm text-[#687760]">{record.abejas.length} {record.abejas.length === 1 ? 'tipo de abeja agregado' : 'tipos de abejas agregados'}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-line pt-4"><span className="text-xs text-[#7a8672]">Actualizado el {dateLabel(record.actualizadoEn)}</span><div className="flex flex-wrap gap-1">{!remote && record.estado === 'borrador' && <button type="button" className={`${quiet} text-[#97472d]`} aria-label={`Eliminar borrador ${record.nombre || 'sin nombre'}`} onClick={() => onDelete(record)}>Eliminar</button>}<a href={`#mi-meliponario/${encodeURIComponent(record.id)}`} className={quiet}>{['borrador','correccion'].includes(record.estado) ? 'Continuar borrador' : 'Ver solicitud'}<Icon name="arrow" size={18}/></a></div></div></div></article>)}</div>}
  </>;
}

function OwnerForm({ record, catalog, onSave, storageBlocked, onDelete, remote = false, userId, onSubmitted, onPublicacionGuardada }) {
  const [form, setForm] = useState(() => ({ ...crearFormulario(record), metodoCaptura: record?.metodoCaptura || 'mapa', precisionMetros: record?.precisionMetros ?? null }));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [dirty, setDirty] = useState(false);
  const [publicacion, setPublicacion] = useState({ dirty: false, busy: false });
  const [productosGuardando, setProductosGuardando] = useState(false);
  const [fotos, setFotos] = useState({ dirty: false, busy: false });
  const [saving, setSaving] = useState(false);
  const [bee, setBee] = useState({ tipoId: '', cajas: '0', jobones: '0' });
  const [editing, setEditing] = useState(null);
  const [beeError, setBeeError] = useState('');
  const [gps, setGps] = useState({ loading: false, error: '' });
  const errorSummary = useRef(null);
  const confirm = useRef(null);
  const leave = useRef(null);
  const pendingLeave = useRef(null);
  const lifecycle = useRef({ active: true });
  const productsEditor = useRef(null);
  const savedId = useRef(record?.id || null);
  const busy = useRef(false);
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  const [uncertain, setUncertain] = useState(false);
  const [locationState, setLocationState] = useState({ municipioId: '', rows: [], error: '' });
  const [locationAttempt, setLocationAttempt] = useState(0);
  const readOnly = remote ? Boolean(record && !['borrador','correccion'].includes(record.estado)) : record?.estado === 'enviado_demo';
  const locationsLoading = remote && Boolean(form.municipioId) && locationState.municipioId !== form.municipioId;
  const localidades = remote ? locationState.municipioId === form.municipioId ? locationState.rows : [] : catalog.localidades.filter(item => item.municipioId === form.municipioId);
  const catalogActual = remote ? { ...catalog, localidades } : catalog;
  useEffect(() => {
    if (!remote || !form.municipioId) return;
    let active = true;
    obtenerLocalidadesReales(userId, form.municipioId).then(rows => { if (active) setLocationState({ municipioId: form.municipioId, rows, error: '' }); }).catch(error => { if (active) setLocationState({ municipioId: form.municipioId, rows: [], error: error.message || 'No pudimos cargar las localidades.' }); });
    return () => { active = false; };
  }, [remote, userId, form.municipioId, locationAttempt]);
  const otherBees = form.abejas.filter((_, index) => index !== editing);
  const options = catalog.abejas.filter(item => !otherBees.some(entry => entry.tipoId === item.id));
  useEffect(() => { const life = lifecycle.current; life.active = true; return () => { life.active = false; }; }, []);
  useEffect(() => {
    if ((!dirty && !saving) || readOnly) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    const beforeLeave = event => {
      if (!dirtyRef.current && !busy.current) return;
      event.preventDefault();
      if (busy.current) { setFailure('Espera a que termine el guardado antes de salir o cerrar sesión.'); return; }
      pendingLeave.current = event.detail?.continuar;
      if (!leave.current.open) leave.current.showModal();
    };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('kaabmap:before-owner-leave', beforeLeave);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('kaabmap:before-owner-leave', beforeLeave); };
  }, [dirty, readOnly, saving]);
  function change(field, value) { if (busy.current) return; setForm(previous => ({ ...previous, [field]: value, ...(field === 'coordenadas' ? { metodoCaptura: 'mapa', precisionMetros: null } : {}), ...(field === 'municipioId' ? { localidadId: '' } : {}) })); setDirty(true); setErrors(previous => ({ ...previous, [field]: '' })); setFailure(''); }
  function changeBee(field, value) { if (busy.current) return; setBee(previous => ({ ...previous, [field]: value })); setBeeError(''); setDirty(true); }
  function commitBee() {
    const invalid = validarAbeja(bee, otherBees);
    if (invalid) { setBeeError(invalid); return; }
    if (remote && (Number(bee.cajas) > 100000 || Number(bee.jobones) > 100000 || editing === null && form.abejas.length >= 50)) { setBeeError('Máximo 100000 por contenedor y 50 tipos de abejas.'); return; }
    const value = { tipoId: bee.tipoId, cajas: Number(bee.cajas), jobones: Number(bee.jobones) };
    change('abejas', editing === null ? [...form.abejas, value] : form.abejas.map((entry, index) => index === editing ? value : entry));
    setBee({ tipoId: '', cajas: '0', jobones: '0' }); setEditing(null); setBeeError('');
  }
  function pendingBee() { return editing !== null || bee.tipoId || Number(bee.cajas) !== 0 || Number(bee.jobones) !== 0; }
  function validate(enviar) {
    if (productsEditor.current && !productsEditor.current.validatePending()) return false;
    if (pendingBee()) { setBeeError('Guarda el tipo de abeja que estás preparando o cancela esa fila antes de continuar.'); document.getElementById('tipo-abeja')?.focus(); return false; }
    if (remote && locationsLoading) { setFailure('Espera a que terminen de cargar las localidades.'); return false; }
    const next = remote ? validarFormularioRemoto(form, catalogActual) : validarFormulario(form, catalog, { enviar }); setErrors(next); setFailure('');
    if (Object.keys(next).length) { requestAnimationFrame(() => errorSummary.current?.focus()); return false; }
    return true;
  }
  async function save(enviar) {
    if (busy.current || productosGuardando || readOnly || uncertain || gps.loading || publicacion.dirty || publicacion.busy || fotos.dirty || fotos.busy) return;
    busy.current = true; setSaving(true); setFailure('');
    try {
      const saved = await onSave(form, savedId.current, enviar, catalogActual);
      savedId.current = saved.id;
      dirtyRef.current = false; busy.current = false;
      if (lifecycle.current.active) { setDirty(false); setSaving(false); confirm.current?.close(); window.location.hash = `mi-meliponario/${encodeURIComponent(saved.id)}`; }
    } catch (error) {
      if (lifecycle.current.active) { setFailure(error.message || 'No pudimos guardar. Tus datos siguen en el formulario.'); if (error.campos) setErrors(error.campos); if (error.resultadoIncierto) setUncertain(true); }
    } finally { busy.current = false; if (lifecycle.current.active) setSaving(false); }
  }
  function gpsLocation() {
    if (!navigator.geolocation) { setGps({ loading: false, error: 'Este navegador no ofrece ubicación. Elige el punto en el mapa.' }); return; }
    setGps({ loading: true, error: '' });
    navigator.geolocation.getCurrentPosition(position => {
      if (!lifecycle.current.active) return;
      setForm(previous => ({ ...previous, coordenadas: [position.coords.latitude, position.coords.longitude], metodoCaptura: 'gps', precisionMetros: position.coords.accuracy })); setDirty(true); setErrors(previous => ({ ...previous, coordenadas: '' })); setGps({ loading: false, error: '' });
    }, error => { if (lifecycle.current.active) setGps({ loading: false, error: error.code === 1 ? 'No se autorizó la ubicación. Puedes colocar el punto en el mapa.' : 'No pudimos obtener tu ubicación. Puedes elegirla en el mapa.' }); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  function coordinate(index, value) { const point = [...(form.coordenadas || ['', ''])]; point[index] = value === '' ? '' : Number(value); change('coordenadas', point); }
  async function discardAndLeave() {
    const next = pendingLeave.current;
    pendingLeave.current = null; leave.current.close();
    if (!next) return;
    setDirty(false);
    const result = await next();
    if (result === false && lifecycle.current.active) setDirty(true);
  }
  const generalFields = [['nombre','Nombre del meliponario','Ej. Meliponario Flor de Mayo'],['referencia','Referencia para encontrarlo','Ej. Frente al parque, junto al camino principal']];
  return <>
    <a href="#mis-meliponarios" className={`${quiet} mb-5 px-0`}>← Mis meliponarios</a>
    <div className="km-work-banner km-page-heading"><div><h1 className="km-page-title">{readOnly ? remote ? 'Tu registro en Supabase' : 'Tu solicitud de prueba' : record ? 'Continúa tu borrador' : 'Registra tu meliponario'}</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{readOnly ? remote ? 'El estado actual del servidor permite consultar este registro sin editarlo.' : 'Este registro se conserva en modo de lectura para mostrar cómo funcionará el envío.' : 'Cuéntanos sobre el lugar y las abejas que cuidas. Puedes guardar el borrador y completarlo después.'}</p></div><Tag data={form}/></div>
    {remote ? <RemoteNotice/> : <DemoNotice/>}
    {saving && <p role="status" className="mb-4 text-sm font-semibold">Guardando y comprobando tu borrador…</p>}
    {uncertain && <div role="alert" className="mb-5 rounded-2xl bg-[#fff0df] p-5"><p className="font-semibold">El resultado del guardado no está confirmado.</p><p className="my-3 text-sm">Tus datos siguen en este formulario. Revisa si el registro existe antes de intentar otra alta.</p><a href="#mis-meliponarios" target="_blank" rel="noreferrer" className={secondary}>Revisar Mis meliponarios en otra pestaña</a></div>}
    {readOnly && !remote && <div className="mb-6 rounded-2xl bg-[#e7eff7] p-5 text-sm leading-relaxed text-[#315979]"><strong>Solicitud de prueba bloqueada.</strong> Aún no se ha enviado al centro. Cuando el backend esté conectado, el trabajador de campo podrá validar la información y el servidor decidirá cuándo se permite editarla.</div>}
    <nav aria-label="Secciones del registro" className="km-tab-strip mb-7">{[['informacion','Información'],['abejas','Tipos de abejas'],['ubicacion','Ubicación'],['actividades','Actividades'],['productos','Productos'],...(remote ? [['publicacion','Publicación'],['fotografias','Fotografías']] : [])].map(([id,label]) => <button type="button" key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="km-button">{label}</button>)}</nav>
    {remote && record?.id && <RealSubmission key={`${record.id}:${record.estado}`} userId={userId} record={record} dirty={dirty || productosGuardando || publicacion.dirty || publicacion.busy || fotos.dirty || fotos.busy} onSubmitted={onSubmitted}/>}
    {remote && (fotos.dirty || fotos.busy) && <p role="status" className="mb-5 rounded-xl bg-[#fff8e6] p-4 text-sm">Termina de subir, comprobar o descartar la selección de Fotografías antes de editar Publicación, Datos básicos o enviar a revisión.</p>}
    {remote && <div inert={fotos.dirty || fotos.busy ? true : undefined}><OwnerPublication key={record?.id || 'sin-guardar'} userId={userId} recordId={record?.id} datosVersion={record?.actualizadoEn || ''} datosSinGuardar={dirty || productosGuardando || saving || uncertain || Boolean(record?.recuperacionPendiente)} onActividad={setPublicacion} onGuardado={onPublicacionGuardada}/></div>}
    {remote && <OwnerPhotos key={'fotos:' + (record?.id || 'sin-guardar')} userId={userId} recordId={record?.id} bloqueado={dirty || productosGuardando || saving || uncertain || Boolean(record?.recuperacionPendiente) || publicacion.dirty || publicacion.busy} onActividad={setFotos}/>}
    {remote && (publicacion.dirty || publicacion.busy) && <p role="status" className="mb-5 rounded-xl bg-[#fff8e6] p-4 text-sm">Termina de guardar o deshaz los cambios de Publicación para continuar con Datos básicos o Enviar a revisión.</p>}
    <form noValidate inert={saving || publicacion.dirty || publicacion.busy || fotos.dirty || fotos.busy ? true : undefined} onSubmit={event => { event.preventDefault(); if (remote) { if (validate(false)) void save(false); } else if (validate(true)) confirm.current.showModal(); }} className="grid gap-6">
      {(Object.values(errors).some(Boolean) || failure) && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-2xl border border-solid border-[#e0b29d] bg-[#fff3ed] p-5"><p className="font-bold">{failure || 'Revisa estos datos para continuar:'}</p>{Object.entries(errors).filter(([,value]) => value).map(([key,value]) => <p key={key} className="mt-2 text-sm">• {value}</p>)}</div>}
      <Section id="informacion" number="1" title="El lugar que cuidas" description="Empieza por su nombre y ubicación. Las localidades cambian según el municipio que elijas.">
        <fieldset disabled={readOnly} className="grid gap-5"><div><label htmlFor="nombre">{generalFields[0][1]} <span className="font-normal text-[#76816d]">{remote ? '· necesario para guardar' : '· necesario para enviar'}</span></label><input id="nombre" className="owner-field" maxLength={remote ? 160 : 120} value={form.nombre} placeholder={readOnly ? '' : generalFields[0][2]} onChange={event => change('nombre',event.target.value)} aria-invalid={Boolean(errors.nombre)} aria-describedby={errors.nombre ? 'error-nombre' : undefined}/><FieldError id="error-nombre">{errors.nombre}</FieldError></div>
          <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="municipioId">Municipio</label><select id="municipioId" className="owner-field" value={form.municipioId} onChange={event => change('municipioId',event.target.value)} aria-invalid={Boolean(errors.municipioId)} aria-describedby={errors.municipioId ? 'error-municipio' : undefined}><option value="">Selecciona un municipio</option>{catalog.municipios.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><FieldError id="error-municipio">{errors.municipioId}</FieldError></div><div><label htmlFor="localidadId">Localidad</label><select id="localidadId" className="owner-field" disabled={readOnly || !form.municipioId || locationsLoading} value={form.localidadId} onChange={event => change('localidadId',event.target.value)} aria-invalid={Boolean(errors.localidadId)} aria-describedby={errors.localidadId ? 'error-localidad' : undefined}><option value="">{locationsLoading ? 'Cargando localidades…' : form.municipioId ? 'Selecciona una localidad' : 'Primero elige un municipio'}</option>{localidades.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><FieldError id="error-localidad">{errors.localidadId}</FieldError>{remote && !locationsLoading && form.municipioId && locationState.municipioId === form.municipioId && !locationState.error && !localidades.length && <p className="mt-3 text-sm text-[#846126]">Tu cuenta no recibió localidades activas para este municipio. El backend debe comprobar el catálogo y los permisos.</p>}{remote && locationState.municipioId === form.municipioId && locationState.error && <div role="alert"><p className="mt-2 text-sm text-[#9c422c]">{locationState.error}</p><button type="button" className={quiet} onClick={() => { setLocationState({ municipioId: '', rows: [], error: '' }); setLocationAttempt(n => n + 1); }}>Volver a cargar localidades</button></div>}</div></div>
          <div><label htmlFor="descripcion">Descripción <span className="font-normal text-[#76816d]">· opcional</span></label><textarea id="descripcion" className="owner-field" maxLength={2000} value={form.descripcion} placeholder={readOnly ? '' : 'Comparte algo sobre tu meliponario y su historia.'} onChange={event => change('descripcion',event.target.value)}/><p className="mt-2 text-right text-xs text-[#7c8873]">{!readOnly && `${form.descripcion.length}/2000`}</p><FieldError>{errors.descripcion}</FieldError></div>
          <div><label htmlFor="referencia">{generalFields[1][1]} <span className="font-normal text-[#76816d]">· opcional</span></label><input id="referencia" className="owner-field" maxLength={remote ? 500 : 300} value={form.referencia} placeholder={readOnly ? '' : generalFields[1][2]} onChange={event => change('referencia',event.target.value)}/><FieldError>{errors.referencia}</FieldError></div>
        </fieldset>
      </Section>
      <Section id="abejas" number="2" title="Las abejas de tu meliponario" description="Agrega cada tipo una sola vez. Puede tener cajas tecnificadas, jobones o ambos; la suma debe ser por lo menos uno.">
        <div className="mb-5 grid gap-3">{form.abejas.map((entry,index) => <article key={entry.tipoId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-solid border-line bg-[#f5f8f0] p-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e4ecd9] text-[#658044]"><Icon name="bee" size={23}/></span><div><h3 className="text-base font-bold italic">{catalog.abejas.find(item => item.id === entry.tipoId)?.nombre || entry.tipoId}</h3><p className="mt-2 text-sm text-muted">{entry.cajas} {entry.cajas === 1 ? 'caja tecnificada' : 'cajas tecnificadas'} · {entry.jobones} {entry.jobones === 1 ? 'jobón' : 'jobones'}</p></div></div>{!readOnly && <div className="flex gap-1"><button className={quiet} type="button" onClick={() => { setBee({ ...entry, cajas:String(entry.cajas), jobones:String(entry.jobones) }); setEditing(index); setBeeError(''); document.getElementById('tipo-abeja')?.focus(); }}>Editar</button><button className={`${quiet} text-[#985b3b]`} type="button" onClick={() => { change('abejas',form.abejas.filter((_,i) => i !== index)); setEditing(null); setBee({tipoId:'',cajas:'0',jobones:'0'}); }}>Quitar</button></div>}</article>)}</div>
        {!readOnly && <fieldset className="rounded-2xl border border-dashed border-[#bdccaF] bg-[#fcfdf9] p-4 sm:p-5"><div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_130px_130px]"><div><label htmlFor="tipo-abeja">Tipo de abeja</label><select id="tipo-abeja" className="owner-field" value={bee.tipoId} onChange={event => changeBee('tipoId',event.target.value)} aria-describedby="ayuda-abeja error-abeja"><option value="">{options.length ? 'Selecciona un tipo de abeja' : 'Ya agregaste todos los tipos disponibles'}</option>{options.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div><div><label htmlFor="cajas">Cajas tecnificadas</label><input id="cajas" className="owner-field" type="number" inputMode="numeric" min="0" step="1" value={bee.cajas} onChange={event => changeBee('cajas',event.target.value)}/></div><div><label htmlFor="jobones">Jobones</label><input id="jobones" className="owner-field" type="number" inputMode="numeric" min="0" step="1" value={bee.jobones} onChange={event => changeBee('jobones',event.target.value)}/></div></div><p id="ayuda-abeja" className="mt-3 text-xs leading-relaxed text-[#74806c]">Un jobón es un tronco hueco donde se aloja una colonia. Se aceptan cantidades enteras, desde cero; cajas y jobones no pueden ser cero al mismo tiempo.</p><FieldError id="error-abeja">{beeError}</FieldError><div className="mt-4 flex flex-wrap gap-2"><button className={secondary} type="button" onClick={commitBee} disabled={!options.length && editing === null}>{editing === null ? '+ Agregar tipo de abeja' : 'Guardar tipo de abeja'}</button>{pendingBee() ? <button className={quiet} type="button" onClick={() => { setBee({tipoId:'',cajas:'0',jobones:'0'}); setEditing(null); setBeeError(''); }}>Cancelar fila</button> : null}</div></fieldset>}
        {!form.abejas.length && <p className="mt-4 text-sm text-[#74806c]">Todavía no has agregado un tipo de abeja. Puedes guardar el borrador y completarlo después.</p>}<FieldError>{errors.abejas}</FieldError>{remote && !catalog.abejas.length && <p className="mt-3 text-sm text-[#846126]">No se recibieron tipos de abejas activos. Puedes guardar este borrador sin abejas y consultar el catálogo con el backend.</p>}
      </Section>
      <Section id="ubicacion" number="3" title="Ubícalo en el mapa" description={readOnly ? remote ? 'Esta es la ubicación privada recuperada desde tu cuenta.' : 'Esta ubicación pertenece a tu solicitud de prueba.' : 'Toca el lugar de tu meliponario o arrastra la abeja para afinar el punto. Si estás ahí, también puedes usar tu ubicación.'}>
        <OwnerMap value={validPoint(form.coordenadas) ? form.coordenadas : null} onChange={value => change('coordenadas',value)} readOnly={readOnly}/>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{!readOnly && <><button className={secondary} type="button" disabled={gps.loading} onClick={gpsLocation}><Icon name="pin" size={18}/>{gps.loading ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}</button><button className={quiet} type="button" onClick={() => change('coordenadas',null)} disabled={!form.coordenadas}>Quitar punto</button></>}</div><p className="text-sm text-[#64775d]">{validPoint(form.coordenadas) ? `Punto elegido · ${form.coordenadas.map(value => value.toFixed(5)).join(', ')}` : 'Elige un punto para completar la ubicación'}</p></div>
        <FieldError>{gps.error}</FieldError><FieldError>{errors.coordenadas}</FieldError>
        <details className="mt-4 rounded-xl bg-[#f3f6ee] p-4"><summary className="cursor-pointer text-sm font-semibold">{readOnly ? 'Consultar coordenadas' : 'Ingresar coordenadas manualmente'}</summary><fieldset disabled={readOnly} className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor="latitud">Latitud</label><input id="latitud" className="owner-field" type="number" step="any" min="-90" max="90" value={form.coordenadas?.[0] ?? ''} onChange={event => coordinate(0,event.target.value)}/></div><div><label htmlFor="longitud">Longitud</label><input id="longitud" className="owner-field" type="number" step="any" min="-180" max="180" value={form.coordenadas?.[1] ?? ''} onChange={event => coordinate(1,event.target.value)}/></div></fieldset></details>
      </Section>
      <Section id="actividades" number="4" title="¿Qué se puede encontrar aquí?" description="Selecciona las actividades del meliponario. La etiqueta cambia automáticamente para identificarlo en el mapa.">
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">{[['vendeMiel','Venta de miel','Ofreces miel de las abejas que cuidas.','bag'],['recibeVisitas','Visitas y difusión','Compartes el conocimiento de las abejas nativas.','bee']].map(([key,title,description,icon]) => <label key={key} className={`!mb-0 flex cursor-pointer items-start gap-3 rounded-2xl border border-solid p-5 ${form[key] ? 'border-[#88a675] bg-[#edf4e7]' : 'border-[#dce4d3] bg-white'}`}><input type="checkbox" checked={form[key]} onChange={event => change(key,event.target.checked)}/><span><span className="flex items-center gap-2 text-base font-bold"><Icon name={icon} size={20}/>{title}</span><span className="mt-2 block text-sm font-normal leading-relaxed text-[#6c7963]">{description}</span></span></label>)}</fieldset><div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f5f7f0] p-4"><span className="text-sm text-muted">Así se identificará:</span><Tag data={form}/></div><FieldError>{errors.actividades}</FieldError>
      </Section>
      <Section id="productos" number="5" title="Los productos que ofreces" description={remote ? "Elige los productos del catálogo del administrador e indica cuáles ofreces." : "Prepara tarjetas con el nombre y la presentación."}>
        {remote ? <ProductosDelCatalogo key={userId + (record?.id || 'nuevo')} usuario={userId} registro={record?.id}
          bloqueado={dirty || saving || uncertain || Boolean(record?.recuperacionPendiente) || publicacion.dirty || publicacion.busy || fotos.dirty || fotos.busy}
          onGuardando={setProductosGuardando}/> : <OwnerProducts value={form.productos} readOnly={readOnly} editorRef={productsEditor} onDirty={() => setDirty(true)} onChange={value => change('productos',value)}/>}
        <FieldError>{errors.productos}</FieldError>
      </Section>
      {!readOnly ? <div className="sticky bottom-3 z-[900] rounded-3xl border border-solid border-[#d5dfcb] bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold">{dirty ? 'Tienes cambios por guardar' : record ? 'Borrador guardado' : 'Avanza a tu ritmo'}</p><p className="mt-1 max-w-md text-xs leading-relaxed text-[#6c7963]">{remote ? 'El borrador real necesita nombre y localidad. Después de guardar usa Enviar a revisión, encima del formulario.' : 'El borrador acepta datos incompletos. El envío de prueba guarda el registro y bloquea su edición.'}</p></div><div className="flex flex-wrap gap-2"><button className={secondary} type="button" disabled={saving || productosGuardando || storageBlocked || gps.loading || uncertain || locationsLoading} onClick={() => { if (validate(false)) save(false); }}>Guardar borrador</button>{!remote && <button className={primary} type="submit" disabled={ saving || storageBlocked || gps.loading || uncertain || locationsLoading}>{'Guardar y enviar solicitud'}<Icon name="arrow" size={18}/></button>}</div></div></div> : <a href="#mis-meliponarios" className={`${secondary} justify-self-start`}>Volver a Mis meliponarios</a>}
      {!remote && !readOnly && record && <button type="button" className={`${quiet} justify-self-start text-[#97472d]`} onClick={() => onDelete(record)}>Eliminar este borrador</button>}
    </form>
    <dialog ref={confirm} aria-labelledby="confirmar-envio"><p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#9c792c]">ENVÍO DE PRUEBA</p><h2 id="confirmar-envio" className="text-2xl font-extrabold">¿Guardar la solicitud y bloquear el registro?</h2><p className="mt-4 text-base leading-relaxed text-[#62715c]">Se guardará <strong>{form.nombre}</strong> en este navegador como una solicitud de prueba. Después no podrás editar sus datos.</p><p className="my-5 rounded-2xl bg-[#fff5db] p-4 text-sm leading-relaxed text-[#796023]">Esta acción todavía no envía información al centro ni publica tu meliponario. La validación por el trabajador de campo se conectará con el backend.</p>{failure && <p role="alert" className="mb-4 text-sm text-[#9c422c]">{failure}</p>}<div className="flex flex-wrap justify-end gap-3"><button className={secondary} type="button" onClick={() => confirm.current.close()}>Seguir editando</button><button className={primary} type="button" disabled={saving} onClick={() => { if (validate(true)) save(true); }}>Simular envío y bloquear</button></div></dialog>
    <dialog ref={leave} aria-labelledby="salir-borrador"><p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#9c792c]">CAMBIOS SIN GUARDAR</p><h2 id="salir-borrador" className="text-2xl font-extrabold">¿Quieres salir del formulario?</h2><p className="my-5 text-base leading-relaxed text-[#64735e]">Los últimos cambios todavía no se han guardado. Puedes volver al formulario y guardar tu borrador antes de salir.</p><div className="flex flex-wrap justify-end gap-3"><button type="button" className={secondary} onClick={() => { pendingLeave.current = null; leave.current.close(); }}>Volver al formulario</button><button type="button" className={primary} onClick={discardAndLeave}>Salir sin guardar</button></div></dialog>
  </>;
}
