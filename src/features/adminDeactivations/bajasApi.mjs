import { validId } from '../territory/territoryApi.mjs';

export function crearBajasApi(cliente) {
  async function autorizar(usuario) {
    if(!validId(usuario))throw new Error('Inicia sesión con la cuenta administradora.');
    const sesion=await cliente.auth.getUser();
    if(sesion.error || sesion.data?.user?.id!==usuario)throw new Error('La sesión cambió. Vuelve a iniciar sesión.');
    const {data,error}=await cliente.from('perfiles').select('id,rol_id,activo').eq('id',usuario).maybeSingle();
    if(error || data?.id!==usuario || data.activo!==true || Number(data.rol_id)!==1)throw new Error('Se requiere una cuenta activa de administrador general.');
  }
  return {
    async resolver(usuario,solicitud,decision,comentario) {
      const nota=comentario.trim();
      if(!validId(solicitud)||!['aprobar','rechazar'].includes(decision)||Array.from(nota).length<10||Array.from(nota).length>1000){
        throw new Error('Selecciona una decisión y escribe un comentario de 10 a 1000 caracteres.');
      }
      await autorizar(usuario);
      let respuesta;
      try {
        respuesta=await cliente.rpc('admin_resolver_desactivacion_meliponario',{
          p_solicitud_id:solicitud,p_decision:decision,p_comentario:nota,
        });
      } catch {throw Object.assign(new Error('No se confirmó la resolución. Actualiza las solicitudes antes de volver a intentarlo.'),{incierto:true});}
      if(respuesta.error||respuesta.data!==solicitud) {
        throw Object.assign(new Error(respuesta.error?.code==='42501'?'Tu cuenta ya no tiene permiso para resolver esta solicitud.'
          :respuesta.error?.code==='22023'?'La solicitud pudo cambiar o ya fue resuelta. Actualiza la bandeja.'
            :'No se confirmó la resolución. Actualiza la bandeja para comprobar el resultado.'),{incierto:!respuesta.error?.code});
      }
      return solicitud;
    },
    async pendientes(usuario) {
      await autorizar(usuario);
      const solicitudes=[];
      const vistos=new Set();
      for(;;){
        const {data,error}=await cliente.rpc('admin_bandeja_desactivaciones_meliponario')
          .order('fecha_solicitud',{ascending:false}).order('solicitud_id').range(solicitudes.length,solicitudes.length+99);
        if(error)throw new Error(['PGRST202','42883'].includes(error.code)
          ? 'El servicio de solicitudes de baja aún no está habilitado. Consulta con el responsable del backend.'
          : 'No se pudieron consultar las solicitudes de baja. Actualiza para volver a intentarlo.');
        if(!Array.isArray(data))throw new Error('La respuesta de solicitudes está incompleta.');
        if(!data.length)return solicitudes;
        for(const fila of data){
          if(!validId(fila.solicitud_id)||!validId(fila.meliponario_id)||vistos.has(fila.solicitud_id)||
              typeof fila.nombre_meliponario!=='string'||typeof fila.motivo!=='string'||!Number.isFinite(Date.parse(fila.fecha_solicitud))){
            throw new Error('La respuesta de solicitudes está incompleta. Actualiza antes de continuar.');
          }
          vistos.add(fila.solicitud_id);
          solicitudes.push({id:fila.solicitud_id,registro:fila.meliponario_id,nombre:fila.nombre_meliponario,
            cliente:[fila.cliente_nombre,fila.cliente_apellidos].filter(Boolean).join(' ')||'Nombre no disponible',
            motivo:fila.motivo,fecha:fila.fecha_solicitud});
        }
      }
    },
  };
}
