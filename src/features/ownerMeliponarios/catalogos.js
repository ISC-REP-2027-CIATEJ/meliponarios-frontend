// Catálogos de muestra para probar la interfaz. Estos IDs y propiedades son
// exclusivos del prototipo: NO describen tablas, columnas ni RPC de Supabase.
// Cuando el backend confirme su contrato, reemplazar la implementación de
// obtenerCatalogosRegistro y adaptar su respuesta a esta forma de la interfaz.
// Las localidades incluidas son solamente las cabeceras, no un catálogo completo.
export async function obtenerCatalogosRegistro() {
  return {
    municipios: [
      { id: 'demo-merida', nombre: 'Mérida' },
      { id: 'demo-izamal', nombre: 'Izamal' },
      { id: 'demo-valladolid', nombre: 'Valladolid' },
    ],
    localidades: [
      { id: 'demo-localidad-merida', municipioId: 'demo-merida', nombre: 'Mérida' },
      { id: 'demo-localidad-izamal', municipioId: 'demo-izamal', nombre: 'Izamal' },
      { id: 'demo-localidad-valladolid', municipioId: 'demo-valladolid', nombre: 'Valladolid' },
    ],
    abejas: [
      { id: 'demo-beecheii', nombre: 'Melipona beecheii', nombreComun: '' },
      { id: 'demo-pectoralis', nombre: 'Scaptotrigona pectoralis', nombreComun: '' },
      { id: 'demo-perilampoides', nombre: 'Nannotrigona perilampoides', nombreComun: '' },
      { id: 'demo-nigra', nombre: 'Frieseomelitta nigra', nombreComun: '' },
    ],
    modo: 'demo',
  };
}
