import { useEffect } from 'react';

const requisitos = [
  'Registro básico aprobado.',
  'Formulario técnico aprobado por el coordinador.',
  'Número telefónico de contacto del meliponario.',
  'Ubicación GPS válida.',
  'Meliponario activo.',
];

// No deduce aprobaciones ni llama a la antigua RPC de autorizaciones.
export default function OwnerPublication({ recordId, onActividad }) {
  useEffect(() => { onActividad?.({ dirty: false, busy: false }); }, [onActividad]);
  return <section id="publicacion" aria-labelledby="publication-requirements-title" className="mb-6 km-panel km-inset">
    <p className="mb-2 text-xs font-bold tracking-[0.15em] text-[#92752f]">CONDICIONES DEL PROCESO</p>
    <h2 id="publication-requirements-title" className="text-xl font-bold">Publicación del meliponario</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted">Para aparecer en Explorar, Mapa y Ficha pública se deben completar las siguientes condiciones:</p>
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">{requisitos.map(requisito => <li key={requisito}>{requisito}</li>)}</ul>
    <p className="mt-4 text-sm leading-relaxed text-muted">La aprobación del registro básico es una etapa del proceso. Después se asignan la visita, la verificación en campo y la revisión del formulario técnico.</p>
    <p className="mt-3 text-sm leading-relaxed text-muted">El teléfono de contacto del meliponario es independiente del teléfono de la cuenta.</p>
    {!recordId && <p className="mt-4 rounded-xl bg-[#edf5e7] p-4 text-sm">Empieza por guardar tu registro básico para continuar con su revisión.</p>}
  </section>;
}
