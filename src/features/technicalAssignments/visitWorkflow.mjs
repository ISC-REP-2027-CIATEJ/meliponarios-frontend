import { validId } from '../territory/territoryApi.mjs';

const firstVisit = 'levantamiento_tecnico';
const listSize = 100;

export function crearFlujoVisitas(client) {
  function id(value) {
    if (!validId(value)) throw new Error('Actualiza la bandeja y vuelve a elegir el registro.');
    return value;
  }

  async function leer(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Supabase no pudo completar la consulta.');
    return data;
  }

  async function lista(nombre, clave, parametros = {}) {
    const rows = [];
    for (;;) {
      const page = await leer(client.rpc(nombre, parametros).order(clave).range(rows.length, rows.length + listSize - 1));
      if (!Array.isArray(page)) throw new Error('La respuesta de la bandeja está incompleta.');
      if (!page.length) return rows;
      rows.push(...page);
    }
  }

  async function guardar(nombre, args) {
    const result = await leer(client.rpc(nombre, args));
    if (!validId(result)) throw new Error('El servidor no confirmó el resultado.');
    return result;
  }

  return {
    pendientes: () => lista('coord_meliponarios_pendientes_visita', 'meliponario_id'),
    revisiones: () => lista('coord_bandeja_formularios_tecnicos', 'visita_tecnica_id'),
    visitasPropias: () => lista('mis_visitas_tecnicas_trabajador_detalle', 'asignacion_id'),
    trabajadores: (registro, equipo) => lista('coord_trabajadores_grupo_visita', 'usuario_id', {
      p_meliponario_id: id(registro), p_grupo_id: id(equipo),
    }),
    asignar(registro, equipo, trabajador, motivo) {
      if (!motivo?.trim()) throw new Error('Escribe el motivo de la visita.');
      return guardar('coord_asignar_visita_grupo', {
        p_meliponario_id: id(registro), p_grupo_id: id(equipo), p_trabajador_id: id(trabajador),
        p_tipo_visita: firstVisit, p_motivo: motivo.trim(),
      });
    },
    async detalle(visita) {
      const args = { p_visita_tecnica_id: id(visita) };
      const [ficha, respuestas] = await Promise.all([
        leer(client.rpc('obtener_formulario_tecnico', args)),
        leer(client.rpc('obtener_respuestas_tecnicas', args)),
      ]);
      if (!tieneContenido(ficha) || !tieneContenido(respuestas)) {
        throw new Error('Aún no se pudo leer la ficha con sus respuestas. Actualiza antes de revisarla.');
      }
      return { ficha, respuestas };
    },
    tomar: visita => guardar('coord_tomar_formulario_tecnico', { p_visita_tecnica_id: id(visita) }),
    resolver(visita, decision, comentario) {
      if (!['aprobar', 'solicitar_correccion'].includes(decision)) throw new Error('Decisión desconocida.');
      if (decision === 'solicitar_correccion' && !comentario?.trim()) throw new Error('Explica qué debe corregir el trabajador.');
      return guardar('coord_resolver_formulario_tecnico', {
        p_visita_tecnica_id: id(visita), p_decision: decision, p_comentario: comentario.trim() || null,
      });
    },
  };
}

export function tieneContenido(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return Boolean(valor.trim());
  if (typeof valor === 'object') return Object.values(valor).some(tieneContenido);
  return true;
}
