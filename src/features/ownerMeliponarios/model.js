// Modelo LOCAL de la interfaz. No es un contrato de base de datos.
// El almacenamiento del navegador permite ensayar borradores y solicitudes;
// enviado_demo no envía datos al centro ni constituye una aprobación pública.
import { normalizarProducto, validarProducto } from './productos.js';
const PREFIJO = 'kaabmap:meliponarios-propios:demo:v1:';
const texto = value => typeof value === 'string' ? value.trim() : '';

export function isCliente(user) {
  return Boolean(texto(user?.id)) && Number(user?.roleId) === 5;
}

export function crearFormulario(record = null) {
  return {
    nombre: record?.nombre ?? '',
    municipioId: record?.municipioId ?? '',
    localidadId: record?.localidadId ?? '',
    descripcion: record?.descripcion ?? '',
    referencia: record?.referencia ?? '',
    abejas: (record?.abejas ?? []).map(abeja => ({ ...abeja })),
    productos: (record?.productos ?? []).map(producto => ({ ...producto })),
    coordenadas: record?.coordenadas ? [...record.coordenadas] : null,
    vendeMiel: record?.vendeMiel ?? false,
    recibeVisitas: record?.recibeVisitas ?? false,
  };
}

// Los controles numéricos pueden entregar números o cadenas numéricas.
// Rechazamos vacíos, decimales, negativos, infinitos y enteros inseguros.
function cantidadValida(value) {
  return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function validarAbeja(bee, others = []) {
  if (!texto(bee?.tipoId)) return 'Selecciona un tipo de abeja.';
  if (others.some(otra => otra.tipoId === bee.tipoId)) {
    return 'Este tipo de abeja ya está agregado.';
  }
  if (!cantidadValida(bee.cajas) || !cantidadValida(bee.jobones)) {
    return 'Escribe cantidades enteras de cero o más para cajas tecnificadas y jobones.';
  }
  if (Number(bee.cajas) + Number(bee.jobones) < 1) {
    return 'Agrega al menos una caja tecnificada o un jobón para este tipo de abeja.';
  }
  return '';
}

function coordenadasValidas(value) {
  return Array.isArray(value) && value.length === 2 &&
    value.every(numero => typeof numero === 'number' && Number.isFinite(numero)) &&
    value[0] >= -90 && value[0] <= 90 && value[1] >= -180 && value[1] <= 180;
}

function coordenadasBorradorValidas(value) {
  return value === null || Array.isArray(value) && value.length === 2 && value.every((numero, index) =>
    numero === '' || typeof numero === 'number' && Number.isFinite(numero) && Math.abs(numero) <= (index === 0 ? 90 : 180));
}

export function validarFormulario(form, catalogos, { enviar = false } = {}) {
  const errores = {};
  const municipios = catalogos?.municipios ?? [];
  const localidades = catalogos?.localidades ?? [];
  const abejasCatalogo = catalogos?.abejas ?? [];
  const lista = Array.isArray(form?.abejas) ? form.abejas : [];
  const productos = form?.productos ?? [];
  if (!Array.isArray(productos)) errores.productos = 'Revisa los productos agregados.';
  else for (let index = 0; index < productos.length; index++) {
    const error = validarProducto(productos[index], productos.filter((_, posicion) => posicion !== index));
    if (error) { errores.productos = error; break; }
  }
  if (Array.isArray(productos)) {
    const ids = productos.map(item => item?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) errores.productos = 'Revisa los productos: hay un identificador repetido.';
  }
  if (!Array.isArray(form?.abejas)) errores.abejas = 'Revisa los tipos de abejas agregados.';

  if (enviar && !texto(form?.nombre)) errores.nombre = 'Escribe el nombre del meliponario.';
  if ((enviar || form?.municipioId) && !municipios.some(m => m.id === form?.municipioId)) {
    errores.municipioId = 'Selecciona un municipio del catálogo.';
  }
  if ((enviar || form?.localidadId) && !localidades.some(l =>
    l.id === form?.localidadId && l.municipioId === form?.municipioId)) {
    errores.localidadId = 'Selecciona una localidad del municipio elegido.';
  }
  if (enviar && !lista.length) errores.abejas = 'Agrega al menos un tipo de abeja.';
  for (let index = 0; index < lista.length; index++) {
    const bee = lista[index];
    const error = validarAbeja(bee, lista.filter((_, posicion) => posicion !== index));
    if (error) errores.abejas = error;
    else if (!abejasCatalogo.some(tipo => tipo.id === bee.tipoId)) {
      errores.abejas = 'Selecciona tipos de abejas del catálogo disponible.';
    }
    if (errores.abejas) break;
  }
  if (enviar ? !coordenadasValidas(form?.coordenadas) : !coordenadasBorradorValidas(form?.coordenadas ?? null)) {
    errores.coordenadas = 'Marca la ubicación del meliponario en el mapa.';
  }
  if (enviar && form?.vendeMiel !== true && form?.recibeVisitas !== true) {
    errores.actividades = 'Selecciona venta de miel, visitas o ambas actividades.';
  }
  return errores;
}

export function actividad(form) {
  if (form?.vendeMiel && form?.recibeVisitas) return {
    key: 'ambas', label: 'Miel y visitas', color: '#3a82b3', fondo: '#e8f2fa', texto: '#24577a',
  };
  if (form?.vendeMiel) return {
    key: 'miel', label: 'Venta de miel', color: '#d6a52f', fondo: '#fff4ce', texto: '#75530c',
  };
  if (form?.recibeVisitas) return {
    key: 'visitas', label: 'Visitas y difusión', color: '#43865d', fondo: '#eaf3e8', texto: '#28563b',
  };
  return {
    key: 'sin-definir', label: 'Actividad por definir', color: '#819083', fondo: '#eef1ec', texto: '#526154',
  };
}

function clave(userId) {
  if (!texto(userId)) throw new Error('Inicia sesión para consultar tus borradores.');
  return PREFIJO + encodeURIComponent(userId);
}

function almacenDisponible(storage) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; }
    catch { throw new Error('No se pudo acceder al almacenamiento de este navegador.'); }
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('No se pudo acceder al almacenamiento de este navegador.');
  }
  return storage;
}

