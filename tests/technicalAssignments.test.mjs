import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechnicalAssignmentsApi } from '../src/features/technicalAssignments/technicalAssignmentsApi.mjs';

const id = number => `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const actor = id(1), worker = id(2), assignment = id(3), meliponario = id(4), zone = id(5);
const timestamp = '2026-11-10T12:00:00.000Z';
const reason = 'Visita para verificar los datos registrados.';
function basic(number, estado = 'aprobada', attempt = 1, mel = id(1000 + number)) {
  return { id: id(number), meliponario_id: mel, estado, numero_intento: attempt, nombre: `Registro ${number}`, localidad: 'Localidad', municipio: 'Municipio' };
}
function assigned(overrides = {}) {
  return { asignacion_id: assignment, meliponario_id: meliponario, trabajador_id: worker, nombre_meliponario: 'Registro asignado', estado: 'asignada', fecha_asignacion: timestamp, fecha_cancelacion: null, motivo_cancelacion: null, ...overrides };
}
function fixture({ role = 3, active = true, sessionId = actor, rows = [], assignments = [], handler } = {}) {
  const calls = [], profiles = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: sessionId ? { id: sessionId } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'perfiles');
      return { select(columns) { assert.equal(columns, 'id,rol_id,activo'); return { eq(column, value) {
        assert.equal(column, 'id'); assert.equal(value, actor); profiles.push(value);
        return { maybeSingle: async () => ({ data: { id: actor, rol_id: role, activo: active }, error: null }) };
      } }; } };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (handler) return handler(name, args);
      if (name === 'coord_consultar_visitas_tecnicas') return { data: assignments, error: null };
      if (name === 'mis_visitas_tecnicas_asignadas') return { data: [{ asignacion_id: assignment, meliponario_id: meliponario, nombre_meliponario: 'Asignado', localidad_nombre: 'Localidad', fecha_asignacion: timestamp, motivo_asignacion: reason }], error: null };
      if (name === 'km_campo_bandeja') {
        const filtered = rows.filter(row => args.p_estado === 'pendientes' ? ['enviada', 'en_revision'].includes(row.estado) : row.estado === args.p_estado);
        return { data: { solicitudes: filtered.slice(args.p_offset, args.p_offset + args.p_limite), total: filtered.length, rol_id: 3, zonas: [{ id: zone, nombre: 'Zona' }] }, error: null };
      }
      if (['coord_asignar_visita_tecnica', 'coord_cancelar_visita_tecnica'].includes(name)) return { data: assignment, error: null };
      throw new Error(`RPC inesperada: ${name}`);
    },
  };
  return { api: createTechnicalAssignmentsApi(client), calls, profiles };
}

test('trabajador consulta exclusivamente su RPC de asignaciones y su propio perfil', async () => {
  const f = fixture({ role: 4 });
  const rows = await f.api.worker(actor);
  assert.deepEqual(f.calls, [{ name: 'mis_visitas_tecnicas_asignadas', args: {} }]);
  assert.deepEqual(f.profiles, [actor]);
  assert.equal(rows[0].meliponarioId, meliponario);
  assert.equal(rows[0].motivo, reason);
  assert.equal(rows[0].fechaVisita, undefined);
});

test('sesión de otro usuario se rechaza antes de consultar datos', async () => {
  const f = fixture({ sessionId: worker });
  await assert.rejects(f.api.coordinator(actor), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 0); assert.equal(f.profiles.length, 0);
});

test('visitante sin sesión no consulta bandejas', async () => {
  const f = fixture({ sessionId: null });
  await assert.rejects(f.api.coordinator(actor), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 0);
});

test('perfil inactivo no consulta ni asigna', async () => {
  const f = fixture({ active: false });
  await assert.rejects(f.api.coordinator(actor), { code: 'ACCESS_DENIED' });
  await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason }), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 0);
});

test('trabajador no puede utilizar operaciones exclusivas del coordinador', async () => {
  const f = fixture({ role: 4 });
  await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason }), { code: 'ACCESS_DENIED' });
  await assert.rejects(f.api.cancel(actor, { asignacionId: assignment, motivo: reason }), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 0);
});

test('coordinador no puede consultar la bandeja del trabajador', async () => {
  const f = fixture();
  await assert.rejects(f.api.worker(actor), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 0);
});

test('bandeja elimina aprobaciones históricas con intentos posteriores pendientes, rechazados o en corrección', async () => {
  const rows = [basic(10), basic(11), basic(12), basic(13), basic(14),
    basic(20, 'rechazada', 2, id(1010)), basic(21, 'correccion', 2, id(1011)),
    basic(22, 'enviada', 2, id(1012)), basic(23, 'en_revision', 2, id(1013))];
  const f = fixture({ rows });
  const data = await f.api.coordinator(actor);
  assert.deepEqual(data.pending.map(row => row.id), [id(14)]);
  assert.deepEqual(f.calls.filter(row => row.name === 'km_campo_bandeja').map(row => row.args.p_estado), ['pendientes', 'correccion', 'aprobada', 'rechazada']);
});

test('registro con asignación vigente no se muestra por asignar', async () => {
  const f = fixture({ rows: [basic(10, 'aprobada', 1, meliponario)], assignments: [assigned()] });
  const result = await f.api.coordinator(actor);
  assert.equal(result.pending.length, 0); assert.equal(result.assignments.length, 1);
});

test('asignación cancelada conserva historial y permite volver a asignar', async () => {
  const f = fixture({ rows: [basic(10, 'aprobada', 1, meliponario)], assignments: [assigned({ estado: 'cancelada', fecha_cancelacion: timestamp, motivo_cancelacion: reason })] });
  const result = await f.api.coordinator(actor);
  assert.equal(result.pending.length, 1); assert.equal(result.assignments[0].estado, 'cancelada');
});

test('consulta completa páginas de cien solicitudes', async () => {
  const f = fixture({ rows: Array.from({ length: 101 }, (_, i) => basic(100 + i)) });
  const result = await f.api.coordinator(actor);
  assert.equal(result.pending.length, 101);
  assert.deepEqual(f.calls.filter(row => row.name === 'km_campo_bandeja' && row.args.p_estado === 'aprobada').map(row => row.args.p_offset), [0, 100]);
});

test('respuesta truncada no se presenta como bandeja completa', async () => {
  const f = fixture({ handler: name => ({ data: name === 'coord_consultar_visitas_tecnicas' ? [] : { solicitudes: [], total: 1, zonas: [], rol_id: 3 }, error: null }) });
  await assert.rejects(f.api.coordinator(actor), { code: 'INVALID_RESPONSE' });
});

test('una respuesta de otro rol no se acepta como catálogo del coordinador', async () => {
  const f = fixture({ handler: name => ({ data: name === 'coord_consultar_visitas_tecnicas' ? [] : { solicitudes: [], total: 0, zonas: [], rol_id: 4 }, error: null }) });
  await assert.rejects(f.api.coordinator(actor), { code: 'INVALID_RESPONSE' });
});

test('asignaciones vigentes duplicadas bloquean una lectura ambigua', async () => {
  const f = fixture({ assignments: [assigned(), assigned({ asignacion_id: id(60) })] });
  await assert.rejects(f.api.coordinator(actor), { code: 'INVALID_RESPONSE' });
});

test('estado técnico que el contrato no define se rechaza', async () => {
  const f = fixture({ assignments: [assigned({ estado: 'completada' })] });
  await assert.rejects(f.api.coordinator(actor), { code: 'INVALID_RESPONSE' });
});

test('asigna con nombres de parámetros reales y motivo recortado', async () => {
  const f = fixture();
  assert.equal(await f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: `  ${reason}  ` }), assignment);
  assert.deepEqual(f.calls, [{ name: 'coord_asignar_visita_tecnica', args: { p_meliponario_id: meliponario, p_trabajador_id: worker, p_motivo: reason } }]);
});

test('identificadores o motivos inválidos no generan escrituras', async () => {
  const f = fixture();
  for (const change of [{ trabajadorId: 'nombre' }, { meliponarioId: 'demo' }, { motivo: 'corto' }, { motivo: 'a'.repeat(1001) }]) {
    await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason, ...change }), { code: 'INVALID_INPUT' });
  }
  assert.equal(f.calls.length, 0);
});

test('la denegación territorial del servidor se respeta', async () => {
  const f = fixture({ handler: () => ({ data: null, error: { code: '42501', message: 'Fuera de zona' } }) });
  await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason }), { code: 'ACCESS_DENIED' });
  assert.equal(f.calls.length, 1);
});

test('servicio ausente produce un error explícito', async () => {
  const f = fixture({ handler: () => ({ data: null, error: { code: 'PGRST202' } }) });
  await assert.rejects(f.api.coordinator(actor), { code: 'CONTRACT_MISSING' });
});

test('pérdida de conexión durante escritura exige verificar sin reintento automático', async () => {
  const f = fixture({ handler: () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason }), { code: 'RESULT_UNKNOWN', uncertain: true });
  assert.equal(f.calls.length, 1);
});

test('UUID ausente en una escritura no se interpreta como confirmación', async () => {
  const f = fixture({ handler: () => ({ data: null, error: null }) });
  await assert.rejects(f.api.assign(actor, { meliponarioId: meliponario, trabajadorId: worker, motivo: reason }), { code: 'RESULT_UNKNOWN', uncertain: true });
});

test('cancelación utiliza el identificador de asignación y verifica su respuesta', async () => {
  const f = fixture();
  await f.api.cancel(actor, { asignacionId: assignment, motivo: reason });
  assert.deepEqual(f.calls, [{ name: 'coord_cancelar_visita_tecnica', args: { p_asignacion_id: assignment, p_motivo: reason } }]);
  const other = fixture({ handler: () => ({ data: id(90), error: null }) });
  await assert.rejects(other.api.cancel(actor, { asignacionId: assignment, motivo: reason }), { code: 'RESULT_UNKNOWN', uncertain: true });
});

test('bandeja de trabajador incompleta no se muestra como asignación válida', async () => {
  const f = fixture({ role: 4, handler: () => ({ data: [{ asignacion_id: assignment }], error: null }) });
  await assert.rejects(f.api.worker(actor), { code: 'INVALID_RESPONSE' });
});
