import test from 'node:test';
import assert from 'node:assert/strict';
import { datosIniciales, validarCuenta, prepararCuenta } from '../src/pages/Register/accountRegistration.js';
import { crearSolicitudRegistro, registrarCuenta, versionesRegistro } from '../src/features/auth/registroCuenta.mjs';

const cuenta = () => ({ ...datosIniciales, firstName: 'Persona', lastName: 'Prueba',
  email: 'persona@example.test', password: 'Clave-Prueba-2026', confirmPassword: 'Clave-Prueba-2026' });

test('la aceptación empieza desmarcada y se exige aunque los demás datos sean válidos', () => {
  assert.equal(datosIniciales.consentimientoAceptado, false);
  assert.ok(validarCuenta(cuenta()).consentimientoAceptado);
  assert.throws(() => prepararCuenta(cuenta()), /Debes aceptar/);
});
test('solo la aceptación booleana explícita permite preparar el registro', () => {
  for (const consentimientoAceptado of [undefined, null, false, 'true', 'false', 1]) {
    assert.ok(validarCuenta({ ...cuenta(), consentimientoAceptado }).consentimientoAceptado);
  }
  const datos = { ...cuenta(), consentimientoAceptado: true };
  assert.deepEqual(validarCuenta(datos), {});
  assert.equal(prepararCuenta(datos).consentimientoAceptado, true);
  assert.equal(prepararCuenta(datos).email, 'persona@example.test');
});
test('aceptar documentos no omite la validación del resto del formulario', () => {
  const errores = validarCuenta({ ...cuenta(), consentimientoAceptado: true, email: 'sin-correo', confirmPassword: 'otra' });
  assert.ok(errores.email);
  assert.ok(errores.confirmPassword);
  assert.equal(errores.consentimientoAceptado, undefined);
});

test('envía exactamente las aceptaciones y versiones que exige handle_new_user', () => {
  const datos = prepararCuenta({ ...cuenta(), consentimientoAceptado: true });
  const solicitud = crearSolicitudRegistro({ ...datos, rol_id: 1, version_terminos: 'version-inventada' });
  assert.deepEqual(solicitud.options.data, {
    nombre: 'Persona', apellidos: 'Prueba', telefono: null,
    acepto_terminos: true, acepto_aviso_privacidad: true,
    version_terminos: versionesRegistro.terminos,
    version_aviso_privacidad: versionesRegistro.privacidad,
  });
  for (const campo of ['version_terminos','version_aviso_privacidad']) {
    assert.ok(solicitud.options.data[campo].trim().length > 0);
    assert.ok(Array.from(solicitud.options.data[campo]).length <= 40);
  }
  assert.equal(solicitud.options.data.rol_id, undefined);
  assert.equal(solicitud.options.data.fecha_aceptacion_terminos, undefined);
});

test('sin aceptación no llama a Supabase aunque se omita el formulario', async () => {
  let altas = 0;
  const cliente = { auth: { async signUp() { altas++; return {}; } } };
  const datos = { nombre: 'Persona', apellidos: 'Prueba', email: 'persona@example.test', password: 'Clave-Prueba-2026' };
  for (const consentimientoAceptado of [false, undefined, 'true']) {
    await assert.rejects(registrarCuenta(cliente, { ...datos, consentimientoAceptado }), /Acepta/);
  }
  assert.equal(altas, 0);
});

test('un alta confirmada conserva el flujo de confirmación por correo sin alterar la contraseña', async () => {
  let peticion;
  const cliente = { auth: { async signUp(payload) {
    peticion = payload;
    return { data: { user: { id: 'cliente-prueba', email: payload.email }, session: null }, error: null };
  } } };
  const datos = { ...prepararCuenta({ ...cuenta(), consentimientoAceptado: true }), email: ' PERSONA@EXAMPLE.TEST ' };
  assert.deepEqual(await registrarCuenta(cliente, datos), {
    userId: 'cliente-prueba', email: 'persona@example.test', emailVerificationRequired: true,
  });
  assert.equal(peticion.password, datos.password);
  assert.equal(peticion.options.data.telefono, null);
});

test('un error del servidor no se muestra como cuenta creada ni provoca reintentos', async () => {
  let altas = 0;
  const cliente = { auth: { async signUp() {
    altas++; return { error: { message: 'Database error saving new user', status: 500 } };
  } } };
  await assert.rejects(registrarCuenta(cliente, prepararCuenta({ ...cuenta(), consentimientoAceptado: true })), /servidor no pudo guardar/);
  assert.equal(altas, 1);
});

test('una respuesta perdida o incompleta no simula éxito ni reenvía la contraseña', async () => {
  for (const modo of ['red', 'sin-usuario']) {
    let altas = 0;
    const cliente = { auth: { async signUp() {
      altas++; if (modo === 'red') throw new Error('fallo de transporte');
      return { data: { user: null }, error: null };
    } } };
    await assert.rejects(registrarCuenta(cliente, prepararCuenta({ ...cuenta(), consentimientoAceptado: true })), /No se pudo confirmar/);
    assert.equal(altas, 1);
  }
});
