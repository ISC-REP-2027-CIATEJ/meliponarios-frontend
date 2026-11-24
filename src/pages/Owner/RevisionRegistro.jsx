import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { obtenerFichaPublica } from '../../features/publicMeliponarios/publicService';

export default function RevisionRegistro({ record, userId, bloqueado }) {
  const [resultado, mostrar] = useState(null);
  const [error, avisar] = useState('');
  const [motivo, cambiar] = useState('');
  const [baja, confirmar] = useState(false);
  const [ocupado, esperar] = useState(false);
  const candado = useRef(false);
  async function ejecutar(accion) {
    if (candado.current) return;
    candado.current = true; esperar(true); avisar('');
    try { await accion(); } catch (e) { avisar(e.message); }
    finally { candado.current = false; esperar(false); }
  }
  function pedirBaja(e) {
    e.preventDefault();
    if (!motivo.trim() || bloqueado || baja || !window.confirm('¿Enviar al administrador la solicitud de baja de ' + record.nombre + '?')) return;
    ejecutar(async () => {
      const sesion = await supabase.auth.getUser();
      if (sesion.error || sesion.data?.user?.id !== userId) throw new Error('Vuelve a entrar con la cuenta propietaria.');
      const { data, error } = await supabase.rpc('cliente_solicitar_desactivacion_meliponario', {
        p_meliponario_id: record.id, p_motivo: motivo.trim(),
      });
      if (error || !data) throw new Error('No se pudo confirmar la solicitud. Consulta su estado con Administración antes de volver a enviarla.');
      confirmar(true);
    });
  }
  return <section className="km-panel km-inset mb-5">
    <h2 className="text-xl font-bold">Revisión y publicación</h2>
    <p className="mt-2 text-sm">La revisión básica, la verificación en campo y la validación técnica forman parte del proceso. Supabase determina cuándo aparece la ficha en el mapa.</p>
    <ul className="my-4 grid gap-2 rounded-2xl bg-soft p-4">
      <li><strong>Registro básico</strong> · {record?.estado === 'aprobada' ? 'Aprobado' : (record?.estado || 'Por guardar').replaceAll('_',' ')}</li>
      <li><strong>Ficha técnica</strong> · Consulta el resultado de la visita con el equipo de campo.</li>
      <li><strong>Teléfono público</strong> · {/^[0-9]{10}$/.test(record?.telefonoPublico || '') ? '10 dígitos guardados' : 'Completa los 10 dígitos en Información'}</li>
      <li><strong>Ubicación GPS</strong> · {record?.coordenadas?.length === 2 && record.coordenadas.every(Number.isFinite) && Math.abs(record.coordenadas[0]) <= 90 && Math.abs(record.coordenadas[1]) <= 180 ? 'Punto GPS en rango' : 'Falta el punto guardado'}</li>
      <li><strong>Estado operativo</strong> · {(record?.estadoOperativo || 'Por confirmar').replaceAll('_',' ')}</li>
    </ul>
    {record ? <>
      <button className="km-button" disabled={ocupado} onClick={() => { mostrar(null); ejecutar(async () => mostrar({ estado: record.estadoOperativo, visible: Boolean(await obtenerFichaPublica(record.id)) })); }}>Comprobar visibilidad sin sesión</button>
      {resultado && resultado.estado === record.estadoOperativo && <p role="status" className="my-3">{resultado.visible ? <a className="underline" href={'#meliponario/' + record.id}>Visible para visitantes · Abrir ficha</a> : 'El servicio público todavía no devuelve esta ficha.'}</p>}
      <details className="mt-5"><summary>Solicitar la baja de este meliponario</summary>
        {baja ? <p role="status">Solicitud enviada a Administración.</p> :
          <form className="mt-3 grid gap-3" onSubmit={pedirBaja}>
            <label>Motivo de la baja<textarea required className="owner-field" value={motivo} onChange={e => cambiar(e.target.value)}/></label>
            <p className="text-sm">El administrador revisará tu solicitud de desactivación. Se conserva el historial.</p>
            <button className="km-button justify-self-start" disabled={bloqueado || ocupado || !motivo.trim()}>Solicitar baja</button>
          </form>}
      </details>
    </> : <p>Guarda el borrador para poder enviar la solicitud básica.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
