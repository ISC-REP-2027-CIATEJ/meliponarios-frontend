export function esRutaCliente(route) {
  return route === 'mis-meliponarios' || route === 'nuevo-meliponario' || route.startsWith('mi-meliponario/');
}
