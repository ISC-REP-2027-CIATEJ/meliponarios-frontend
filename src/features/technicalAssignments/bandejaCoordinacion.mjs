import { validId } from '../territory/territoryApi.mjs';

export async function bandejaCoordinacion(flujo) {
  const [agenda, pendientes, historial, miembros] = await Promise.allSettled([
    flujo.agenda(), flujo.pendientes(), flujo.historial(), flujo.miembros(),
  ]);
  if (agenda.status === 'rejected' && pendientes.status === 'rejected' && historial.status === 'rejected') {
    throw new Error('No se pudieron consultar las visitas de tu territorio. Comprueba la sesión y vuelve a cargar.');
  }
  const avisos = [];
  function filas(resultado, titulo) {
    if (resultado.status === 'fulfilled' && Array.isArray(resultado.value)) return resultado.value;
    avisos.push('No se pudo consultar ' + titulo + '.');
    return [];
  }
  const visitas = filas(agenda, 'la agenda territorial');
  const solicitudes = filas(pendientes, 'la bandeja de primeras visitas');
  const anteriores = filas(historial, 'el historial de asignaciones');
  const personas = filas(miembros, 'el directorio del equipo');
  const nombres = new Map(personas.map(p => [p.usuario_id, [p.nombre, p.apellidos].filter(Boolean).join(' ')]));
  const porRegistro = new Map(visitas.map(v => [v.meliponario_id, v]));
  const zonas = new Map();
  for (const r of [...visitas, ...solicitudes]) {
    if (validId(r.zona_id) && r.zona_nombre) zonas.set(r.zona_id, { id: r.zona_id, nombre: r.zona_nombre });
  }
  const assignments = anteriores.filter(r => validId(r.asignacion_id) && validId(r.meliponario_id)).map(r => {
    const v = porRegistro.get(r.meliponario_id);
    return { id: r.asignacion_id, meliponarioId: r.meliponario_id, nombre: r.nombre_meliponario,
      trabajadorId: r.trabajador_id, trabajadorNombre: nombres.get(r.trabajador_id) || (v?.asignacion_activa_id === r.asignacion_id && v.trabajador_actual) || 'Nombre no disponible',
      estado: r.estado, vigente: agenda.status === 'fulfilled' ? v?.asignacion_activa_id === r.asignacion_id : null,
      cancelable: r.estado === 'asignada' && v?.asignacion_activa_id === r.asignacion_id,
      asignadaEn: r.fecha_asignacion, canceladaEn: r.fecha_cancelacion, motivoCancelacion: r.motivo_cancelacion };
  });
  for (const v of visitas) {
    if (validId(v.asignacion_activa_id) && !assignments.some(a => a.id === v.asignacion_activa_id)) {
      assignments.push({ id: v.asignacion_activa_id, meliponarioId: v.meliponario_id, nombre: v.nombre,
        localidad: v.localidad, vigente: true, cancelable: false, trabajadorNombre: v.trabajador_actual || 'Nombre no disponible' });
    }
  }
  const pending = solicitudes.filter(r => validId(r.meliponario_id) && !porRegistro.get(r.meliponario_id)?.asignacion_activa_id)
    .map(r => ({ id: r.meliponario_id, meliponarioId: r.meliponario_id, nombre: r.nombre, localidad: r.localidad,
      meliponario_id: r.meliponario_id, zona_id: r.zona_id, zona_nombre: r.zona_nombre }));
  return { pending, assignments, zones: [...zonas.values()], avisos, fuentes: {
    pendientes: pendientes.status === 'fulfilled',
    asignadas: agenda.status === 'fulfilled',
    historial: agenda.status === 'fulfilled' && historial.status === 'fulfilled',
  } };
}


// Una consulta fallida se comunica sin presentar un contador de cero.
export async function panelCoordinacion(flujo) {
  const [asignaciones, revision] = await Promise.allSettled([
    bandejaCoordinacion(flujo), flujo.revisiones(),
  ]);
  let revisiones = null;
  if (revision.status === 'fulfilled' && Array.isArray(revision.value) &&
      revision.value.every(f => validId(f.visita_tecnica_id) && validId(f.meliponario_id) && typeof f.estado === 'string')) {
    revisiones = revision.value.map(f => ({ ...f, id: f.visita_tecnica_id, nombre: f.nombre_meliponario || f.nombre || 'Meliponario',
      trabajadorNombre: f.trabajador_nombre, localidad: f.localidad_nombre || f.localidad }));
  }
  if (asignaciones.status === 'rejected' && revisiones === null) {
    throw new Error('No se pudieron consultar las asignaciones ni las fichas de tu cobertura. Actualiza para volver a intentarlo.');
  }
  const data = asignaciones.status === 'fulfilled' ? asignaciones.value : {
    pending: [], assignments: [], zones: [], fuentes: {}, avisos: ['No se pudieron consultar las asignaciones.'],
  };
  return { ...data, revisiones: revisiones || [], fuentes: { ...data.fuentes, revisiones: revisiones !== null },
    avisos: [...data.avisos, ...(revisiones === null ? ['No se pudo consultar la bandeja de fichas técnicas.'] : [])] };
}
