// Contrato recibido el 27/10/2026. No modifica tablas, permisos ni datos públicos.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGINA = 500;
const texto = value => typeof value === 'string' ? value.trim() : '';
const longitud = value => Array.from(value).length;

export class ErrorRegistro extends Error {
  constructor(message, campos = {}, resultadoIncierto = false) {
    super(message);
    this.name = 'ErrorRegistro';
    this.campos = campos;
    this.resultadoIncierto = resultadoIncierto;
  }
}

function errorServidor(error, contexto, incierto = false) {
  const conocidos = new Map([
    ['Localidad fuera de cobertura territorial activa', 'La localidad no tiene una zona de atención activa de Yucatán. El backend debe confirmar su cobertura.'],
    ['La localidad no tiene una zona activa de atencion', 'La localidad no tiene una zona de atención activa de Yucatán. El backend debe confirmar su cobertura.'],
    ['Solo se permite editar borradores o correcciones', 'El servidor indica que este registro ya no está disponible para editar. Actualiza Mis meliponarios.'],
    ['Meliponario inexistente o ajeno', 'No encontramos ese registro entre los meliponarios de tu cuenta.'],
    ['Especie inexistente o inactiva', 'Un tipo de abeja dejó de estar disponible. Actualiza los catálogos antes de guardar.'],
  ]);
  if (error?.code === '42501') return new ErrorRegistro('Tu cuenta no tiene autorización para esta operación. Comprueba que sea Cliente y que el perfil esté activo.');
  if (conocidos.has(error?.message)) return new ErrorRegistro(conocidos.get(error.message));
  if (incierto) return new ErrorRegistro('La conexión se interrumpió y no pudimos confirmar el guardado. Conserva el formulario y revisa Mis meliponarios antes de intentar crear otro registro.', {}, true);
  return new ErrorRegistro(contexto);
}

function entero(value) {
  return (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100000;
}

export function validarFormularioRemoto(form, catalogo) {
  const errores = {};
  const nombre = texto(form?.nombre);
  if (longitud(nombre) < 3 || longitud(nombre) > 160) errores.nombre = 'Escribe un nombre de 3 a 160 caracteres.';
  if (!UUID.test(form?.municipioId ?? '') || !catalogo?.municipios?.some(item => item.id === form.municipioId)) errores.municipioId = 'Selecciona un municipio del catálogo real.';
  if (!UUID.test(form?.localidadId ?? '') || !catalogo?.localidades?.some(item => item.id === form.localidadId && item.municipioId === form.municipioId)) errores.localidadId = 'Selecciona una localidad del municipio elegido.';
  if (typeof form?.descripcion !== 'string' || longitud(form.descripcion) > 2000) errores.descripcion = 'La descripción admite hasta 2000 caracteres.';
  if (typeof form?.referencia !== 'string' || longitud(form.referencia) > 500) errores.referencia = 'La referencia admite hasta 500 caracteres.';
  if (typeof form?.vendeMiel !== 'boolean' || typeof form?.recibeVisitas !== 'boolean') errores.actividades = 'Revisa las actividades seleccionadas.';
  if (!Array.isArray(form?.abejas) || form.abejas.length > 50) errores.abejas = 'Puedes declarar de cero a 50 tipos de abejas en un borrador.';
  else {
    const ids = new Set();
    for (const bee of form.abejas) {
      if (!UUID.test(bee?.tipoId ?? '') || !catalogo?.abejas?.some(item => item.id === bee.tipoId)) errores.abejas = 'Selecciona tipos de abejas del catálogo real.';
      else if (ids.has(bee.tipoId)) errores.abejas = 'No puedes repetir un tipo de abeja.';
      else if (!entero(bee.cajas) || !entero(bee.jobones) || Number(bee.cajas) + Number(bee.jobones) < 1) errores.abejas = 'Cada tipo necesita al menos una caja o un jobón. Las cantidades deben ser enteras entre 0 y 100000.';
      ids.add(bee?.tipoId);
      if (errores.abejas) break;
    }
  }
  const point = form?.coordenadas;
  if (point !== null && point !== undefined) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) errores.coordenadas = 'Completa ambas coordenadas o quita el punto para guardar sin ubicación.';
    const metodo = form.metodoCaptura ?? 'mapa';
    const precision = form.precisionMetros ?? null;
    if (!['gps', 'mapa'].includes(metodo) || precision !== null && (!Number.isFinite(precision) || precision < 0 || precision > 100000) || metodo === 'mapa' && precision !== null) errores.coordenadas = 'Revisa el método y la precisión de la ubicación.';
  }
  return errores;
}

