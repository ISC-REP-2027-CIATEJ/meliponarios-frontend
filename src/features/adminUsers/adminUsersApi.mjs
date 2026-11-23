const PROFILE_COLUMNS = 'id, nombre, apellidos, telefono, activo, fecha_creacion, rol_id';
const PAGE_SIZE = 500;

function denied() {
  const error = new Error('Tu cuenta no tiene un perfil de administrador general activo. Cierra sesión y comprueba tu acceso.');
  error.code = 'ADMIN_ACCESS_DENIED';
  return error;
}

function checkResult(result, message) {
  if (result.error) throw new Error(`${message} ${result.error.message || ''}`.trim());
  return result.data;
}

// El cliente se recibe como argumento para comprobar la autorización sin una base real.
export function createAdminUsersApi(client) {
  async function validateActor() {
    if (!client) throw new Error('Falta configurar la conexión pública de Supabase.');
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data?.user) throw denied();
    const actor = auth.data.user;
    const result = await client.from('perfiles').select('rol_id, activo').eq('id', actor.id).maybeSingle();
    const profile = checkResult(result, 'No se pudo comprobar tu perfil.');
    if (!profile || profile.activo !== true || Number(profile.rol_id) !== 1) throw denied();
    return actor;
  }

  async function listUsers() {
    await validateActor();
    const roles = checkResult(await client.from('roles').select('id, nombre').order('id', { ascending: true }), 'No se pudieron consultar los roles.');
    if (!Array.isArray(roles) || !roles.length) throw new Error('No hay roles disponibles para esta cuenta. Revisa los permisos de lectura con backend.');
    const profiles = [];
    let offset = 0;
    let total = null;
    do {
      const result = await client.from('perfiles')
        .select(PROFILE_COLUMNS, { count: 'exact' })
        .order('fecha_creacion', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      const rows = checkResult(result, 'No se pudo cargar la lista de usuarios.');
      if (!Array.isArray(rows) || !Number.isInteger(result.count) || result.count < 0) {
        throw new Error('La respuesta de perfiles no incluyó una lista y un total válidos.');
      }
      total = result.count;
      if (!rows.length && offset < total) throw new Error('La lista llegó incompleta. Actualiza para volver a consultar.');
      profiles.push(...rows);
      offset += rows.length;
    } while (offset < total);
    // Un cambio concurrente de la lista no debe producir filas duplicadas.
    const unique = new Map(profiles.map(profile => [profile.id, profile]));
    if (unique.size !== profiles.length) throw new Error('La lista cambió mientras se consultaba. Actualiza para obtenerla de nuevo.');
    return { perfiles: profiles, roles };
  }

  async function updateUser(userId, operation, value) {
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error('Selecciona un identificador de usuario válido.');
    }
    if (operation === 'role' && (!Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > 32767)) throw new Error('Selecciona un rol válido.');
    if (operation === 'status' && typeof value !== 'boolean') throw new Error('Selecciona un estado válido.');
    const actor = await validateActor();
    if (actor.id === userId) throw new Error('No puedes cambiar el rol ni el estado de tu propia cuenta desde este panel.');
    const isRole = operation === 'role';
    const result = await client.rpc(isRole ? 'admin_cambiar_rol_usuario' : 'admin_cambiar_estado_usuario', isRole ?
      { p_usuario_id: userId, p_rol_id: Number(value) } : { p_usuario_id: userId, p_activo: value });
    checkResult(result, 'No se pudo confirmar el cambio. Actualiza la lista antes de volver a intentarlo.');
  }

  return {
    listUsers,
    changeRole: (userId, roleId) => updateUser(userId, 'role', roleId),
    changeStatus: (userId, active) => updateUser(userId, 'status', active),
  };
}
