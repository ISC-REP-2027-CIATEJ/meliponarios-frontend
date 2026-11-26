import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { crearBorradoresApi } from '../../features/ownerMeliponarios/borradoresApi.mjs';

const api = crearBorradoresApi(supabase);
export default function EliminarBorradorDialog({ record, usuario, onCerrar, onEliminado }) {
  const dialog = useRef(null);
  const [revision, refrescar] = useState(0);
  const [consulta, mostrar] = useState(null);
  const [error, fallar] = useState('');
  const [confirmacion, escribir] = useState('');
  const [ocupado, esperar] = useState(false);
  const [incierto, marcar] = useState(false);
  const candado = useRef(false);
  const vivo = useRef(false);
  useEffect(() => {
    vivo.current = true; dialog.current.showModal();
    return () => { vivo.current = false; };
  }, []);
  useEffect(() => {
    let vigente = true;
    api.consultar(usuario, record.id).then(estado => { if (vigente) mostrar(estado); })
      .catch(fallo => { if (vigente) fallar(fallo.message); });
    return () => { vigente = false; };
  }, [usuario, record.id, revision]);
  useEffect(() => {
    if (!ocupado) return;
    const proteger = e => { e.preventDefault(); if (e.type === 'beforeunload') e.returnValue = ''; };
    window.addEventListener('beforeunload', proteger);
    window.addEventListener('kaabmap:before-owner-leave', proteger);
    return () => { window.removeEventListener('beforeunload', proteger); window.removeEventListener('kaabmap:before-owner-leave', proteger); };
  }, [ocupado]);
  function comprobar() {
    if (candado.current) return;
    mostrar(null); fallar(''); refrescar(n => n + 1);
  }
  async function eliminar(e) {
    e.preventDefault();
    if (candado.current || incierto || !consulta?.puedeEliminar || confirmacion.trim().toUpperCase() !== 'ELIMINAR') return;
    candado.current = true; esperar(true); fallar('');
    try {
      await api.eliminar(usuario, record.id);
      if (vivo.current) onEliminado(record.id);
    } catch (fallo) {
      if (vivo.current) { fallar(fallo.message); marcar(fallo.incierto === true); mostrar(null); }
    } finally { candado.current = false; if (vivo.current) esperar(false); }
  }
  return <dialog ref={dialog} className="km-dialog" aria-labelledby="eliminar-borrador-titulo"
    onCancel={e => { e.preventDefault(); if (!candado.current) onCerrar(incierto); }}>
    <p className="text-xs font-bold uppercase tracking-wide text-muted">Borrador privado</p>
    <h2 id="eliminar-borrador-titulo" className="km-section-title mt-2">Eliminar borrador</h2>
    <p className="mt-4"><strong>{record.nombre || 'Borrador sin nombre'}</strong></p>
    <p className="mt-3 text-sm text-muted">Se eliminarán sus datos guardados, ubicación, especies y productos asociados. Los cambios sin guardar también se descartarán. Esta acción no se puede deshacer.</p>
    {!consulta && !error && <p className="km-status my-4" role="status">Comprobando que el registro siga siendo un borrador eliminable…</p>}
    {consulta && !consulta.puedeEliminar && <div className="km-status my-4" role="status">
      <p>{consulta.motivo}</p>{consulta.fotos > 0 && <p className="mt-2">Abre el borrador y entra a Fotografías para quitar sus imágenes. Después vuelve a comprobar.</p>}
    </div>}
    {error && <p role="alert" className="km-status my-4">{error}</p>}
    {incierto ? <p className="my-4 text-sm">La operación pudo completarse. Cierra este diálogo para actualizar tus registros; no vuelvas a enviarla sin comprobar.</p>
      : <form className="grid gap-4 mt-5" onSubmit={eliminar}>
        {consulta?.puedeEliminar && <label className="grid gap-2 text-sm font-semibold">Escribe ELIMINAR para confirmar
          <input className="km-field" autoComplete="off" value={confirmacion} disabled={ocupado} onChange={e => escribir(e.target.value)}/></label>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="km-button" disabled={ocupado} onClick={() => onCerrar(false)}>Cancelar</button>
          <button type="button" className="km-button" disabled={ocupado || (!consulta && !error)} onClick={comprobar}>Volver a comprobar</button>
          <button className="km-button km-button--danger" disabled={ocupado || !consulta?.puedeEliminar || confirmacion.trim().toUpperCase() !== 'ELIMINAR'}>{ocupado ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
        </div>
      </form>}
    {incierto && <button className="km-button" disabled={ocupado} onClick={() => onCerrar(true)}>Cerrar y actualizar registros</button>}
  </dialog>;
}

