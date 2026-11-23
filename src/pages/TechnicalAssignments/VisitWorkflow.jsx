import { useCallback, useEffect, useState } from 'react';
import { comprobarConfiguracion, supabase } from '../../lib/supabase';
import { servicioEquipos } from '../../features/territory/territoryService';
import { crearFlujoVisitas } from '../../features/technicalAssignments/visitWorkflow.mjs';
import { obtenerFichaPublica } from '../../features/publicMeliponarios/publicService';

const flujo = crearFlujoVisitas(supabase);
const boton = 'km-button';
const primario = 'km-button km-button--primary';
const panel = 'km-panel km-inset grid gap-4';
const titulo = valor => String(valor ?? '').replaceAll('_', ' ');
const fecha = valor => valor ? String(valor).slice(0, 10) : '';

function useLectura(cargar, revision = 0) {
  const [resultado, actualizar] = useState(null);
  useEffect(() => {
    let vigente = true;
    Promise.resolve().then(() => { comprobarConfiguracion(); return cargar(); })
      .then(data => { if (vigente) actualizar({ cargar, revision, data }); })
      .catch(error => { if (vigente) actualizar({ cargar, revision, error: error.message }); });
    return () => { vigente = false; };
  }, [cargar, revision]);
  return resultado?.cargar === cargar && resultado.revision === revision ? resultado : {};
}

function Lectura({ resultado, children }) {
  if (resultado.error) return <p role="alert">{resultado.error}</p>;
  if (resultado.data === undefined) return <p role="status">Consultando registros…</p>;
  return children(resultado.data);
}

