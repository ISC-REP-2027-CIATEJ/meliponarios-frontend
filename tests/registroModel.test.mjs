import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCliente, crearFormulario, validarAbeja, validarFormulario,
  actividad, leerRegistros, guardarRegistro,
} from '../src/features/ownerMeliponarios/model.js';
import { obtenerCatalogosRegistro } from '../src/features/ownerMeliponarios/catalogos.js';

const catalogos = await obtenerCatalogosRegistro();
const bee = { tipoId: catalogos.abejas[0].id, cajas: 1, jobones: 0 };
function almacen() {
  const valores = new Map();
  return {
    valores,
    getItem(key) { return valores.get(key) ?? null; },
    setItem(key, value) { valores.set(key, value); },
  };
}
function completo() {
  return {
    ...crearFormulario(), nombre: 'Meliponario de prueba',
    municipioId: catalogos.municipios[0].id,
    localidadId: catalogos.localidades[0].id,
    abejas: [{ ...bee }], coordenadas: [20.97, -89.62], vendeMiel: true,
  };
}

test('el borrador conserva coordenadas parciales y el envío exige completarlas', () => {
  const storage = almacen();
  const form = { ...crearFormulario(), coordenadas: [20.9, ''] };
  const saved = guardarRegistro({ userId: 'u1', form, catalogos }, storage);
  assert.deepEqual(leerRegistros('u1', storage)[0].coordenadas, [20.9, '']);
  assert.ok(validarFormulario(form, catalogos, { enviar: true }).coordenadas);
  assert.equal(saved.estado, 'borrador');
});

test('solo un usuario con ID y rol Cliente cumple la condición de la interfaz', () => {
  assert.equal(isCliente(null), false);
  assert.equal(isCliente({ id: ' ', roleId: 5 }), false);
  assert.equal(isCliente({ id: 'u1', roleId: 1, roleName: 'Cliente' }), false);
  assert.equal(isCliente({ id: 'u1', roleId: '5' }), true);
});

test('el formulario se crea vacío y copia arrays sin modificar el registro original', () => {
  const vacio = crearFormulario();
  assert.deepEqual(vacio.abejas, []);
  assert.equal(vacio.coordenadas, null);
  const original = completo();
  const copia = crearFormulario(original);
  copia.abejas[0].cajas = 7;
  copia.coordenadas[0] = 0;
  assert.equal(original.abejas[0].cajas, 1);
  assert.equal(original.coordenadas[0], 20.97);
});

test('cada abeja requiere como mínimo una caja o un jobón y no admite cantidades inválidas', () => {
  assert.equal(validarAbeja(bee), '');
  assert.equal(validarAbeja({ ...bee, cajas: 0, jobones: 1 }), '');
  assert.equal(validarAbeja({ ...bee, cajas: '0', jobones: '1' }), '');
  for (const cajas of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '', null]) {
    assert.notEqual(validarAbeja({ ...bee, cajas, jobones: 0 }), '', String(cajas));
  }
  assert.notEqual(validarAbeja({ ...bee, tipoId: '' }), '');
});

test('los duplicados se rechazan y al quitar la abeja vuelve a estar disponible', () => {
  assert.notEqual(validarAbeja(bee, [{ ...bee }]), '');
  const otras = [{ ...bee }].filter(item => item.tipoId !== bee.tipoId);
  assert.equal(validarAbeja(bee, otras), '');
  assert.notDeepEqual(validarFormulario({ ...completo(), abejas: [bee, { ...bee }] }, catalogos), {});
});

test('un borrador puede estar incompleto pero los datos de abejas agregadas deben ser válidos', () => {
  assert.deepEqual(validarFormulario(crearFormulario(), catalogos), {});
  const incompleto = { ...crearFormulario(), abejas: [{ ...bee, cajas: 0 }] };
  assert.ok(validarFormulario(incompleto, catalogos).abejas);
  assert.ok(validarFormulario({ ...completo(), abejas: [{ ...bee, tipoId: 'fuera-del-catalogo' }] }, catalogos).abejas);
});

test('enviar requiere datos generales, localidad del municipio, abejas, coordenadas y actividad', () => {
  const errores = validarFormulario(crearFormulario(), catalogos, { enviar: true });
  for (const campo of ['nombre', 'municipioId', 'localidadId', 'abejas', 'coordenadas', 'actividades']) {
    assert.ok(errores[campo], campo);
  }
  assert.deepEqual(validarFormulario(completo(), catalogos, { enviar: true }), {});
  const cambiado = { ...completo(), municipioId: catalogos.municipios[1].id };
  assert.ok(validarFormulario(cambiado, catalogos, { enviar: true }).localidadId);
  assert.deepEqual(cambiado.abejas, completo().abejas);
});

test('la ubicación rechaza coordenadas fuera de rango o no numéricas', () => {
  for (const coordenadas of [[91, 0], [0, -181], ['20', -89], [NaN, 0], [1], []]) {
    assert.ok(validarFormulario({ ...completo(), coordenadas }, catalogos, { enviar: true }).coordenadas);
  }
});

