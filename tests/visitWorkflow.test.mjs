import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFlujoVisitas } from '../src/features/technicalAssignments/visitWorkflow.mjs';

const registro = '11111111-1111-4111-8111-111111111111';
const equipo = '22222222-2222-4222-8222-222222222222';
const trabajador = '33333333-3333-4333-8333-333333333333';
const visita = '44444444-4444-4444-8444-444444444444';

function cliente(responder) {
  const llamadas = [];
  const client = { rpc(nombre, args) {
    llamadas.push({ nombre, args });
    return responder(nombre, args);
  } };
  return { flujo: crearFlujoVisitas(client), llamadas };
}

test('primera visita por equipo usa la firma explícita y los tres identificadores seleccionados', async () => {
  const { flujo, llamadas } = cliente(() => ({ data: visita }));
  assert.equal(await flujo.asignar(registro, equipo, trabajador, ' Prueba de visita '), visita);
  assert.deepEqual(llamadas[0], { nombre: 'coord_asignar_visita_grupo', args: {
    p_meliponario_id: registro, p_grupo_id: equipo, p_trabajador_id: trabajador,
    p_tipo_visita: 'levantamiento_tecnico', p_motivo: 'Prueba de visita',
  } });
});

test('una corrección requiere indicaciones y los errores de permiso llegan a la interfaz', async () => {
  const { flujo, llamadas } = cliente(() => ({ error: { message: 'Sin acceso a esta visita' } }));
  assert.throws(() => flujo.resolver(visita, 'solicitar_correccion', ' '));
  assert.equal(llamadas.length, 0);
  await assert.rejects(flujo.resolver(visita, 'solicitar_correccion', ' Revisar inventario '), /Sin acceso/);
  assert.equal(llamadas[0].args.p_comentario, 'Revisar inventario');
});

test('la aprobación solo envía la decisión técnica', async () => {
  const { flujo, llamadas } = cliente(() => ({ data: visita }));
  await flujo.tomar(visita);
  await flujo.resolver(visita, 'aprobar', '');
  assert.deepEqual(llamadas.map(x => x.nombre), ['coord_tomar_formulario_tecnico','coord_resolver_formulario_tecnico']);
  assert.equal(llamadas[1].args.p_decision, 'aprobar');
});

test('conserva varias respuestas, Otro y valores negativos en la revisión', async () => {
  const respuestas = { techo: ['madera', 'otro'], otro: 'Material de prueba', alimenta: false };
  const { flujo } = cliente(nombre => ({ data: nombre === 'obtener_formulario_tecnico' ? { especies: [1] } : respuestas }));
  assert.deepEqual((await flujo.detalle(visita)).respuestas, respuestas);
});

test('bloquea la revisión ante respuestas ausentes y una escritura sin confirmación', async () => {
  const { flujo } = cliente(() => ({ data: {} }));
  await assert.rejects(flujo.detalle(visita), /respuestas/);
  await assert.rejects(flujo.tomar(visita), /confirmó/);
});

test('solo ofrece personas de la RPC de equipo y continúa después de una página corta', async () => {
  const { flujo, llamadas } = cliente(() => ({order: () => ({range: desde => ({ data: desde ? [] : [{ usuario_id: trabajador }] })})}));
  assert.equal((await flujo.trabajadores(registro, equipo)).length, 1);
  assert.equal(llamadas.length, 2);
  assert.deepEqual(llamadas[0], {nombre: 'coord_trabajadores_grupo_visita', args: {p_meliponario_id: registro, p_grupo_id: equipo}});
});
