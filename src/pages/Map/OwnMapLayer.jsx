import './OwnMapLayer.css';

export function OwnMapNotice({ state }) {
  if (!state.visible) return null;
  return <section aria-label="Tus registros privados en el mapa" className="mb-5 rounded-2xl border border-solid border-[#d9e2ce] bg-[#f0f5e8] p-4 text-sm leading-relaxed text-[#3e5b36]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">Tus registros de prueba · solo tú los ves</p><p className="mt-1">{state.loading ? 'Recuperando tus registros…' : state.error ? state.error : `${state.puntos.length} con ubicación en el mapa${state.total > state.puntos.length ? ` · ${state.total - state.puntos.length} por ubicar` : ''}. Tus borradores y solicitudes todavía no están aprobados.`}</p><p className="mt-1 text-xs">Se distinguen por el borde punteado. Los demás visitantes solo ven los ejemplos públicos.</p></div><a href="#mis-meliponarios" className="inline-flex min-h-11 items-center rounded-full border border-solid border-[#cdd8c0] bg-white px-4 py-2 font-semibold text-[#30502d] no-underline">Mis meliponarios</a></div>
  </section>;
}

export function PrivateMapSelection({ point }) {
  if (!point?.privadoDemo) return null;
  return <div className="mb-4 rounded-2xl border border-dashed border-[#bdcda9] bg-[#f2f6e9] p-4 text-sm leading-relaxed text-[#4a653b]"><p className="font-bold">{point.etiquetaPrivada}</p><p className="mt-1">Solo aparece en tu cuenta. Este registro local aún no se publica para otras personas.</p></div>;
}