test('la etiqueta de actividad usa miel amarillo, visitas verde y ambas azul', () => {
  assert.equal(actividad({}).key, 'sin-definir');
  assert.equal(actividad({ vendeMiel: true }).color, '#d6a52f');
  assert.equal(actividad({ recibeVisitas: true }).color, '#43865d');
  assert.equal(actividad({ vendeMiel: true, recibeVisitas: true }).color, '#3a82b3');
});

test('guardar el mismo borrador varias veces actualiza su ID y permite varios meliponarios', () => {
  const storage = almacen();
  assert.deepEqual(leerRegistros('u1', storage), []);
  const primero = guardarRegistro({ userId: 'u1', form: crearFormulario(), catalogos }, storage);
  const editado = guardarRegistro({ userId: 'u1', id: primero.id, form: { ...crearFormulario(), nombre: 'Ya tiene nombre' }, catalogos }, storage);
  assert.equal(editado.id, primero.id);
  assert.equal(editado.creadoEn, primero.creadoEn);
  assert.equal(leerRegistros('u1', storage).length, 1);
  const segundo = guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  assert.notEqual(segundo.id, primero.id);
  assert.equal(leerRegistros('u1', storage).length, 2);
});

test('el envío local bloquea cambios posteriores y no convierte el registro en público', () => {
  const storage = almacen();
  const draft = guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  const enviado = guardarRegistro({ userId: 'u1', id: draft.id, form: completo(), catalogos, enviar: true }, storage);
  assert.equal(enviado.estado, 'enviado_demo');
  assert.ok(enviado.enviadoEn);
  assert.throws(() => guardarRegistro({ userId: 'u1', id: enviado.id, form: completo(), catalogos }, storage), /bloqueados/);
  assert.throws(() => guardarRegistro({ userId: 'u1', id: enviado.id, form: completo(), catalogos, enviar: true }, storage), /bloqueados/);
  assert.equal(leerRegistros('u1', storage).length, 1);
});

test('enviar un formulario incompleto no guarda una solicitud', () => {
  const storage = almacen();
  assert.throws(() => guardarRegistro({ userId: 'u1', form: crearFormulario(), catalogos, enviar: true }, storage));
  assert.deepEqual(leerRegistros('u1', storage), []);
});

test('los registros se aíslan por usuario y no se puede editar un ID de otra cuenta', () => {
  const storage = almacen();
  const record = guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  assert.deepEqual(leerRegistros('u2', storage), []);
  assert.throws(() => guardarRegistro({ userId: 'u2', id: record.id, form: completo(), catalogos }, storage), /No encontramos/);
  assert.throws(() => leerRegistros('', storage), /Inicia sesión/);
});

test('los errores de almacenamiento y registros corruptos se comunican sin sobrescribirlos', () => {
  assert.throws(() => leerRegistros('u1', null), /almacenamiento/);
  assert.throws(() => leerRegistros('u1', { getItem() { throw new Error(); }, setItem() {} }), /leer tus borradores/);
  const storage = almacen();
  guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  const key = [...storage.valores.keys()][0];
  storage.setItem(key, '{roto');
  assert.throws(() => leerRegistros('u1', storage), /registros locales/);
  assert.throws(() => guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage), /registros locales/);
  assert.equal(storage.getItem(key), '{roto');
  storage.setItem(key, '{}');
  assert.throws(() => leerRegistros('u1', storage), /formato inválido/);
  const soloLectura = { getItem() { return null; }, setItem() { throw new Error(); } };
  assert.throws(() => guardarRegistro({ userId: 'u1', form: completo(), catalogos }, soloLectura), /No se pudo guardar/);
});

test('lecturas nuevas preservan registros creados después de abrir otro borrador', () => {
  const storage = almacen();
  const primero = guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  const segundo = guardarRegistro({ userId: 'u1', form: { ...completo(), nombre: 'Segundo' }, catalogos }, storage);
  guardarRegistro({ userId: 'u1', id: primero.id, form: { ...completo(), nombre: 'Primero editado' }, catalogos }, storage);
  assert.equal(leerRegistros('u1', storage).length, 2);
  assert.ok(leerRegistros('u1', storage).some(record => record.id === segundo.id));
});

test('una copia manipulada de otra cuenta o IDs duplicados se considera inválida', () => {
  const storage = almacen();
  const record = guardarRegistro({ userId: 'u1', form: completo(), catalogos }, storage);
  const key = [...storage.valores.keys()][0];
  storage.setItem(key, JSON.stringify([{ ...record, ownerId: 'u2' }]));
  assert.throws(() => leerRegistros('u1', storage), /formato inválido/);
  storage.setItem(key, JSON.stringify([record, record]));
  assert.throws(() => leerRegistros('u1', storage), /formato inválido/);
});
