export function nombreCuenta(cuenta) {
  return [cuenta.nombre, cuenta.apellidos].filter(Boolean).join(' ').trim() || 'Cuenta sin nombre';
}

export function cuentasDisponibles({ usuarios, asignaciones }) {
  const asignados = new Set(
    asignaciones.filter(asignacion => asignacion.vigente).map(asignacion => asignacion.usuario_id),
  );
  return usuarios.filter(cuenta => !asignados.has(cuenta.id));
}

export function agruparAsignaciones(asignaciones) {
  const personas = new Map();
  for (const asignacion of asignaciones) {
    const id = asignacion.usuario_id;
    if (!personas.has(id)) {
      personas.set(id, {
        id,
        nombre: nombreCuenta(asignacion),
        rolId: asignacion.rol_id,
        vigentes: [],
        historial: [],
      });
    }
    const persona = personas.get(id);
    const periodos = asignacion.vigente ? persona.vigentes : persona.historial;
    periodos.push(asignacion);
  }
  return [...personas.values()].sort((a, b) => {
    if (Boolean(a.vigentes.length) !== Boolean(b.vigentes.length)) return a.vigentes.length ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es-MX');
  });
}

function textoBusqueda(value) {
  return (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-MX');
}

export function filtrarPersonas(personas, { estado, personaId = '', busqueda = '' }) {
  const termino = textoBusqueda(busqueda.trim());
  return personas.filter(persona => {
    if (personaId && persona.id !== personaId) return false;
    const { vigentes, historial } = persona;
    const periodos = estado === 'vigentes' ? vigentes
      : estado === 'historial' ? historial : [...vigentes, ...historial];
    if (!periodos.length) return false;
    return textoBusqueda(persona.nombre).includes(termino)
      || periodos.some(periodo => textoBusqueda(periodo.zona).includes(termino));
  });
}
