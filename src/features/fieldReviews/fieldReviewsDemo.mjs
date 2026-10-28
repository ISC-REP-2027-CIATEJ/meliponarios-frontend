// Todos los nombres, folios, cantidades y puntos son ficticios.
// Estos ejemplos no proceden de clientes y no se guardan en Supabase.
const VALLADOLID = '11111111-1111-4111-8111-111111111111';
const IZAMAL = '22222222-2222-4222-8222-222222222222';
const BEECHEII = '33333333-3333-4333-8333-333333333333';
const NANNOTRIGONA = '44444444-4444-4444-8444-444444444444';
const photos = [
  { id: 'foto-a', src: '/images/meliponarios/palapa.png', descripcion: 'Ejemplo de vista general' },
  { id: 'foto-b', src: '/images/meliponarios/cajas.png', descripcion: 'Ejemplo de cajas tecnificadas' },
  { id: 'foto-c', src: '/images/meliponarios/sendero.png', descripcion: 'Ejemplo del entorno' },
];

export function createReviewDemo() {
  const assignment = { localidadId: VALLADOLID, localidad: 'Valladolid', municipio: 'Valladolid', activa: true };
  const base = {
    localidadId: VALLADOLID, localidad: 'Valladolid', municipio: 'Valladolid',
    descripcion: 'Ficha ficticia para probar la revisión de datos mínimos del meliponario.',
    referencia: 'Referencia de ejemplo, sin domicilio de una persona real.',
    coordenadas: [20.69, -88.20], metodoCaptura: 'mapa',
    abejas: [{ especieId: BEECHEII, nombre: 'Melipona beecheii', cajas: 12, jobones: 3 }],
    fotos: photos, vendeMiel: true, recibeVisitas: false,
    enviadoEn: '2026-10-27T16:00:00Z', numeroIntento: 1, historial: [],
  };
  const records = [
    { ...base, id: 'demo-sol-001', folio: 'EJEMPLO-001', nombre: 'Meliponario del jardín', estado: 'enviada' },
    { ...base, id: 'demo-sol-002', folio: 'EJEMPLO-002', nombre: 'Abejas del monte', estado: 'en_revision',
      abejas: [...base.abejas, { especieId: NANNOTRIGONA, nombre: 'Nannotrigona perilampoides', cajas: 6, jobones: 0 }],
      enviadoEn: '2026-10-27T17:00:00Z' },
    { ...base, id: 'demo-sol-003', folio: 'EJEMPLO-003', nombre: 'Pequeño meliponario', estado: 'enviada',
      coordenadas: null, fotos: [], enviadoEn: '2026-10-27T18:00:00Z' },
    { ...base, id: 'demo-sol-004', folio: 'EJEMPLO-004', nombre: 'El árbol de las abejas', estado: 'correccion',
      revisadoEn: '2026-10-27T19:00:00Z', comentarioRevision: 'Revisa el punto en el mapa y completa la cantidad de jobones.' },
    { ...base, id: 'demo-sol-005', folio: 'EJEMPLO-005', nombre: 'Jardín de flores', estado: 'aprobada',
      revisadoEn: '2026-10-27T19:00:00Z', comentarioRevision: 'Datos mínimos revisados en el ejemplo.' },
    { ...base, id: 'demo-sol-006', folio: 'EJEMPLO-006', nombre: 'Registro duplicado', estado: 'rechazada',
      revisadoEn: '2026-10-27T19:00:00Z', comentarioRevision: 'Ejemplo de rechazo por duplicidad de la misma solicitud.' },
    // Sirve para comprobar el filtro territorial en las pruebas. Nunca se muestra en Valladolid.
    { ...base, id: 'demo-sol-otra-localidad', folio: 'EJEMPLO-OTRA', nombre: 'Ejemplo de otra localidad',
      localidadId: IZAMAL, localidad: 'Izamal', municipio: 'Izamal', estado: 'enviada' },
  ];
  return structuredClone({ assignment, records });
}