export function construirDatosRegistro(form, catalogo) {
  const campos = validarFormularioRemoto(form, catalogo);
  if (Object.keys(campos).length) throw new ErrorRegistro(Object.values(campos)[0], campos);
  return {
    localidad_id: form.localidadId,
    nombre: texto(form.nombre),
    descripcion: texto(form.descripcion) || null,
    referencia_ubicacion: texto(form.referencia) || null,
    ofrece_venta_miel: form.vendeMiel,
    ofrece_visitas: form.recibeVisitas,
    especies: form.abejas.map(bee => ({ especie_id: bee.tipoId, cantidad_cajas: Number(bee.cajas), cantidad_jobones: Number(bee.jobones) })),
    ubicacion: form.coordenadas ? {
      latitud: form.coordenadas[0], longitud: form.coordenadas[1],
      metodo_captura: form.metodoCaptura ?? 'mapa', precision_metros: form.precisionMetros ?? null,
    } : null,
  };
}

async function leerTodas(crearConsulta, contexto) {
  const filas = [];
  let offset = 0;
  // No asumimos que el servidor permita tantas filas como se solicitaron.
  for (let pagina = 0; pagina < 10000; pagina++) {
    let respuesta;
    try { respuesta = await crearConsulta().range(offset, offset + PAGINA - 1); }
    catch { throw new ErrorRegistro(contexto); }
    if (respuesta.error) throw errorServidor(respuesta.error, contexto);
    if (!Array.isArray(respuesta.data)) throw new ErrorRegistro(contexto);
    if (!respuesta.data.length) return filas;
    filas.push(...respuesta.data);
    offset += respuesta.data.length;
  }
  throw new ErrorRegistro('El catálogo es demasiado grande para recuperarlo en una sola operación. Consulta al backend.');
}

async function leerPorIds(client, tabla, columnas, campo, ids, orden = 'id') {
  const filas = [];
  for (let i = 0; i < ids.length; i += 50) {
    filas.push(...await leerTodas(() => client.from(tabla).select(columnas).in(campo, ids.slice(i, i + 50)).order(orden), 'No pudimos recuperar todos los datos de tus registros. Vuelve a cargar la lista.'));
  }
  return filas;
}

export function combinarRegistros({ meliponarios, solicitudes, localidades, abejas, puntos, ubicaciones, userId }) {
  const localidadPorId = new Map(localidades.map(item => [item.id, item]));
  const puntoPorId = new Map(puntos.map(item => [item.id, item]));
  const ubicacionPorId = new Map(ubicaciones.map(item => [item.meliponario_id, item]));
  const solicitudPorId = new Map();
  const abejasPorId = new Map();
  for (const solicitud of solicitudes) {
    const anterior = solicitudPorId.get(solicitud.meliponario_id);
    if (!anterior || solicitud.numero_intento > anterior.numero_intento) solicitudPorId.set(solicitud.meliponario_id, solicitud);
  }
  for (const bee of abejas) {
    const lista = abejasPorId.get(bee.meliponario_id) ?? [];
    lista.push({ tipoId: bee.especie_id, cajas: bee.cantidad_cajas, jobones: bee.cantidad_jobones });
    abejasPorId.set(bee.meliponario_id, lista);
  }
  return meliponarios.filter(item => item.responsable_principal_id === userId).map(item => {
    const solicitud = solicitudPorId.get(item.id);
    const localidad = localidadPorId.get(item.localidad_id);
    const punto = puntoPorId.get(item.id);
    const ubicacion = ubicacionPorId.get(item.id);
    return {
      id: item.id, ownerId: userId, fuente: 'supabase', nombre: item.nombre,
      municipioId: localidad?.municipio_id ?? '', localidadId: item.localidad_id,
      localidadNombre: localidad?.nombre ?? '', descripcion: item.descripcion ?? '',
      referencia: item.referencia_ubicacion ?? '', vendeMiel: item.ofrece_venta_miel,
      recibeVisitas: item.ofrece_visitas, estado: solicitud?.estado ?? 'sin_solicitud',
      solicitudId: solicitud?.id ?? null, estadoOperativo: item.estado_operativo,
      visibilidad: item.visibilidad, creadoEn: item.fecha_creacion,
      actualizadoEn: item.fecha_actualizacion, enviadoEn: solicitud?.fecha_envio ?? null,
      abejas: abejasPorId.get(item.id) ?? [], productos: [],
      coordenadas: punto && Number.isFinite(punto.latitud) && Number.isFinite(punto.longitud) ? [punto.latitud, punto.longitud] : null,
      metodoCaptura: ubicacion?.metodo_captura ?? 'mapa', precisionMetros: ubicacion?.precision_metros ?? null,
    };
  });
}