function Contenido({ valor }) {
  if (Array.isArray(valor)) return valor.length
    ? <ul className="grid list-disc gap-2 pl-5">{valor.map((item, i) => <li key={i}><Contenido valor={item}/></li>)}</ul> : 'Sin registros';
  if (valor && typeof valor === 'object') return <dl className="grid gap-2">{Object.entries(valor).map(([clave, v]) =>
    <div key={clave} className="rounded-xl bg-soft px-3 py-2"><dt className="font-bold capitalize">{titulo(clave)}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words"><Contenido valor={v}/></dd></div>)}</dl>;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return valor === null || valor === '' ? 'Sin dato' : String(valor);
}

export function Asignar({ registro, user, ocupado, ejecutar }) {
  const [equipo, setEquipo] = useState('');
  const [trabajador, setTrabajador] = useState('');
  const [motivo, setMotivo] = useState('');
  const equipos = useLectura(useCallback(async () => {
    const { grupos } = await servicioEquipos().directorio(user.id);
    return grupos.filter(g => g.activo && g.zona_id === registro.zona_id && g.coordinador_id === user.id);
  }, [registro.zona_id, user.id]));
  const personas = useLectura(useCallback(() => equipo
    ? flujo.trabajadores(registro.meliponario_id, equipo) : [], [registro.meliponario_id, equipo]));
  function enviar(e) {
    e.preventDefault();
    const persona = personas.data?.find(p => p.usuario_id === trabajador);
    if (ocupado || !persona || !motivo.trim()) return;
    if (!window.confirm('¿Asignar la primera visita de ' + registro.nombre + ' a ' + [persona.nombre, persona.apellidos].filter(Boolean).join(' ') + '?')) return;
    ejecutar(() => flujo.asignar(registro.meliponario_id, equipo, trabajador, motivo), 'Visita asignada. El trabajador puede actualizar su bandeja en la app.');
  }
  return <form onSubmit={enviar} className="grid gap-3"><fieldset disabled={ocupado} className="grid gap-3"><Lectura resultado={equipos}>{grupos => <label>Equipo de {registro.zona_nombre}
    <select className="review-field" required value={equipo} onChange={e => { setEquipo(e.target.value); setTrabajador(''); }}>
      <option value="">{grupos.length ? 'Selecciona tu equipo' : 'Sin equipos activos para esta zona'}</option>
      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>}</Lectura>
    {equipo && <Lectura resultado={personas}>{filas => <label>Trabajador de campo
      <select className="review-field" required value={trabajador} onChange={e => setTrabajador(e.target.value)}>
        <option value="">{filas.length ? 'Selecciona un trabajador' : 'Sin trabajadores elegibles en este equipo y zona'}</option>
        {filas.map(p => <option key={p.usuario_id} value={p.usuario_id}>{[p.nombre, p.apellidos].filter(Boolean).join(' ')}</option>)}</select></label>}</Lectura>}
    <label>Motivo de la primera visita<textarea required className="review-field" value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
    <button className={primario} disabled={ocupado || !trabajador || !motivo.trim()}>Confirmar asignación</button></fieldset></form>;
}

export function Revision({ fila, ocupado, ejecutar }) {
  const visita = fila.visita_tecnica_id;
  const datos = useLectura(useCallback(() => flujo.detalle(visita), [visita]));
  const [comentario, setComentario] = useState('');
  const resolver = decision => {
    const aprobar = decision === 'aprobar';
    const pregunta = aprobar ? '¿Aprobar la ficha? Supabase evaluará si corresponde publicarla.' : '¿Devolver esta ficha al trabajador con el comentario escrito?';
    if (!window.confirm(pregunta)) return;
    ejecutar(() => flujo.resolver(visita, decision, comentario), aprobar ? 'Ficha técnica aprobada.' : 'Ficha devuelta para corrección.',
      aprobar ? { id: fila.meliponario_id, nombre: fila.nombre_meliponario } : null);
  };
  return <Lectura resultado={datos}>{detalle => <div className="grid gap-4">
    <details open><summary className="font-bold">Datos de la visita e inventario</summary><Contenido valor={detalle.ficha}/></details>
    <details open><summary className="font-bold">Respuestas del trabajador</summary><Contenido valor={detalle.respuestas}/></details>
    {fila.estado === 'enviada' && <button className={primario} disabled={ocupado} onClick={() => {
      if (window.confirm('¿Tomar la revisión de esta ficha técnica?')) ejecutar(() => flujo.tomar(visita), 'Revisión tomada. Abre la ficha en revisión para resolverla.');
    }}>Tomar revisión</button>}
    {fila.estado === 'en_revision' && <><label>Comentario al trabajador<textarea className="review-field" value={comentario} onChange={e => setComentario(e.target.value)}/></label>
      <div className="flex flex-wrap gap-3"><button className={boton} disabled={ocupado || !comentario.trim()} onClick={() => resolver('solicitar_correccion')}>Solicitar corrección</button>
      <button className={primario} disabled={ocupado} onClick={() => resolver('aprobar')}>Aprobar ficha técnica</button></div></>}
  </div>}</Lectura>;
}

export function Publicacion({ registro }) {
  const [intento, setIntento] = useState(0);
  const resultado = useLectura(useCallback(() => obtenerFichaPublica(registro.id), [registro]), intento);
  return <section className={panel} aria-label="Resultado público"><h2 className="font-bold">{registro.nombre}</h2>
    <Lectura resultado={resultado}>{ficha => ficha
      ? <a className={primario} href={'#meliponario/' + registro.id}>Visible sin sesión · Abrir ficha pública</a>
      : <p>La ficha todavía no aparece en la consulta pública. Revisa el teléfono de contacto, el GPS y el estado operativo.</p>}</Lectura>
    <button className={boton} onClick={() => setIntento(n => n + 1)}>Volver a comprobar visibilidad</button></section>;
}

export default function VisitWorkflow() {
  const [version, refrescar] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(0);
  const resultado = useLectura(flujo.visitasPropias, version);
  return <main className="km-container km-workspace">
    <header className="km-work-banner km-page-heading"><div>
      <h1 className="km-page-title">Mis visitas de campo</h1>
      <p className="mt-2">Abre la app de campo con esta misma cuenta para capturar o corregir tu ficha.</p>
    </div><button className={boton} onClick={() => { setPagina(0); refrescar(v => v + 1); }}>Actualizar bandeja</button></header>
    <a className={boton + ' mb-4'} href="#campo/solicitudes">Solicitudes básicas</a>
    <section className={panel}><h2 className="text-xl font-bold">Meliponarios asignados</h2>
      <label>Buscar meliponario<input className="review-field" type="search" value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(0); }}/></label>
      <Lectura resultado={resultado}>{filas => {
        const encontradas = filas.filter(f => [f.nombre, f.nombre_meliponario, f.localidad, f.localidad_nombre].filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(buscar.trim().toLocaleLowerCase('es-MX')));
        const ultima = Math.max(0, Math.ceil(encontradas.length / 12) - 1);
        const actual = Math.min(pagina, ultima);
        return <>{!encontradas.length && <p>{buscar ? 'Sin coincidencias.' : 'No hay visitas asignadas para tu cuenta y cobertura actuales.'}</p>}
          {encontradas.slice(actual * 12, actual * 12 + 12).map(f => <article className="km-record-inset grid gap-3 p-5" key={f.asignacion_id}>
            <h3 className="text-lg font-bold">{f.nombre || f.nombre_meliponario}</h3>
            <p>{[f.zona_nombre, f.localidad || f.localidad_nombre, fecha(f.fecha_visita), titulo(f.estado_formulario || f.tipo_visita)].filter(Boolean).join(' · ')}</p>
            {f.motivo_asignacion && <p>{f.motivo_asignacion}</p>}
            {f.comentario_correccion && <p><strong>Corrección solicitada. </strong>{f.comentario_correccion}</p>}
          </article>)}
          {ultima > 0 && <div className="flex items-center gap-3">
            <button className={boton} disabled={!actual} onClick={() => setPagina(actual-1)}>Anterior</button>
            <span>{actual+1} de {ultima+1}</span><button className={boton} disabled={actual === ultima} onClick={() => setPagina(actual+1)}>Siguiente</button>
          </div>}
        </>;
      }}</Lectura>
    </section>
  </main>;
}
