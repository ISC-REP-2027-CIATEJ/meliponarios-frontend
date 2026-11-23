import { accionesEquipo } from './workTeamActions.mjs';

const camposGrupo = 'id,zona_id,coordinador_id,nombre,descripcion,activo';
const camposPersona = 'id,nombre,apellidos,rol_id,activo';
const paginaRpc = 150;

export function crearApiEquipos({ client, authorize, rpc, readRows, failure, validId, acciones = accionesEquipo }) {
  function comprobarIds(...ids) {
    if (!ids.every(validId)) throw new Error('Vuelve a seleccionar el equipo, la zona o la persona.');
  }

  async function grupoActual(userId, grupoId, roles) {
    const rol = await authorize(userId, roles);
    comprobarIds(grupoId);
    let consulta = client.from('grupos_trabajo').select(camposGrupo).eq('id', grupoId);
    if (rol === 3) consulta = consulta.eq('coordinador_id', userId);
    const { data, error } = await consulta.maybeSingle();
    if (error) throw failure(error);
    if (!data) throw new Error('Este equipo ya no está disponible para tu cuenta.');
    return { rol, grupo: data };
  }

  async function filasRpc(nombre, filtros, orden) {
    const filas = [];
    for (;;) {
      let consulta = client.rpc(nombre, {});
      for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor);
      for (const campo of orden) consulta = consulta.order(campo);
      const { data, error } = await consulta.range(filas.length, filas.length + paginaRpc - 1);
      if (error) throw failure(error);
      if (!Array.isArray(data)) throw new Error('El servidor no devolvió la lista esperada.');
      if (!data.length) return filas;
      filas.push(...data);
    }
  }

  return {
    async directorio(userId) {
      const rol = await authorize(userId, [1, 3]);
      const esAdmin = rol === 1;
      const [grupos, zonas, coordinadores, trabajadores] = await Promise.all([
        readRows('grupos_trabajo', camposGrupo, 'id', esAdmin ? {} : { coordinador_id: userId }),
        readRows('zonas', 'id,nombre,codigo,activo', 'id'),
        esAdmin ? readRows('perfiles', camposPersona, 'id', { rol_id: 3 }) : [],
        esAdmin ? readRows('perfiles', camposPersona, 'id', { rol_id: 4 }) : [],
      ]);
      return { rol, grupos, zonas, coordinadores, trabajadores };
    },

    async integrantes(userId, grupoId) {
      const { rol, grupo } = await grupoActual(userId, grupoId, [1, 3]);
      if (rol === 1) {
        const filas = await readRows('grupos_trabajo_miembros', 'id,trabajador_id,fecha_inicio,fecha_fin',
          'id', { grupo_id: grupo.id });
        const hoy = Date.now();
        return filas.filter(fila => Date.parse(fila.fecha_inicio) <= hoy
          && (!fila.fecha_fin || hoy < Date.parse(fila.fecha_fin)))
          .map(fila => ({ usuario_id: fila.trabajador_id, fecha_inicio: fila.fecha_inicio }));
      }
      const [miembros, asignados] = await Promise.all([
        filasRpc('coord_mis_grupos_trabajadores', { grupo_id: grupo.id }, ['usuario_id','fecha_inicio']),
        filasRpc('coord_listar_personal_zona', { zona_id: grupo.zona_id }, ['usuario_id','asignacion_id']),
      ]);
      const ids = new Set(asignados.map(persona => persona.usuario_id));
      return miembros.map(persona => ({ ...persona, enZona: ids.has(persona.usuario_id) }));
    },

    async historial(userId, grupoId, pagina = 0) {
      await grupoActual(userId, grupoId, [1, 3]);
      const limite = 8;
      const desde = pagina * limite;
      const { data, error } = await client.rpc('historial_grupo_trabajo', { p_grupo_id: grupoId })
        .order('fecha_evento', { ascending: false }).order('evento_id')
        .range(desde, desde + limite);
      if (error) throw failure(error);
      if (!Array.isArray(data)) throw new Error('No se pudo comprobar el historial.');
      return { filas: data.slice(0, limite), siguiente: data.length > limite };
    },

    async guardarGrupo(userId, original, valores) {
      await authorize(userId, [1]);
      const accion = original ? acciones.editar : acciones.crear;
      if (!accion) throw new Error('Falta confirmar la acción de equipos indicada en la guía de instalación.');
      comprobarIds(valores.zonaId, valores.coordinadorId);
      if (!valores.nombre.trim()) throw new Error('Escribe el nombre del equipo.');
      if (original) {
        const { grupo } = await grupoActual(userId, original.id, [1]);
        if (['nombre','descripcion','zona_id','coordinador_id','activo'].some(campo => grupo[campo] !== original[campo])) {
          throw new Error('El equipo cambió. Actualiza sus datos antes de editar.');
        }
      }
      return rpc('admin_gestionar_grupo_trabajo', {
        p_accion: accion, p_grupo_id: original?.id ?? null, p_zona_id: valores.zonaId,
        p_coordinador_id: valores.coordinadorId, p_nombre: valores.nombre.trim(),
        p_descripcion: valores.descripcion.trim() || null,
      }, true);
    },

    async cambiarMiembro(userId, grupoId, trabajadorId, agregar) {
      comprobarIds(grupoId, trabajadorId);
      if (typeof agregar !== 'boolean') throw new Error('Selecciona la acción del integrante.');
      const { grupo } = await grupoActual(userId, grupoId, [1]);
      if (!grupo.activo) throw new Error('El equipo está inactivo.');
      return rpc('gestionar_miembro_grupo_trabajo', {
        p_grupo_id: grupo.id, p_trabajador_id: trabajadorId, p_agregar: agregar,
      }, true);
    },

    async asignarPersonal(userId, grupoId, zonaId, trabajadorId, asignar) {
      comprobarIds(grupoId, zonaId, trabajadorId);
      if (typeof asignar !== 'boolean') throw new Error('Selecciona la acción territorial.');
      const { grupo } = await grupoActual(userId, grupoId, [3]);
      if (!grupo.activo || grupo.zona_id !== zonaId) throw new Error('Cambió la zona o el estado del equipo. Actualiza la lista.');
      const miembros = await filasRpc('coord_mis_grupos_trabajadores',
        { grupo_id: grupo.id, usuario_id: trabajadorId }, ['fecha_inicio']);
      if (!miembros.length) throw new Error('Este trabajador ya no pertenece a tu equipo.');
      return rpc('gestionar_asignacion_personal_zona', {
        p_usuario_id: trabajadorId, p_zona_id: grupo.zona_id, p_asignado: asignar,
      }, true);
    },

    async sincronizarZona(userId, grupoId, zonaId) {
      comprobarIds(grupoId, zonaId);
      const { grupo } = await grupoActual(userId, grupoId, [3]);
      if (!grupo.activo || grupo.zona_id !== zonaId) throw new Error('Cambió la zona o el estado del equipo. Actualiza la lista.');
      return rpc('asignar_grupo_trabajo_zona', { p_grupo_id: grupo.id }, true,
        value => typeof value === 'object' && !Array.isArray(value));
    },
  };
}
