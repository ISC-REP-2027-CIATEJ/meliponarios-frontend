import { validId, TerritoryError } from '../territory/territoryApi.mjs';

const STATES = ['pendientes', 'correccion', 'aprobada', 'rechazada'];
const PAGE_SIZE = 100;
const MAX_ROWS_PER_STATE = 10000;
const text = value => typeof value === 'string';
const date = value => text(value) && Number.isFinite(Date.parse(value));
const length = value => text(value) ? Array.from(value.trim()).length : -1;
const invalid = () => new TerritoryError('La respuesta de asignaciones está incompleta. Actualiza antes de continuar.', 'INVALID_RESPONSE');

function failure(error, write = false) {
  if (error?.code === '42501') return new TerritoryError('Tu cuenta o tu zona ya no permite esta operación. Actualiza y comprueba tu sesión.', 'ACCESS_DENIED');
  if (['PGRST202', '42883'].includes(error?.code)) return new TerritoryError('El servicio de asignaciones técnicas no está disponible en este proyecto. Comunícalo al responsable del backend.', 'CONTRACT_MISSING');
  if (write && !error?.code) return new TerritoryError('No se pudo confirmar si se guardó la operación. Actualiza y revisa el listado antes de volver a enviarla.', 'RESULT_UNKNOWN', true);
  return new TerritoryError(error?.message || 'No se pudo consultar el servicio de asignaciones.', error?.code || 'NETWORK_ERROR');
}

function coordinatorRows(data) {
  if (!Array.isArray(data)) throw invalid();
  const seen = new Set();
  const active = new Set();
  return data.map(row => {
    if (!row || ![row.asignacion_id, row.meliponario_id, row.trabajador_id].every(validId)
      || !text(row.nombre_meliponario) || !date(row.fecha_asignacion)
      || !['asignada', 'cancelada'].includes(row.estado) || seen.has(row.asignacion_id)
      || (row.estado === 'asignada' && active.has(row.meliponario_id))
      || (row.estado === 'cancelada' && (!date(row.fecha_cancelacion) || !text(row.motivo_cancelacion)))) throw invalid();
    seen.add(row.asignacion_id);
    if (row.estado === 'asignada') active.add(row.meliponario_id);
    return {
      id: row.asignacion_id, meliponarioId: row.meliponario_id, nombre: row.nombre_meliponario,
      trabajadorId: row.trabajador_id, estado: row.estado, asignadaEn: row.fecha_asignacion,
      canceladaEn: row.fecha_cancelacion, motivoCancelacion: row.motivo_cancelacion,
    };
  });
}

