import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Explore/Icon';
import { MAX_FOTOS } from '../../features/ownerMeliponarios/fotosSupabase.mjs';
import { prepararFoto } from '../../features/ownerMeliponarios/prepararFoto.mjs';
import { eliminarFotoPropia, obtenerFotosPropias, subirFotoPropia } from '../../features/ownerMeliponarios/fotosRemotas';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d3ddcc] bg-white px-4 py-2 text-sm font-semibold text-[#163e2c] hover:bg-[#edf2e7] disabled:cursor-not-allowed disabled:opacity-50';
const primary = button + ' !border-[#123f2d] !bg-[#123f2d] !text-white';

export default function OwnerPhotos({ userId, recordId, bloqueado = false, onActividad }) {
  const [gallery, setGallery] = useState({ items: [], loading: Boolean(recordId), visibilidad: '', aviso: '', error: '' });
  const [pending, setPending] = useState([]);
  const [operation, setOperation] = useState('');
  const [needsCheck, setNeedsCheck] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [failedUrls, setFailedUrls] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const selection = useRef([]);
  const previewUrls = useRef(new Map());
  const check = useRef(false);
  const lock = useRef(false);
  const life = useRef(false);
  const input = useRef(null);
  const confirm = useRef(null);
  const viewer = useRef(null);

  const updateSelection = useCallback(items => { selection.current = items; setPending(items); }, []);
  const release = useCallback(key => {
    const url = previewUrls.current.get(key);
    if (url) URL.revokeObjectURL(url);
    previewUrls.current.delete(key);
  }, []);
  const requireCheck = useCallback(value => { check.current = value; setNeedsCheck(value); }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    life.current = true;
    return () => { life.current = false; for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); };
  }, []);
  useEffect(() => {
    if (!recordId) return;
    let active = true;
    obtenerFotosPropias(userId, recordId).then(value => {
      if (!active) return;
      setGallery({ ...value, loading: false, error: '' });
      if (check.current) {
        const uncertain = selection.current.filter(item => item.estado === 'por_comprobar');
        uncertain.forEach(item => release(item.key));
        updateSelection(selection.current.filter(item => item.estado !== 'por_comprobar'));
        requireCheck(false);
        setNotice('Galería consultada de nuevo. Revisa qué archivos están guardados antes de seleccionar otra vez una foto cuyo resultado era incierto.');
      }
    }).catch(failure => {
      if (active) setGallery(previous => ({ ...previous, loading: false, error: failure.message || 'No pudimos consultar la galería.' }));
    });
    return () => { active = false; };
  }, [userId, recordId, revision, release, updateSelection, requireCheck]);

  useEffect(() => {
    onActividad?.({ dirty: pending.length > 0 || needsCheck, busy: Boolean(operation) });
  }, [pending.length, needsCheck, operation, onActividad]);
  useEffect(() => {
    if (!pending.length && !operation && !needsCheck) return;
    const unload = event => { event.preventDefault(); event.returnValue = ''; };
    const leave = event => {
      event.preventDefault();
      setError(operation ? 'Espera a que termine la operación de fotografías.' : needsCheck ?
        'Actualiza y comprueba la galería antes de salir.' : 'Sube o descarta las fotografías seleccionadas antes de salir.');
      requestAnimationFrame(() => document.getElementById('fotografias')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('kaabmap:before-owner-leave', leave);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('kaabmap:before-owner-leave', leave); };
  }, [pending.length, operation, needsCheck]);

  async function selectFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || lock.current || bloqueado || gallery.loading || needsCheck) return;
    const libres = MAX_FOTOS - gallery.items.length - selection.current.length;
    if (files.length > libres) { setError('Quedan ' + libres + ' espacios. Selecciona esa cantidad o menos.'); return; }
    lock.current = true; setOperation('preparar'); setError(''); setNotice('');
    const failures = [];
    try {
      for (const file of files) {
        try {
          const prepared = await prepararFoto(file);
          if (!life.current) return;
          const key = crypto.randomUUID();
          const preview = URL.createObjectURL(prepared.blob);
          previewUrls.current.set(key, preview);
          updateSelection([...selection.current, { ...prepared, key, preview, estado: 'preparada' }]);
        } catch (failure) { failures.push((file.name || 'Fotografía') + ': ' + failure.message); }
      }
      if (life.current && failures.length) setError(failures.join('\n'));
    } finally { lock.current = false; if (life.current) setOperation(''); }
  }

  function discard(key) {
    if (lock.current || needsCheck) return;
    const items = key ? selection.current.filter(item => item.key === key) : selection.current;
    items.forEach(item => release(item.key));
    updateSelection(key ? selection.current.filter(item => item.key !== key) : []);
    setError(''); setNotice('');
  }
  function description(key, value) {
    if (lock.current || needsCheck) return;
    updateSelection(selection.current.map(item => item.key === key ? { ...item, descripcion: value } : item));
  }
  function refresh() {
    if (lock.current) return;
    setGallery(previous => ({ ...previous, loading: true, error: '' }));
    setError(''); setRevision(value => value + 1);
  }

  async function upload() {
    if (lock.current || bloqueado || gallery.loading || gallery.error || needsCheck) return;
    const ready = selection.current.filter(item => item.estado === 'preparada');
    if (!ready.length) return;
    if (ready.length + gallery.items.length > MAX_FOTOS) { setError('Hay más fotos seleccionadas que espacios libres. Descarta algunas o elimina una foto guardada.'); return; }
    lock.current = true; setOperation('subir'); setError(''); setNotice('');
    let completed = 0;
    try {
      for (const item of ready) {
        updateSelection(selection.current.map(row => row.key === item.key ? { ...row, estado: 'subiendo' } : row));
        try {
          await subirFotoPropia(userId, recordId, item);
          if (!life.current) return;
          completed++;
          release(item.key);
          updateSelection(selection.current.filter(row => row.key !== item.key));
        } catch (failure) {
          if (!life.current) return;
          const uncertain = Boolean(failure.requiereComprobar);
          updateSelection(selection.current.map(row => row.key === item.key ? { ...row, estado: uncertain ? 'por_comprobar' : 'preparada' } : row));
          requireCheck(uncertain);
          setError(failure.message || 'No pudimos subir la fotografía.');
          break;
        }
      }
      if (life.current && completed) setNotice(completed + (completed === 1 ? ' fotografía guardada.' : ' fotografías guardadas.') + ' Los archivos restantes siguen en la selección.');
      if (!check.current) {
        try {
          const value = await obtenerFotosPropias(userId, recordId);
          if (life.current) setGallery({ ...value, loading: false, error: '' });
        } catch {
          if (life.current) { requireCheck(true); setError('La operación terminó, pero falta actualizar la galería. Pulsa Actualizar y comprobar; no se repetirán las subidas.'); }
        }
      }
    } finally { lock.current = false; if (life.current) setOperation(''); }
  }

  async function remove() {
    if (lock.current || bloqueado || needsCheck || !deleting) return;
    lock.current = true; setOperation('eliminar'); setError(''); setNotice('');
    try {
      await eliminarFotoPropia(userId, recordId, deleting.id);
      if (!life.current) return;
      setGallery(previous => ({ ...previous, items: previous.items.filter(item => item.id !== deleting.id) }));
      setNotice('Fotografía y registro de galería eliminados.');
      try {
        const value = await obtenerFotosPropias(userId, recordId);
        if (life.current) setGallery({ ...value, loading: false, error: '' });
      } catch { if (life.current) { requireCheck(true); setError('La eliminación fue confirmada. Falta volver a consultar la galería; pulsa Actualizar y comprobar.'); } }
    } catch (failure) {
      if (life.current) { requireCheck(Boolean(failure.requiereComprobar)); setError(failure.message || 'No pudimos eliminar la fotografía.'); }
    } finally {
      lock.current = false;
      if (life.current) { setOperation(''); setDeleting(null); confirm.current?.close(); }
    }
  }

  if (!recordId) return <section id="fotografias" className="mb-6 rounded-3xl border border-solid border-[#dde4d5] bg-white p-5 sm:p-8"><h2 className="text-xl font-bold">Fotografías</h2><p className="mt-3 text-sm leading-relaxed text-[#697760]">Guarda primero el borrador real. Después podrás añadir y consultar sus fotografías aquí.</p></section>;

  const busy = Boolean(operation);
  const free = Math.max(0, MAX_FOTOS - gallery.items.length - pending.length);
  const missing = gallery.items.filter(item => item.estadoArchivo === 'sin_archivo').length;
  const ready = pending.filter(item => item.estado === 'preparada');
  return <section id="fotografias" aria-labelledby="owner-photos-title" aria-busy={busy || gallery.loading} className="mb-6 rounded-3xl border border-solid border-[#dde4d5] bg-white p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-2 text-xs font-bold tracking-[0.15em] text-[#92752f]">FOTOGRAFÍAS DEL PROPIETARIO</p><h2 id="owner-photos-title" className="text-xl font-bold">Galería fotográfica</h2><p className="mt-3 text-sm text-[#697760]">Hasta cinco fotografías JPEG, PNG o WebP de 5 MiB. Recomendamos tres para presentar tu meliponario.</p></div><span className="rounded-full bg-[#edf2e7] px-4 py-2 text-xs font-bold">{gallery.loading ? 'Consultando…' : gallery.items.length + '/5 espacios ocupados'}</span></div>
    <p className="mt-4 rounded-xl bg-[#edf5e7] p-4 text-sm leading-relaxed">Las imágenes permanecen privadas mientras la ficha no sea pública. Si la ficha ya es pública, las nuevas fotos podrán verse sin sesión al terminar la subida.</p>
    {bloqueado && <p className="mt-4 rounded-xl bg-[#fff8e6] p-3 text-sm">Termina de guardar o deshaz los cambios de Datos básicos y Publicación para gestionar fotografías.</p>}
    {gallery.loading && <p role="status" className="mt-4 text-sm">Consultando fotografías y archivos disponibles…</p>}
    {(error || gallery.error) && <p role="alert" className="mt-4 whitespace-pre-line break-words rounded-xl bg-[#fff3ed] p-4 text-sm text-[#9c422c]">{error || gallery.error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-[#edf5e7] p-4 text-sm">{notice}</p>}
    {gallery.aviso && <p className="mt-4 text-sm text-[#765d23]">{gallery.aviso}</p>}
    {missing > 0 && <p className="mt-4 text-sm text-[#765d23]">{missing} {missing === 1 ? 'espacio tiene una reserva sin archivo' : 'espacios tienen reservas sin archivo'}. Puedes eliminar esas reservas para liberar espacio.</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {gallery.items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-solid border-[#dce4d3]">
        {item.url && !failedUrls.includes(item.url) ? <button type="button" className="block w-full border-0 bg-[#edf2e7] p-0" aria-label={'Ampliar fotografía ' + item.posicion} onClick={() => { setViewing(item); viewer.current?.showModal(); }}><img src={item.url} alt={item.descripcion || 'Fotografía del meliponario'} className="aspect-[4/3] w-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrls(prev => [...prev, item.url])}/></button> : <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[#edf2e7] p-4 text-center text-sm text-[#697760]"><Icon name="bee" size={32}/>{item.estadoArchivo === 'sin_archivo' ? 'Reserva sin archivo subido' : 'Vista previa no disponible. Actualiza la galería.'}</div>}
        <div className="p-4"><p className="text-xs font-bold text-[#697760]">Fotografía {item.posicion}</p>{item.descripcion && <p className="mt-2 break-words text-sm leading-relaxed">{item.descripcion}</p>}<button type="button" className={button + ' mt-3 text-[#97472d]'} disabled={busy || bloqueado || needsCheck || gallery.loading} onClick={() => { setDeleting(item); confirm.current?.showModal(); }}>{item.estadoArchivo === 'sin_archivo' ? 'Eliminar reserva' : 'Eliminar fotografía'}</button></div>
      </article>)}
    </div>
    {!gallery.loading && !gallery.error && !gallery.items.length && <p className="mt-5 rounded-2xl border border-dashed border-[#ccd7c6] p-6 text-center text-sm text-[#697760]">Todavía no hay fotografías guardadas en este registro.</p>}

    <div className="mt-5 flex flex-wrap gap-3">
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Seleccionar fotografías del meliponario" disabled={busy || bloqueado || gallery.loading || Boolean(gallery.error) || needsCheck || free < 1} onChange={selectFiles}/>
      <button type="button" className={button} disabled={busy || bloqueado || gallery.loading || Boolean(gallery.error) || needsCheck || free < 1} onClick={() => input.current?.click()}>+ Seleccionar fotografías</button>
      <button type="button" className={button} disabled={busy || gallery.loading} onClick={refresh}>Actualizar y comprobar</button>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-[#697760]">Se prepara una copia de hasta 2400 píxeles de lado, normalmente WebP, sin trasladar los metadatos EXIF. Tus archivos originales no se modifican.</p>

    {pending.length > 0 && <div className="mt-6 rounded-2xl bg-[#f5f7f0] p-4 sm:p-5">
      <h3 className="text-base font-bold">Seleccionadas en este navegador</h3><p className="mt-2 text-sm text-[#697760]">Estas vistas previas todavía no significan que las fotos estén guardadas. Revisa y pulsa Subir fotografías.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {pending.map(item => <article key={item.key} className="overflow-hidden rounded-2xl border border-solid border-[#dce4d3] bg-white">
          <img src={item.preview} alt="Vista previa local de la fotografía seleccionada" className="aspect-[4/3] w-full object-cover"/>
          <div className="p-4"><p className="break-all text-xs font-bold text-[#697760]">{item.nombreLocal}</p><p className="mt-2 text-xs">{item.estado === 'subiendo' ? 'Subiendo…' : item.estado === 'por_comprobar' ? 'Resultado pendiente de comprobar' : 'Preparada para subir'}</p><label className="mt-3" htmlFor={'foto-descripcion-' + item.key}>Descripción pública opcional</label><textarea id={'foto-descripcion-' + item.key} className="owner-field" maxLength={500} value={item.descripcion} disabled={busy || needsCheck} onChange={event => description(item.key, event.target.value)}/><p className="mt-2 text-xs text-[#697760]">{Array.from(item.descripcion).length}/250 caracteres</p><button type="button" className={button + ' mt-3'} disabled={busy || needsCheck} onClick={() => discard(item.key)}>Quitar de la selección</button></div>
        </article>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={primary} disabled={busy || bloqueado || needsCheck || gallery.loading || Boolean(gallery.error) || !ready.length || ready.length + gallery.items.length > MAX_FOTOS} onClick={upload}>{operation === 'subir' ? 'Subiendo…' : 'Subir fotografías'}</button><button type="button" className={button} disabled={busy || needsCheck} onClick={() => discard()}>Descartar selección</button></div>
    </div>}
    {needsCheck && <p className="mt-4 rounded-xl bg-[#fff8e6] p-4 text-sm leading-relaxed">La operación no se repetirá automáticamente. Pulsa Actualizar y comprobar antes de intentar subir o eliminar de nuevo.</p>}
    {operation === 'preparar' && <p role="status" className="mt-4 text-sm">Preparando fotografías y sus vistas previas…</p>}

    <dialog ref={confirm} aria-labelledby="owner-photo-delete-title" onCancel={event => { if (lock.current) event.preventDefault(); else setDeleting(null); }}>
      <h3 id="owner-photo-delete-title" className="text-2xl font-bold">{deleting?.estadoArchivo === 'sin_archivo' ? 'Eliminar reserva incompleta' : 'Eliminar fotografía'}</h3>
      <p className="my-4 text-sm leading-relaxed">Se eliminarán esta imagen y su registro de galería. Si la ficha es pública, dejará de mostrarla al actualizar. Esta acción no se puede deshacer.</p>
      <div className="flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={() => { setDeleting(null); confirm.current?.close(); }}>Conservar</button><button type="button" className={primary} disabled={busy} onClick={remove}>{operation === 'eliminar' ? 'Eliminando…' : 'Sí, eliminar'}</button></div>
    </dialog>
    <dialog ref={viewer} aria-labelledby="owner-photo-view-title" onClose={() => setViewing(null)}><div className="mb-4 flex items-center justify-between gap-3"><h3 id="owner-photo-view-title" className="text-lg font-bold">Fotografía del meliponario</h3><button type="button" className={button} onClick={() => viewer.current?.close()}>Cerrar</button></div>{viewing && <><img src={viewing.url} alt={viewing.descripcion || 'Fotografía del meliponario'} className="max-h-[70svh] w-full object-contain" referrerPolicy="no-referrer"/>{viewing.descripcion && <p className="mt-3 break-words text-sm">{viewing.descripcion}</p>}</>}</dialog>
  </section>;
}
