const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validId = value => typeof value === 'string' && UUID.test(value);
const textLength = value => typeof value === 'string' ? Array.from(value.trim()).length : -1;

export class TerritoryError extends Error {
  constructor(message, code = 'TERRITORY_ERROR', uncertain = false) {
    super(message); this.name = 'TerritoryError'; this.code = code; this.uncertain = uncertain;
  }
}

function failure(error, write = false) {
  if (error?.code === '42501') return new TerritoryError('Tu cuenta o asignación ya no permite esta operación. Vuelve a iniciar sesión y actualiza la bandeja.', 'ACCESS_DENIED');
  if (['PGRST202', '42883'].includes(error?.code)) return new TerritoryError('Falta instalar o actualizar el SQL del panel territorial en este proyecto Supabase.', 'CONTRACT_MISSING');
  if (write && !error?.code) return new TerritoryError('No se pudo confirmar el resultado. Actualiza y comprueba el estado antes de intentar otra operación.', 'RESULT_UNKNOWN', true);
  return new TerritoryError(error?.message || 'No se pudo consultar Supabase.', error?.code || 'NETWORK_ERROR');
}

export function createTerritoryApi(client) {
  async function authorize(userId, roles) {
    if (!client || !validId(userId)) throw new TerritoryError('Inicia sesión para continuar.', 'ACCESS_DENIED');
    let auth;
    try { auth = await client.auth.getUser(); } catch { throw new TerritoryError('No pudimos comprobar tu sesión.'); }
    if (auth.error || auth.data?.user?.id !== userId) throw new TerritoryError('La sesión cambió. Vuelve a iniciar sesión.', 'ACCESS_DENIED');
    let profile;
    try { profile = await client.from('perfiles').select('id,rol_id,activo').eq('id', userId).maybeSingle(); }
    catch { throw new TerritoryError('No pudimos comprobar el perfil de tu cuenta.'); }
    if (profile.error) throw failure(profile.error);
    if (profile.data?.activo !== true || !roles.includes(Number(profile.data.rol_id))) throw new TerritoryError('La cuenta no tiene el rol activo requerido.', 'ACCESS_DENIED');
  }
  async function rpc(name, args, write = false) {
    let result;
    try { result = await client.rpc(name, args); } catch (error) { throw failure(error, write); }
    if (result.error) throw failure(result.error, write);
    if (result.data === null || result.data === undefined) throw new TerritoryError('El servidor no devolvió un resultado verificable.', write ? 'RESULT_UNKNOWN' : 'INVALID_RESPONSE', write);
    if (write && !validId(result.data)) throw new TerritoryError('El resultado no contiene un identificador válido. Actualiza antes de reintentar.', 'RESULT_UNKNOWN', true);
    return result.data;
  }
  return {
    async assignments(userId) {
      await authorize(userId, [1]);
      const data = await rpc('km_admin_catalogo_asignaciones', {});
      if (!Array.isArray(data.usuarios) || !Array.isArray(data.zonas) || !Array.isArray(data.asignaciones)) throw new TerritoryError('Respuesta de asignaciones incompleta.');
      return data;
    },
    async assign(userId, { id, usuarioId, zonaId, observaciones = '' }) {
      if (![id, usuarioId, zonaId].every(validId) || typeof observaciones !== 'string' || Array.from(observaciones).length > 2000) throw new TerritoryError('Revisa la cuenta, zona y observaciones.');
      await authorize(userId, [1]);
      return rpc('km_admin_asignar_zona', { p_asignacion_id: id, p_usuario_id: usuarioId, p_zona_id: zonaId, p_observaciones: observaciones.trim() }, true);
    },
    async finish(userId, id) {
      if (!validId(id)) throw new TerritoryError('Selecciona una asignación válida.');
      await authorize(userId, [1]);
      return rpc('km_admin_finalizar_asignacion', { p_asignacion_id: id }, true);
    },
    async list(userId, { estado = 'pendientes', busqueda = '', offset = 0 } = {}) {
      if (!['pendientes', 'correccion', 'aprobada', 'rechazada'].includes(estado) || typeof busqueda !== 'string' || Array.from(busqueda).length > 160 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000000) throw new TerritoryError('Revisa los filtros de la bandeja.');
      await authorize(userId, [3, 4]);
      const data = await rpc('km_campo_bandeja', { p_estado: estado, p_busqueda: busqueda.trim(), p_offset: offset, p_limite: 20 });
      if (!Array.isArray(data.solicitudes) || !Array.isArray(data.zonas) || !Number.isSafeInteger(data.total) || !data.contadores) throw new TerritoryError('Respuesta de solicitudes incompleta.');
      return data;
    },
    async detail(userId, id) {
      if (!validId(id)) throw new TerritoryError('Selecciona una solicitud válida.');
      await authorize(userId, [3, 4]);
      const data = await rpc('km_campo_ficha', { p_solicitud_id: id });
      if (data.id !== id || !Array.isArray(data.abejas) || !Array.isArray(data.revisiones)) throw new TerritoryError('No se pudo verificar la ficha.');
      const last = data.revisiones.at(-1);
      return { id: data.id, meliponarioId: data.meliponario_id, folio: data.id.slice(0, 8), nombre: data.nombre,
        estado: data.estado, localidadId: data.localidad_id, localidad: data.localidad, municipio: data.municipio,
        descripcion: data.descripcion, referencia: data.referencia, vendeMiel: data.vende_miel, recibeVisitas: data.recibe_visitas,
        coordenadas: data.coordenadas, metodoCaptura: data.metodo_captura, abejas: data.abejas, fotos: [],
        numeroIntento: data.numero_intento, enviadoEn: data.fecha_envio, trabajadorRevisorId: data.trabajador_revisor_id,
        comentarioRevision: last?.comentario || '', revisadoEn: last?.fecha || null, revisiones: data.revisiones };
    },
    async take(userId, id) {
      if (!validId(id)) throw new TerritoryError('Selecciona una solicitud válida.');
      await authorize(userId, [4]);
      return rpc('tomar_solicitud_territorial', { p_solicitud_id: id }, true);
    },
    async resolve(userId, id, decision, comentario) {
      if (!validId(id) || !['aprobar', 'rechazar', 'solicitar_correccion'].includes(decision) || textLength(comentario) < 10 || textLength(comentario) > 2000) throw new TerritoryError('Indica una decisión válida y un comentario de 10 a 2000 caracteres.');
      await authorize(userId, [4]);
      return rpc('resolver_solicitud_territorial', { p_solicitud_id: id, p_decision: decision, p_comentario: comentario.trim() }, true);
    },
    async send(userId, meliponarioId, estado) {
      if (!validId(meliponarioId) || !['borrador', 'correccion'].includes(estado)) throw new TerritoryError('Solo se envían borradores guardados o registros devueltos a corrección.');
      await authorize(userId, [5]);
      return rpc(estado === 'correccion' ? 'reenviar_registro_corregido' : 'enviar_registro_basico', { p_meliponario_id: meliponarioId }, true);
    },
    async ownerReviews(userId, solicitudId) {
      if (!validId(solicitudId)) return [];
      await authorize(userId, [5]);
      const result = await client.from('revisiones_solicitud').select('id,decision,comentario,fecha_revision').eq('solicitud_id', solicitudId).order('fecha_revision').order('id');
      if (result.error) throw failure(result.error);
      if (!Array.isArray(result.data)) throw new TerritoryError('No pudimos recuperar los comentarios de revisión.');
      return result.data;
    },
  };
}
