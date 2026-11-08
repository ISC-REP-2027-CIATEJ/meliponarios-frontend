// Contrato exportado de Supabase: no crea tablas, permisos ni buckets.
export const BUCKET_FOTOS = 'kaabmap-meliponarios';
export const MAX_FOTOS = 5;
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;
export const TIPOS_FOTO = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const extensiones = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class ErrorFotos extends Error {
  constructor(message, { requiereComprobar = false, fase = '', reserva = null } = {}) {
    super(message); this.name = 'ErrorFotos';
    this.requiereComprobar = requiereComprobar; this.fase = fase; this.reserva = reserva;
  }
}
const falloLectura = () => new ErrorFotos('No pudimos consultar tus fotografías. Actualiza la galería e inténtalo de nuevo.');
const datosInvalidos = () => new ErrorFotos('La respuesta de fotografías no coincide con el contrato esperado. Actualiza y consulta al backend si continúa.');

export function normalizarFotosPropias(data, id) {
  if (!Array.isArray(data) || data.length > MAX_FOTOS || !UUID.test(id ?? '')) throw datosInvalidos();
  const ids = new Set(), posiciones = new Set(), rutas = new Set();
  return data.map(row => {
    const partes = typeof row?.ruta_storage === 'string' ? row.ruta_storage.split('/') : [];
    if (!UUID.test(row?.id ?? '') || !Number.isInteger(row.posicion) || row.posicion < 1 || row.posicion > MAX_FOTOS ||
        partes.length !== 2 || partes[0].toLowerCase() !== id.toLowerCase() ||
        !/^[a-z0-9_-][a-z0-9_. -]*\.(jpe?g|png|webp)$/i.test(partes[1]) || partes[1].includes('..') ||
        ids.has(row.id.toLowerCase()) || posiciones.has(row.posicion) || rutas.has(row.ruta_storage)) throw datosInvalidos();
    ids.add(row.id.toLowerCase()); posiciones.add(row.posicion); rutas.add(row.ruta_storage);
    return { id: row.id, ruta: row.ruta_storage, posicion: row.posicion, descripcion: typeof row.descripcion === 'string' ? row.descripcion : '' };
  }).sort((a, b) => a.posicion - b.posicion);
}

export function validarFotoPreparada(value) {
  if (value?.metadatosEliminados !== true || !(value.blob instanceof Blob) || !TIPOS_FOTO.includes(value.blob.type) ||
      !Number.isSafeInteger(value.blob.size) || value.blob.size < 1 || value.blob.size > MAX_BYTES_FOTO) {
    throw new ErrorFotos('Prepara una fotografía JPEG, PNG o WebP de hasta 5 MiB antes de subirla.');
  }
  const descripcion = typeof value.descripcion === 'string' ? value.descripcion.trim() : '';
  if (Array.from(descripcion).length > 250) throw new ErrorFotos('La descripción de una fotografía admite hasta 250 caracteres.');
  return { blob: value.blob, descripcion: descripcion || null };
}

function urlSegura(value, origen) {
  try {
    const url = new URL(value), base = new URL(origen);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.origin === base.origin && (url.protocol === 'https:' || local && url.protocol === 'http:') &&
      url.pathname.startsWith('/storage/v1/object/sign/' + BUCKET_FOTOS + '/') ? url.href : null;
  } catch { return null; }
}
function sinObjeto(error) {
  const status = Number(error?.statusCode || error?.status);
  return (error?.code || error?.error) === 'NoSuchKey' || [400, 404].includes(status) && /^(?:object not found|the specified key does not exist)\.?$/i.test(error?.message || '');
}

