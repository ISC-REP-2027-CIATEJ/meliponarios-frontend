const iso = /^\d{4}-\d{2}-\d{2}$/;
export function fechaValida(fecha) {
  return typeof fecha === 'string' && iso.test(fecha) &&
    Number.isFinite(Date.parse(fecha + 'T12:00:00Z')) && new Date(fecha + 'T12:00:00Z').toISOString().slice(0,10) === fecha;
}
export function hoyMexico(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(ahora);
  const valor = tipo => partes.find(p => p.type === tipo).value;
  return valor('year') + '-' + valor('month') + '-' + valor('day');
}
export function sumarDias(fecha, dias) {
  const date = new Date(fecha + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0,10);
}
export function rangoVisible(fecha, vista = 'mes') {
  if (!fechaValida(fecha)) throw new Error('Selecciona una fecha válida.');
  const lunes = dia => sumarDias(dia, -((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7));
  if (vista === 'semana') { const inicio=lunes(fecha); return { inicio, fin:sumarDias(inicio,6) }; }
  const primero=fecha.slice(0,7)+'-01';
  const inicio=lunes(primero);
  return { inicio, fin:sumarDias(inicio,41) };
}
export function avanzar(fecha, cantidad, vista) {
  if (vista === 'semana') return sumarDias(fecha, cantidad * 7);
  const date = new Date(fecha.slice(0,7)+'-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth()+cantidad);
  return date.toISOString().slice(0,10);
}
export function fechaVisible(fecha) {
  return fechaValida(fecha) ? new Intl.DateTimeFormat('es-MX', { timeZone:'UTC',day:'numeric',month:'short',year:'numeric' }).format(new Date(fecha+'T12:00:00Z')) : 'Sin fecha';
}
export const horaVisible = hora => hora ? hora.slice(0,5) : 'Hora pendiente';
export const tiposVisita = Object.freeze({ levantamiento_tecnico:'Primera visita técnica', seguimiento:'Seguimiento', correccion_datos:'Corrección de datos' });

export function instanteVisible(valor) {
  return valor && Number.isFinite(Date.parse(valor)) ? new Intl.DateTimeFormat('es-MX', {
    timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short',
  }).format(new Date(valor)) : 'Sin fecha';
}
