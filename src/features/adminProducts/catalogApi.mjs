import { isAdminUser } from '../adminUsers/adminUsersModel.mjs';
import { validId } from '../territory/territoryApi.mjs';

const extensiones = { 'image/jpeg': ['jpg','jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };

export function rutaObjeto(valor) {
  const ruta = String(valor ?? '').trim();
  if (!ruta || /[\\?#:]/.test(ruta) || Array.from(ruta).some(c => c.charCodeAt(0) < 32) || ruta.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('La referencia guardada de la fotografía es inválida.');
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

export async function prepararImagen(archivo, config, uuid) {
  const posibles = extensiones[archivo?.type];
  const permitidos = config.tipos;
  if (!posibles || (permitidos?.length && ![archivo.type,'image/*','*/*'].some(tipo => permitidos.includes(tipo)))) {
    throw new Error('Elige una fotografía JPEG, PNG o WebP admitida por el almacén.');
  }
  if (config.maxBytes > 0 && archivo.size > config.maxBytes) throw new Error('La fotografía supera el tamaño permitido por el bucket.');
  if (await tipoReal(archivo) !== archivo.type) throw new Error('El contenido del archivo no corresponde al formato seleccionado.');
  const ext = posibles.find(e => !config.extensiones?.length || config.extensiones.includes(e));
  if (!ext) throw new Error('Esta extensión no está permitida por la regla de rutas.');
  const identificador = uuid();
  if (!validId(identificador)) throw new Error('No se pudo preparar la fotografía. Vuelve a seleccionarla.');
  return 'catalogo/' + identificador + '.' + ext;
}

export function crearCatalogo(client, config, uuid = () => crypto.randomUUID()) {
  function storage() {
    if (!config.bucket) throw new Error('El almacén de fotografías del catálogo aún no está configurado.');
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
    async guardar(userId, producto, { nombre, descripcion, archivo }) {
      const nombreFinal = nombre.trim();
      if (!nombreFinal) throw new Error('Escribe el nombre del producto.');
      await admin(userId);
      if (producto) await vigente(producto);
      let ruta = producto?.imagen_storage;
      let subida = false;
      if (archivo) {
        const bucket = storage();
        ruta = await prepararImagen(archivo, config, uuid);
        let carga;
        try { carga = await bucket.upload(ruta, archivo, { upsert: false, contentType: archivo.type }); }
        catch { throw new Error('No se confirmó la carga de la fotografía. Revisa tu conexión y vuelve a intentarlo.'); }
        const { error } = carga;
        if (error) throw new Error('No se pudo subir la fotografía. Revisa tu conexión y los permisos del catálogo.');
        subida = true;
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
          if (retirada.error || !retirada.data?.length) throw new Error('El producto no se guardó y quedó una fotografía pendiente de revisión.');
        }
        throw new Error('El servidor rechazó los datos del producto. Revisa el nombre y la fotografía.');
      }
      const incierto = new Error('No se pudo confirmar el guardado. Cierra el formulario y actualiza el catálogo antes de repetir.');
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
