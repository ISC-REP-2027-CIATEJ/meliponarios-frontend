import test from 'node:test';
import assert from 'node:assert/strict';
import { crearOfertaReal } from '../src/features/ownerMeliponarios/ofertaReal.mjs';
import { crearFlujoVisitas } from '../src/features/technicalAssignments/visitWorkflow.mjs';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
function clientePrueba() {
  const llamadas = [];
  const catalogo = [{ id:id(1), nombre:'Miel' }, { id:id(2), nombre:'Cerumen' }];
  const relaciones = new Map();
  const cliente = {
    auth: { getUser: async () => ({data:{user:{id:id(10)}}}) },
    rpc(nombre, args) {
      llamadas.push([nombre,args]);
      if (nombre === 'guardar_producto_meliponario') {
        const lista = relaciones.get(args.p_meliponario_id) || new Map();
        lista.set(args.p_producto_id, { producto_id:args.p_producto_id, nombre:'Miel', estado:args.p_estado, producto_activo:true });
        relaciones.set(args.p_meliponario_id,lista);
        return Promise.resolve({data:id(50)});
      }
      const lista = nombre === 'listar_catalogo_productos' ? catalogo : [...(relaciones.get(args.p_meliponario_id)?.values() || [])];
      let campo, cursor;
      return {
        order(c) { campo=c; return this; }, limit() { return this; },
        gt(c,v) { assert.equal(c,campo); cursor=v; return this; },
        then(resolve) { resolve({data:lista.filter(f => !cursor || f[campo]>cursor).slice(0,1)}); },
      };
    },
  };
  return { api:crearOfertaReal(cliente), llamadas, cliente };
}

test('el cliente recupera todo el catálogo desde su RPC con paginación y orden por nombre', async () => {
  const { api, llamadas } = clientePrueba();
  const { catalogo, oferta } = await api.leer(id(10),id(20));
  assert.deepEqual(catalogo.map(p => p.nombre),['Cerumen','Miel']);
  assert.deepEqual(oferta,[]);
  assert.ok(llamadas.every(([rpc]) => !rpc.startsWith('admin_')));
});

test('guardar y actualizar la disponibilidad afecta solo al meliponario elegido', async () => {
  const { api, llamadas } = clientePrueba();
  for (const estado of ['disponible','bajo_pedido','no_disponible']) {
    await api.guardar(id(10),id(20),id(1),estado);
    const { oferta } = await api.leer(id(10),id(20));
    assert.equal(oferta.length,1);
    assert.equal(oferta[0].estado,estado);
    assert.deepEqual(llamadas.findLast(([n]) => n === 'guardar_producto_meliponario')[1], {
      p_meliponario_id:id(20),p_producto_id:id(1),p_estado:estado,
    });
  }
  assert.deepEqual((await api.leer(id(10),id(21))).oferta,[]);
});

test('rechaza registros aún sin guardar, sesión cambiada y estados ajenos al contrato', async () => {
  const { api, llamadas } = clientePrueba();
  await assert.rejects(api.leer(id(10),null));
  await assert.rejects(api.guardar(id(11),id(20),id(1),'disponible'));
  await assert.rejects(api.guardar(id(10),id(20),id(1),'desconocido'));
  assert.equal(llamadas.length,0);
});

test('comunica denegación o confirmación incompleta sin repetir escrituras', async () => {
  const { api, cliente } = clientePrueba();
  let veces = 0;
  cliente.rpc = async () => { veces++; return {error:new Error('Operación denegada')}; };
  await assert.rejects(api.guardar(id(10),id(20),id(1),'disponible'),/denegada/);
  cliente.rpc = async () => { veces++; return {data:null}; };
  await assert.rejects(api.guardar(id(10),id(20),id(1),'disponible'),/confirmación/);
  assert.equal(veces,2);
});

test('la selección por nombre contiene solo personal del equipo elegible para ese meliponario', async () => {
  const persona = n => ({usuario_id:id(n),nombre:'Trabajador '+n,apellidos:'Campo'});
  const rpc = (nombre,args) => {
    const elegibles = nombre === 'coord_trabajadores_para_visita';
    if (elegibles) assert.equal(args.p_meliponario_id,id(20));
    else assert.equal(nombre,'coord_mis_grupos_trabajadores');
    const filas = (elegibles ? [1,2] : [2,3]).map(persona);
    return { order(){return this;},range(n){return {data:n ? [] : filas};} };
  };
  assert.deepEqual(await crearFlujoVisitas({rpc}).candidatos(id(20)),[persona(2)]);
});
