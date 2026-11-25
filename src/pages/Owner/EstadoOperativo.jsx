import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { crearEstadoOperativo, estadosOperativos } from '../../features/ownerMeliponarios/estadoOperativo.mjs';

const servicio = crearEstadoOperativo(supabase);

export default function EstadoOperativo({ record, userId, bloqueado, onActividad, onGuardado }) {
  const [seleccion, elegir] = useState(record.estadoOperativo);
  const [ocupado, esperar] = useState(false);
  const [incierto, comprobar] = useState(false);
  const [aviso, avisar] = useState('');
  const [error, fallar] = useState('');
  const candado = useRef(false);
  const vivo = useRef(false);
  const sucio = seleccion !== record.estadoOperativo;
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => {
    onActividad({ dirty: sucio || incierto, busy: ocupado });
    if (!sucio && !incierto && !ocupado) return;
    function proteger(e) {
      if (e.type === 'beforeunload') { e.preventDefault(); e.returnValue = ''; }
      else if (candado.current || !window.confirm('¿Salir sin terminar el cambio de estado?')) e.preventDefault();
    }
    window.addEventListener('beforeunload', proteger);
    window.addEventListener('kaabmap:before-owner-leave', proteger);
    return () => {
      window.removeEventListener('beforeunload', proteger);
      window.removeEventListener('kaabmap:before-owner-leave', proteger);
    };
  }, [sucio, incierto, ocupado, onActividad]);
  async function ejecutar(guardar) {
    if (candado.current || bloqueado || (guardar && incierto)) return;
    if (guardar && !window.confirm('¿Cambiar el estado de ' + record.nombre + ' a ' + estadosOperativos[seleccion] + '?')) return;
    candado.current = true; esperar(true); fallar(''); avisar('');
    try {
      const actual = guardar
        ? await servicio.guardar(userId, record.id, record.estadoOperativo, seleccion)
        : await servicio.consultar(userId, record.id);
      if (!vivo.current) return;
      elegir(actual.estadoOperativo); comprobar(false); onGuardado(actual.id, actual.estadoOperativo);
      avisar('Estado comprobado · ' + estadosOperativos[actual.estadoOperativo] + '. Puedes consultar la visibilidad más abajo.');
    } catch (e) {
      if (!vivo.current) return;
      if (e.actual) { elegir(e.actual.estadoOperativo); onGuardado(e.actual.id, e.actual.estadoOperativo); }
      comprobar(Boolean(e.incierto)); fallar(e.message);
    } finally { candado.current = false; if (vivo.current) esperar(false); }
  }
  return <section className="km-panel km-inset mb-5" aria-labelledby="estado-operativo-titulo">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bosque">Funcionamiento del meliponario</p>
    <h2 id="estado-operativo-titulo" className="text-xl font-bold">Estado operativo</h2>
    <p className="my-3 text-sm text-muted">Actualiza la situación del lugar para que los visitantes puedan consultarla.</p>
    <p className="mb-4 rounded-xl bg-soft p-4 text-sm">Estado guardado · <strong>{estadosOperativos[record.estadoOperativo] || 'Por comprobar'}</strong></p>
    <label htmlFor="estado-operativo" className="text-sm font-semibold">¿Cómo se encuentra actualmente?
      <select id="estado-operativo" className="owner-field" value={seleccion || ''} disabled={bloqueado || ocupado || incierto}
        onChange={e => { elegir(e.target.value); fallar(''); avisar(''); }}>
        {!estadosOperativos[seleccion] && <option value="">Selecciona un estado</option>}
        {Object.entries(estadosOperativos).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
      </select>
    </label>
    <p className="my-3 text-sm text-muted">Fuera de operación retira el registro de las consultas públicas. Al volver a Activo, el backend comprueba los requisitos de publicación.</p>
    {bloqueado && <p className="my-2 text-sm">Termina de guardar los otros cambios para actualizar el estado.</p>}
    <div className="flex flex-wrap gap-2">
      <button className="km-button km-button--primary" disabled={!sucio || bloqueado || ocupado || incierto} onClick={() => ejecutar(true)}>Guardar estado</button>
      <button className="km-button" disabled={bloqueado || ocupado} onClick={() => ejecutar(false)}>{ocupado ? 'Consultando…' : 'Comprobar estado'}</button>
      {sucio && !incierto && <button className="km-button" disabled={ocupado} onClick={() => { elegir(record.estadoOperativo); fallar(''); }}>Descartar cambio</button>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-[#944c32]">{error}</p>}
    {aviso && <p role="status" className="mt-3 text-sm">{aviso}</p>}
  </section>;
}
