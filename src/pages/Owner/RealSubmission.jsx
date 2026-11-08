import { useEffect, useRef, useState } from 'react';
import { enviarSolicitudReal, obtenerRevisionesCliente } from '../../features/territory/territoryService';

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-solid border-[#cbd9bc] bg-white px-5 py-2 text-sm font-semibold text-[#163e2c] hover:bg-[#edf4e6] disabled:opacity-50';
export default function RealSubmission({ userId, record, dirty, onSubmitted }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reviews, setReviews] = useState([]);
  const lock = useRef(false);
  const dialog = useRef(null);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    if (record.solicitudId) obtenerRevisionesCliente(userId, record.solicitudId).then(rows => { if (active) setReviews(rows); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [userId, record.solicitudId]);
  async function send() {
    if (lock.current || dirty || uncertain) return;
    lock.current = true; setSaving(true); setError('');
    try {
      await enviarSolicitudReal(userId, record.id, record.estado);
      if (live.current) { dialog.current.close(); onSubmitted(); }
    } catch (failure) {
      if (live.current) { setError(failure.message); setUncertain(Boolean(failure.uncertain)); }
    } finally { lock.current = false; if (live.current) setSaving(false); }
  }
  const allowed = ['borrador', 'correccion'].includes(record.estado);
  return <section className="mb-6 rounded-2xl border border-solid border-[#cbdcbc] bg-[#eff6e9] p-5" aria-labelledby="real-submission-title"><h2 id="real-submission-title" className="text-lg font-bold">Solicitud real de revisión</h2>
    {reviews.map(row => <p key={row.id} className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed"><strong>Observaciones:</strong> {row.comentario}</p>)}
    {allowed ? <><p className="mt-3 text-sm leading-relaxed">Guarda primero tus datos y, si quieres que se publique tras la aprobación, las autorizaciones de Control de publicación. Después envía el registro al trabajador asignado a la zona del meliponario. El servidor comprobará las especies, cantidades y ubicación.</p><button type="button" className={`${button} mt-4`} disabled={dirty || saving || uncertain} onClick={() => { setError(''); dialog.current.showModal(); }}>{record.estado === 'correccion' ? 'Reenviar registro corregido' : 'Enviar a revisión'}</button>{dirty && <p className="mt-2 text-xs">Guarda el borrador y termina los cambios de Publicación y Fotografías para habilitar el envío.</p>}</> : <p className="mt-3 text-sm leading-relaxed">La solicitud está en estado {record.estado}. La publicación también requiere las autorizaciones del propietario. Puedes revisarlas en Control de publicación, debajo de esta sección.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-[#964b2f]">{error}</p>}{uncertain && <button type="button" className={`${button} mt-3`} onClick={onSubmitted}>Actualizar y comprobar el estado</button>}
    <dialog ref={dialog} aria-labelledby="real-submit-confirm" onCancel={event => { if (lock.current) event.preventDefault(); }}><h3 id="real-submit-confirm" className="text-2xl font-bold">Enviar el registro a revisión</h3><p className="my-4 text-sm leading-relaxed">Se enviará la versión guardada de {record.nombre}. Después sus datos quedarán bloqueados hasta que se soliciten correcciones. Este envío no publica la ficha.</p>{error && <p role="alert" className="mb-4 text-sm text-[#964b2f]">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={saving} onClick={() => dialog.current.close()}>Cancelar</button><button type="button" className={button} disabled={saving || uncertain} onClick={send}>{saving ? 'Enviando…' : 'Confirmar envío'}</button></div></dialog>
  </section>;
}
