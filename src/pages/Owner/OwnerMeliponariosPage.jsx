import { useEffect, useRef, useState } from 'react';
import Icon from '../Explore/Icon';
import { OwnerHeader } from '../../components/ClientNavigation';
import { obtenerCatalogosRegistro } from '../../features/ownerMeliponarios/catalogos';
import { actividad, crearFormulario, guardarRegistro, isCliente, leerRegistros, validarAbeja, validarFormulario } from '../../features/ownerMeliponarios/model';
import OwnerMap from './OwnerMap';
import './OwnerPage.css';

const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-solid border-[#123f2d] bg-[#123f2d] px-6 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-[#23583e]';
const secondary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-solid border-[#d3ddcc] bg-white px-5 py-3 text-sm font-semibold text-[#163e2c] no-underline hover:bg-[#edf2e7]';
const quiet = 'inline-flex min-h-11 items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-sm font-semibold text-[#496042] no-underline hover:bg-[#e9eee2]';

function FieldError({ id, children }) { return children ? <p id={id} className="mt-2 text-sm leading-relaxed text-[#9c422c]">{children}</p> : null; }
function Tag({ data }) { const tag = actividad(data); return <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold" style={{ backgroundColor: tag.fondo, color: tag.texto }}><span className="size-2 rounded-full" style={{ backgroundColor: tag.color }}/>{tag.label}</span>; }
function StateTag({ record }) { return <span className={`rounded-full px-3 py-2 text-xs font-semibold ${record.estado === 'borrador' ? 'bg-[#f7eac4] text-[#785a19]' : 'bg-[#e6eef7] text-[#305c80]'}`}>{record.estado === 'borrador' ? 'Borrador' : 'Solicitud de prueba · solo lectura'}</span>; }
function DemoNotice() { return <div className="mb-7 flex items-start gap-3 rounded-2xl border border-solid border-[#eadbb0] bg-[#fff8e6] p-4 text-sm leading-relaxed text-[#765d23]"><span aria-hidden="true" className="mt-0.5"><Icon name="bee"/></span><p><strong>Vista previa para practicar.</strong> Los catálogos son ejemplos. Tus borradores se guardan en este navegador y el envío es una simulación; todavía no se envía una solicitud al centro.</p></div>; }
function Section({ id, number, title, description, children }) { return <section id={id} className="rounded-3xl border border-solid border-[#dde4d5] bg-white p-5 sm:p-8"><div className="mb-6 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#edf2e7] text-sm font-bold text-[#49653d]">{number}</span><div><h2 className="text-xl font-bold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[#697760]">{description}</p></div></div>{children}</section>; }
function snapshot(userId) { try { return { records: leerRegistros(userId), error: '' }; } catch (error) { return { records: [], error: error.message }; } }
function dateLabel(value) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
function validPoint(value) { return Array.isArray(value) && value.length === 2 && value.every(x => typeof x === 'number' && Number.isFinite(x)) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180; }

export default function OwnerMeliponariosPage({ route, user, sessionReady, onLogout }) {
  return <div className="owner-page min-h-screen bg-[#f8f7f1]">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="mx-auto max-w-6xl px-5 py-16"><p role="status">Comprobando tu sesión…</p></main> : !isCliente(user) ? <main className="mx-auto max-w-xl px-5 py-20 text-center"><span className="mx-auto mb-6 grid size-20 place-items-center rounded-full bg-[#e6ecdd] text-[#9e7929]"><Icon name="bee" size={42}/></span><h1 className="text-3xl font-extrabold">{user ? 'Este espacio es para cuentas Cliente' : 'Tu meliponario tiene un lugar aquí'}</h1><p className="my-5 text-base leading-relaxed text-[#65735d]">{user ? 'Puedes continuar explorando los meliponarios públicos desde tu cuenta actual.' : 'Inicia sesión con tu cuenta Cliente para registrar y consultar tus meliponarios.'}</p><div className="flex flex-wrap justify-center gap-3">{!user && <a href="#login" className={primary}>Iniciar sesión</a>}<a href="#explorar" className={secondary}>Volver a Explorar</a>{!user && <a href="#register" className={quiet}>Crear cuenta<Icon name="arrow" size={16}/></a>}</div></main> : <Workspace key={user.id} route={route} user={user}/>}
  </div>;
}

function Workspace({ route, user }) {
  const [stored, setStored] = useState(() => snapshot(user.id));
  const [catalog, setCatalog] = useState({ loading: true, value: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    obtenerCatalogosRegistro().then(value => { if (active) setCatalog({ loading: false, value, error: '' }); }).catch(error => { if (active) setCatalog({ loading: false, value: null, error: error.message || 'No pudimos cargar las opciones del formulario.' }); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);
  function save(form, id, enviar) {
    if (stored.error) throw new Error('Primero vuelve a cargar tus registros. No pudimos leer los borradores de este navegador.');
    const saved = guardarRegistro({ userId: user.id, form, id, enviar, catalogos: catalog.value });
    const fresh = snapshot(user.id);
    setStored(previous => fresh.error ? { records: [saved, ...previous.records.filter(item => item.id !== saved.id)], error: fresh.error } : fresh);
    setMessage(enviar ? 'Solicitud de prueba guardada y bloqueada. Aún no se ha enviado al centro.' : 'Borrador guardado en este navegador. Puedes retomarlo cuando quieras.');
    window.location.hash = `mi-meliponario/${encodeURIComponent(saved.id)}`;
    return saved;
  }
  let recordId = null;
  if (route.startsWith('mi-meliponario/')) { try { recordId = decodeURIComponent(route.slice('mi-meliponario/'.length)); } catch { recordId = ''; } }
  const record = recordId ? stored.records.find(item => item.id === recordId) : null;
  return <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:pt-10 lg:px-8">
    {message && <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-[#e5efdc] p-4 text-sm font-semibold"><p>{message}</p><button type="button" aria-label="Cerrar aviso" className={quiet} onClick={() => setMessage('')}><Icon name="close" size={17}/></button></div>}
    {catalog.loading ? <p role="status" className="py-14 text-center">Preparando tu espacio…</p> : catalog.error ? <div role="alert" className="rounded-3xl bg-white p-8"><h1 className="text-2xl font-bold">No pudimos cargar el formulario</h1><p className="my-4">{catalog.error}</p><button className={secondary} onClick={() => { setCatalog({ loading: true, value: null, error: '' }); setAttempt(n => n + 1); }}>Reintentar</button></div> : <>
      {stored.error && <div role="alert" className="mb-6 rounded-2xl border border-solid border-[#e4b59f] bg-[#fff3ed] p-5"><p className="font-bold">No pudimos recuperar tus borradores</p><p className="my-3 text-sm">{stored.error} Los datos guardados no se han reemplazado.</p><button type="button" className={secondary} onClick={() => setStored(snapshot(user.id))}>Volver a cargar</button></div>}
      {route === 'mis-meliponarios' ? <OwnerList records={stored.records} catalog={catalog.value} onRefresh={() => { setStored(snapshot(user.id)); setMessage('Lista actualizada desde este navegador.'); }}/> : route.startsWith('mi-meliponario/') && !record ? <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-bold">No encontramos este registro en tu cuenta</h1><p className="my-5 text-[#687760]">Puede ser de otro navegador o de otra cuenta. Los registros de esta prueba se guardan únicamente aquí.</p><a href="#mis-meliponarios" className={secondary}>Mis meliponarios</a></div> : <OwnerForm key={`${record?.id || 'nuevo'}:${record?.estado || 'borrador'}`} record={record} catalog={catalog.value} onSave={save} storageBlocked={Boolean(stored.error)}/>}
    </>}
  </main>;
}

function OwnerList({ records, catalog, onRefresh }) {
  const [filter, setFilter] = useState('todos');
  const [mapView, setMapView] = useState(false);
  const visible = records.filter(record => filter === 'todos' || record.estado === filter).toSorted((a,b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
  const mapped = visible.filter(record => validPoint(record.coordenadas));
  function location(record) { return [catalog.localidades.find(item => item.id === record.localidadId)?.nombre, catalog.municipios.find(item => item.id === record.municipioId)?.nombre].filter(Boolean).join(' · ') || 'Ubicación por completar'; }
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-3 text-xs font-bold tracking-[0.18em] text-[#9c792b]">TU ESPACIO · ABEJAS Y SABERES</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Mis meliponarios</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-[#66735e]">Un lugar para cada meliponario que cuidas. Empieza un registro, guarda tus avances y retómalos a tu ritmo.</p></div><a href="#nuevo-meliponario" className={primary}><span className="text-xl" aria-hidden="true">+</span>Nuevo meliponario</a></div>
    <DemoNotice/>
    <div className="mb-7 grid gap-3 sm:grid-cols-3">{[[records.length,'Registros en este navegador'],[records.filter(r => r.estado === 'borrador').length,'Borradores para continuar'],[records.filter(r => r.estado === 'enviado_demo').length,'Solicitudes de prueba']].map(([value,label]) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-solid border-[#dfe5d8] bg-white px-5 py-4"><span className="text-3xl font-extrabold text-[#2e583a]">{value}</span><p className="text-sm leading-relaxed text-[#64725d]">{label}</p></div>)}</div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2" aria-label="Filtrar mis registros">{[['todos','Todos'],['borrador','Borradores'],['enviado_demo','Solicitudes de prueba']].map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`${secondary} ${filter === value ? 'bg-[#e5ecda] border-[#9eaf8f]' : ''}`}>{label}</button>)}</div><div className="flex flex-wrap gap-2"><button className={quiet} type="button" onClick={onRefresh}>Actualizar lista</button><button className={secondary} type="button" aria-pressed={mapView} onClick={() => setMapView(value => !value)}><Icon name={mapView ? 'bee' : 'map'}/>{mapView ? 'Ver tarjetas' : 'Ver ubicaciones'}</button></div></div>
    {!visible.length ? <section className="rounded-3xl border border-dashed border-[#cbd7c0] bg-white px-6 py-16 text-center"><span className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-[#edf2e6] text-[#a47b25]"><Icon name="bee" size={40}/></span><h2 className="text-2xl font-bold">{records.length ? 'Todavía no hay registros en esta sección' : 'Tu primer meliponario comienza aquí'}</h2><p className="mx-auto mb-6 mt-3 max-w-lg text-base leading-relaxed text-[#697760]">{records.length ? 'Prueba otro filtro para encontrar tus borradores.' : 'Puedes tener varios meliponarios y guardar cada borrador por separado. No necesitas completar todo de una vez.'}</p>{!records.length && <a href="#nuevo-meliponario" className={primary}>Registrar mi primer meliponario<Icon name="arrow" size={18}/></a>}</section> : mapView ? <section className="rounded-3xl border border-solid border-[#dce4d4] bg-white p-4 sm:p-6"><h2 className="mb-2 text-xl font-bold">El mapa de tus registros</h2><p className="mb-5 text-sm leading-relaxed text-[#697760]">Esta vista es privada para tu cuenta. Una solicitud de prueba no representa una aprobación pública.</p><OwnerMap records={mapped} readOnly onOpen={id => { window.location.hash = `mi-meliponario/${encodeURIComponent(id)}`; }}/><p className="mt-4 text-sm text-[#697760]">{mapped.length} {mapped.length === 1 ? 'registro con ubicación' : 'registros con ubicación'} · {visible.length - mapped.length} por ubicar</p><div className="mt-4 flex flex-wrap gap-3" aria-label="Actividades">{[{vendeMiel:true,recibeVisitas:false},{vendeMiel:false,recibeVisitas:true},{vendeMiel:true,recibeVisitas:true}].map(item => <Tag key={actividad(item).key} data={item}/>)}</div><div className="mt-5 flex flex-wrap gap-2">{visible.map(record => <a key={record.id} href={`#mi-meliponario/${encodeURIComponent(record.id)}`} className={secondary}>{record.nombre || 'Borrador sin nombre'}<Icon name="arrow" size={16}/></a>)}</div></section> : <div className="grid gap-5 md:grid-cols-2">{visible.map(record => <article key={record.id} className="overflow-hidden rounded-3xl border border-solid border-[#dce4d4] bg-white shadow-sm"><div className="owner-cover flex min-h-32 items-center justify-between gap-3 px-6 py-5"><span className="grid size-16 place-items-center rounded-2xl bg-white/80 text-[#658151]"><Icon name="bee" size={38}/></span><StateTag record={record}/></div><div className="p-6"><Tag data={record}/><h2 className="mt-4 text-xl font-bold">{record.nombre || 'Borrador sin nombre'}</h2><p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-[#687760]"><Icon name="pin" size={17}/>{location(record)}</p><p className="mt-3 text-sm text-[#687760]">{record.abejas.length} {record.abejas.length === 1 ? 'tipo de abeja agregado' : 'tipos de abejas agregados'}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-[#e7ebdf] pt-4"><span className="text-xs text-[#7a8672]">Actualizado el {dateLabel(record.actualizadoEn)}</span><a href={`#mi-meliponario/${encodeURIComponent(record.id)}`} className={quiet}>{record.estado === 'borrador' ? 'Continuar borrador' : 'Ver solicitud'}<Icon name="arrow" size={18}/></a></div></div></article>)}</div>}
  </>;
}

function OwnerForm({ record, catalog, onSave, storageBlocked }) {
  const [form, setForm] = useState(() => crearFormulario(record));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [dirty, setDirty] = useState(false);
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
  const readOnly = record?.estado === 'enviado_demo';
  const localidades = catalog.localidades.filter(item => item.municipioId === form.municipioId);
  const otherBees = form.abejas.filter((_, index) => index !== editing);
  const options = catalog.abejas.filter(item => !otherBees.some(entry => entry.tipoId === item.id));
  useEffect(() => { const life = lifecycle.current; life.active = true; return () => { life.active = false; }; }, []);
  useEffect(() => {
    if (!dirty || readOnly) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    const beforeLeave = event => {
      event.preventDefault();
      pendingLeave.current = event.detail?.continuar;
      if (!leave.current.open) leave.current.showModal();
    };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('kaabmap:before-owner-leave', beforeLeave);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('kaabmap:before-owner-leave', beforeLeave); };
  }, [dirty, readOnly]);
  function change(field, value) { setForm(previous => ({ ...previous, [field]: value, ...(field === 'municipioId' ? { localidadId: '' } : {}) })); setDirty(true); setErrors(previous => ({ ...previous, [field]: '' })); setFailure(''); }
  function changeBee(field, value) { setBee(previous => ({ ...previous, [field]: value })); setBeeError(''); setDirty(true); }
  function commitBee() {
    const invalid = validarAbeja(bee, otherBees);
    if (invalid) { setBeeError(invalid); return; }
    const value = { tipoId: bee.tipoId, cajas: Number(bee.cajas), jobones: Number(bee.jobones) };
    change('abejas', editing === null ? [...form.abejas, value] : form.abejas.map((entry, index) => index === editing ? value : entry));
    setBee({ tipoId: '', cajas: '0', jobones: '0' }); setEditing(null); setBeeError('');
  }
  function pendingBee() { return editing !== null || bee.tipoId || Number(bee.cajas) !== 0 || Number(bee.jobones) !== 0; }
  function validate(enviar) {
    if (pendingBee()) { setBeeError('Guarda el tipo de abeja que estás preparando o cancela esa fila antes de continuar.'); document.getElementById('tipo-abeja')?.focus(); return false; }
    const next = validarFormulario(form, catalog, { enviar }); setErrors(next); setFailure('');
    if (Object.keys(next).length) { requestAnimationFrame(() => errorSummary.current?.focus()); return false; }
    return true;
  }
  function save(enviar) {
    if (saving || readOnly) return;
    setSaving(true); setFailure('');
    try { onSave(form, record?.id || null, enviar); setDirty(false); confirm.current?.close(); }
    catch (error) { setFailure(error.message || 'No pudimos guardar. Tus datos siguen en el formulario.'); if (error.campos) setErrors(error.campos); }
    finally { setSaving(false); }
  }
  function gpsLocation() {
    if (!navigator.geolocation) { setGps({ loading: false, error: 'Este navegador no ofrece ubicación. Elige el punto en el mapa.' }); return; }
    setGps({ loading: true, error: '' });
    navigator.geolocation.getCurrentPosition(position => {
      if (!lifecycle.current.active) return;
      change('coordenadas', [position.coords.latitude, position.coords.longitude]); setGps({ loading: false, error: '' });
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
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-3 text-xs font-bold tracking-[0.18em] text-[#9b782a]">TU ESPACIO · REGISTRO DE MELIPONARIOS</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{readOnly ? 'Tu solicitud de prueba' : record ? 'Continúa tu borrador' : 'Registra tu meliponario'}</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-[#65735d]">{readOnly ? 'Este registro se conserva en modo de lectura para mostrar cómo funcionará el envío.' : 'Cuéntanos sobre el lugar y las abejas que cuidas. Puedes guardar el borrador y completarlo después.'}</p></div><Tag data={form}/></div>
    <DemoNotice/>
    {readOnly && <div className="mb-6 rounded-2xl bg-[#e7eff7] p-5 text-sm leading-relaxed text-[#315979]"><strong>Solicitud de prueba bloqueada.</strong> Aún no se ha enviado al centro. Cuando el backend esté conectado, el trabajador de campo podrá validar la información y el servidor decidirá cuándo se permite editarla.</div>}
    <nav aria-label="Secciones del registro" className="mb-7 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['informacion','Información'],['abejas','Tipos de abejas'],['ubicacion','Ubicación'],['actividades','Actividades']].map(([id,label],index) => <button type="button" key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-12 items-center gap-3 rounded-2xl border border-solid border-[#e0e5d7] bg-[#eef2e8] px-4 py-3 text-left text-sm text-[#3c5938]"><span className="font-bold text-[#a68333]">0{index+1}</span>{label}</button>)}</nav>
    <form noValidate onSubmit={event => { event.preventDefault(); if (validate(true)) confirm.current.showModal(); }} className="grid gap-6">
      {(Object.values(errors).some(Boolean) || failure) && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-2xl border border-solid border-[#e0b29d] bg-[#fff3ed] p-5"><p className="font-bold">{failure || 'Revisa estos datos para continuar:'}</p>{Object.entries(errors).filter(([,value]) => value).map(([key,value]) => <p key={key} className="mt-2 text-sm">• {value}</p>)}</div>}
      <Section id="informacion" number="1" title="El lugar que cuidas" description="Empieza por su nombre y ubicación. Las localidades cambian según el municipio que elijas.">
        <fieldset disabled={readOnly} className="grid gap-5"><div><label htmlFor="nombre">{generalFields[0][1]} <span className="font-normal text-[#76816d]">· necesario para enviar</span></label><input id="nombre" className="owner-field" maxLength={120} value={form.nombre} placeholder={generalFields[0][2]} onChange={event => change('nombre',event.target.value)} aria-invalid={Boolean(errors.nombre)} aria-describedby={errors.nombre ? 'error-nombre' : undefined}/><FieldError id="error-nombre">{errors.nombre}</FieldError></div>
          <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="municipioId">Municipio</label><select id="municipioId" className="owner-field" value={form.municipioId} onChange={event => change('municipioId',event.target.value)} aria-invalid={Boolean(errors.municipioId)} aria-describedby={errors.municipioId ? 'error-municipio' : undefined}><option value="">Selecciona un municipio</option>{catalog.municipios.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><FieldError id="error-municipio">{errors.municipioId}</FieldError></div><div><label htmlFor="localidadId">Localidad</label><select id="localidadId" className="owner-field" disabled={readOnly || !form.municipioId} value={form.localidadId} onChange={event => change('localidadId',event.target.value)} aria-invalid={Boolean(errors.localidadId)} aria-describedby={errors.localidadId ? 'error-localidad' : undefined}><option value="">{form.municipioId ? 'Selecciona una localidad' : 'Primero elige un municipio'}</option>{localidades.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><FieldError id="error-localidad">{errors.localidadId}</FieldError></div></div>
          <div><label htmlFor="descripcion">Descripción <span className="font-normal text-[#76816d]">· opcional</span></label><textarea id="descripcion" className="owner-field" maxLength={2000} value={form.descripcion} placeholder="Comparte algo sobre tu meliponario y su historia." onChange={event => change('descripcion',event.target.value)}/><p className="mt-2 text-right text-xs text-[#7c8873]">{form.descripcion.length}/2000</p></div>
          <div><label htmlFor="referencia">{generalFields[1][1]} <span className="font-normal text-[#76816d]">· opcional</span></label><input id="referencia" className="owner-field" maxLength={300} value={form.referencia} placeholder={generalFields[1][2]} onChange={event => change('referencia',event.target.value)}/></div>
        </fieldset>
      </Section>
      <Section id="abejas" number="2" title="Las abejas de tu meliponario" description="Agrega cada tipo una sola vez. Puede tener cajas tecnificadas, jobones o ambos; la suma debe ser por lo menos uno.">
        <div className="mb-5 grid gap-3">{form.abejas.map((entry,index) => <article key={entry.tipoId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-solid border-[#dfe6d7] bg-[#f5f8f0] p-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e4ecd9] text-[#658044]"><Icon name="bee" size={23}/></span><div><h3 className="text-base font-bold italic">{catalog.abejas.find(item => item.id === entry.tipoId)?.nombre || entry.tipoId}</h3><p className="mt-2 text-sm text-[#697760]">{entry.cajas} {entry.cajas === 1 ? 'caja tecnificada' : 'cajas tecnificadas'} · {entry.jobones} {entry.jobones === 1 ? 'jobón' : 'jobones'}</p></div></div>{!readOnly && <div className="flex gap-1"><button className={quiet} type="button" onClick={() => { setBee({ ...entry, cajas:String(entry.cajas), jobones:String(entry.jobones) }); setEditing(index); setBeeError(''); document.getElementById('tipo-abeja')?.focus(); }}>Editar</button><button className={`${quiet} text-[#985b3b]`} type="button" onClick={() => { change('abejas',form.abejas.filter((_,i) => i !== index)); setEditing(null); setBee({tipoId:'',cajas:'0',jobones:'0'}); }}>Quitar</button></div>}</article>)}</div>
        {!readOnly && <fieldset className="rounded-2xl border border-dashed border-[#bdccaF] bg-[#fcfdf9] p-4 sm:p-5"><div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_130px_130px]"><div><label htmlFor="tipo-abeja">Tipo de abeja</label><select id="tipo-abeja" className="owner-field" value={bee.tipoId} onChange={event => changeBee('tipoId',event.target.value)} aria-describedby="ayuda-abeja error-abeja"><option value="">{options.length ? 'Selecciona un tipo de abeja' : 'Ya agregaste todos los tipos disponibles'}</option>{options.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div><div><label htmlFor="cajas">Cajas tecnificadas</label><input id="cajas" className="owner-field" type="number" inputMode="numeric" min="0" step="1" value={bee.cajas} onChange={event => changeBee('cajas',event.target.value)}/></div><div><label htmlFor="jobones">Jobones</label><input id="jobones" className="owner-field" type="number" inputMode="numeric" min="0" step="1" value={bee.jobones} onChange={event => changeBee('jobones',event.target.value)}/></div></div><p id="ayuda-abeja" className="mt-3 text-xs leading-relaxed text-[#74806c]">Un jobón es un tronco hueco donde se aloja una colonia. Se aceptan cantidades enteras, desde cero; cajas y jobones no pueden ser cero al mismo tiempo.</p><FieldError id="error-abeja">{beeError}</FieldError><div className="mt-4 flex flex-wrap gap-2"><button className={secondary} type="button" onClick={commitBee} disabled={!options.length && editing === null}>{editing === null ? '+ Agregar tipo de abeja' : 'Guardar tipo de abeja'}</button>{pendingBee() ? <button className={quiet} type="button" onClick={() => { setBee({tipoId:'',cajas:'0',jobones:'0'}); setEditing(null); setBeeError(''); }}>Cancelar fila</button> : null}</div></fieldset>}
        {!form.abejas.length && <p className="mt-4 text-sm text-[#74806c]">Todavía no has agregado un tipo de abeja. Puedes guardar el borrador y completarlo después.</p>}<FieldError>{errors.abejas}</FieldError>
      </Section>
      <Section id="ubicacion" number="3" title="Ubícalo en el mapa" description={readOnly ? 'Esta ubicación pertenece a tu solicitud de prueba.' : 'Toca el lugar de tu meliponario o arrastra la abeja para afinar el punto. Si estás ahí, también puedes usar tu ubicación.'}>
        <OwnerMap value={validPoint(form.coordenadas) ? form.coordenadas : null} onChange={value => change('coordenadas',value)} readOnly={readOnly}/>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{!readOnly && <><button className={secondary} type="button" disabled={gps.loading} onClick={gpsLocation}><Icon name="pin" size={18}/>{gps.loading ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}</button><button className={quiet} type="button" onClick={() => change('coordenadas',null)} disabled={!form.coordenadas}>Quitar punto</button></>}</div><p className="text-sm text-[#64775d]">{validPoint(form.coordenadas) ? `Punto elegido · ${form.coordenadas.map(value => value.toFixed(5)).join(', ')}` : 'Elige un punto para completar la ubicación'}</p></div>
        <FieldError>{gps.error}</FieldError><FieldError>{errors.coordenadas}</FieldError>
        <details className="mt-4 rounded-xl bg-[#f3f6ee] p-4"><summary className="cursor-pointer text-sm font-semibold">{readOnly ? 'Consultar coordenadas' : 'Ingresar coordenadas manualmente'}</summary><fieldset disabled={readOnly} className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor="latitud">Latitud</label><input id="latitud" className="owner-field" type="number" step="any" min="-90" max="90" value={form.coordenadas?.[0] ?? ''} onChange={event => coordinate(0,event.target.value)}/></div><div><label htmlFor="longitud">Longitud</label><input id="longitud" className="owner-field" type="number" step="any" min="-180" max="180" value={form.coordenadas?.[1] ?? ''} onChange={event => coordinate(1,event.target.value)}/></div></fieldset></details>
      </Section>
      <Section id="actividades" number="4" title="¿Qué se puede encontrar aquí?" description="Selecciona las actividades del meliponario. La etiqueta cambia automáticamente para identificarlo en el mapa.">
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">{[['vendeMiel','Venta de miel','Ofreces miel de las abejas que cuidas.','bag'],['recibeVisitas','Visitas y difusión','Compartes el conocimiento de las abejas nativas.','bee']].map(([key,title,description,icon]) => <label key={key} className={`!mb-0 flex cursor-pointer items-start gap-3 rounded-2xl border border-solid p-5 ${form[key] ? 'border-[#88a675] bg-[#edf4e7]' : 'border-[#dce4d3] bg-white'}`}><input type="checkbox" checked={form[key]} onChange={event => change(key,event.target.checked)}/><span><span className="flex items-center gap-2 text-base font-bold"><Icon name={icon} size={20}/>{title}</span><span className="mt-2 block text-sm font-normal leading-relaxed text-[#6c7963]">{description}</span></span></label>)}</fieldset><div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f5f7f0] p-4"><span className="text-sm text-[#697760]">Así se identificará:</span><Tag data={form}/></div><FieldError>{errors.actividades}</FieldError>
      </Section>
      {!readOnly ? <div className="sticky bottom-3 z-[900] rounded-3xl border border-solid border-[#d5dfcb] bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold">{dirty ? 'Tienes cambios por guardar' : record ? 'Borrador guardado' : 'Avanza a tu ritmo'}</p><p className="mt-1 max-w-md text-xs leading-relaxed text-[#6c7963]">El borrador acepta datos incompletos. El envío de prueba guarda el registro y bloquea su edición.</p></div><div className="flex flex-wrap gap-2"><button className={secondary} type="button" disabled={saving || storageBlocked} onClick={() => { if (validate(false)) save(false); }}>Guardar borrador</button><button className={primary} type="submit" disabled={saving || storageBlocked}>Guardar y enviar solicitud<Icon name="arrow" size={18}/></button></div></div></div> : <a href="#mis-meliponarios" className={`${secondary} justify-self-start`}>Volver a Mis meliponarios</a>}
    </form>
    <dialog ref={confirm} aria-labelledby="confirmar-envio"><p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#9c792c]">ENVÍO DE PRUEBA</p><h2 id="confirmar-envio" className="text-2xl font-extrabold">¿Guardar la solicitud y bloquear el registro?</h2><p className="mt-4 text-base leading-relaxed text-[#62715c]">Se guardará <strong>{form.nombre}</strong> en este navegador como una solicitud de prueba. Después no podrás editar sus datos.</p><p className="my-5 rounded-2xl bg-[#fff5db] p-4 text-sm leading-relaxed text-[#796023]">Esta acción todavía no envía información al centro ni publica tu meliponario. La validación por el trabajador de campo se conectará con el backend.</p>{failure && <p role="alert" className="mb-4 text-sm text-[#9c422c]">{failure}</p>}<div className="flex flex-wrap justify-end gap-3"><button className={secondary} type="button" onClick={() => confirm.current.close()}>Seguir editando</button><button className={primary} type="button" disabled={saving} onClick={() => { if (validate(true)) save(true); }}>Simular envío y bloquear</button></div></dialog>
    <dialog ref={leave} aria-labelledby="salir-borrador"><p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#9c792c]">CAMBIOS SIN GUARDAR</p><h2 id="salir-borrador" className="text-2xl font-extrabold">¿Quieres salir del formulario?</h2><p className="my-5 text-base leading-relaxed text-[#64735e]">Los últimos cambios todavía no se han guardado. Puedes volver al formulario y guardar tu borrador antes de salir.</p><div className="flex flex-wrap justify-end gap-3"><button type="button" className={secondary} onClick={() => { pendingLeave.current = null; leave.current.close(); }}>Volver al formulario</button><button type="button" className={primary} onClick={discardAndLeave}>Salir sin guardar</button></div></dialog>
  </>;
}