export function createTechnicalAssignmentsApi(client) {
  async function authorize(userId, role) {
    if (!client || !validId(userId)) throw new TerritoryError('Inicia sesión para continuar.', 'ACCESS_DENIED');
    let auth;
    try { auth = await client.auth.getUser(); } catch { throw new TerritoryError('No se pudo comprobar tu sesión.'); }
    if (auth.error || auth.data?.user?.id !== userId) throw new TerritoryError('La sesión cambió. Vuelve a iniciar sesión.', 'ACCESS_DENIED');
    let profile;
    try { profile = await client.from('perfiles').select('id,rol_id,activo').eq('id', userId).maybeSingle(); }
    catch { throw new TerritoryError('No se pudo comprobar tu perfil.'); }
    if (profile.error) throw failure(profile.error);
    if (profile.data?.activo !== true || Number(profile.data.rol_id) !== role) throw new TerritoryError('Esta operación requiere el rol activo correspondiente.', 'ACCESS_DENIED');
  }

  async function rpc(name, args = {}, write = false) {
    let result;
    try { result = await client.rpc(name, args); } catch (error) { throw failure(error, write); }
    if (result.error) throw failure(result.error, write);
    if (result.data == null || (write && !validId(result.data))) {
      throw new TerritoryError('El servidor no devolvió un resultado verificable. Actualiza antes de continuar.', write ? 'RESULT_UNKNOWN' : 'INVALID_RESPONSE', write);
    }
    return result.data;
  }

  async function basicRequests() {
    const rows = [];
    const seen = new Set();
    let zones = null;
    for (const state of STATES) {
      let offset = 0;
      let expectedTotal = null;
      do {
        const value = await rpc('km_campo_bandeja', { p_estado: state, p_busqueda: '', p_offset: offset, p_limite: PAGE_SIZE });
        if (!Array.isArray(value.solicitudes) || !Array.isArray(value.zonas)
          || value.rol_id !== 3 || !Number.isSafeInteger(value.total) || value.total < 0
          || value.total > MAX_ROWS_PER_STATE || (expectedTotal !== null && expectedTotal !== value.total)
          || value.solicitudes.length !== Math.min(PAGE_SIZE, Math.max(0, value.total - offset))) throw invalid();
        expectedTotal = value.total;
        zones = value.zonas;
        for (const row of value.solicitudes) {
          const allowed = state === 'pendientes' ? ['enviada', 'en_revision'] : [state];
          if (!row || !validId(row.id) || !validId(row.meliponario_id) || !text(row.nombre)
            || !text(row.localidad) || !text(row.municipio) || !allowed.includes(row.estado)
            || !Number.isSafeInteger(row.numero_intento) || row.numero_intento < 1 || seen.has(row.id)) throw invalid();
          seen.add(row.id);
          rows.push(row);
        }
        offset += value.solicitudes.length;
      } while (offset < expectedTotal);
    }
    if (!zones.every(zone => validId(zone.id) && text(zone.nombre))) throw invalid();
    const latest = new Map();
    for (const row of rows) {
      const current = latest.get(row.meliponario_id);
      if (current?.numero_intento === row.numero_intento) throw invalid();
      if (!current || row.numero_intento > current.numero_intento) latest.set(row.meliponario_id, row);
    }
    return { zones, latest: [...latest.values()] };
  }

  return {
    async coordinator(userId) {
      await authorize(userId, 3);
      const assignments = coordinatorRows(await rpc('coord_consultar_visitas_tecnicas'));
      // La bandeja incluye intentos históricos. Se contrastan todos los estados visibles.
      const { zones, latest } = await basicRequests();
      const active = new Set(assignments.filter(row => row.estado === 'asignada').map(row => row.meliponarioId));
      const pending = latest.filter(row => row.estado === 'aprobada' && !active.has(row.meliponario_id)).map(row => ({
        id: row.id, meliponarioId: row.meliponario_id, nombre: row.nombre,
        localidad: row.localidad, municipio: row.municipio, intento: row.numero_intento,
      }));
      // La RPC de escritura vuelve a exigir el último intento aprobado, incluso si cambió después de leer.
      return { zones, pending, assignments };
    },

    async worker(userId) {
      await authorize(userId, 4);
      const rows = await rpc('mis_visitas_tecnicas_asignadas');
      if (!Array.isArray(rows)) throw invalid();
      const seen = new Set();
      const meliponarios = new Set();
      return rows.map(row => {
        if (!row || ![row.asignacion_id, row.meliponario_id].every(validId)
          || !text(row.nombre_meliponario) || !text(row.localidad_nombre) || !text(row.motivo_asignacion)
          || !date(row.fecha_asignacion) || seen.has(row.asignacion_id) || meliponarios.has(row.meliponario_id)) throw invalid();
        seen.add(row.asignacion_id); meliponarios.add(row.meliponario_id);
        return { id: row.asignacion_id, meliponarioId: row.meliponario_id, nombre: row.nombre_meliponario,
          localidad: row.localidad_nombre, asignadaEn: row.fecha_asignacion, motivo: row.motivo_asignacion };
      });
    },

    async assign(userId, { meliponarioId, trabajadorId, motivo }) {
      if (![meliponarioId, trabajadorId].every(validId) || length(motivo) < 10 || length(motivo) > 1000) {
        throw new TerritoryError('Indica un meliponario, un identificador de trabajador válido y un motivo de 10 a 1000 caracteres.', 'INVALID_INPUT');
      }
      await authorize(userId, 3);
      return rpc('coord_asignar_visita_tecnica', { p_meliponario_id: meliponarioId, p_trabajador_id: trabajadorId, p_motivo: motivo.trim() }, true);
    },

    async cancel(userId, { asignacionId, motivo }) {
      if (!validId(asignacionId) || length(motivo) < 10 || length(motivo) > 1000) throw new TerritoryError('Indica una asignación válida y un motivo de 10 a 1000 caracteres.', 'INVALID_INPUT');
      await authorize(userId, 3);
      const result = await rpc('coord_cancelar_visita_tecnica', { p_asignacion_id: asignacionId, p_motivo: motivo.trim() }, true);
      if (result !== asignacionId) throw new TerritoryError('El resultado no corresponde a la asignación. Actualiza antes de continuar.', 'RESULT_UNKNOWN', true);
      return result;
    },
  };
}
