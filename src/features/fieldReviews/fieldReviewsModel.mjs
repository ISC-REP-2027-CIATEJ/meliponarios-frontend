// La bandeja y la ficha se autorizan en Supabase por asignaciones territoriales vigentes.
export const FIELD_REVIEWS_ROUTE = 'campo/solicitudes';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = value => typeof value === 'string' ? value.trim() : '';
const length = value => Array.from(value).length;

export const REVIEW_STATES = Object.freeze({
  enviada: 'Pendiente de revisión', en_revision: 'En revisión', correccion: 'Correcciones solicitadas',
  aprobada: 'Aprobada', rechazada: 'Rechazada',
});
export const REVIEW_TABS = Object.freeze([
  { id: 'pendientes', label: 'Pendientes' }, { id: 'correccion', label: 'En corrección' },
  { id: 'aprobada', label: 'Aprobadas' }, { id: 'rechazada', label: 'Rechazadas' },
]);
export const REVIEW_CHECKS = Object.freeze([
  { id: 'nombre', label: 'El nombre identifica el meliponario.' },
  { id: 'localidad', label: 'La localidad corresponde a mi asignación.' },
  { id: 'abejas', label: 'Las especies y cantidades están completas.' },
  { id: 'ubicacion', label: 'La ubicación está registrada y es coherente con la ficha.' },
]);

export function isFieldWorker(user) {
  return Boolean(text(user?.id)) && Number(user?.roleId) === 4;
}

export function canReview(record, user) {
  return Number(user?.roleId) === 4 && record?.estado === 'en_revision' && record.trabajadorRevisorId === user?.id;
}

export function validCoordinates(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) &&
    Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
}

export function minimumDataErrors(record) {
  const errors = [];
  if (length(text(record?.nombre)) < 3 || length(text(record?.nombre)) > 160) errors.push('El nombre debe tener de 3 a 160 caracteres.');
  const bees = record?.abejas;
  if (!Array.isArray(bees) || !bees.length || bees.length > 50) errors.push('Debe declararse al menos una especie de abeja.');
  else {
    const ids = new Set();
    for (const bee of bees) {
      if (!UUID.test(bee?.especieId ?? '') || !text(bee.nombre) || ids.has(bee.especieId) ||
        ![bee.cajas, bee.jobones].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 100000) ||
        bee.cajas + bee.jobones < 1) {
        errors.push('Revisa especies, cantidades y filas repetidas.'); break;
      }
      ids.add(bee.especieId);
    }
  }
  if (!validCoordinates(record?.coordenadas)) errors.push('Falta una ubicación válida.');
  if (!Array.isArray(record?.fotos) || record.fotos.length > 5) errors.push('La ficha admite de cero a cinco fotografías.');
  return errors;
}

export function validateDecision(record, user, decision, { checks = {}, note = '' } = {}) {
  if (!canReview(record, user)) return ['Actualiza la bandeja: esta solicitud no está disponible para revisión.'];
  if (!['aprobar', 'rechazar', 'correccion'].includes(decision)) return ['Selecciona una decisión válida.'];
  const errors = [];
  if (typeof note !== 'string' || length(note) > 2000) errors.push('El comentario admite hasta 2000 caracteres.');
  if (decision === 'aprobar') {
    errors.push(...minimumDataErrors(record));
    if (!REVIEW_CHECKS.every(item => checks[item.id] === true)) errors.push('Confirma los puntos de revisión antes de aprobar.');
  }
  if (length(text(note)) < 10) errors.push('El servidor exige un comentario de 10 a 2000 caracteres para todas las decisiones.');
  return errors;
}

export function photoSource(value) {
  if (typeof value !== 'string') return null;
  if (/^\/images\/[\w./-]+$/.test(value) && !value.includes('..')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function formatReviewDate(value) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City',
  }).format(new Date(value)) : 'Fecha no disponible';
}
