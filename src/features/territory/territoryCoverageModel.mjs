import { normalizar } from '../adminUsers/adminUsersModel.mjs';

export const ADMIN_COVERAGE_ROUTE = 'administracion/cobertura';
export const HISTORIAL_POR_PAGINA = 8;
export const LOCALIDADES_POR_PAGINA = 12;
export const SIN_ZONA = 'sin-zona';

const ordenarNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es-MX');

export function unirCobertura({ municipios, zonas, localidades, relaciones }) {
  const porMunicipio = new Map(municipios.map(municipio => [municipio.id, municipio]));
  const porZona = new Map(zonas.map(zona => [zona.id, zona]));
  const idsLocalidades = new Set(localidades.map(localidad => localidad.id));
  const zonasPorLocalidad = new Map();
  for (const relacion of relaciones) {
    const zona = porZona.get(relacion.zona_id);
    if (!zona || !idsLocalidades.has(relacion.localidad_id) || zonasPorLocalidad.has(relacion.localidad_id)) {
      throw new Error('El catálogo de cobertura está incompleto. Actualiza las localidades para volver a comprobarlo.');
    }
    zonasPorLocalidad.set(relacion.localidad_id, zona);
  }

  return {
    municipios: [...municipios].sort(ordenarNombre),
    zonas: [...zonas].sort(ordenarNombre),
    localidades: localidades.map(localidad => {
      const municipio = porMunicipio.get(localidad.municipio_id);
      if (!municipio) throw new Error('Falta el municipio de una localidad. Actualiza para volver a comprobarlo.');
      return {
        ...localidad, municipio, zona: zonasPorLocalidad.get(localidad.id) ?? null,
      };
    }).sort((a, b) => ordenarNombre(a, b) || ordenarNombre(a.municipio, b.municipio)),
  };
}

export function filtrarLocalidades(localidades, { busqueda = '', municipioId = '', zonaId = '' }) {
  const termino = normalizar(busqueda);
  return localidades.filter(localidad => {
    if (municipioId && localidad.municipio_id !== municipioId) return false;
    if (zonaId === SIN_ZONA && localidad.zona) return false;
    if (zonaId && zonaId !== SIN_ZONA && localidad.zona?.id !== zonaId) return false;
    return !termino || normalizar([localidad.nombre, localidad.municipio.nombre, localidad.clave_localidad].join(' ')).includes(termino);
  });
}

export function zonasDestino(zonas, zonaActualId) {
  return zonas.filter(zona => zona.activo === true && zona.id !== zonaActualId);
}

export function planMunicipal(localidades, zonaId) {
  const origenes = new Map();
  let sinZona = 0;
  let enDestino = 0;
  let enOtras = 0;
  for (const { zona } of localidades) {
    if (!zona) {
      sinZona++;
    } else if (zona.id === zonaId) {
      enDestino++;
    } else {
      enOtras++;
      const origen = origenes.get(zona.id) ?? { ...zona, total: 0 };
      origen.total++;
      origenes.set(zona.id, origen);
    }
  }

  return {
    total: localidades.length, sinZona, enDestino, enOtras,
    origenes: [...origenes.values()].sort(ordenarNombre),
    estadoEsperado: Object.fromEntries(localidades.map(row => [row.id, row.zona?.id ?? null])),
  };
}