function registroValido(record, userId) {
  return record && typeof record === 'object' && texto(record.id) &&
    record.ownerId === userId && ['borrador', 'enviado_demo'].includes(record.estado) &&
    ['nombre', 'municipioId', 'localidadId', 'descripcion', 'referencia', 'creadoEn', 'actualizadoEn']
      .every(campo => typeof record[campo] === 'string') &&
    Number.isFinite(Date.parse(record.creadoEn)) && Number.isFinite(Date.parse(record.actualizadoEn)) &&
    typeof record.vendeMiel === 'boolean' && typeof record.recibeVisitas === 'boolean' &&
    Array.isArray(record.abejas) && record.abejas.every(bee => !validarAbeja(bee)) &&
    new Set(record.abejas.map(bee => bee.tipoId)).size === record.abejas.length &&
    (record.productos === undefined || Array.isArray(record.productos) && record.productos.every((producto, index, lista) =>
      typeof producto?.id === 'string' && producto.id.trim() && !validarProducto(producto, lista.filter((_, posicion) => posicion !== index))) &&
      new Set(record.productos.map(producto => producto.id)).size === record.productos.length) &&
    (record.estado === 'borrador' ? coordenadasBorradorValidas(record.coordenadas) : coordenadasValidas(record.coordenadas)) &&
    (record.estado === 'borrador' ? record.enviadoEn === null : typeof record.enviadoEn === 'string');
}

export function leerRegistros(userId, storage) {
  const key = clave(userId);
  storage = almacenDisponible(storage);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    throw new Error('No se pudieron leer tus borradores. Revisa el almacenamiento del navegador.');
  }
  if (raw === null) return [];
  let registros;
  try {
    registros = JSON.parse(raw);
  } catch {
    throw new Error('Los registros locales no se pueden leer. Conserva una copia antes de restablecerlos.');
  }
  if (!Array.isArray(registros) || registros.some(record => !registroValido(record, userId)) ||
    new Set(registros.map(record => record.id)).size !== registros.length) {
    throw new Error('Los registros locales tienen un formato inválido. Conserva una copia antes de restablecerlos.');
  }
  return registros;
}

export function guardarRegistro({ userId, form, id = null, enviar = false, catalogos }, storage) {
  storage = almacenDisponible(storage);
  const registros = leerRegistros(userId, storage);
  const existente = id ? registros.find(record => record.id === id) : null;
  if (id && !existente) throw new Error('No encontramos este borrador entre tus meliponarios.');
  if (existente?.estado === 'enviado_demo') {
    throw new Error('Esta solicitud de prueba ya fue enviada y sus datos están bloqueados.');
  }
  const errores = validarFormulario(form, catalogos, { enviar });
  if (Object.keys(errores).length) {
    const error = new Error(Object.values(errores)[0]);
    error.campos = errores;
    throw error;
  }
  const ahora = new Date().toISOString();
  const datos = crearFormulario(form);
  const record = {
    ...datos,
    nombre: texto(datos.nombre), descripcion: texto(datos.descripcion), referencia: texto(datos.referencia),
    abejas: datos.abejas.map(bee => ({ tipoId: bee.tipoId, cajas: Number(bee.cajas), jobones: Number(bee.jobones) })),
    productos: datos.productos.map(normalizarProducto),
    id: existente?.id ?? 'demo-meliponario-' + (globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(36).slice(2)),
    ownerId: userId,
    estado: enviar ? 'enviado_demo' : 'borrador',
    creadoEn: existente?.creadoEn ?? ahora,
    actualizadoEn: ahora,
    enviadoEn: enviar ? ahora : null,
  };
  const siguientes = existente ? registros.map(item => item.id === record.id ? record : item) : [...registros, record];
  try {
    storage.setItem(clave(userId), JSON.stringify(siguientes));
  } catch {
    throw new Error('No se pudo guardar. El almacenamiento del navegador puede estar lleno o bloqueado.');
  }
  return record;
}

// Solo borra borradores locales del propietario. Las solicitudes enviadas siguen bloqueadas.
export function eliminarBorrador({ userId, id }, storage) {
  storage = almacenDisponible(storage);
  const registros = leerRegistros(userId, storage);
  const record = registros.find(item => item.id === id);
  if (!record) throw new Error('No encontramos este borrador en tu cuenta. Actualiza la lista.');
  if (record.estado !== 'borrador') throw new Error('Una solicitud enviada no se puede eliminar desde este espacio.');
  try { storage.setItem(clave(userId), JSON.stringify(registros.filter(item => item.id !== id))); }
  catch { throw new Error('No se pudo eliminar el borrador. Tus registros se conservaron.'); }
  return record;
}
