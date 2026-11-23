const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = value => typeof value === 'string' ? value.trim() : '';
const longitud = value => Array.from(value).length;
const COLUMNAS = 'id,responsable_principal_id,visibilidad,autorizacion_ubicacion_exacta,autorizacion_contacto_publico,nombre_contacto_publico,telefono_contacto_publico,fecha_autorizacion_publicacion';

export class ErrorPublicacion extends Error {
  constructor(message, { campos = {}, resultadoIncierto = false } = {}) {
    super(message);
    this.name = 'ErrorPublicacion';
    this.campos = campos;
    this.resultadoIncierto = resultadoIncierto;
  }
}

export function formularioPublicacion(value) {
  return {
    autorizarUbicacion: value?.autorizarUbicacion === true,
    autorizarContacto: value?.autorizarContacto === true,
    nombreContacto: typeof value?.nombreContacto === 'string' ? value.nombreContacto : '',
    telefonoContacto: typeof value?.telefonoContacto === 'string' ? value.telefonoContacto : '',
  };
}

export function datosPublicacion(id, form) {
  const campos = {};
  if (!UUID.test(id ?? '')) throw new ErrorPublicacion('Guarda primero el meliponario real para configurar su publicación.');
  if (typeof form?.autorizarUbicacion !== 'boolean' || typeof form?.autorizarContacto !== 'boolean') {
    campos.autorizaciones = 'Revisa las dos autorizaciones de publicación.';
  }
  const nombre = texto(form?.nombreContacto);
  const telefono = texto(form?.telefonoContacto);
  if (form?.autorizarContacto) {
    if (longitud(nombre) < 3 || longitud(nombre) > 180) campos.nombreContacto = 'El nombre de contacto debe tener entre 3 y 180 caracteres.';
    if (longitud(telefono) < 7 || longitud(telefono) > 30) campos.telefonoContacto = 'El teléfono de contacto debe tener entre 7 y 30 caracteres.';
  }
  if (Object.keys(campos).length) throw new ErrorPublicacion('Revisa los datos de publicación.', { campos });
  return {
    p_meliponario_id: id,
    p_autorizar_ubicacion: form.autorizarUbicacion,
    p_autorizar_contacto: form.autorizarContacto,
    p_nombre_contacto: form.autorizarContacto ? nombre : null,
    p_telefono_contacto: form.autorizarContacto ? telefono : null,
  };
}

export function motivosPublicacion(state) {
  if (!state || state.publicada === true) return [];
  const motivos = [];
  if (state.estadoSolicitud !== 'aprobada') motivos.push('La última solicitud todavía no está aprobada.');
  if (!state.tieneUbicacion) motivos.push('Falta guardar la ubicación del meliponario.');
  if (!state.autorizarUbicacion) motivos.push('Falta autorizar la publicación de la ubicación exacta.');
  if (!state.autorizarContacto) motivos.push('Falta autorizar la publicación del nombre y teléfono.');
  if (!texto(state.nombreContacto) || !texto(state.telefonoContacto)) motivos.push('Faltan el nombre o el teléfono de contacto público.');
  if (!state.fechaAutorizacion) motivos.push('Falta guardar las autorizaciones de publicación.');
  if (state.visibilidad !== 'publico') motivos.push('La visibilidad guardada en el servidor sigue siendo privada.');
  if (!motivos.length && state.publicada === false) motivos.push('La consulta pública todavía no devuelve esta ficha. Actualiza y, si continúa así, pide al backend revisar sus reglas de publicación.');
  return motivos;
}

function errorLectura(error) {
  return new ErrorPublicacion(error?.code === '42501'
    ? 'Tu cuenta no tiene permiso para consultar la publicación de este registro.'
    : 'No pudimos comprobar los datos de publicación. Conserva tus cambios e inténtalo de nuevo.');
}

function errorGuardado(error, incierto = false) {
  if (incierto || !error?.code) return new ErrorPublicacion('No pudimos confirmar el guardado. No lo repetiremos automáticamente. Pulsa Actualizar y comprobar antes de volver a guardar.', { resultadoIncierto: true });
  if (error.code === '42501') return new ErrorPublicacion('La cuenta debe estar activa y ser propietaria del meliponario para cambiar sus autorizaciones.');
  if (['22023', '23514'].includes(error.code)) return new ErrorPublicacion('El servidor rechazó los datos de publicación. Revisa las autorizaciones, el nombre y el teléfono.');
  if (['PGRST202', '42883'].includes(error.code)) return new ErrorPublicacion('La función de publicación no está disponible en este proyecto. El backend debe comprobar su instalación.');
  return new ErrorPublicacion('El servidor rechazó el guardado de publicación. Actualiza para comprobar el estado.');
}

