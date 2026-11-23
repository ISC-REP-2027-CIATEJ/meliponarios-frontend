export function createAdminAccountsApi(client) {
  async function invoke(action, values) {
    if (!client) throw new Error('Falta configurar la conexión pública de Supabase.');
    const { data, error } = await client.functions.invoke('admin-accounts', { body: { ...values, action } });
    let payload = data;
    if (error?.context && typeof error.context.json === 'function') {
      try { payload = await error.context.json(); } catch { /* La red puede impedir leer el detalle. */ }
    }
    if (error || payload?.ok !== true) {
      const detail = payload?.error;
      const failure = new Error(detail?.message || 'No se pudo contactar con la función administrativa. Comprueba que admin-accounts esté desplegada y que permita el origen de tu web.');
      failure.code = detail?.code || 'ADMIN_FUNCTION_UNAVAILABLE';
      failure.partial = detail?.partial === true;
      failure.userId = detail?.userId;
      failure.profileSaved = detail?.profileSaved === true;
      throw failure;
    }
    return payload;
  }
  return {
    detail: userId => invoke('detail', { userId }),
    updateProfile: (userId, values) => invoke('profile', { userId, nombre: values.nombre, apellidos: values.apellidos, telefono: values.telefono }),
    changeEmail: (userId, email) => invoke('email', { userId, email }),
    changePassword: (userId, password) => invoke('password', { userId, password }),
    create: values => invoke('create', { nombre: values.nombre, apellidos: values.apellidos, telefono: values.telefono, email: values.email, password: values.password, roleId: Number(values.roleId), active: values.active, confirmEmail: values.confirmEmail }),
  };
}
