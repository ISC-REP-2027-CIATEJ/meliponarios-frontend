// Únicamente se importa después de elegir «Explorar con datos de ejemplo».
// Nombres, cantidades y puntos ilustrativos; no pertenecen al padrón del proyecto.
import { normalizarInventario } from './inventarioModel.mjs';
const especies = [
  ['s1', 'Xunáan kab', 'Melipona beecheii'],
  ['s2', 'Chooj', 'Scaptotrigona pectoralis'],
  ['s3', 'Sak xiik', 'Frieseomelitta nigra'],
  ['s4', 'Mejen bóol', 'Nannotrigona perilampoides'],
];
const territorios = [
  ['m1', 'Mérida', 'l1', 'Mérida', 'z1', 'Zona centro · ejemplo', 20.9674, -89.5926],
  ['m1', 'Mérida', 'l2', 'Chablekal', 'z1', 'Zona centro · ejemplo', 21.1025, -89.5727],
  ['m2', 'Valladolid', 'l3', 'Valladolid', 'z2', 'Zona oriente · ejemplo', 20.6896, -88.2022],
  ['m2', 'Valladolid', 'l4', 'Popolá', 'z2', 'Zona oriente · ejemplo', 20.7272, -88.1828],
  ['m3', 'Izamal', 'l5', 'Izamal', 'z3', 'Zona interior · ejemplo', 20.9317, -89.0177],
  ['m4', 'Tizimín', 'l6', 'Tizimín', 'z2', 'Zona oriente · ejemplo', 21.1422, -88.1508],
];
export function crearInventarioEjemplo(ahora = new Date().toISOString()) {
  const nombres = ['Jardín del monte', 'Semillas del solar', 'Abejas del amanecer', 'Sendero de flores', 'Patio de la ceiba', 'Voces del monte', 'Colmenas del jardín', 'Refugio de abejas', 'Rincón de las flores', 'El solar verde', 'Camino de la ceiba', 'Monte en flor'];
  const registros = nombres.map((nombre, indice) => {
    const [municipioId, municipio, localidadId, localidad, zonaId, zonaNombre, lat, lng] = territorios[indice % territorios.length];
    const inventario = [0, 1].slice(0, indice % 3 === 0 ? 1 : 2).map((_, desplazamiento) => {
      const [especieId, nombreComun, nombreCientifico] = especies[(indice + desplazamiento) % especies.length];
      return { especieId, nombreComun, nombreCientifico, cajas: indice === 4 ? null : 3 + indice, jobones: indice % 4 };
    });
    return { id: 'ejemplo-' + (indice + 1), nombre: nombre + ' · ejemplo', municipioId, municipio, localidadId, localidad, zonas: [{ id: zonaId, nombre: zonaNombre }], estadoOperativo: indice === 10 ? 'inactivo' : indice === 11 ? 'fuera_de_operacion' : 'activo', visibilidad: indice % 4 === 0 ? 'privado' : 'publico', fechaFicha: '2026-11-' + String(10 + indice).padStart(2, '0'), latitud: indice === 7 ? null : lat + indice * 0.002, longitud: indice === 7 ? null : lng + indice * 0.003, inventario };
  });
  return normalizarInventario({ modo: 'ejemplo', fechaConsulta: ahora, registros });
}
