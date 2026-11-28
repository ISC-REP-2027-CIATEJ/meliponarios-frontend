import { validarGraficas } from './researchCharts.mjs';

export const RUTA_INVESTIGACION = 'investigacion';
export const RUTA_INVENTARIO = 'investigacion/inventario';
export const esInvestigador = user => Number(user?.roleId) === 2;
export const esRutaInvestigacion = ruta => [RUTA_INVESTIGACION, RUTA_INVENTARIO].includes(ruta);
export const FILTROS_INICIALES = Object.freeze({ zona: '', municipio: '', localidad: '', especie: '', estado: '', busqueda: '' });
export const ESTADOS = Object.freeze({ activo: 'Activo', inactivo: 'Inactivo', fuera_de_operacion: 'Fuera de operación' });
export const VISIBILIDADES = Object.freeze({ publico: 'Público', privado: 'Privado' });
export const NOTA_METODOLOGICA = 'Inventario vigente de la última ficha aprobada por meliponario. Los datos sin registrar se muestran como «Sin dato» y no se convierten en cero. Cajas y jobones no equivalen a un conteo de abejas individuales ni se suman para inferir colonias.';
export const numero = valor => valor === null || valor === undefined ? 'Sin dato' : new Intl.NumberFormat('es-MX').format(valor);
export const textoEstado = valor => ESTADOS[valor] || VISIBILIDADES[valor] || 'Sin dato';
export function fechaVisible(fecha) {
  if (!fecha) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(fecha.slice(0, 10) + 'T12:00:00Z'));
}
export function instanteVisible(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}
export function fechaMexico(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}
const claveTexto = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');
const texto = (valor, campo) => {
  if (typeof valor !== 'string' || !valor.trim()) throw new Error('Falta ' + campo + ' en el inventario.');
  return valor.trim();
};
const conteo = valor => {
  if (valor === null || valor === undefined) return null;
  if (!Number.isSafeInteger(valor) || valor < 0) throw new Error('El inventario contiene un conteo inválido.');
  return valor;
};
function fechaValida(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(valor)) || new Date(valor).toISOString().slice(0, 10) !== valor) throw new Error('Fecha de ficha inválida.');
  return valor;
}
export function tieneGPS(registro) {
  return Number.isFinite(registro.latitud) && Number.isFinite(registro.longitud) && Math.abs(registro.latitud) <= 90 && Math.abs(registro.longitud) <= 180;
}

// Contrato interno de la pantalla. No representa una RPC existente ni amplía permisos.
// El conector real debe entregar exclusivamente el último inventario aprobado y autorizado.
export function normalizarInventario(respuesta) {
  if (!respuesta || !['real', 'ejemplo'].includes(respuesta.modo) || !Array.isArray(respuesta.registros) || !Number.isFinite(Date.parse(respuesta.fechaConsulta))) throw new Error('La respuesta del inventario está incompleta.');
  const vistos = new Set();
  const registros = respuesta.registros.map(registro => {
    const id = texto(registro.id, 'la referencia interna');
    if (vistos.has(id)) throw new Error('Hay meliponarios duplicados en el inventario.');
    vistos.add(id);
    if (!Array.isArray(registro.inventario) || !Array.isArray(registro.zonas)) throw new Error('Falta el detalle del inventario.');
    const especies = new Set();
    const inventario = registro.inventario.map(fila => {
      const especieId = texto(fila.especieId, 'la especie');
      if (especies.has(especieId)) throw new Error('La misma especie aparece repetida en un meliponario.');
      especies.add(especieId);
      return { especieId, nombreComun: texto(fila.nombreComun, 'el nombre de la especie'), nombreCientifico: texto(fila.nombreCientifico, 'el nombre científico'), cajas: conteo(fila.cajas), jobones: conteo(fila.jobones) };
    });
    const zonasVistas = new Set();
    const zonas = registro.zonas.map(zona => {
      const zonaId = texto(zona.id, 'la zona');
      if (zonasVistas.has(zonaId)) throw new Error('La cobertura contiene una zona repetida.');
      zonasVistas.add(zonaId);
      return { id: zonaId, nombre: texto(zona.nombre, 'el nombre de la zona') };
    });
    const normalizado = { id, nombre: texto(registro.nombre, 'el nombre del meliponario'), municipioId: texto(registro.municipioId, 'el municipio'), municipio: texto(registro.municipio, 'el nombre del municipio'), localidadId: texto(registro.localidadId, 'la localidad'), localidad: texto(registro.localidad, 'el nombre de la localidad'), zonas, estadoOperativo: registro.estadoOperativo || null, visibilidad: registro.visibilidad || null, fechaFicha: fechaValida(registro.fechaFicha), latitud: registro.latitud ?? null, longitud: registro.longitud ?? null, inventario };
    if ((normalizado.latitud !== null || normalizado.longitud !== null) && !tieneGPS(normalizado)) throw new Error('El inventario contiene coordenadas inválidas.');
    return normalizado;
  });
  return { modo: respuesta.modo, fechaConsulta: new Date(respuesta.fechaConsulta).toISOString(), registros };
}

