import test from 'node:test';
import assert from 'node:assert/strict';
import { completarInventario } from '../src/features/publicMeliponarios/inventarioPublico.mjs';
import { bandejaCoordinacion } from '../src/features/technicalAssignments/bandejaCoordinacion.mjs';
import { guardarTelefonoPublico, normalizarTelefonoPublico } from '../src/features/ownerMeliponarios/telefonoPublico.mjs';
import { crearApiPublica } from '../src/features/publicMeliponarios/publicApi.mjs';

const id = n => 'c0000000-0000-4000-8000-' + String(n).padStart(12, '0');
test('el propietario guarda 10 dígitos y conserva un cero inicial', async () => {
  let envio;
  const cliente = { auth: { getUser: async () => ({ data: { user: { id: id(1) } } }) },
    rpc: async (rpc, args) => { envio = [rpc, args]; return { error: null }; } };
  assert.equal(await guardarTelefonoPublico(cliente,id(1),id(2),'(012) 345-6789'), '0123456789');
  assert.deepEqual(envio, ['cliente_actualizar_telefono_contacto', { p_meliponario_id: id(2), p_telefono: '0123456789' }]);
  envio = null;
  await assert.rejects(guardarTelefonoPublico(cliente,id(3),id(2),'0123456789'));
  assert.equal(envio, null);
  for (const valor of ['', '12', '123456789a', '+521234567890']) assert.throws(() => normalizarTelefonoPublico(valor));
});
function inventario(vendeMiel, falla = false) {
  const llamadas = [];
  const cliente = { rpc(nombre, args) {
    assert.equal(args.p_meliponario_id, id(2));
    llamadas.push(nombre);
    const abejas = nombre === 'listar_especies_meliponario_publicas';
    const data = abejas ? [{ especie_id: id(1), nombre_comun: 'Xunán kab', cantidad_cajas: 0, cantidad_jobones: 2, interno: 'privado' }]
      : ['disponible','bajo_pedido','no_disponible','disponible'].map((estado,i) =>
        ({ producto_id: id(i+1), producto_activo: i !== 3, nombre: String(i), estado, comentario: 'privado' }));
    return { order() { return this; }, limit() { return this; }, gt() { return Promise.resolve({data:[]}); },
      then(ok) { return Promise.resolve(falla && abejas ? {error: {}} : {data}).then(ok); } };
  } };
  return { resultado: completarInventario(cliente, { id: id(2), vendeMiel }), llamadas };
}
test('la ficha pública muestra inventario real y solo la oferta activa', async () => {
  const f = await inventario(true).resultado;
  assert.deepEqual(f.especies, ['Xunán kab']);
  assert.equal(f.abejas[0].cajas, 0);
  assert.deepEqual(f.productos, ['0','1']);
  assert.equal(f.productosPublicos[1].disponibilidad, 'Bajo pedido');
  assert.ok(!JSON.stringify(f).includes('privado'));
});
test('solo visitas omite la lectura de productos y distingue un fallo de inventario', async () => {
  const q = inventario(false,true);
  const f = await q.resultado;
  assert.deepEqual(q.llamadas, ['listar_especies_meliponario_publicas']);
  assert.equal(f.especiesDisponibles,false);
  assert.deepEqual(f.productos,[]);
});
test('la ficha fuera de operación queda fuera de la lectura por ID', async () => {
  const api = crearApiPublica({rpc: () => ({order() {return this;}, range() {return { data: [{
    id:id(1),nombre:'Registro', telefono_contacto:null, ofrece_venta_miel:false, ofrece_visitas:true,
    latitud:20, longitud:-89, informacion_tecnica_verificada:true, estado_operativo:'fuera_de_operacion',
  }]};}})});
  assert.equal(await api.ficha(id(1)),null);
});
test('una ficha técnica pendiente y un GPS ausente quedan fuera por ID y del listado', async () => {
  const base = { nombre:'Visita', telefono_contacto:null, ofrece_venta_miel:false, ofrece_visitas:true,
    latitud:20, longitud:-89, informacion_tecnica_verificada:true };
  const datos = [{...base,id:id(1),informacion_tecnica_verificada:false}, {...base,id:id(2),latitud:null}, {...base,id:id(3)}];
  const api = crearApiPublica({rpc: (_, args) => ({order() {return this;}, range(inicio) {
    return {data: args.p_id ? datos.filter(r => r.id === args.p_id) : inicio ? [] : datos};
  }})});
  assert.equal(await api.ficha(id(1)),null); assert.equal(await api.ficha(id(2)),null);
  assert.deepEqual((await api.listar()).map(r => r.id),[id(3)]);
});
test('una visita terminada y una vigente conviven en la misma bandeja', async () => {
  const visitas = [1,2].map(n => ({ asignacion_id:id(n), meliponario_id:id(3), trabajador_id:id(4), estado:n===1?'completada':'asignada' }));
  const flujo = { historial:async () => visitas, agenda:async () => [{ meliponario_id:id(3), asignacion_activa_id:id(2), trabajador_actual:'María' }],
    pendientes:async () => [{ meliponario_id:id(3) }], miembros:async () => [] };
  const r = await bandejaCoordinacion(flujo);
  assert.deepEqual(r.assignments.map(a => a.cancelable),[false,true]);
  assert.equal(r.assignments[1].trabajadorNombre,'María'); assert.equal(r.pending.length,0);
  flujo.historial = async () => { throw Error(); };
  const parcial = await bandejaCoordinacion(flujo);
  assert.equal(parcial.avisos.length,1); assert.equal(parcial.assignments[0].vigente,true);
  assert.equal(parcial.assignments[0].cancelable,false);
});
