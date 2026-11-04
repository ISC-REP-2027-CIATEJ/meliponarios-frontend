import { useEffect, useRef, useState } from 'react';
import { formularioPublicacion, motivosPublicacion } from '../../features/ownerMeliponarios/publicacionSupabase.mjs';
import { obtenerPublicacionPropia, guardarPublicacionPropia } from '../../features/ownerMeliponarios/publicacionRemota';

const button = 'inline-flex min-h-11 items-center justify-center rounded-full border border-solid border-[#d3ddcc] bg-white px-5 py-2 text-sm font-semibold text-[#163e2c] hover:bg-[#edf2e7] disabled:cursor-not-allowed disabled:opacity-50';
const labels = { borrador: 'Borrador', correccion: 'En corrección', enviada: 'Enviada', en_revision: 'En revisión', aprobada: 'Aprobada', rechazada: 'Rechazada', sin_solicitud: 'Sin solicitud' };

export default function OwnerPublication({ userId, recordId, datosVersion = '', datosSinGuardar = false, onActividad, onGuardado }) {
  const [state, setState] = useState(null);
  const [form, setForm] = useState(() => formularioPublicacion());
  const [loading, setLoading] = useState(Boolean(recordId));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const life = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => { life.current = true; return () => { life.current = false; }; }, []);
  useEffect(() => {
    if (!recordId) return;
    let active = true;
    obtenerPublicacionPropia(userId, recordId).then(value => {
      if (!active) return;
      setState(value); setForm(formularioPublicacion(value)); setLoading(false);
      setDirty(false); setUncertain(false); setNeedsCheck(false); setError(''); setFields({});
    }).catch(failure => { if (active) { setLoading(false); setError(failure.message || 'No pudimos leer la publicación.'); } });
    return () => { active = false; };
  }, [userId, recordId, revision, datosVersion]);

  useEffect(() => {
    onActividad?.({ dirty: dirty || uncertain || needsCheck, busy: saving });
  }, [dirty, uncertain, needsCheck, saving, onActividad]);

  useEffect(() => {
    if (!dirty && !saving && !uncertain && !needsCheck) return;
    const unload = event => { event.preventDefault(); event.returnValue = ''; };
    const leave = event => {
      event.preventDefault();
      setError(saving ? 'Espera a que termine el guardado de publicación.' :
        uncertain || needsCheck ? 'Actualiza y comprueba la publicación antes de salir.' :
          'Guarda o deshaz los cambios de Publicación antes de salir.');
      requestAnimationFrame(() => document.getElementById('publicacion')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('kaabmap:before-owner-leave', leave);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('kaabmap:before-owner-leave', leave); };
  }, [dirty, saving, uncertain, needsCheck]);

  function change(field, value) {
    if (lock.current || loading || datosSinGuardar || uncertain || needsCheck) return;
    const next = { ...form, [field]: value };
    setForm(next);
    setDirty(JSON.stringify(next) !== JSON.stringify(formularioPublicacion(state)));
    setFields(previous => ({ ...previous, [field]: '' }));
    setError(''); setNotice('');
  }

  function refresh() {
    if (lock.current || dirty && !uncertain && !needsCheck) return;
    setLoading(true); setNotice(''); setRevision(value => value + 1);
  }

  async function save(event) {
    event.preventDefault();
    if (lock.current || loading || datosSinGuardar || uncertain || needsCheck || !state) return;
    lock.current = true; setSaving(true); setError(''); setFields({}); setNotice('');
    try {
      const result = await guardarPublicacionPropia(userId, recordId, form);
      if (!life.current) return;
      setDirty(false);
      if (result.state) {
        setState(result.state); setForm(formularioPublicacion(result.state));
        if (result.state.publicada === true) setNotice('Autorizaciones guardadas. La consulta sin sesión ya devuelve esta ficha pública.');
        else if (result.state.publicada === null) setNotice('El servidor confirmó el guardado, pero no pudimos comprobar la consulta pública. Actualiza y comprueba.');
        else setNotice('Autorizaciones guardadas. La ficha sigue privada; revisa las condiciones indicadas abajo.');
      } else {
        setNeedsCheck(true);
        setNotice('El servidor confirmó el guardado. Falta volver a leer sus datos; pulsa Actualizar y comprobar. No se repetirá la escritura.');
      }
      onGuardado?.(recordId, result.state?.visibilidad || result.visibilidad);
    } catch (failure) {
      if (!life.current) return;
      setError(failure.message || 'No pudimos guardar la publicación.');
      setFields(failure.campos || {});
      setUncertain(Boolean(failure.resultadoIncierto));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { lock.current = false; if (life.current) setSaving(false); }
  }

  function undo() {
    if (lock.current || uncertain || needsCheck) return;
    setForm(formularioPublicacion(state)); setDirty(false); setError(''); setFields({}); setNotice('');
  }

  if (!recordId) return <section id="publicacion" className="mb-6 rounded-3xl border border-solid border-[#dde4d5] bg-white p-5 sm:p-8" aria-labelledby="publicacion-title">
    <h2 id="publicacion-title" className="text-xl font-bold">Publicación</h2>
    <p className="mt-3 text-sm leading-relaxed text-[#697760]">Guarda primero el borrador para habilitar las autorizaciones de publicación de este meliponario. Después podrás autorizar ubicación y contacto antes de enviarlo a revisión o cuando ya esté aprobado.</p>
  </section>;

  const blocked = loading || saving || datosSinGuardar || uncertain || needsCheck || !state;
  const reasons = motivosPublicacion(state);
  const status = loading || needsCheck ? 'Sin comprobar' : state?.publicada === true ? 'Ficha pública' : state?.publicada === false ? 'Ficha privada' : 'Consulta pública sin comprobar';
  return <section id="publicacion" className="mb-6 rounded-3xl border border-solid border-[#cbdcbc] bg-white p-5 sm:p-8" aria-labelledby="publicacion-title" aria-busy={loading || saving}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-2 text-xs font-bold tracking-[0.15em] text-[#92752f]">AUTORIZACIONES DEL PROPIETARIO</p><h2 id="publicacion-title" className="text-xl font-bold">Control de publicación</h2></div>
      <span className="rounded-full bg-[#edf2e7] px-4 py-2 text-xs font-bold">{status}</span>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-[#697760]">Aprobar la solicitud y autorizar su publicación son pasos diferentes. Tu backend requiere los dos permisos siguientes para mostrar la ficha a cualquier visitante.</p>
    {state && !loading && <p className="mt-3 text-sm"><strong>Última solicitud:</strong> {labels[state.estadoSolicitud] || 'Sin aprobación confirmada'}</p>}
    {loading && <p role="status" className="mt-4 text-sm">Consultando permisos guardados y acceso sin sesión…</p>}
    {datosSinGuardar && <p className="mt-4 rounded-xl bg-[#fff8e6] p-3 text-sm">Guarda primero los cambios de Datos básicos para editar la publicación.</p>}
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="mt-4 rounded-xl bg-[#fff3ed] p-4 text-sm text-[#9c422c]">{error}</div>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[#edf5e7] p-4 text-sm leading-relaxed">{notice}</p>}
    {state && !loading && <form noValidate onSubmit={save} className="mt-5 grid gap-5">
      <fieldset disabled={blocked} className="grid gap-4">
        <label className="!mb-0 flex items-start gap-3 rounded-2xl border border-solid border-[#dce4d3] bg-[#f7f9f3] p-4">
          <input type="checkbox" checked={form.autorizarUbicacion} onChange={event => change('autorizarUbicacion', event.target.checked)}/>
          <span><strong className="block">Publicar ubicación exacta</strong><span className="mt-1 block text-sm font-normal leading-relaxed text-[#697760]">Autorizo que cualquier visitante consulte las coordenadas del meliponario y pueda abrirlas en un mapa.</span></span>
        </label>
        <label className="!mb-0 flex items-start gap-3 rounded-2xl border border-solid border-[#dce4d3] bg-[#f7f9f3] p-4">
          <input type="checkbox" checked={form.autorizarContacto} onChange={event => change('autorizarContacto', event.target.checked)}/>
          <span><strong className="block">Publicar nombre y teléfono</strong><span className="mt-1 block text-sm font-normal leading-relaxed text-[#697760]">Autorizo que cualquier visitante vea los datos de contacto que escribo aquí. El correo de inicio de sesión no se publica.</span></span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="contacto-publico-nombre">Nombre de contacto</label><input id="contacto-publico-nombre" className="owner-field" maxLength={360} autoComplete="off" disabled={!form.autorizarContacto} value={form.nombreContacto} onChange={event => change('nombreContacto', event.target.value)} aria-invalid={Boolean(fields.nombreContacto)} aria-describedby="contacto-publico-nombre-ayuda"/><p id="contacto-publico-nombre-ayuda" className="mt-2 text-xs text-[#697760]">Entre 3 y 180 caracteres al autorizar contacto.</p>{fields.nombreContacto && <p className="mt-2 text-sm text-[#9c422c]">{fields.nombreContacto}</p>}</div>
          <div><label htmlFor="contacto-publico-telefono">Teléfono de contacto</label><input id="contacto-publico-telefono" className="owner-field" type="tel" maxLength={60} autoComplete="off" disabled={!form.autorizarContacto} value={form.telefonoContacto} onChange={event => change('telefonoContacto', event.target.value)} aria-invalid={Boolean(fields.telefonoContacto)} aria-describedby="contacto-publico-telefono-ayuda"/><p id="contacto-publico-telefono-ayuda" className="mt-2 text-xs text-[#697760]">Entre 7 y 30 caracteres; admite prefijo de país.</p>{fields.telefonoContacto && <p className="mt-2 text-sm text-[#9c422c]">{fields.telefonoContacto}</p>}</div>
        </div>
      </fieldset>
      <p className="rounded-xl bg-[#fff8e6] p-4 text-sm leading-relaxed text-[#765d23]">Los permisos se aplican al guardar. Si desmarcas cualquiera, la ficha completa queda privada. Si autorizas ambos antes de la aprobación, el backend podrá publicarla al aprobar la solicitud.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={blocked} className={button + ' !border-[#123f2d] !bg-[#123f2d] !text-white'}>{saving ? 'Guardando…' : 'Guardar autorizaciones'}</button>
        <button type="button" disabled={!dirty || saving || uncertain || needsCheck} onClick={undo} className={button}>Deshacer cambios</button>
        <p className="text-xs text-[#697760]">{dirty ? 'Cambios de publicación sin guardar' : 'Se muestran los permisos guardados'}</p>
      </div>
    </form>}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" className={button} disabled={loading || saving || dirty && !uncertain && !needsCheck} onClick={refresh}>Actualizar y comprobar</button>
      {state?.publicada === true && !loading && !needsCheck && !uncertain && <a href={'#meliponario/' + encodeURIComponent(recordId)} className={button + ' no-underline'}>Abrir ficha pública</a>}
    </div>
    {state && !loading && !needsCheck && state.publicada !== true && <div className="mt-5 rounded-xl bg-[#f5f7f0] p-4 text-sm leading-relaxed">
      <p className="font-bold">Qué falta según los datos guardados</p>
      {reasons.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-5">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {state.publicada === null && <p className="mt-3">No se pudo completar la consulta sin sesión. Los permisos guardados se muestran arriba; actualiza para comprobar su visibilidad.</p>}
    </div>}
    <p className="mt-5 text-xs leading-relaxed text-[#697760]">La ausencia de fotografías no bloquea la publicación en tu backend actual. Su subida desde este formulario se conectará en la siguiente parte.</p>
  </section>;
}
