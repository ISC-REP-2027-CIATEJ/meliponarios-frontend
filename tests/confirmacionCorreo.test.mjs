import test from 'node:test';
import assert from 'node:assert/strict';
import { crearConfirmacionCorreo, esRutaConfirmacion, urlConfirmacion } from '../src/features/auth/confirmacionCorreo.mjs';
import { registrarCuenta } from '../src/features/auth/registroCuenta.mjs';

function entorno(url = 'https://kaabmap.netlify.app/confirm-email?token_hash=hash-de-prueba&type=email') {
  const location = new URL(url), navegaciones = [], historial = [];
  location.assign = destino => navegaciones.push(destino);
  const browser = { location, history: { replaceState(_a,_b,destino) { historial.push(destino); location.href = new URL(destino,location).href; } } };
  const usuario = { id: 'usuario-enlace', email_confirmed_at: '2026-11-25T12:00:00Z' };
  const sesion = { user: usuario, access_token: 'sesion-de-prueba' };
  const llamadas = [];
  const respuesta = () => ({ data: { user: usuario, session: sesion }, error: null });
  const cliente = { auth: {
    async initialize() { llamadas.push(['initialize']); return { error: null }; },
    async verifyOtp(args) { llamadas.push(['verifyOtp',args]); return respuesta(); },
    async setSession(args) { llamadas.push(['setSession',args]); return respuesta(); },
    async exchangeCodeForSession(code) { llamadas.push(['exchangeCodeForSession',code]); return respuesta(); },
    async getUser() { llamadas.push(['getUser']); return { data: { user: usuario }, error: null }; },
    async getSession() { return { data: { session: sesion }, error: null }; },
    async signOut(args) { llamadas.push(['signOut',args]); return { error: null }; },
  } };
  return { browser, cliente, llamadas, navegaciones, historial, usuario };
}
async function terminar(api) {
  for (let i=0;i<20 && api.getSnapshot().fase==='comprobando';i++) await new Promise(resolve=>setImmediate(resolve));
  assert.notEqual(api.getSnapshot().fase,'comprobando');
  return api.getSnapshot();
}

