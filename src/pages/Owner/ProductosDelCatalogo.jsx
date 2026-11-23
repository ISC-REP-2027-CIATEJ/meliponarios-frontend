import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { almacenProductos } from '../../features/adminProducts/catalogStorage.mjs';
import { rutaObjeto } from '../../features/adminProducts/catalogApi.mjs';
import { crearOfertaReal, disponibilidad } from '../../features/ownerMeliponarios/ofertaReal.mjs';

const api = crearOfertaReal(supabase);

function FotoCatalogo({ ruta, nombre }) {
  const [foto, setFoto] = useState('');
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (!ruta || !almacenProductos.bucket) return;
    let vigente = true;
    let temporal;
    async function cargar() {
      const { data, error } = await supabase.storage.from(almacenProductos.bucket).download(rutaObjeto(ruta));
      if (error || !data?.size) throw new Error();
      if (vigente) { temporal = URL.createObjectURL(data); setFoto(temporal); }
    }
    cargar().catch(() => { if (vigente) setFallo(true); });
    return () => { vigente = false; if (temporal) URL.revokeObjectURL(temporal); };
  }, [ruta]);
  return foto && !fallo
    ? <img src={foto} alt={nombre} onError={() => setFallo(true)} className="h-28 w-28 rounded-2xl object-cover"/>
    : <p className="text-xs text-muted">{fallo || !ruta || !almacenProductos.bucket ? 'Fotografía de catálogo no disponible.' : 'Cargando fotografía…'}</p>;
}

export default function ProductosDelCatalogo({ usuario, registro, bloqueado, onGuardando }) {
  const [datos, setDatos] = useState(null);
  const [elegido, setElegido] = useState('');
  const [revision, setRevision] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const enCurso = useRef(false);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; onGuardando(false); };
  }, [onGuardando]);

  useEffect(() => {
    if (!registro) return;
    let vigente = true;
    api.leer(usuario, registro).then(resultado => {
      if (vigente) setDatos(resultado);
    }).catch(fallo => { if (vigente) setError(fallo.message || 'No pudimos consultar tus productos.'); });
    return () => { vigente = false; };
  }, [usuario, registro, revision]);

  if (!registro) return <p className="rounded-2xl bg-soft p-4">Guarda primero el borrador del meliponario. Después podrás elegir sus productos del catálogo.</p>;
  const asociados = datos?.oferta || [];
  const vinculo = asociados.find(p => p.producto_id === elegido);
  const producto = datos?.catalogo.find(p => p.id === elegido) || vinculo;
  const asignados = new Set(asociados.map(p => p.producto_id));
  const disponibles = datos?.catalogo.filter(p => !asignados.has(p.id)) || [];
  const ocupado = bloqueado || guardando;
  function actualizar() {
    if (enCurso.current) return;
    setDatos(null); setElegido(''); setError(''); setMensaje(''); setRevision(n => n + 1);
  }
  async function guardar(estado) {
    if (ocupado || enCurso.current || !producto || vinculo?.producto_activo === false) return;
    enCurso.current = true; setGuardando(true); onGuardando(true); setMensaje(''); setError('');
    try {
      await api.guardar(usuario, registro, elegido, estado);
      const lectura = await api.leer(usuario, registro);
      if (!montado.current) return;
      setDatos(lectura);
      const actual = lectura.oferta.find(p => p.producto_id === elegido);
      setMensaje(actual?.estado === estado
        ? producto.nombre + ' · ' + disponibilidad[estado] + '. Guardado en tu meliponario.'
        : 'La consulta devolvió un estado distinto. Revisa la oferta actual antes de cambiarla.');
    } catch (fallo) {
      if (montado.current) {
        setDatos(null); setElegido('');
        setError((fallo.message || 'No pudimos confirmar el resultado.') + ' Actualiza la lista para comprobar qué quedó guardado.');
      }
    } finally {
      enCurso.current = false;
      if (montado.current) { setGuardando(false); onGuardando(false); }
    }
  }

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">Oferta de este meliponario</h3>
      <button type="button" className="km-button" disabled={guardando || (!datos && !error)} onClick={actualizar}>Actualizar productos</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!datos && !error && <p role="status">Consultando catálogo y productos guardados…</p>}
    {datos && <>
      {asociados.length ? <ul className="grid gap-2">{asociados.map(p =>
        <li key={p.producto_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft p-3">
          <div><strong>{p.nombre}</strong><p className="text-sm">{disponibilidad[p.estado] || 'Estado sin identificar'}{!p.producto_activo && ' · Inactivo en el catálogo'}</p></div>
          <button type="button" className="km-button" disabled={guardando} onClick={() => { setElegido(p.producto_id); setMensaje(''); }}
            aria-label={'Ver ' + p.nombre}>Ver producto</button>
        </li>)}</ul> : <p className="text-sm text-muted">Todavía no has agregado productos a este meliponario.</p>}
      <label>Agregar del catálogo
        <select className="owner-field" value={vinculo ? '' : elegido} disabled={!disponibles.length || guardando}
          onChange={e => { setElegido(e.target.value); setMensaje(''); }}>
          <option value="">{disponibles.length ? 'Elige un producto' : 'Sin productos nuevos disponibles'}</option>
          {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      {producto && <div className="km-record-inset grid gap-3 p-5" aria-label="Producto seleccionado">
        <FotoCatalogo key={elegido + ':' + producto.imagen_storage} ruta={producto.imagen_storage} nombre={producto.nombre}/>
        <h3 className="text-lg font-bold">{producto.nombre}</h3>{producto.descripcion && <p>{producto.descripcion}</p>}
        {vinculo?.producto_activo === false ? <p>El administrador desactivó este producto.</p> : <>
          <p className="text-sm">{vinculo ? 'Elige la nueva disponibilidad para guardarla.' : 'Elige la disponibilidad para agregar este producto.'}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={'Disponibilidad de ' + producto.nombre}>
            {Object.entries(disponibilidad).map(([valor, etiqueta]) =>
              <button type="button" key={valor} className={'km-button' + (valor === vinculo?.estado ? ' km-button--primary' : '')}
                aria-pressed={valor === vinculo?.estado} disabled={ocupado || valor === vinculo?.estado} onClick={() => guardar(valor)}>{etiqueta}</button>)}
          </div>
        </>}
      </div>}
      {bloqueado && <p className="text-sm text-muted">Termina primero el guardado o la edición pendiente del registro.</p>}
    </>}
    {guardando && <p role="status">Guardando y consultando la disponibilidad…</p>}
    {mensaje && <p role="status" className="rounded-xl bg-soft p-3">{mensaje}</p>}
  </div>;
}
