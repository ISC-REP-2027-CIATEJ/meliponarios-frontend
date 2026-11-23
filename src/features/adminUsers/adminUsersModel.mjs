export const ADMIN_USERS_ROUTE = 'administracion/usuarios';
export const ADMIN_ROLE_ID = 1;

export function isAdminUser(user) {
  return Boolean(user?.id) && Number(user.roleId) === ADMIN_ROLE_ID;
}

export function fullName(profile) {
  return [profile.nombre, profile.apellidos].filter(Boolean).join(' ').trim() || 'Sin nombre registrado';
}

export function roleName(profile, roles) {
  return roles.find(role => Number(role.id) === Number(profile.rol_id))?.nombre || 'Rol sin catálogo';
}

export function normalizar(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();
}

export function filterUsers(profiles, { search = '', role = '', status = '' }) {
  const query = normalizar(search);
  return profiles.filter(profile =>
    (!query || normalizar([fullName(profile), profile.telefono, profile.id].join(' ')).includes(query)) &&
    (!role || Number(profile.rol_id) === Number(role)) &&
    (!status || (status === 'activo' ? profile.activo === true : profile.activo === false))
  );
}

export function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Este bloqueo orienta la interfaz. La protección definitiva corresponde a las RPC.
export function blockedAction(target, actorId, profiles, nextRole = null) {
  if (target.id === actorId) return 'Tu propia cuenta se consulta sin cambiar su rol ni su estado desde este panel.';
  const removesAdmin = target.activo === true && Number(target.rol_id) === ADMIN_ROLE_ID && (nextRole === null || Number(nextRole) !== ADMIN_ROLE_ID);
  if (removesAdmin && profiles.filter(profile => profile.activo === true && Number(profile.rol_id) === ADMIN_ROLE_ID).length <= 1) {
    return 'Debe permanecer al menos un administrador general activo.';
  }
  return '';
}
