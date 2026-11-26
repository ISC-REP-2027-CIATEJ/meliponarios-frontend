import { validId } from '../territory/territoryApi.mjs';

export function crearBorradoresApi(cliente) {
  async function autorizar(usuario) {
    if (!validId(usuario)) throw new Error('Inicia sesión con la cuenta propietaria.');
    const sesion = await cliente.auth.getUser();
    if (sesion.error || sesion.data?.user?.id !== usuario) throw new Error('La sesión cambió. Vuelve a entrar con la cuenta propietaria.');
    const perfil = await cliente.from('perfiles').select('id,rol_id,activo').eq('id', usuario).maybeSingle();
    if (perfil.error || perfil.data?.id !== usuario || perfil.data.activo !== true || Number(perfil.data.rol_id) !== 5) {
      throw new Error('Se requiere una cuenta Cliente activa.');
    }
  }
  function fallo(error) {
    if (['PGRST202', '42883'].includes(error?.code)) return new Error('La eliminación de borradores todavía no está habilitada por el responsable del sistema.');
    if (error?.code === '42501') return new Error('El registro no está disponible para esta cuenta. Actualiza Mis meliponarios.');
    if (error?.code === '22023') return new Error('El registro cambió o contiene información que debe conservarse. Vuelve a comprobarlo.');
    if (error?.code === '23503') return new Error('El registro tiene información vinculada. No se eliminó; solicita apoyo al responsable del sistema.');
    return Object.assign(new Error('No se confirmó la eliminación. Comprueba el registro antes de intentarlo otra vez.'), { incierto: true });
  }
  return {
    async consultar(usuario, registro) {
      if (!validId(registro)) throw new Error('Vuelve a seleccionar el borrador.');
      await autorizar(usuario);
      const { data, error } = await cliente.rpc('cliente_estado_borrador_eliminable', { p_meliponario_id: registro }).maybeSingle();
      if (error) throw fallo(error);
      if (data?.meliponario_id !== registro || typeof data.puede_eliminar !== 'boolean' ||
          !Number.isSafeInteger(data.cantidad_fotos) || data.cantidad_fotos < 0 || typeof data.motivo_bloqueo !== 'string') {
        throw new Error('No se pudo comprobar si este borrador puede eliminarse.');
      }
      return { puedeEliminar: data.puede_eliminar, fotos: data.cantidad_fotos, motivo: data.motivo_bloqueo };
    },
    async eliminar(usuario, registro) {
      if (!validId(registro)) throw new Error('Vuelve a seleccionar el borrador.');
      await autorizar(usuario);
      let resultado;
      try { resultado = await cliente.rpc('cliente_eliminar_borrador_meliponario', { p_meliponario_id: registro }); }
      catch { throw fallo(null); }
      if (resultado.error) throw fallo(resultado.error);
      if (resultado.data !== registro) throw fallo(null);
      return registro;
    },
  };
}