test('el destino del correo es /confirm-email y permite HTTP solo en desarrollo local', () => {
  assert.equal(urlConfirmacion(new URL('https://kaabmap.netlify.app/#register')),'https://kaabmap.netlify.app/confirm-email');
  assert.equal(urlConfirmacion(new URL('http://localhost:5173/#register')),'http://localhost:5173/confirm-email');
  assert.throws(()=>urlConfirmacion(new URL('http://sitio.example/#register')),/HTTPS/);
});
test('reconoce confirmación y enlaces anteriores sin apropiarse de recuperación o navegación pública', () => {
  for (const url of ['https://example.test/confirm-email','https://example.test/#confirm-email','https://example.test/#type=signup&access_token=a&refresh_token=b']) assert.equal(esRutaConfirmacion(new URL(url)),true);
  for (const url of ['https://example.test/#login','https://example.test/#type=recovery&access_token=a','https://example.test/reset-password?type=email']) assert.equal(esRutaConfirmacion(new URL(url)),false);
});
test('canjea token_hash una sola vez, valida el correo con Auth y limpia la dirección', async () => {
  const e=entorno();const api=crearConfirmacionCorreo(e.cliente,e.browser);
  const unsub=api.subscribe(()=>{});unsub();api.subscribe(()=>{});api.getSnapshot();api.getSnapshot();
  assert.equal(e.browser.location.search,'');
  assert.equal(e.browser.location.pathname,'/confirm-email');
  assert.equal((await terminar(api)).fase,'confirmada');
  assert.deepEqual(e.llamadas.filter(c=>c[0]==='verifyOtp'),[['verifyOtp',{token_hash:'hash-de-prueba',type:'email'}]]);
  assert.ok(!JSON.stringify(api.getSnapshot()).includes('hash-de-prueba'));
});
test('admite el tipo signup para plantillas existentes', async () => {
  const e=entorno('https://example.test/confirm-email?token_hash=hash-de-prueba&type=signup');
  const api=crearConfirmacionCorreo(e.cliente,e.browser);
  assert.equal((await terminar(api)).fase,'confirmada');
  assert.equal(e.llamadas.find(c=>c[0]==='verifyOtp')[1].type,'signup');
});
test('un enlace implícito anterior que regresaba al inicio muestra la confirmación', async () => {
  const e=entorno('https://example.test/#access_token=token-prueba&refresh_token=refresh-prueba&type=signup');
  const api=crearConfirmacionCorreo(e.cliente,e.browser);
  assert.equal((await terminar(api)).fase,'confirmada');
  assert.deepEqual(e.llamadas.find(c=>c[0]==='setSession'),['setSession',{access_token:'token-prueba',refresh_token:'refresh-prueba'}]);
  assert.equal(e.browser.location.hash,'');
});
test('admite canje PKCE una sola vez y omite destinos externos sugeridos en la URL', async () => {
  const e=entorno('https://example.test/confirm-email?code=codigo-prueba&next=https://otro.example');
  const api=crearConfirmacionCorreo(e.cliente,e.browser);
  assert.equal((await terminar(api)).fase,'confirmada');
  assert.deepEqual(e.llamadas.find(c=>c[0]==='exchangeCodeForSession'),['exchangeCodeForSession','codigo-prueba']);
  await api.continuar();assert.deepEqual(e.navegaciones,['/#login']);
});
test('abrir la ruta sin enlace no declara éxito aunque exista una sesión previa', async () => {
  const e=entorno('https://example.test/confirm-email');
  const api=crearConfirmacionCorreo(e.cliente,e.browser);
  assert.equal((await terminar(api)).fase,'sin_enlace');
  assert.equal(e.llamadas.length,0);
  await api.continuar();assert.deepEqual(e.navegaciones,['/#login']);
  assert.equal(e.llamadas.filter(c=>c[0]==='signOut').length,0);
});
test('rechaza parámetros duplicados, mezclados, vacíos, errores y tipos ajenos sin canjearlos', async () => {
  const urls=[
    '?token_hash=a&token_hash=b&type=email', '?token_hash=a&type=email&type=signup',
    '?token_hash=a&type=recovery', '?token_hash=a', '?token_hash=&type=email',
    '?token_hash=a%20b&type=email', '?token_hash=a&type=email&code=b',
    '#access_token=a&type=signup', '?error=access_denied&error_description=texto-secreto',
  ];
  for (const fragment of urls) {
    const e=entorno('https://example.test/confirm-email'+fragment);const api=crearConfirmacionCorreo(e.cliente,e.browser);
    assert.equal((await terminar(api)).fase,'invalida',fragment);
    assert.equal(e.llamadas.length,0,fragment);
    assert.ok(!JSON.stringify(api.getSnapshot()).includes('texto-secreto'));
  }
});
test('token caducado o fallo de Auth no se sustituye por una sesión previa válida', async () => {
  for(const metodo of ['initialize','verifyOtp']){
    const e=entorno();e.cliente.auth[metodo]=async()=>({error:{code:'otp_expired',message:'dato-no-publico'}});
    const api=crearConfirmacionCorreo(e.cliente,e.browser);
    assert.equal((await terminar(api)).fase,'invalida');
    assert.equal(e.llamadas.filter(c=>c[0]==='getUser').length,0);
    assert.ok(!api.getSnapshot().error.includes('dato-no-publico'));
  }
});
test('exige el mismo usuario verificado y una fecha de confirmación de correo válida', async () => {
  for (const user of [{id:'otra-persona',email_confirmed_at:'2026-11-25T12:00:00Z'}, {id:'usuario-enlace',email_confirmed_at:null}]) {
    const e=entorno();e.cliente.auth.getUser=async()=>({data:{user},error:null});
    assert.equal((await terminar(crearConfirmacionCorreo(e.cliente,e.browser))).fase,'invalida');
  }
});
test('el botón cierra solo la sesión local creada por el enlace antes de ir al login', async () => {
  const e=entorno();const api=crearConfirmacionCorreo(e.cliente,e.browser);await terminar(api);
  await api.continuar();
  assert.deepEqual(e.llamadas.find(c=>c[0]==='signOut'),['signOut',{scope:'local'}]);
  assert.deepEqual(e.navegaciones,['/#login']);
});
test('si falla el cierre conserva la confirmación y reintenta solo el cierre', async () => {
  const e=entorno();let cierres=0;
  e.cliente.auth.signOut=async()=>({error:++cierres===1?{message:'red'}:null});
  const api=crearConfirmacionCorreo(e.cliente,e.browser);await terminar(api);await api.continuar();
  assert.equal(api.getSnapshot().fase,'confirmada');assert.ok(api.getSnapshot().error);assert.equal(e.navegaciones.length,0);
  await api.continuar();assert.equal(cierres,2);assert.equal(e.llamadas.filter(c=>c[0]==='verifyOtp').length,1);
  assert.deepEqual(e.navegaciones,['/#login']);
});
test('una sesión que cambió a otra cuenta impide cerrar esa cuenta desde la confirmación', async () => {
  const e=entorno();const api=crearConfirmacionCorreo(e.cliente,e.browser);await terminar(api);
  e.cliente.auth.getSession=async()=>({data:{session:{user:{id:'otra-cuenta'}}},error:null});
  await api.continuar();assert.ok(api.getSnapshot().error);assert.equal(e.navegaciones.length,0);
  assert.equal(e.llamadas.filter(c=>c[0]==='signOut').length,0);
});
test('registro conserva el consentimiento y añade el destino real al correo de confirmación', async () => {
  let solicitud;
  const cliente={auth:{async signUp(payload){solicitud=payload;return {data:{user:{id:'nueva-cuenta',email:payload.email},session:null},error:null};}}};
  await registrarCuenta(cliente,{nombre:'Persona',apellidos:'Prueba',email:'persona@example.test',password:'Clave-De-Prueba-2026',consentimientoAceptado:true},new URL('https://kaabmap.netlify.app/#register'));
  assert.equal(solicitud.options.emailRedirectTo,'https://kaabmap.netlify.app/confirm-email');
  assert.equal(solicitud.options.data.acepto_terminos,true);
  assert.equal(solicitud.options.data.acepto_aviso_privacidad,true);
});
