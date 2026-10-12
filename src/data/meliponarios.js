// Datos de ejemplo. Sustituir por registros autorizados.
export const meliponarios = [
  { id: 'xunaan-kab', nombre: 'Meliponario Xunaan-Kab', municipio: 'Izamal', estado: 'Activo', especies: ['Melipona beecheii', 'Nannotrigona perilampoides'], colonias: 36, productos: ['Miel', 'Cera'], imagen: 'palapa.png', descripcion: 'Un espacio para conocer la crianza tradicional de abejas nativas y el cuidado de sus colonias.' },
  { id: 'las-flores', nombre: 'Reserva Las Flores', municipio: 'Valladolid', estado: 'Activo', especies: ['Melipona beecheii', 'Scaptotrigona pectoralis', 'Nannotrigona perilampoides'], colonias: 24, productos: ['Miel', 'Propóleo'], imagen: 'cajas.png', descripcion: 'Entre árboles y flores, este meliponario reúne cajas de abejas sin aguijón en un entorno natural.' },
  { id: 'mayab', nombre: 'Santuario del Mayab', municipio: 'Tixkokob', estado: 'Pendiente', especies: ['Melipona beecheii'], colonias: 12, productos: [], imagen: 'sendero.png', descripcion: 'Un sitio dedicado a la conservación de las abejas nativas y su entorno. Registro de demostración pendiente.' },
];
export const municipios = [...new Set(meliponarios.map(m => m.municipio))].sort();
export const especies = [...new Set(meliponarios.flatMap(m => m.especies))].sort();
export const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filtrarMeliponarios(datos, { busqueda, municipio, especie, conProductos, activos }) {
  return datos.filter(m => normalizar(`${m.nombre} ${m.municipio} ${m.especies.join(' ')}`).includes(normalizar(busqueda.trim())) && (!municipio || m.municipio === municipio) && (!especie || m.especies.includes(especie)) && (!conProductos || m.productos.length > 0) && (!activos || m.estado === 'Activo'));
}
