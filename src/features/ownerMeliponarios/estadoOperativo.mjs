import { validId } from '../territory/territoryApi.mjs';

export const estadosOperativos = Object.freeze({
  activo: 'Activo',
  inactivo: 'Inactivo',
  temporalmente_suspendido: 'Suspendido temporalmente',
  fuera_de_operacion: 'Fuera de operación',
});
const errorEstado = (mensaje, datos = {}) => Object.assign(new Error(mensaje), datos);

export function crearEstadoOperativo(cliente) {
  async function sesion(usuario) {
    const { data, error } = await cliente.auth.getUser();
    if (error || !validId(usuario) || data?.user?.id !== usuario) {
      throw errorEstado('Vuelve a iniciar sesión con la cuenta propietaria.');
    }
  }
  async function consultar(usuario, registro) {
    if (!validId(registro)) throw errorEstado('Vuelve a abrir el registro desde Mis meliponarios.');
    const { data, error } = await cliente.from('meliponarios')
      .select('id,responsable_principal_id,estado_operativo').eq('id', registro)
      .eq('responsable_principal_id', usuario).maybeSingle();
    if (error || data?.id !== registro || data.responsable_principal_id !== usuario ||
        !Object.hasOwn(estadosOperativos, data.estado_operativo)) {
      throw errorEstado('No se pudo comprobar el estado de este registro en tu cuenta.');
    }
    return { id: data.id, estadoOperativo: data.estado_operativo };
  }
  return {
    async consultar(usuario, registro) {
      await sesion(usuario);
      return consultar(usuario, registro);
    },
    async guardar(usuario, registro, esperado, estado) {
      if (!Object.hasOwn(estadosOperativos, estado)) throw errorEstado('Selecciona un estado de la lista.');
      await sesion(usuario);
      const anterior = await consultar(usuario, registro);
      if (anterior.estadoOperativo !== esperado) {
        throw errorEstado('El estado cambió desde que abriste el registro. Revisa el valor actualizado antes de continuar.', { actual: anterior });
      }
      let respuesta;
      try {
        respuesta = await cliente.rpc('cliente_actualizar_estado_operativo', {
          p_meliponario_id: registro, p_estado_operativo: estado,
        });
      } catch {
        throw errorEstado('No se pudo confirmar el guardado. Pulsa Comprobar estado para consultar el resultado.', { incierto: true });
      }
      if (respuesta.error) {
        throw errorEstado(respuesta.error.code === '42501' ? 'Tu cuenta ya no tiene permiso para actualizar este registro.'
          : 'No se confirmó el cambio de estado. Comprueba el resultado antes de reintentarlo.', { incierto: !respuesta.error.code });
      }
      let actual;
      try { actual = await consultar(usuario, registro); }
      catch { throw errorEstado('El cambio fue enviado. Falta comprobar el estado guardado.', { incierto: true }); }
      if (actual.estadoOperativo !== estado) {
        throw errorEstado('El estado guardado difiere del seleccionado. Revisa el valor actualizado.', { actual });
      }
      return actual;
    },
  };
}
