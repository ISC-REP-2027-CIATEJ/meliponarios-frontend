import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  agruparAsignaciones, cuentasDisponibles, filtrarPersonas,
} from '../src/pages/AdminAssignments/adminAssignmentsModel.mjs';

const periodo = (id, usuario_id, zona, vigente, nombre = 'María') => ({
  id, usuario_id, zona, vigente, nombre, apellidos: 'Tun', rol_id: 3,
});

test('un período cerrado y otro vigente de la misma cuenta forman una sola tarjeta', () => {
  const anterior = periodo('primero', 'persona', 'Zona Centro', false);
  const vigente = periodo('segundo', 'persona', 'Zona Centro', true);
  const personas = agruparAsignaciones([vigente, anterior]);
  assert.equal(personas.length, 1);
  assert.equal(personas[0].id, 'persona');
  assert.deepEqual(personas[0].vigentes, [vigente]);
  assert.deepEqual(personas[0].historial, [anterior]);
  assert.equal(filtrarPersonas(personas, { estado: 'todas' }).length, 1);
});

test('dos cuentas con el mismo nombre conservan sus propias zonas y sus propios identificadores', () => {
  const personas = agruparAsignaciones([
    periodo('a', 'persona-a', 'Zona Centro', true),
    periodo('b', 'persona-b', 'Zona Norte', true),
  ]);
  const seleccionadas = filtrarPersonas(personas, { estado: 'todas', personaId: 'persona-b' });
  assert.equal(personas.length, 2);
  assert.equal(seleccionadas.length, 1);
  assert.equal(seleccionadas[0].vigentes[0].id, 'b');
});

test('una persona con dos períodos vigentes conserva las dos acciones de finalización', () => {
  const zonas = [
    periodo('a', 'persona', 'Zona Centro', true),
    periodo('b', 'persona', 'Zona Norte', true),
  ];
  const [persona] = agruparAsignaciones(zonas);
  assert.deepEqual(persona.vigentes.map(row => row.id), ['a', 'b']);
});

test('buscar por zona en historial respeta la vigencia de los períodos', () => {
  const personas = agruparAsignaciones([
    periodo('a', 'persona', 'Zona Este', true),
    periodo('b', 'persona', 'Zona Península', false),
  ]);
  assert.equal(filtrarPersonas(personas, { estado: 'historial', busqueda: 'peninsula' }).length, 1);
  assert.equal(filtrarPersonas(personas, { estado: 'vigentes', busqueda: 'peninsula' }).length, 0);
  assert.equal(filtrarPersonas(personas, { estado: 'todas', busqueda: 'maria' }).length, 1);
});

test('la cuenta vuelve al formulario al finalizar la última asignación vigente', () => {
  const usuarios = [{ id: 'persona', rol_id: 3 }];
  const historial = periodo('a', 'persona', 'Zona Centro', false);
  const vigente = periodo('b', 'persona', 'Zona Norte', true);
  assert.deepEqual(cuentasDisponibles({ usuarios, asignaciones: [historial, vigente] }), []);
  assert.deepEqual(cuentasDisponibles({ usuarios, asignaciones: [historial, { ...vigente, vigente: false }] }), usuarios);
});