export function crearApiFotos(client, { origenAlmacenamiento = '' } = {}) {
  async function autorizar(userId, id) {
    if (!UUID.test(userId ?? '') || !UUID.test(id ?? '') || !client) throw new ErrorFotos('Abre un meliponario real guardado con su cuenta Cliente propietaria.');
    let sesion, perfil, propio;
    try {
      sesion = await client.auth.getUser();
      if (sesion.error || sesion.data?.user?.id !== userId) throw new ErrorFotos('La sesión cambió. Vuelve a entrar con la cuenta que abrió este registro.');
      perfil = await client.from('perfiles').select('id,rol_id,activo').eq('id', userId).maybeSingle();
      if (perfil.error) throw falloLectura();
      if (perfil.data?.id !== userId || perfil.data?.activo !== true || Number(perfil.data.rol_id) !== 5) throw new ErrorFotos('Las fotografías requieren una cuenta Cliente con perfil activo.');
      propio = await client.from('meliponarios').select('id,responsable_principal_id,visibilidad').eq('id', id).eq('responsable_principal_id', userId).maybeSingle();
    } catch (error) { throw error instanceof ErrorFotos ? error : falloLectura(); }
    if (propio.error) throw falloLectura();
    if (propio.data?.id !== id || propio.data?.responsable_principal_id !== userId) throw new ErrorFotos('No encontramos ese meliponario entre los registros de tu cuenta.');
    return propio.data;
  }
  async function metadatos(id) {
    let result;
    try { result = await client.rpc('listar_imagenes_meliponario', { p_meliponario_id: id }); }
    catch { throw falloLectura(); }
    if (result?.error) throw falloLectura();
    return normalizarFotosPropias(result?.data, id);
  }
  const storage = () => client.storage.from(BUCKET_FOTOS);
  async function existe(ruta) {
    let result;
    try { result = await storage().info(ruta); } catch { throw falloLectura(); }
    if (result?.error) {
      if (sinObjeto(result.error)) return false;
      throw falloLectura();
    }
    if (!result?.data || typeof result.data !== 'object') throw falloLectura();
    return true;
  }
  return {
    async listar(userId, id) {
      const propio = await autorizar(userId, id);
      const rows = await metadatos(id);
      if (!rows.length) return { items: [], visibilidad: propio.visibilidad, aviso: '' };
      let firmas;
      try { firmas = await storage().createSignedUrls(rows.map(row => row.ruta), 60); } catch { firmas = null; }
      let problemas = false;
      const items = await Promise.all(rows.map(async row => {
        const firma = !firmas?.error && Array.isArray(firmas?.data) ? firmas.data.find(item => item.path === row.ruta && !item.error) : null;
        const url = firma && urlSegura(firma.signedUrl, origenAlmacenamiento);
        if (url) return { ...row, url, estadoArchivo: 'disponible' };
        try {
          const presente = await existe(row.ruta);
          if (!presente) return { ...row, url: null, estadoArchivo: 'sin_archivo' };
        } catch { /* Un fallo de lectura no prueba que el archivo no exista. */ }
        problemas = true;
        return { ...row, url: null, estadoArchivo: 'sin_comprobar' };
      }));
      return { items, visibilidad: propio.visibilidad, aviso: problemas ? 'Algunas imágenes no pudieron comprobarse. Actualiza la galería para solicitar nuevos enlaces.' : '' };
    },

    async subir(userId, id, value) {
      const { blob, descripcion } = validarFotoPreparada(value);
      await autorizar(userId, id);
      if ((await metadatos(id)).length >= MAX_FOTOS) throw new ErrorFotos('Ya se ocuparon los cinco espacios. Actualiza la galería antes de añadir otra foto.');
      let result;
      try {
        result = await client.rpc('reservar_imagen_meliponario', { p_meliponario_id: id, p_tipo_mime: blob.type, p_descripcion: descripcion });
      } catch {
        throw new ErrorFotos('No pudimos confirmar la reserva. Actualiza y comprueba la galería antes de volver a subir esta imagen.', { requiereComprobar: true, fase: 'reserva' });
      }
      if (result?.error) {
        const error = result.error;
        if (error.code === '23514') throw new ErrorFotos('El servidor indica que ya hay cinco imágenes. Actualiza la galería.');
        if (error.code === '42501') throw new ErrorFotos('Tu cuenta no tiene permiso para añadir fotografías a este meliponario.');
        if (error.code === '22023') throw new ErrorFotos('El servidor rechazó el formato o la descripción de la fotografía.');
        if (['PGRST202', '42883'].includes(error.code)) throw new ErrorFotos('El backend debe comprobar que la función de reserva esté disponible.');
        throw new ErrorFotos('No pudimos confirmar la reserva. Actualiza y comprueba antes de repetir.', { requiereComprobar: true, fase: 'reserva' });
      }
      let reserva;
      try {
        const row = result?.data;
        reserva = normalizarFotosPropias([row], id)[0];
        if (reserva.ruta !== id + '/' + reserva.id + '.' + extensiones[blob.type]) throw datosInvalidos();
      } catch {
        throw new ErrorFotos('La reserva no devolvió un identificador y ruta verificables. Actualiza la galería antes de repetir.', { requiereComprobar: true, fase: 'reserva' });
      }
      try {
        await autorizar(userId, id);
        const uploaded = await storage().upload(reserva.ruta, blob, { contentType: blob.type, cacheControl: '60', upsert: false });
        if (uploaded?.error || uploaded?.data?.path !== reserva.ruta) throw Error('Subida sin confirmar');
      } catch {
        // Conservar la reserva: el archivo podría haberse guardado aunque se perdiera la respuesta.
        throw new ErrorFotos('Se reservó un espacio, pero no se confirmó la subida. Actualiza y comprueba: si aparece sin archivo, podrás eliminar esa reserva.', { requiereComprobar: true, fase: 'archivo', reserva });
      }
      return { ...reserva, subidaConfirmada: true };
    },

    async eliminar(userId, id, imagenId) {
      if (!UUID.test(imagenId ?? '')) throw new ErrorFotos('Selecciona una fotografía válida de esta galería.');
      await autorizar(userId, id);
      const row = (await metadatos(id)).find(item => item.id === imagenId);
      if (!row) throw new ErrorFotos('La fotografía ya no aparece en este registro. Actualiza la galería.');
      try {
        if (await existe(row.ruta)) {
          const removed = await storage().remove([row.ruta]);
          if (removed?.error) throw Error('Borrado sin confirmar');
          // Una respuesta vacía de remove no demuestra que RLS haya permitido borrar.
          if (await existe(row.ruta)) throw Error('El archivo sigue presente');
        }
      } catch {
        throw new ErrorFotos('No pudimos confirmar la eliminación del archivo. Conservamos su registro para no dejarlo sin acceso. Actualiza y comprueba antes de repetir.', { requiereComprobar: true, fase: 'archivo', reserva: row });
      }
      // La política DELETE de Storage necesita que el registro todavía exista.
      // Por eso se borra el objeto y se verifica su ausencia ANTES de llamar a esta RPC.
      try {
        await autorizar(userId, id);
        const deleted = await client.rpc('eliminar_imagen_meliponario', { p_imagen_id: row.id });
        if (deleted?.error || deleted?.data !== null) throw Error('Registro sin confirmar');
      } catch {
        throw new ErrorFotos('El archivo ya no está disponible, pero falta comprobar la eliminación de su registro. Actualiza la galería; si sigue la reserva, podrás eliminarla.', { requiereComprobar: true, fase: 'registro', reserva: row });
      }
      return { id: row.id, eliminacionConfirmada: true };
    },
  };
}
