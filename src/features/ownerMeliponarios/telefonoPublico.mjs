export function normalizarTelefonoPublico(valor) {
  const telefono = String(valor ?? '').replace(/[\s()-]/g, '');
  if (!/^[0-9]{10}$/.test(telefono)) throw new Error('Escribe los 10 dígitos del teléfono, incluida la lada. Puedes usar espacios o guiones.');
  return telefono;
}

export async function guardarTelefonoPublico(client, userId, meliponarioId, valor) {
  const telefono = normalizarTelefonoPublico(valor);
  const sesion = await client.auth.getUser();
  if (sesion.error || !sesion.data?.user?.id || sesion.data.user.id !== userId) throw new Error('Inicia sesión nuevamente con la cuenta propietaria.');
  const { error } = await client.rpc('cliente_actualizar_telefono_contacto', {
    p_meliponario_id: meliponarioId, p_telefono: telefono,
  });
  if (error) throw new Error('Supabase no confirmó la actualización del teléfono. Actualiza tu registro para comprobarlo.');
  return telefono;
}
