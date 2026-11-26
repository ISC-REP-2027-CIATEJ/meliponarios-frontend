import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { crearOfertaReal, disponibilidad } from '../../features/ownerMeliponarios/ofertaReal.mjs';

import FotoProductoCatalogo from './FotoProductoCatalogo';
import './ProductosDelCatalogo.css';

const api = crearOfertaReal(supabase);

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
  const catalogoPorId = new Map((datos?.catalogo || []).map(p => [p.id, p]));
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
      {asociados.length ? <ul className="owner-catalog-list" role="list">{asociados.map(p =>
        <li key={p.producto_id} className={'owner-catalog-row' + (elegido === p.producto_id ? ' owner-catalog-row--selected' : '')}>
          <FotoProductoCatalogo ruta={p.imagen_storage || catalogoPorId.get(p.producto_id)?.imagen_storage} nombre={p.nombre}/>
          <div className="owner-catalog-name"><strong>{p.nombre}</strong><p>
            <span className="owner-product-state" data-state={p.estado}>{disponibilidad[p.estado] || 'Estado sin identificar'}</span>
            {p.producto_activo === false && <span className="owner-product-inactive">Inactivo en el catálogo</span>}
          </p></div>
          <button type="button" className="km-button" disabled={guardando}
            onClick={() => { setElegido(elegido === p.producto_id ? '' : p.producto_id); setMensaje(''); }}
            aria-expanded={elegido === p.producto_id} aria-label={(elegido === p.producto_id ? 'Cerrar detalles de ' : 'Consultar disponibilidad de ') + p.nombre}>
            {elegido === p.producto_id ? 'Cerrar detalles' : p.producto_activo === false ? 'Consultar' : 'Disponibilidad'}
          </button>
        </li>)}</ul> : <p className="text-sm text-muted">Todavía no has agregado productos a este meliponario.</p>}
      <label>Agregar del catálogo
        <select className="owner-field" value={vinculo ? '' : elegido} disabled={!disponibles.length || guardando}
          onChange={e => { setElegido(e.target.value); setMensaje(''); }}>
          <option value="">{disponibles.length ? 'Elige un producto' : 'Sin productos nuevos disponibles'}</option>
          {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      {producto && <div className="owner-product-detail" aria-label="Producto seleccionado">
        <FotoProductoCatalogo ruta={producto.imagen_storage} nombre={producto.nombre} grande/>
        <div><h3>{producto.nombre}</h3>{producto.descripcion && <p className="owner-product-detail-description">{producto.descripcion}</p>}</div>
        <div className="owner-product-detail-actions">
          {vinculo?.producto_activo === false ? <p>El administrador desactivó este producto.</p> : <>
            <p className="text-sm">{vinculo ? 'Elige la nueva disponibilidad para guardarla.' : 'Elige la disponibilidad para agregar este producto.'}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={'Disponibilidad de ' + producto.nombre}>
              {Object.entries(disponibilidad).map(([valor, etiqueta]) =>
                <button type="button" key={valor} className={'km-button' + (valor === vinculo?.estado ? ' km-button--primary' : '')}
                  aria-pressed={valor === vinculo?.estado} disabled={ocupado || valor === vinculo?.estado} onClick={() => guardar(valor)}>{etiqueta}</button>)}
            </div>
          </>}
        </div>
      </div>}
      {bloqueado && <p className="text-sm text-muted">Termina primero el guardado o la edición pendiente del registro.</p>}
    </>}
    {guardando && <p role="status">Guardando y consultando la disponibilidad…</p>}
    {mensaje && <p role="status" className="rounded-xl bg-soft p-3">{mensaje}</p>}
  </div>;
}
