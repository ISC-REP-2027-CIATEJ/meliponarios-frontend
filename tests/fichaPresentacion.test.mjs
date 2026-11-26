import test from 'node:test';
import assert from 'node:assert/strict';
import { limpiarFicha, formatoDatoFicha } from '../src/features/technicalAssignments/fichaPresentacion.mjs';

test('la presentación excluye referencias internas y mantiene todas las selecciones, Otro, No y cero', () => {
  const original = { visita: { id: '11111111-1111-4111-8111-111111111111', revisor_id: null, fecha_visita: '2026-11-25' },
    respuestas: { techo: ['madera', 'palma', 'otro'], otro_texto: 'Fibra local', alimenta: false },
    especies: [{ especie_id: '11111111-1111-4111-8111-111111111111', cantidad_cajas: 0, nombre_comun: 'Abeja' }] };
  const clean = limpiarFicha(original);
  assert.deepEqual(clean.respuestas, original.respuestas);
  assert.deepEqual(clean.especies, [{ cantidad_cajas: 0, nombre_comun: 'Abeja' }]);
  assert.ok(!('id' in clean.visita)); assert.ok(!('revisor_id' in clean.visita));
  assert.equal(formatoDatoFicha(false), 'No'); assert.equal(formatoDatoFicha(0), '0');
  assert.equal(original.visita.revisor_id, null);
});
test('fechas civiles no cambian de día y los instantes se muestran en horario de México', () => {
  assert.match(formatoDatoFicha('2026-11-25', 'fecha_visita'), /25/);
  assert.match(formatoDatoFicha('2026-11-26T01:30:00Z', 'fecha_envio'), /25/);
  assert.equal(formatoDatoFicha('11111111-1111-4111-8111-111111111111'), '');
});

