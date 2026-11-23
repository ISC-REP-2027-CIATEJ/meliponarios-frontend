const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = value => typeof value === 'string' ? value : '';
const invalido = () => new Error('No pudimos verificar los datos públicos. Actualiza e inténtalo de nuevo.');
const BUCKET = 'kaabmap-meliponarios';
export const SEGUNDOS_FOTO_PUBLICA = 60;

function uuid(value) {
  if (typeof value !== 'string') return null;
  try {
    const id = decodeURIComponent(value);
    return UUID.test(id) ? id.toLowerCase() : null;
  } catch { return null; }
}

// Cliente independiente: nunca utiliza la sesión del propietario para una pantalla pública.
export function crearClienteLecturaPublica(createClient, url, clave) {
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'kaabmap-public-read-v1' },
  });
}

// Lista explícita de los campos de listar_meliponarios_publicos. No trasladar perfiles ni notas.
export function normalizarFichaPublica(value) {
  if (!uuid(value?.id) || !texto(value?.nombre).trim() ||
      typeof value.ofrece_venta_miel !== 'boolean' || typeof value.ofrece_visitas !== 'boolean' ||
      typeof value.informacion_tecnica_verificada !== 'boolean' ||
      (value.telefono_contacto !== null && typeof value.telefono_contacto !== 'string') ||
      ![value.latitud, value.longitud].every(Number.isFinite) || Math.abs(value.latitud) > 90 || Math.abs(value.longitud) > 180) throw invalido();
  return {
    id: uuid(value.id), nombre: value.nombre, descripcion: texto(value.descripcion),
    municipio: texto(value.municipio), localidad: texto(value.localidad),
    nombreContacto: texto(value.nombre_contacto).trim() || 'Sin nombre de contacto', telefonoContacto: texto(value.telefono_contacto),
    vendeMiel: value.ofrece_venta_miel, recibeVisitas: value.ofrece_visitas,
    informacionTecnicaVerificada: value.informacion_tecnica_verificada,
    estado: 'Publicado', coordenadas: [value.latitud, value.longitud],
    // La consulta pública ya limita las coordenadas a registros publicables.
    ubicacionAproximada: false,
    // Clave de colores que MapCanvas también utiliza para los registros propios.
    ofertaVisualDemo: value.ofrece_venta_miel ? (value.ofrece_visitas ? 'ambos' : 'miel') : (value.ofrece_visitas ? 'difusion' : null),
    abejas: [], especies: [], productos: [], especiesDisponibles: false, productosDisponibles: false,
    fuente: 'publico-aprobado',
  };
}

function publicable(row) {
  return row.informacion_tecnica_verificada === true && row.estado_operativo !== 'fuera_de_operacion' &&
    [row.latitud, row.longitud].every(Number.isFinite) && Math.abs(row.latitud) <= 90 && Math.abs(row.longitud) <= 180;
}

function fallo(error, fotos = false) {
  return new Error(['PGRST202', '42883'].includes(error?.code)
    ? 'El catálogo público todavía no está disponible. Inténtalo más tarde.'
    : fotos ? 'No se pudieron cargar las fotografías públicas. Inténtalo de nuevo.'
      : 'No se pudieron cargar los meliponarios públicos. Comprueba la conexión e inténtalo de nuevo.');
}

function normalizarImagenes(data, id) {
  if (!Array.isArray(data) || data.length > 5) throw invalido();
  const ids = new Set();
  const posiciones = new Set();
  const rutas = new Set();
  return data.map(row => {
    const partes = texto(row?.ruta_storage).split('/');
    if (!uuid(row?.id) || !Number.isInteger(row.posicion) || row.posicion < 1 || row.posicion > 5 ||
        partes.length !== 2 || partes[0].toLowerCase() !== id ||
        !/^[a-z0-9_-][a-z0-9_. -]*\.(jpe?g|png|webp)$/i.test(partes[1]) || partes[1].includes('..') ||
        ids.has(uuid(row.id)) || posiciones.has(row.posicion) || rutas.has(row.ruta_storage)) throw invalido();
    ids.add(uuid(row.id)); posiciones.add(row.posicion); rutas.add(row.ruta_storage);
    return { id: uuid(row.id), ruta: row.ruta_storage, posicion: row.posicion, descripcion: texto(row.descripcion) };
  }).sort((a, b) => a.posicion - b.posicion);
}

