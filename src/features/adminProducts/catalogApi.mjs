import { isAdminUser } from '../adminUsers/adminUsersModel.mjs';
import { validId } from '../territory/territoryApi.mjs';

const extensiones = { 'image/jpeg': ['jpg','jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };

export function rutaObjeto(valor) {
  const ruta = String(valor ?? '').trim();
  if (!ruta || /[\\?#:]/.test(ruta) || Array.from(ruta).some(c => c.charCodeAt(0) < 32) || ruta.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Introduce la ruta del archivo dentro del bucket.');
  }
  return ruta;
}

async function tipoReal(blob) {
  const cabecera = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const coincide = (bytes, desde = 0) => bytes.every((byte, i) => cabecera[desde+i] === byte);
  if (coincide([255,216,255])) return 'image/jpeg';
  if (coincide([137,80,78,71,13,10,26,10])) return 'image/png';
  if (coincide([82,73,70,70]) && coincide([87,69,66,80], 8)) return 'image/webp';
  return null;
}

export async function prepararImagen(archivo, config, uuid, rutaNueva = '') {
  const posibles = extensiones[archivo?.type];
  const permitidos = config.tipos;
  if (!posibles || (permitidos?.length && ![archivo.type,'image/*','*/*'].some(tipo => permitidos.includes(tipo)))) {
    throw new Error('Elige una fotografía JPEG, PNG o WebP admitida por el almacén.');
  }
  if (config.maxBytes > 0 && archivo.size > config.maxBytes) throw new Error('La fotografía supera el tamaño permitido por el bucket.');
  if (await tipoReal(archivo) !== archivo.type) throw new Error('El contenido del archivo no corresponde al formato seleccionado.');
  const ext = posibles.find(e => !config.extensiones?.length || config.extensiones.includes(e));
  if (!ext) throw new Error('Esta extensión no está permitida por la regla de rutas.');
  if (!config.plantilla?.includes('{uuid}') || !config.plantilla.includes('{ext}')) {
    const manual = rutaObjeto(rutaNueva);
    const final = manual.split('.').pop().toLowerCase();
    if (!posibles.includes(final) || (config.extensiones?.length && !config.extensiones.includes(final))) {
      throw new Error('La extensión de la ruta debe coincidir con el tipo de la fotografía.');
    }
    return manual;
  }
  return rutaObjeto(config.plantilla.replaceAll('{uuid}', uuid()).replaceAll('{ext}', ext));
}

export function crearCatalogo(client, config, uuid = () => crypto.randomUUID()) {
  function storage() {
    if (!config.bucket) throw new Error('Primero configura el bucket del catálogo con el paso 2 del Léeme.');
    return client.storage.from(config.bucket);
  }

  async function admin(userId) {
    const { data, error } = await client.auth.getUser();
    if (error || !validId(userId) || data?.user?.id !== userId) throw new Error('Tu sesión cambió. Vuelve a iniciar sesión.');
    const perfil = await client.from('perfiles').select('id,rol_id,activo').eq('id',userId).maybeSingle();
    if (perfil.error || !perfil.data?.activo || !isAdminUser({id: perfil.data.id, roleId: perfil.data.rol_id})) {
      throw new Error('Se requiere una cuenta activa de administrador general.');
    }
  }

  function filas() { return client.rpc('admin_listar_productos', {}); }

  async function vigente(producto) {
    const { data, error } = await filas().eq('id', producto.id).maybeSingle();
    if (error) throw error;
    if (!data || data.fecha_actualizacion !== producto.fecha_actualizacion || data.activo !== producto.activo ||
        data.nombre !== producto.nombre || data.descripcion !== producto.descripcion || data.imagen_storage !== producto.imagen_storage) {
      throw new Error('Este producto cambió. Cierra el formulario y actualiza el catálogo.');
    }
  }

  async function foto(ruta) {
    const { data, error } = await storage().download(rutaObjeto(ruta));
    if (error || !data?.size) throw new Error('No se pudo leer la imagen con tu cuenta.');
    return data;
  }

  return {
    foto,
    async listar(userId) {
      await admin(userId);
      const productos = [];
      for (;;) {
        let consulta = filas().order('id').limit(100);
        if (productos.length) consulta = consulta.gt('id', productos.at(-1).id);
        const { data, error } = await consulta;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('El servidor no devolvió la lista de productos.');
        if (!data.length) return productos;
        if (!data.every(p => validId(p.id) && typeof p.nombre === 'string' && typeof p.activo === 'boolean') ||
            (productos.length && data[0].id <= productos.at(-1).id)) throw new Error('No se pudo verificar la lista del catálogo.');
        productos.push(...data);
      }
    },
    async guardar(userId, producto, { nombre, descripcion, archivo, rutaExistente, rutaNueva }) {
      const nombreFinal = nombre.trim();
      if (!nombreFinal) throw new Error('Escribe el nombre del producto.');
      await admin(userId);
      if (producto) await vigente(producto);
      let ruta = producto?.imagen_storage;
      let subida = false;
      if (archivo) {
        const bucket = storage();
        ruta = await prepararImagen(archivo, config, uuid, rutaNueva);
        let carga;
        try { carga = await bucket.upload(ruta, archivo, { upsert: false, contentType: archivo.type }); }
        catch { throw new Error('Carga sin confirmar. Comprueba la ruta en Storage antes de repetir: ' + ruta); }
        const { error } = carga;
        if (error) throw new Error('No se confirmó la carga de la fotografía. Revisa el almacén y la ruta. ' + error.message);
        subida = true;
      } else if (rutaExistente) {
        ruta = rutaObjeto(rutaExistente);
        if (!await tipoReal(await foto(ruta))) throw new Error('El archivo guardado debe ser una fotografía JPEG, PNG o WebP.');
      }
      if (!ruta) throw new Error('Selecciona la fotografía del producto.');
      const valores = { p_nombre: nombreFinal, p_descripcion: descripcion.trim() || null, p_imagen_storage: ruta };
      const rpc = producto ? 'admin_actualizar_producto' : 'admin_crear_producto';
      if (producto) valores.p_producto_id = producto.id;
      let respuesta;
      try { respuesta = await client.rpc(rpc, valores); }
      catch { /* La escritura pudo completarse aunque se perdiera la respuesta. */ }
      if (respuesta && !respuesta.error && (producto || validId(respuesta.data))) return;
      const error = respuesta?.error;
      if (error?.code && /^(22|23|42501$|P0001$|PGRST20[23]$)/.test(error.code)) {
        if (subida) {
          const retirada = await storage().remove([ruta]).catch(() => ({ error: true }));
          if (retirada.error || !retirada.data?.length) throw new Error('El producto no se guardó y quedó una imagen pendiente de revisar en Storage: ' + ruta + '. ' + error.message);
        }
        throw new Error(error.message);
      }
      const incierto = new Error('No se pudo confirmar el guardado. Actualiza y busca el producto antes de repetir. La imagen se conservó en ' + ruta + '.');
      incierto.incierto = true;
      throw incierto;
    },
    async cambiarEstado(userId, producto) {
      await admin(userId);
      await vigente(producto);
      const { error } = await client.rpc('admin_cambiar_estado_producto', {
        p_producto_id: producto.id, p_activo: !producto.activo,
      });
      if (error) throw error;
    },
  };
}
