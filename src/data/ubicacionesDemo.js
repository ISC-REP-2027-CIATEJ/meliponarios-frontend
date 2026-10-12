// Puntos ilustrativos cercanos a las cabeceras municipales.
// NO son las coordenadas reales de los meliponarios ni sirven para llegar a ellos.
export const ubicacionesDemo = {
  'xunaan-kab': [20.93, -89.02],
  'las-flores': [20.69, -88.20],
  'mayab': [21.00, -89.39],
};

export const limitesPeninsula = [[17.8, -92.6], [22.0, -86.5]];

export function distanciaKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
