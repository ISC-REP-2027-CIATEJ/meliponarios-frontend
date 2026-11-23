import test from 'node:test';
import assert from 'node:assert/strict';
import { panelCoordinacion } from '../src/features/technicalAssignments/bandejaCoordinacion.mjs';

const id = n => '10000000-0000-4000-8000-' + String(n).padStart(12,'0');
function servicios() {
  return {
    agenda: async () => [],
    pendientes: async () => [{ meliponario_id: id(1), nombre:'Meliponario', zona_id:id(2), zona_nombre:'Norte' }],
    historial: async () => [], miembros: async () => [], revisiones: async () => [],
  };
}
test('el pendiente integrado conserva la zona necesaria para elegir equipo', async () => {
  const panel = await panelCoordinacion(servicios());
  assert.equal(panel.pending[0].zona_id,id(2));
  assert.equal(panel.pending[0].meliponario_id,id(1));
  assert.equal(panel.fuentes.revisiones,true);
  assert.equal(panel.revisiones.length,0);
});
test('fallar la bandeja de fichas permite consultar las asignaciones y señala el fallo', async () => {
  const flujo=servicios();
  flujo.revisiones=async () => { throw Error('Sin conexión'); };
  const panel=await panelCoordinacion(flujo);
  assert.equal(panel.pending.length,1);
  assert.equal(panel.fuentes.revisiones,false);
  assert.ok(panel.avisos.some(a => a.includes('fichas técnicas')));
});
test('un historial legible con agenda fallida no se presenta como finalizado', async () => {
  const flujo=servicios();
  flujo.agenda=async () => {throw Error();};
  flujo.historial=async () => [{ asignacion_id:id(3),meliponario_id:id(1),trabajador_id:id(4),estado:'asignada' }];
  const panel=await panelCoordinacion(flujo);
  assert.equal(panel.assignments[0].vigente,null);
  assert.equal(panel.assignments[0].cancelable,false);
  assert.equal(panel.fuentes.historial,false);
});
test('la revisión sigue disponible cuando fallan las consultas de asignación', async () => {
  const flujo=servicios();
  for(const nombre of ['agenda','pendientes','historial']) flujo[nombre]=async () => {throw Error();};
  flujo.revisiones=async () => [{ visita_tecnica_id:id(8),meliponario_id:id(1),nombre_meliponario:'Visita',estado:'enviada' }];
  const panel=await panelCoordinacion(flujo);
  assert.equal(panel.revisiones[0].id,id(8));
  assert.equal(panel.revisiones[0].nombre,'Visita');
  assert.equal(panel.fuentes.revisiones,true);
  assert.ok(panel.avisos.length);
  flujo.revisiones=async () => {throw Error();};
  await assert.rejects(panelCoordinacion(flujo),/consultar/);
});