export function opcionesTerritoriales(registros, filtros = FILTROS_INICIALES) {
  const unicos = filas => [...new Map(filas.map(fila => [fila.id, fila])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const porZona = registros.filter(registro => !filtros.zona || registro.zonas.some(z => z.id === filtros.zona));
  const porMunicipio = porZona.filter(registro => !filtros.municipio || registro.municipioId === filtros.municipio);
  return {
    zonas: unicos(registros.flatMap(r => r.zonas)),
    municipios: unicos(porZona.map(r => ({ id: r.municipioId, nombre: r.municipio }))),
    localidades: unicos(porMunicipio.map(r => ({ id: r.localidadId, nombre: r.localidad + ' · ' + r.municipio }))),
    especies: unicos(registros.flatMap(r => r.inventario.map(fila => ({ id: fila.especieId, nombre: fila.nombreComun, cientifico: fila.nombreCientifico })))),
  };
}
export function cambiarFiltro(filtros, clave, valor) {
  return { ...filtros, [clave]: valor, ...(clave === 'zona' ? { municipio: '', localidad: '' } : clave === 'municipio' ? { localidad: '' } : {}) };
}
export function filtrarInventario(registros, filtros) {
  const busqueda = claveTexto(filtros.busqueda).trim();
  return registros.filter(r => (!filtros.zona || r.zonas.some(z => z.id === filtros.zona))
    && (!filtros.municipio || r.municipioId === filtros.municipio)
    && (!filtros.localidad || r.localidadId === filtros.localidad)
    && (!filtros.estado || r.estadoOperativo === filtros.estado)
    && (!filtros.especie || r.inventario.some(fila => fila.especieId === filtros.especie))
    && (!busqueda || claveTexto([r.nombre, r.municipio, r.localidad, ...r.zonas.map(z => z.nombre), ...r.inventario.map(fila => fila.nombreComun + ' ' + fila.nombreCientifico)].join(' ')).includes(busqueda)))
    .map(r => ({ ...r, inventario: r.inventario.filter(fila => !filtros.especie || fila.especieId === filtros.especie) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
export function sumarMedida(registros, medida) {
  const filas = registros.flatMap(r => r.inventario);
  const conocidos = filas.filter(fila => fila[medida] !== null);
  const total = conocidos.reduce((sum, fila) => sum + fila[medida], 0);
  if (!Number.isSafeInteger(total)) throw new Error('El total del inventario supera el rango numérico permitido.');
  return { total: conocidos.length ? total : null, faltantes: filas.length - conocidos.length, registrados: conocidos.length };
}
export function resumirInventario(registros) {
  const agrupar = (clave, nombre) => {
    const grupos = new Map();
    registros.forEach(r => {
      const id = clave(r);
      const anterior = grupos.get(id) || { id, nombre: nombre(r), total: 0 };
      grupos.set(id, { ...anterior, total: anterior.total + 1 });
    });
    return [...grupos.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  };
  const especies = new Map();
  const inventarios = new Map();
  registros.forEach(r => r.inventario.forEach(fila => {
    const grupo = especies.get(fila.especieId) || { id: fila.especieId, nombre: fila.nombreComun, cientifico: fila.nombreCientifico, total: 0 };
    especies.set(fila.especieId, { ...grupo, total: grupo.total + 1 });
    const anterior = inventarios.get(fila.especieId) || { id: fila.especieId, nombre: fila.nombreComun, cientifico: fila.nombreCientifico, inventario: [] };
    anterior.inventario.push(fila);
    inventarios.set(fila.especieId, anterior);
  }));
  return {
    meliponarios: registros.length, especies: especies.size, localidades: new Set(registros.map(r => r.localidadId)).size,
    cajas: sumarMedida(registros, 'cajas'), jobones: sumarMedida(registros, 'jobones'),
    sinInventario: registros.filter(r => !r.inventario.length).length, sinGPS: registros.filter(r => !tieneGPS(r)).length,
    municipios: agrupar(r => r.municipioId, r => r.municipio),
    distribucionEspecies: [...especies.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')),
    inventarioEspecies: [...inventarios.values()].map(fila => ({ id: fila.id, nombre: fila.nombre, cientifico: fila.cientifico, cajas: sumarMedida([fila], 'cajas'), jobones: sumarMedida([fila], 'jobones') })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    estados: agrupar(r => r.estadoOperativo || 'sin_dato', r => textoEstado(r.estadoOperativo)),
  };
}
export function describirFiltros(filtros, opciones) {
  const nombre = (filas, id) => filas.find(fila => fila.id === id)?.nombre || 'Sin correspondencia';
  return [
    ['Zona', filtros.zona ? nombre(opciones.zonas, filtros.zona) : 'Todas las zonas autorizadas'],
    ['Municipio', filtros.municipio ? nombre(opciones.municipios, filtros.municipio) : 'Todos'],
    ['Localidad', filtros.localidad ? nombre(opciones.localidades, filtros.localidad) : 'Todas'],
    ['Especie', filtros.especie ? nombre(opciones.especies, filtros.especie) : 'Todas'],
    ['Estado operativo', filtros.estado ? textoEstado(filtros.estado) : 'Todos'],
    ['Búsqueda', filtros.busqueda.trim() || 'Sin búsqueda'],
  ];
}
const congelar = objeto => {
  if (objeto && typeof objeto === 'object') { Object.values(objeto).forEach(congelar); Object.freeze(objeto); }
  return objeto;
};
export function crearReporte({ datos, filtros, seleccion = [], alcance = 'filtrados', graficas, incluirGraficas = true, ahora = new Date().toISOString() }) {
  if (!['filtrados', 'seleccionados'].includes(alcance)) throw new Error('Elige el alcance del reporte.');
  const visibles = filtrarInventario(datos.registros, filtros);
  const ids = new Set(seleccion);
  const registros = alcance === 'seleccionados' ? visibles.filter(r => ids.has(r.id)) : visibles;
  if (!registros.length) throw new Error('No hay meliponarios en el alcance seleccionado.');
  const copia = JSON.parse(JSON.stringify(registros));
  return congelar({ titulo: 'Inventario territorial de meliponarios', modo: datos.modo, fuente: datos.modo === 'ejemplo' ? 'EJEMPLO · Datos ficticios para revisar el diseño. No son registros de CIATEJ.' : 'Consulta de inventario autorizada para la cuenta investigadora', fechaConsulta: datos.fechaConsulta, generado: ahora, alcanceClave: alcance, alcance: alcance === 'seleccionados' ? 'Solo los meliponarios seleccionados dentro de los filtros' : 'Todos los meliponarios que cumplen los filtros', criterios: describirFiltros(filtros, opcionesTerritoriales(datos.registros, filtros)), nota: NOTA_METODOLOGICA, resumen: resumirInventario(copia), registros: copia, graficas: validarGraficas(graficas), incluirGraficas: incluirGraficas === true });
}
export function nombreArchivoReporte(reporte, extension) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(reporte.generado));
  const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  const sello = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(clave => valores[clave]).join('');
  const alcance = reporte.alcanceClave === 'seleccionados' ? 'seleccion' : 'filtrados';
  return `KaabMap_${reporte.modo === 'ejemplo' ? 'EJEMPLO_' : ''}inventario_territorial_${alcance}_${reporte.registros.length}_${sello}.${extension}`;
}
