import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRecuperacion, esRutaRecuperacion, urlRecuperacion, validarNuevaPassword } from '../src/features/auth/passwordRecovery.mjs';

function doble({ ruta = '/', evento = true, initError = null, updateError = null, signoutError = null, user = 'cuenta-recuperacion' } = {}) {
  let listener;
  const calls = [];
  const location = { pathname: ruta, hash: '', search: '', origin: 'https://kaabmap.netlify.app' };
  const browser = { location, history: { replaceState(a, b, url) {
    const n = new URL(url, location.origin); Object.assign(location, { pathname: n.pathname, hash: n.hash, search: n.search });
  } } };
  const client = { auth: {
    onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    async initialize() {
      if (evento) setTimeout(() => listener('PASSWORD_RECOVERY', { user: { id: 'cuenta-recuperacion' } }), 0);
      return { error: initError };
    },
    async getUser() { calls.push('getUser'); return { data: { user: { id: user } } }; },
    async resetPasswordForEmail(email, options) { calls.push({ email, options }); return {}; },
    async updateUser(body) { calls.push({ update: body }); return { data: { user: { id: user } }, error: updateError }; },
    async signOut(options) { calls.push({ signout: options }); if (!signoutError) listener('SIGNED_OUT', null); return { error: signoutError }; },
  } };
  return { api: crearRecuperacion(client, browser), calls, browser, emit: (...args) => listener(...args), client };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('solicitud de correo usa el destino propio /reset-password y no consulta perfiles', async () => {
  const { api, calls } = doble();
  await api.solicitar('  Productor@ejemplo.mx ');
  assert.deepEqual(calls, [{ email: 'productor@ejemplo.mx', options: { redirectTo: 'https://kaabmap.netlify.app/reset-password' } }]);
  api.dispose();
});
test('valida correo antes de enviar y permite HTTP solo en desarrollo local', async () => {
  const { api, calls } = doble();
  await assert.rejects(api.solicitar('correo-incompleto'), /válido/); assert.equal(calls.length, 0);
  assert.equal(urlRecuperacion({ origin: 'http://localhost:5173' }), 'http://localhost:5173/reset-password');
  assert.throws(() => urlRecuperacion({ origin: 'http://sitio.example' }), /HTTPS/); api.dispose();
});
test('una sesión normal y visitar manualmente la ruta no autorizan un restablecimiento', async () => {
  const d = doble({ ruta: '/reset-password', evento: false });
  await tick(); assert.equal(d.api.getSnapshot().fase, 'invalida');
  await assert.rejects(d.api.guardar('Password de prueba', 'Password de prueba'), /enlace/);
  assert.equal(d.calls.length, 0); d.api.dispose();
});
test('enlace vencido elimina el fragmento de la URL y no llama updateUser', async () => {
  const d = doble({ ruta: '/reset-password', evento: false, initError: { code: 'otp_expired' } });
  d.browser.location.hash = '#error=expired&error_description=informacion-no-visible';
  await tick(); assert.equal(d.api.getSnapshot().fase, 'invalida'); assert.equal(d.browser.location.hash, '');
  assert.equal(d.calls.length, 0); d.api.dispose();
});
test('evento temprano se conserva, valida usuario, actualiza y cierra recuperación local', async () => {
  const d = doble({ ruta: '/reset-password' });
  d.browser.location.hash = '#access_token=valor-de-prueba&type=recovery';
  await tick(); assert.equal(d.api.getSnapshot().fase, 'lista'); assert.equal(d.browser.location.hash, '');
  await d.api.guardar('Password de prueba', 'Password de prueba');
  assert.equal(d.api.getSnapshot().fase, 'completada');
  assert.deepEqual(d.calls, ['getUser', { update: { password: 'Password de prueba' } }, { signout: { scope: 'local' } }]);
  await d.api.salir(); assert.equal(d.api.getSnapshot().fase, 'inactiva'); assert.equal(d.browser.location.hash, '#login'); d.api.dispose();
});
test('no permite cambiar la contraseña de otra sesión ni dobles envíos', async () => {
  const d = doble({ ruta: '/reset-password', user: 'otra-cuenta' }); await tick();
  await d.api.guardar('Password de prueba', 'Password de prueba');
  assert.equal(d.api.getSnapshot().fase, 'invalida'); assert.deepEqual(d.calls, ['getUser']); d.api.dispose();
  const ok = doble({ ruta: '/reset-password' }); await tick();
  await Promise.all([ok.api.guardar('Password de prueba', 'Password de prueba'), ok.api.guardar('Password de prueba', 'Password de prueba')]);
  assert.equal(ok.calls.filter(c => c.update).length, 1); ok.api.dispose();
});
test('si falla el cierre después de actualizar, solo reintenta el cierre y nunca updateUser', async () => {
  const d = doble({ ruta: '/reset-password', signoutError: { message: 'offline' } }); await tick();
  await d.api.guardar('Password de prueba', 'Password de prueba'); assert.equal(d.api.getSnapshot().fase, 'salida_pendiente');
  await assert.rejects(d.api.guardar('Password de prueba', 'Password de prueba'), /enlace/);
  d.client.auth.signOut = async () => { d.calls.push('cierre-reintentado'); return {}; };
  await d.api.terminar(); assert.equal(d.api.getSnapshot().fase, 'completada');
  assert.equal(d.calls.filter(c => c.update).length, 1); d.api.dispose();
});
test('contraseña débil conserva un estado recuperable y no expone errores técnicos', async () => {
  const d = doble({ ruta: '/reset-password', updateError: { code: 'weak_password', message: 'internal diagnostic' } }); await tick();
  await d.api.guardar('Password de prueba', 'Password de prueba');
  assert.equal(d.api.getSnapshot().fase, 'lista'); assert.match(d.api.getSnapshot().error, /requisitos/);
  assert.ok(!d.api.getSnapshot().error.includes('internal')); d.api.dispose();
});
test('la validación mantiene contraseñas exactamente como se escriben', () => {
  assert.match(validarNuevaPassword('123', '123'), /8/);
  assert.match(validarNuevaPassword('12345678', '12345679'), /coincidir/);
  assert.equal(validarNuevaPassword(' 12345678 ', ' 12345678 '), '');
  assert.equal(esRutaRecuperacion({ pathname: '/', hash: '#access_token=prueba&type=recovery' }), true);
});

