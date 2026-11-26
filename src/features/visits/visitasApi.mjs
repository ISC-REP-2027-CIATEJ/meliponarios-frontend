import { validId } from '../territory/territoryApi.mjs';
import { fechaValida, hoyMexico } from './fechasVisita.mjs';

const calendarios = { 3:'coord_calendario_visitas_tecnicas', 4:'mis_visitas_tecnicas_calendario', 5:'cliente_mis_visitas_tecnicas' };
const desconocida = () => new Error('La respuesta de visitas está incompleta. Actualiza para comprobar los datos.');
export function crearVisitasApi(cliente) {
  async function autorizar(usuario, rol) {
    if (!validId(usuario) || !Object.hasOwn(calendarios, rol)) throw new Error('Esta cuenta no tiene acceso a la agenda.');
    const sesion = await cliente.auth.getUser();
    if (sesion.error || sesion.data?.user?.id !== usuario) throw new Error('La sesión cambió. Vuelve a iniciar sesión.');
    const {data, error} = await cliente.from('perfiles').select('id,rol_id,activo').eq('id',usuario).maybeSingle();
    if (error || data?.id !== usuario || data.activo !== true || Number(data.rol_id) !== rol) throw new Error('La agenda requiere una cuenta activa del rol correspondiente.');
  }
  async function ejecutar(consulta) {
    const {data,error} = await consulta;
    if (error) throw new Error(['PGRST202','42883'].includes(error.code)
      ? 'El servicio de agenda aún no está habilitado en este proyecto. Consulta con el responsable del backend.'
      : error.code === '42501' ? 'Tu cuenta ya no tiene acceso a estas visitas.' : 'No se pudo consultar la agenda. Actualiza para volver a intentarlo.');
    return data;
  }
  async function lista(nombre, args, orden) {
    const filas=[];
    let paginaAnterior='';
    for (;;) {
      let consulta=cliente.rpc(nombre,args);
      for (const [campo,ascendente] of orden) consulta=consulta.order(campo,{ascending:ascendente});
      const pagina=await ejecutar(consulta.range(filas.length,filas.length+99));
      if (!Array.isArray(pagina)) throw desconocida();
      if (!pagina.length) return filas;
      const huella=JSON.stringify(pagina);
      if (huella===paginaAnterior) throw desconocida();
      paginaAnterior=huella; filas.push(...pagina);
    }
  }
  return {
    async calendario(usuario,rol,inicio,fin) {
      if (!fechaValida(inicio) || !fechaValida(fin) || fin < inicio ||
          (Date.parse(fin)-Date.parse(inicio))/86400000 > 62) throw new Error('Consulta un intervalo de hasta 63 días.');
      await autorizar(usuario,rol);
      const rows=await lista(calendarios[rol],{p_fecha_inicio:inicio,p_fecha_fin:fin},[['fecha_programada',true],['asignacion_id',true]]);
      return rows.map(row => {
        if (!validId(row.asignacion_id) || !validId(row.meliponario_id) ||
            !Object.hasOwn(row,'hora_programada') || !fechaValida(row.fecha_programada) || row.fecha_programada < inicio || row.fecha_programada > fin ||
            typeof row.nombre_meliponario !== 'string' ||
            (row.hora_programada != null && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(row.hora_programada))) throw desconocida();
        return { id:row.asignacion_id, registro:row.meliponario_id, nombre:row.nombre_meliponario,
          fecha:row.fecha_programada,hora:row.hora_programada || null,tipo:row.tipo_visita,estado:row.estado_asignacion,
          localidad:rol === 5 ? '' : row.localidad_nombre,trabajador:rol === 3 ? row.trabajador_nombre : '',
          motivo:rol === 5 ? '' : row.motivo_asignacion, formulario:rol === 5 ? null : row.estado_formulario };
      });
    },
    async asignadas(usuario) {
      await autorizar(usuario,4);
      const rows=await lista('mis_visitas_tecnicas_trabajador_detalle',{},[['asignacion_id',true]]);
      if (!rows.every(r=>validId(r.asignacion_id)&&validId(r.meliponario_id)&&typeof r.nombre_meliponario==='string'&&Object.hasOwn(r,'fecha_programada')&&Object.hasOwn(r,'hora_programada'))) throw desconocida();
      return rows.map(r=>({id:r.asignacion_id,registro:r.meliponario_id,nombre:r.nombre_meliponario,
        localidad:r.localidad_nombre,tipo:r.tipo_visita,motivo:r.motivo_asignacion,formulario:r.estado_formulario,
        correccion:r.comentario_correccion,fecha:r.fecha_programada || null,hora:r.hora_programada || null}));
    },
    async registrosCoordinador(usuario) {
      await autorizar(usuario,3);
      const filas=await lista('coord_agenda_visitas_tecnicas',{},[['meliponario_id',true]]);
      return filas.filter(r=>validId(r.meliponario_id)).map(r=>({id:r.meliponario_id,nombre:r.nombre,localidad:r.localidad}));
    },
    async horarios(usuario,registro) {
      if (!validId(registro)) throw new Error('Elige un meliponario de la lista.');
      await autorizar(usuario,3);
      const rows=await lista('coord_historial_programacion_visitas',{p_meliponario_id:registro},[['fecha_cambio',false],['asignacion_id',true]]);
      return rows.map(r=>({id:r.asignacion_id,tipo:r.tipo_visita,trabajador:r.trabajador_nombre,actor:r.actor_nombre,
        anterior:r.fecha_anterior,horaAnterior:r.hora_anterior,fecha:r.fecha_nueva,hora:r.hora_nueva,
        motivo:r.motivo,cambio:r.fecha_cambio}));
    },
    async visitasAnteriores(usuario,registro) {
      if (!validId(registro)) throw new Error('Elige un meliponario de la lista.');
      await autorizar(usuario,3);
      const rows=await lista('coord_historial_visitas_tecnicas',{p_meliponario_id:registro},[['fecha_asignacion',false],['asignacion_id',false]]);
      return rows.map(r=>({id:r.asignacion_id,tipo:r.tipo_visita,trabajador:r.trabajador_nombre,
        estado:r.estado_asignacion,formulario:r.estado_formulario,fecha:r.fecha_asignacion,
        enviada:r.fecha_envio,aprobada:r.fecha_aprobacion,motivo:r.motivo_asignacion}));
    },
    async programar(usuario,asignacion,fecha,hora,motivo) {
      const nota=motivo.trim();
      if (!validId(asignacion) || !fechaValida(fecha) || fecha < hoyMexico() ||
          (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) || (nota && (Array.from(nota).length<10 || Array.from(nota).length>1000))) {
        throw new Error('Revisa la fecha, la hora y el motivo opcional de 10 a 1000 caracteres.');
      }
      await autorizar(usuario,4);
      let respuesta;
      try {respuesta=await cliente.rpc('trabajador_programar_visita_tecnica',{p_asignacion_id:asignacion,
        p_fecha_programada:fecha,p_hora_programada:hora || null,p_motivo:nota || null});}
      catch {throw Object.assign(new Error('No se confirmó el guardado. Comprueba la programación antes de reintentar.'),{incierto:true});}
      if (respuesta.error || respuesta.data!==asignacion) throw Object.assign(new Error(respuesta.error?.code==='42501'
        ? 'Tu cuenta ya no puede programar esta visita.' : 'No se confirmó la programación. Consulta el estado antes de reintentar.'),{incierto:!respuesta.error?.code});
      return asignacion;
    },
  };
}
