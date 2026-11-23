import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearApiEquipos } from '../src/features/territory/workTeamsApi.mjs';

const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const [actor, otro, grupo, zona, trabajador] = [1, 2, 3, 4, 5].map(uid);
const base = { id: grupo, zona_id: zona, coordinador_id: actor, nombre: 'Equipo de prueba', activo: true, descripcion: null };

function simular(rol, opciones = {}) {
  const escrituras = [];
  const consultas = [];
  const tablas = {
    grupos_trabajo: [base, { ...base, id: uid(10), coordinador_id: otro }],
    grupos_trabajo_miembros: [
      { id: uid(20), grupo_id: grupo, trabajador_id: trabajador, fecha_inicio: '2020-01-01', fecha_fin: null },
      { id: uid(21), grupo_id: grupo, trabajador_id: otro, fecha_inicio: '2020-01-01', fecha_fin: '2020-02-01' },
    ],
    perfiles: [{ id: trabajador, rol_id: 4, activo: true }, { id: actor, rol_id: 3, activo: true }],
    zonas: [{ id: zona, nombre: 'Zona de prueba', activo: true }],
    coord_mis_grupos_trabajadores: [{ grupo_id: grupo, usuario_id: trabajador }],
    coord_listar_personal_zona: [{ zona_id: zona, usuario_id: trabajador, asignacion_id: uid(30) }],
    historial_grupo_trabajo: Array.from({ length: 9 }, (_, i) => ({ evento_id: uid(100+i) })),
    ...opciones.tablas,
  };
  const filtrar = (filas, filtros) => filas.filter(f => Object.entries(filtros).every(([clave,v]) => f[clave] === v));
  function lista(origen) {
    const filtros = {};
    const obj = {
      select() { return obj; }, order() { return obj; },
      eq(campo, valor) { filtros[campo] = valor; return obj; },
      async maybeSingle() { return { data: filtrar(tablas[origen],filtros)[0] ?? null, error: null }; },
      async range(desde,hasta) { consultas.push({ origen, desde, filtros: { ...filtros } });
        return { data: filtrar(tablas[origen],filtros).slice(desde,hasta+1), error: null }; },
    };
    return obj;
  }
  const api = crearApiEquipos({
    client: { from: lista, rpc: lista },
    authorize: async (id, permitidos) => {
      if (id !== actor || !permitidos.includes(rol)) throw new Error('Sin permiso');
      return rol;
    },
    rpc: async (nombre,args) => { escrituras.push({ nombre,args }); return grupo; },
    readRows: async (origen,campos,_key, filtros = {}) => {
      consultas.push({origen,campos,filtros});
      return filtrar(tablas[origen],filtros);
    },
    failure: err => new Error(err.message),
    validId: id => typeof id === 'string' && id.startsWith('00000000-0000-4000-8000-'),
    acciones: opciones.acciones ?? { crear: 'alta_confirmada_en_prueba', editar: 'edicion_confirmada_en_prueba' },
  });
  return { api, escrituras, consultas };
}

test('la coordinación consulta sus equipos y evita el directorio de perfiles administrativos', async () => {
  const { api, consultas } = simular(3);
  const datos = await api.directorio(actor);
  assert.deepEqual(datos.grupos.map(g => g.id), [grupo]);
  assert.ok(!consultas.some(c => c.origen === 'perfiles'));
});

test('Administración conserva integrantes vigentes y permite el historial aparte', async () => {
  const { api } = simular(1);
  assert.deepEqual((await api.integrantes(actor,grupo)).map(p => p.usuario_id), [trabajador]);
  const primera = await api.historial(actor,grupo);
  assert.ok(primera.siguiente);
  assert.equal(primera.filas.length,8);
  const ultima = await api.historial(actor,grupo,1);
  assert.equal(ultima.filas.length,1);
  assert.ok(!ultima.siguiente);
});

test('la misma persona puede incorporarse a un segundo equipo', async () => {
  const { api, escrituras } = simular(1);
  await api.cambiarMiembro(actor,uid(10),trabajador,true);
  assert.deepEqual(escrituras[0],{nombre:'gestionar_miembro_grupo_trabajo',args:{
    p_grupo_id:uid(10),p_trabajador_id:trabajador,p_agregar:true,
  }});
});

test('la acción de creación procede del contrato y solo escribe una vez', async () => {
  const { api, escrituras } = simular(1);
  await api.guardarGrupo(actor,null,{ zonaId:zona,coordinadorId:actor,nombre:' Equipo ',descripcion:'' });
  assert.deepEqual(escrituras,[{nombre:'admin_gestionar_grupo_trabajo',args:{
    p_accion:'alta_confirmada_en_prueba',p_grupo_id:null,p_zona_id:zona,p_coordinador_id:actor,
    p_nombre:'Equipo',p_descripcion:null,
  }}]);
});

test('una acción pendiente de verificar y un rol no autorizado detienen la escritura', async () => {
  const { api, escrituras } = simular(1,{ acciones:{ crear:null,editar:null } });
  await assert.rejects(api.guardarGrupo(actor,null,{}),/confirmar la acción/);
  assert.equal(escrituras.length,0);
  const coord = simular(3);
  await assert.rejects(coord.api.cambiarMiembro(actor,grupo,trabajador,true),/Sin permiso/);
  assert.equal(coord.escrituras.length,0);
  await assert.rejects(simular(4).api.directorio(actor),/Sin permiso/);
});

test('el coordinador solo actúa dentro del grupo y de la zona que confirmó', async () => {
  const { api, escrituras } = simular(3);
  assert.ok((await api.integrantes(actor,grupo))[0].enZona);
  await assert.rejects(api.asignarPersonal(actor,uid(10),zona,trabajador,true),/no está disponible/);
  await assert.rejects(api.asignarPersonal(actor,grupo,uid(11),trabajador,true),/Cambió la zona/);
  await assert.rejects(api.asignarPersonal(actor,grupo,zona,otro,false),/no pertenece/);
  assert.equal(escrituras.length,0);
  await api.asignarPersonal(actor,grupo,zona,trabajador,false);
  assert.deepEqual(escrituras[0],{ nombre:'gestionar_asignacion_personal_zona',
    args:{p_usuario_id:trabajador,p_zona_id:zona,p_asignado:false} });
});

test('sincronizar delega el grupo completo a Supabase, sin escrituras en bucle', async () => {
  const { api, escrituras } = simular(3);
  await api.sincronizarZona(actor,grupo,zona);
  assert.deepEqual(escrituras,[{nombre:'asignar_grupo_trabajo_zona',args:{p_grupo_id:grupo}}]);
});

test('un cambio concurrente de responsable impide editar datos obsoletos', async () => {
  const { api, escrituras } = simular(1);
  await assert.rejects(api.guardarGrupo(actor,{ ...base, coordinador_id: otro },
    { zonaId:zona,coordinadorId:actor,nombre:'A',descripcion:'' }),/equipo cambió/);
  assert.equal(escrituras.length,0);
});
