import { HISTORIAL_POR_PAGINA, unirCobertura } from './territoryCoverageModel.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOTE_COBERTURA = 250;
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
  async function rpc(name, args, write = false, validar = validId) {
    let result;
    try { result = await client.rpc(name, args); } catch (error) { throw failure(error, write); }
    if (result.error) throw failure(result.error, write);
    if (result.data === null || result.data === undefined) throw new TerritoryError('El servidor no devolvió un resultado verificable.', write ? 'RESULT_UNKNOWN' : 'INVALID_RESPONSE', write);
    if (write && !validar(result.data)) throw new TerritoryError('El resultado no coincide con el cambio esperado. Actualiza y revisa el estado antes de reintentar.', 'RESULT_UNKNOWN', true);
    return result.data;
  }

  async function readCoverageRows(table, columns, key, municipioId) {
    const rows = [];
    let cursor = null;
    for (;;) {
      let query = client.from(table).select(columns).order(key).limit(LOTE_COBERTURA);
      if (municipioId) query = query.eq('municipio_id', municipioId);
      if (cursor) query = query.gt(key, cursor);
      const { data, error } = await query;
      if (error) throw failure(error);
      if (!Array.isArray(data)) throw new TerritoryError('La consulta de cobertura quedó incompleta.', 'INVALID_RESPONSE');
      if (!data.length) return rows;
      const next = data.at(-1)[key];
      if (!validId(next) || (cursor && next <= cursor)) {
        throw new TerritoryError('No se pudo continuar la lectura de cobertura.', 'INVALID_RESPONSE');
      }
      rows.push(...data);
      cursor = next;
    }
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
    async coverage(userId) {
      await authorize(userId, [1]);
      const [municipios, zonas, localidades, relaciones] = await Promise.all([
        readCoverageRows('municipios', 'id,nombre,activo', 'id'),
        readCoverageRows('zonas', 'id,codigo,nombre,activo', 'id'),
        readCoverageRows('localidades', 'id,municipio_id,clave_localidad,nombre,activo', 'id'),
        readCoverageRows('zonas_localidades', 'localidad_id,zona_id', 'localidad_id'),
      ]);
      return unirCobertura({ municipios, zonas, localidades, relaciones });
    },
    async coverageMunicipalCatalog(userId) {
      await authorize(userId, [1]);
      try {
        const { version, municipios, zonas } = await rpc('km_admin_catalogo_cobertura_municipal', {});
        if (version !== 1 || !Array.isArray(municipios) || !Array.isArray(zonas)) {
          throw new TerritoryError('No se pudo verificar el catálogo municipal.', 'INVALID_RESPONSE');
        }
        if (!municipios.every(row => Number.isSafeInteger(row.localidades) && Number.isSafeInteger(row.con_zona)
          && row.con_zona >= 0 && row.con_zona <= row.localidades)) {
          throw new TerritoryError('Los totales municipales no se pudieron verificar.', 'INVALID_RESPONSE');
        }
        return { ...unirCobertura({ municipios, zonas, localidades: [], relaciones: [] }), gestionMunicipal: true };
      } catch (error) {
        if (error.code !== 'CONTRACT_MISSING') throw error;
      }
      const [municipios, zonas] = await Promise.all([
        readCoverageRows('municipios', 'id,nombre,activo', 'id'),
        readCoverageRows('zonas', 'id,codigo,nombre,activo', 'id'),
      ]);
      return { ...unirCobertura({ municipios, zonas, localidades: [], relaciones: [] }), gestionMunicipal: false };
    },
    async coverageByMunicipality(userId, municipioId) {
      if (!validId(municipioId)) throw new TerritoryError('Selecciona un municipio válido.');
      await authorize(userId, [1]);
      const filas = await readCoverageRows('localidades',
        'id,municipio_id,clave_localidad,nombre,activo,cobertura:zonas_localidades!zonas_localidades_localidad_id_fkey(zona_id)',
        'id', municipioId);
      const localidades = [];
      const relaciones = [];
      for (const { cobertura, ...localidad } of filas) {
        const zonas = Array.isArray(cobertura) ? cobertura : cobertura === null ? [] : [cobertura];
        if (localidad.municipio_id !== municipioId || !validId(localidad.id) || zonas.length > 1
          || zonas.some(row => !validId(row?.zona_id))) {
          throw new TerritoryError('La cobertura de una localidad no se pudo verificar.', 'INVALID_RESPONSE');
        }
        localidades.push(localidad);
        if (zonas.length) relaciones.push({ localidad_id: localidad.id, zona_id: zonas[0].zona_id });
      }
      return { localidades, relaciones };
    },
    async createCoverageZone(userId, { codigo, nombre }) {
      if (textLength(codigo) < 1 || textLength(nombre) < 1) {
        throw new TerritoryError('Escribe el código y el nombre de la zona.');
      }
      await authorize(userId, [1]);
      return rpc('km_admin_crear_zona_cobertura', { p_codigo: codigo.trim(), p_nombre: nombre.trim() }, true);
    },
    async assignMunicipality(userId, { municipioId, zonaId, motivo, estadoEsperado, trasladar = false }) {
      if (!validId(municipioId) || !validId(zonaId) || typeof trasladar !== 'boolean'
        || textLength(motivo) < 10 || textLength(motivo) > 1000
        || !estadoEsperado || typeof estadoEsperado !== 'object' || Array.isArray(estadoEsperado)) {
        throw new TerritoryError('Revisa el municipio, la zona y el motivo de 10 a 1000 caracteres.');
      }
      const estados = Object.entries(estadoEsperado);
      if (!estados.length || estados.some(([id, zona]) => !validId(id) || (zona !== null && !validId(zona)))) {
        throw new TerritoryError('Actualiza la vista previa del municipio antes de confirmar.');
      }
      const asignadas = estados.filter(([, zona]) => zona === null).length;
      const sinCambios = estados.filter(([, zona]) => zona === zonaId).length;
      const otras = estados.length - asignadas - sinCambios;
      if (otras && !trasladar) {
        throw new TerritoryError('Confirma si también quieres trasladar las localidades de otras zonas.');
      }
      if (!asignadas && !otras) throw new TerritoryError('Las localidades de este municipio ya están en esa zona.');
      await authorize(userId, [1]);
      return rpc('km_admin_asignar_municipio_zona', {
        p_municipio_id: municipioId, p_zona_id: zonaId, p_motivo: motivo.trim(),
        p_estado_esperado: estadoEsperado, p_trasladar: trasladar,
      }, true, data => data.total === estados.length && data.asignadas === asignadas
        && data.trasladadas === otras && data.sin_cambios === sinCambios);
    },
    async coverageHistory(userId, localidadId, pagina = 1) {
      if (!validId(localidadId) || !Number.isSafeInteger(pagina) || pagina < 1) {
        throw new TerritoryError('Selecciona una localidad y una página válidas.');
      }
      await authorize(userId, [1]);
      const inicio = (pagina - 1) * HISTORIAL_POR_PAGINA;
      const { data, count, error } = await client.from('historial_zonas_localidades')
        .select('id,zona_anterior_id,zona_nueva_id,tipo_cambio,fecha_cambio,motivo', { count: 'exact' })
        .eq('localidad_id', localidadId)
        .order('fecha_cambio', { ascending: false }).order('id', { ascending: false })
        .range(inicio, inicio + HISTORIAL_POR_PAGINA - 1);
      if (error) throw failure(error);
      if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < data.length) {
        throw new TerritoryError('No se pudo comprobar la página del historial.', 'INVALID_RESPONSE');
      }
      return { registros: data, total: count };
    },
    async changeCoverage(userId, { localidadId, accion, zonaActualId, zonaId, motivo }) {
      const asignar = accion === 'asignar' && zonaActualId === null && validId(zonaId);
      const trasladar = accion === 'trasladar' && validId(zonaActualId) && validId(zonaId) && zonaActualId !== zonaId;
      const retirar = accion === 'retirar' && validId(zonaActualId) && zonaId === null;
      if (!validId(localidadId) || !(asignar || trasladar || retirar) || textLength(motivo) < 10 || textLength(motivo) > 1000) {
        throw new TerritoryError('Revisa la localidad, el cambio y el motivo de 10 a 1000 caracteres.');
      }
      await authorize(userId, [1]);
      const { data, error } = await client.from('zonas_localidades').select('zona_id')
        .eq('localidad_id', localidadId).maybeSingle();
      if (error) throw failure(error);
      if ((data?.zona_id ?? null) !== zonaActualId) {
        throw new TerritoryError('La zona de esta localidad cambió. Revísala antes de confirmar otra operación.', 'COVERAGE_CHANGED');
      }
      const confirmada = await rpc('admin_gestionar_zona_localidad', {
        p_localidad_id: localidadId, p_accion: accion, p_zona_id: zonaId, p_motivo: motivo.trim(),
      }, true);
      if (confirmada !== (retirar ? zonaActualId : zonaId)) {
        throw new TerritoryError('La respuesta no coincide con el cambio esperado. Revisa la zona y el historial antes de volver a intentarlo.', 'RESULT_UNKNOWN', true);
      }
      return confirmada;
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