export function crearApiPublicacion(client, { consultarPublica } = {}) {
  async function autorizar(userId) {
    if (!UUID.test(userId ?? '') || !client) throw new ErrorPublicacion('Inicia sesión con tu cuenta Cliente.');
    let user;
    try { user = await client.auth.getUser(); } catch { throw errorLectura(); }
    if (user.error || user.data?.user?.id !== userId) throw new ErrorPublicacion('La sesión cambió. Vuelve a entrar con la cuenta que abrió este registro.');
    let perfil;
    try { perfil = await client.from('perfiles').select('id,rol_id,activo').eq('id', userId).maybeSingle(); }
    catch { throw errorLectura(); }
    if (perfil.error) throw errorLectura(perfil.error);
    if (perfil.data?.id !== userId || perfil.data?.activo !== true || Number(perfil.data.rol_id) !== 5) {
      throw new ErrorPublicacion('Este apartado requiere una cuenta Cliente con perfil activo.');
    }
  }

  async function propio(userId, id) {
    if (!UUID.test(id ?? '')) throw new ErrorPublicacion('Selecciona un meliponario real guardado.');
    let result;
    try { result = await client.from('meliponarios').select(COLUMNAS).eq('id', id).eq('responsable_principal_id', userId).maybeSingle(); }
    catch { throw errorLectura(); }
    if (result.error) throw errorLectura(result.error);
    const row = result.data;
    if (!row || row.id !== id || row.responsable_principal_id !== userId) throw new ErrorPublicacion('No encontramos este meliponario entre los registros de tu cuenta.');
    if (!['privado', 'publico'].includes(row.visibilidad) || ![true, false, null].includes(row.autorizacion_ubicacion_exacta) || ![true, false, null].includes(row.autorizacion_contacto_publico)) {
      throw errorLectura();
    }
    return row;
  }

  async function recuperar(userId, id, row) {
    let solicitud, ubicacion;
    try {
      [solicitud, ubicacion] = await Promise.all([
        client.from('solicitudes_meliponario').select('id,estado,numero_intento').eq('meliponario_id', id).order('numero_intento', { ascending: false }).limit(1).maybeSingle(),
        client.from('ubicaciones_meliponarios').select('meliponario_id').eq('meliponario_id', id).maybeSingle(),
      ]);
    } catch { throw errorLectura(); }
    if (solicitud.error || ubicacion.error) throw errorLectura(solicitud.error || ubicacion.error);
    let publicada = null;
    try {
      if (typeof consultarPublica !== 'function') throw Error('Sin comprobación');
      const ficha = await consultarPublica(id);
      if (ficha && ficha.id !== id) throw Error('Identificador distinto');
      publicada = Boolean(ficha);
    } catch { /* La lectura privada sigue disponible para poder retirar permisos. */ }
    return {
      id, ...formularioPublicacion({
        autorizarUbicacion: row.autorizacion_ubicacion_exacta,
        autorizarContacto: row.autorizacion_contacto_publico,
        nombreContacto: row.nombre_contacto_publico,
        telefonoContacto: row.telefono_contacto_publico,
      }),
      visibilidad: row.visibilidad, fechaAutorizacion: row.fecha_autorizacion_publicacion ?? null,
      estadoSolicitud: solicitud.data?.estado ?? 'sin_solicitud',
      tieneUbicacion: ubicacion.data?.meliponario_id === id, publicada,
    };
  }

  return {
    async leer(userId, id) {
      await autorizar(userId);
      return recuperar(userId, id, await propio(userId, id));
    },
    async guardar(userId, id, form) {
      const args = datosPublicacion(id, form);
      await autorizar(userId);
      await propio(userId, id);
      let result;
      try { result = await client.rpc('configurar_publicacion_meliponario', args); }
      catch { throw errorGuardado(null, true); }
      if (result?.error) throw errorGuardado(result.error);
      if (!['publico', 'privado'].includes(result?.data)) throw errorGuardado(null, true);
      // El servidor confirmó la escritura. Un fallo posterior de lectura no convierte ese guardado en fallido.
      try {
        await autorizar(userId);
        const state = await recuperar(userId, id, await propio(userId, id));
        return { guardadoConfirmado: true, visibilidad: result.data, state };
      } catch {
        return { guardadoConfirmado: true, visibilidad: result.data, state: null };
      }
    },
  };
}