export function crearApiRegistroSupabase(client) {
  async function autorizar(userId) {
    if (!client || !UUID.test(userId ?? '')) throw new ErrorRegistro('Inicia sesión con tu cuenta Cliente para continuar.');
    let respuesta;
    try { respuesta = await client.auth.getUser(); } catch { throw new ErrorRegistro('No pudimos comprobar tu sesión. Conserva el formulario y vuelve a iniciar sesión.'); }
    if (respuesta.error || respuesta.data?.user?.id !== userId) throw new ErrorRegistro('La sesión cambió o terminó. Vuelve a iniciar sesión con la cuenta que abrió este formulario.');
    let perfil;
    try { perfil = await client.from('perfiles').select('id,rol_id,activo').eq('id', userId).maybeSingle(); }
    catch { throw new ErrorRegistro('No pudimos comprobar tu perfil. Conserva el formulario e inténtalo de nuevo.'); }
    if (perfil.error) throw errorServidor(perfil.error, 'No pudimos comprobar tu perfil. Inténtalo de nuevo.');
    if (!perfil.data?.activo || Number(perfil.data.rol_id) !== 5) throw new ErrorRegistro('Este formulario requiere una cuenta Cliente con perfil activo.');
  }
  return {
    async catalogos(userId) {
      await autorizar(userId);
      const [municipios, abejas] = await Promise.all([
        leerTodas(() => client.from('municipios').select('id,nombre').eq('activo', true).eq('clave_entidad', '31').order('nombre').order('id'), 'No pudimos cargar los municipios reales.'),
        leerTodas(() => client.from('especies').select('id,nombre_cientifico,nombre_comun').eq('activo', true).order('nombre_cientifico').order('id'), 'No pudimos cargar los tipos de abejas reales.'),
      ]);
      if (!municipios.length) throw new ErrorRegistro('Tu sesión no recibió municipios activos. El backend debe comprobar los datos y permisos de lectura para Cliente.');
      return { municipios, localidades: [], abejas: abejas.map(item => ({ id: item.id, nombre: item.nombre_cientifico, nombreComun: item.nombre_comun ?? '' })), modo: 'supabase' };
    },
    async localidades(userId, municipioId) {
      await autorizar(userId);
      if (!UUID.test(municipioId ?? '')) throw new ErrorRegistro('Selecciona un municipio válido.');
      const filas = await leerTodas(() => client.from('localidades').select('id,municipio_id,nombre').eq('activo', true).eq('municipio_id', municipioId).order('nombre').order('id'), 'No pudimos cargar todas las localidades del municipio.');
      return filas.map(item => ({ id: item.id, municipioId: item.municipio_id, nombre: item.nombre }));
    },
    async listar(userId) {
      await autorizar(userId);
      const meliponarios = await leerTodas(() => client.from('meliponarios').select('id,responsable_principal_id,localidad_id,nombre,descripcion,referencia_ubicacion,ofrece_venta_miel,ofrece_visitas,estado_operativo,visibilidad,fecha_creacion,fecha_actualizacion').eq('responsable_principal_id', userId).order('id'), 'No pudimos recuperar tus meliponarios desde Supabase.');
      if (!meliponarios.length) return [];
      const ids = meliponarios.map(item => item.id);
      const [solicitudes, localidades, abejas, puntos, ubicaciones] = await Promise.all([
        leerPorIds(client, 'solicitudes_meliponario', 'id,meliponario_id,numero_intento,estado,fecha_envio', 'meliponario_id', ids),
        leerPorIds(client, 'localidades', 'id,municipio_id,nombre', 'id', [...new Set(meliponarios.map(item => item.localidad_id))]),
        leerPorIds(client, 'meliponarios_especies_declaradas', 'id,meliponario_id,especie_id,cantidad_cajas,cantidad_jobones', 'meliponario_id', ids),
        leerTodas(() => client.rpc('mis_meliponarios_mapa_privado').order('id'), 'No pudimos recuperar las ubicaciones privadas de tus registros.'),
        leerPorIds(client, 'ubicaciones_meliponarios', 'meliponario_id,metodo_captura,precision_metros', 'meliponario_id', ids, 'meliponario_id'),
      ]);
      return combinarRegistros({ meliponarios, solicitudes, localidades, abejas, puntos, ubicaciones, userId });
    },
    async guardar(userId, form, id, catalogo) {
      const datos = construirDatosRegistro(form, catalogo);
      if (id !== null && !UUID.test(id ?? '')) throw new ErrorRegistro('Los borradores de demostración no se convierten automáticamente en registros reales.');
      await autorizar(userId);
      let respuesta;
      try { respuesta = await client.rpc('guardar_formulario_meliponario', { p_datos: datos, p_meliponario_id: id }); }
      catch (error) { throw errorServidor(error, 'No pudimos guardar tu borrador.', true); }
      if (respuesta.error) throw errorServidor(respuesta.error, 'El servidor rechazó el guardado. Revisa los datos y vuelve a cargar los catálogos.', !respuesta.error.code);
      if (!UUID.test(respuesta.data ?? '')) throw new ErrorRegistro('El servidor no devolvió un identificador válido. Revisa Mis meliponarios antes de intentar guardar otra vez.', {}, true);
      return respuesta.data;
    },
  };
}