function urlFoto(value, origen) {
  try {
    const base = new URL(origen);
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.origin === base.origin && (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
      url.pathname.startsWith('/storage/v1/object/sign/' + BUCKET + '/') ? url.href : null;
  } catch { return null; }
}

export function crearApiPublica(client, { origenAlmacenamiento = '' } = {}) {
  async function ejecutar(consulta, fotos = false) {
    let result;
    try { result = await consulta(); } catch (error) { throw fallo(error, fotos); }
    if (result?.error) throw fallo(result.error, fotos);
    return result?.data;
  }
  async function pagina(id, desde, hasta) {
    const data = await ejecutar(() => client.rpc('listar_meliponarios_publicos', { p_id: id }).order('id').range(desde, hasta));
    if (!Array.isArray(data) || data.length > hasta - desde + 1) throw invalido();
    return data;
  }
  return {
    async listar() {
      const items = new Map();
      let offset = 0;
      for (let page = 0; page < 10000; page++) {
        const data = await pagina(null, offset, offset + 499);
        if (!data.length) return [...items.values()].filter(Boolean);
        const anteriores = items.size;
        for (const item of data) {
          const id = uuid(item?.id);
          if (!id) throw invalido();
          items.set(id, publicable(item) ? normalizarFichaPublica(item) : null);
        }
        if (items.size === anteriores) throw invalido();
        // No asumir que Supabase permite 500 filas: la instancia puede aplicar un límite menor.
        offset += data.length;
      }
      throw invalido();
    },
    async ficha(encodedId) {
      const id = uuid(encodedId);
      if (!id) return null;
      const data = await pagina(id, 0, 1);
      if (!data.length) return null; // Misma respuesta para privado, pendiente o inexistente.
      if (data.length !== 1) throw invalido();
      if (uuid(data[0]?.id) !== id) throw invalido();
      return publicable(data[0]) ? normalizarFichaPublica(data[0]) : null;
    },
    async fotos(encodedId) {
      const id = uuid(encodedId);
      if (!id) return { fotos: [], faltantes: 0 };
      const data = await ejecutar(() => client.rpc('listar_imagenes_meliponario', { p_meliponario_id: id }), true);
      const imagenes = normalizarImagenes(data, id);
      if (!imagenes.length) return { fotos: [], faltantes: 0 };
      const firmas = await ejecutar(() => client.storage.from(BUCKET).createSignedUrls(imagenes.map(row => row.ruta), SEGUNDOS_FOTO_PUBLICA), true);
      if (!Array.isArray(firmas)) throw invalido();
      const fotos = imagenes.flatMap(row => {
        const firma = firmas.find(item => item.path === row.ruta && !item.error);
        const url = firma && urlFoto(firma.signedUrl, origenAlmacenamiento);
        return url ? [{ id: row.id, posicion: row.posicion, descripcion: row.descripcion, url }] : [];
      });
      // Una reserva sin archivo subido no impide consultar la ficha ni las demás imágenes.
      return { fotos, faltantes: imagenes.length - fotos.length };
    },
  };
}

export function enlaceTelefono(value) {
  const number = texto(value).trim().replace(/[ ()-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(number) ? 'tel:' + number : null;
}

const normalizar = value => texto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filtrarPublicos(items, filtros = {}) {
  return items.filter(item => (!filtros.activos || (item.fuente === 'publico-aprobado' ? item.informacionTecnicaVerificada : item.estado === 'Activo')) &&
    (!filtros.municipio || item.municipio === filtros.municipio) &&
    (!filtros.especie || item.especiesDisponibles === false || item.especies.includes(filtros.especie)) &&
    (!filtros.conProductos || item.productosDisponibles === false || item.productos.length > 0) &&
    (!filtros.busqueda || normalizar([item.nombre, item.municipio, item.localidad, ...item.especies].join(' ')).includes(normalizar(filtros.busqueda).trim())));
}
