import test from 'node:test';
import assert from 'node:assert/strict';
import { crearApiPublicacion, datosPublicacion, formularioPublicacion, motivosPublicacion } from '../src/features/ownerMeliponarios/publicacionSupabase.mjs';

const userId = '50000000-0000-4000-8000-000000000101';
const otroId = '50000000-0000-4000-8000-000000000103';
const id = '50000000-0000-4000-8000-000000000001';
const form = () => ({ autorizarUbicacion: true, autorizarContacto: true, nombreContacto: 'Contacto autorizado', telefonoContacto: '+52 999 123 4567' });
const row = () => ({ id, responsable_principal_id: userId, visibilidad: 'privado', autorizacion_ubicacion_exacta: false,
  autorizacion_contacto_publico: false, nombre_contacto_publico: null, telefono_contacto_publico: null, fecha_autorizacion_publicacion: null });

function entorno(options = {}) {
  const state = { row: row(), perfil: { id: userId, rol_id: 5, activo: true }, solicitud: { id: otroId, estado: 'aprobada', numero_intento: 2 },
    ubicacion: { meliponario_id: id }, publica: false, ...options };
  const calls = [];
  let written = false;
  const client = {
    auth: { async getUser() {
      calls.push({ tipo: 'sesion' });
      if (options.authError) throw Error('DETALLE_INTERNO');
      return { data: { user: { id: written && options.cambioTrasGuardar ? otroId : options.sessionId || userId } } };
    } },
    from(table) {
      const query = { tipo: 'lectura', tabla: table, filtros: [] };
      const builder = {
        select(fields) { query.columnas = fields; return builder; },
        eq(campo, valor) { query.filtros.push([campo, valor]); return builder; },
        order(campo, config) { query.orden = [campo, config]; return builder; },
        limit(n) { query.limite = n; return builder; },
        async maybeSingle() {
          calls.push(query);
          if (options.readError || written && options.fallaLecturaPosterior) return { error: { code: '42501', message: 'DETALLE_INTERNO' } };
          return { data: ({ perfiles: state.perfil, meliponarios: state.row, solicitudes_meliponario: state.solicitud, ubicaciones_meliponarios: state.ubicacion })[table] ?? null };
        },
      };
      return builder;
    },
    async rpc(name, args) {
      calls.push({ tipo: 'rpc', name, args });
      assert.equal(name, 'configurar_publicacion_meliponario');
      if (options.networkError) throw Error('DETALLE_INTERNO');
      if (options.rpcError) return { error: options.rpcError };
      if (options.badResponse) return { data: { inventado: 'publico' } };
      written = true;
      state.row = { ...state.row, autorizacion_ubicacion_exacta: args.p_autorizar_ubicacion,
        autorizacion_contacto_publico: args.p_autorizar_contacto, nombre_contacto_publico: args.p_nombre_contacto,
        telefono_contacto_publico: args.p_telefono_contacto, fecha_autorizacion_publicacion: args.p_autorizar_ubicacion && args.p_autorizar_contacto ? '2026-11-04T00:00:00Z' : null,
        visibilidad: options.forzarPrivado || !args.p_autorizar_ubicacion || !args.p_autorizar_contacto || state.solicitud?.estado !== 'aprobada' || !state.ubicacion ? 'privado' : 'publico' };
      state.publica = state.row.visibilidad === 'publico';
      return { data: state.row.visibilidad };
    },
  };
  const api = crearApiPublicacion(client, { consultarPublica: async mid => {
    calls.push({ tipo: 'lectura_anonima', id: mid });
    if (options.publicReadError) throw Error('DETALLE_INTERNO');
    return state.publica ? { id: options.idPublico || id } : null;
  } });
  return { state, calls, api };
}

test('las autorizaciones nuevas empiezan desmarcadas y sin datos de cuenta', () => {
  assert.deepEqual(formularioPublicacion({ email: 'PRIVADO', name: 'PRIVADO' }), {
    autorizarUbicacion: false, autorizarContacto: false, nombreContacto: '', telefonoContacto: '',
  });
});

test('el payload contiene únicamente los cinco argumentos reales, normalizados', () => {
  assert.deepEqual(datosPublicacion(id, { ...form(), nombreContacto: '  Contacto autorizado  ', telefonoContacto: ' 9991234567 ', propietario: otroId, estado: 'aprobada' }), {
    p_meliponario_id: id, p_autorizar_ubicacion: true, p_autorizar_contacto: true,
    p_nombre_contacto: 'Contacto autorizado', p_telefono_contacto: '9991234567',
  });
});

test('retirar contacto envía nulos aunque el formulario conserve texto anterior', () => {
  const data = datosPublicacion(id, { ...form(), autorizarContacto: false, nombreContacto: 'No publicar', telefonoContacto: 'No publicar' });
  assert.equal(data.p_nombre_contacto, null);
  assert.equal(data.p_telefono_contacto, null);
  assert.equal(data.p_autorizar_contacto, false);
});

test('valida las longitudes del contrato contando caracteres Unicode', () => {
  assert.doesNotThrow(() => datosPublicacion(id, { ...form(), nombreContacto: '🐝'.repeat(180) }));
  for (const [campo, valor] of [['nombreContacto', 'ab'], ['nombreContacto', '🐝'.repeat(181)], ['telefonoContacto', '123456'], ['telefonoContacto', '9'.repeat(31)]]) {
    assert.throws(() => datosPublicacion(id, { ...form(), [campo]: valor }), error => Boolean(error.campos[campo]));
  }
  assert.throws(() => datosPublicacion(id, { ...form(), autorizarUbicacion: false, nombreContacto: '' }), /Revisa/);
});

test('rechaza permisos implícitos e IDs de demostración antes de consultar', async () => {
  for (const invalid of [null, '', 'demo-local', '../registro']) assert.throws(() => datosPublicacion(invalid, form()), /Guarda primero/);
  assert.throws(() => datosPublicacion(id, { ...form(), autorizarContacto: 'true' }), /Revisa/);
  const e = entorno();
  await assert.rejects(e.api.guardar(userId, 'demo-local', form()), /Guarda primero/);
  assert.equal(e.calls.length, 0);
});

test('aprobación sin autorizaciones explica la privacidad sin exigir fotografías', () => {
  const reasons = motivosPublicacion({ ...formularioPublicacion(), estadoSolicitud: 'aprobada', tieneUbicacion: true, visibilidad: 'privado', publicada: false });
  assert.ok(reasons.some(x => x.includes('ubicación exacta')));
  assert.ok(reasons.some(x => x.includes('nombre y teléfono')));
  assert.ok(reasons.every(x => !/fotograf|Última solicitud/i.test(x)));
});

test('una ficha pendiente sigue privada aunque tenga ambos permisos', () => {
  const reasons = motivosPublicacion({ ...form(), estadoSolicitud: 'enviada', tieneUbicacion: true, visibilidad: 'privado', fechaAutorizacion: 'fecha', publicada: false });
  assert.ok(reasons.some(x => x.includes('no está aprobada')));
});

test('si todas las condiciones están guardadas pero no hay ficha pública lo distingue', () => {
  const saved = { ...form(), estadoSolicitud: 'aprobada', tieneUbicacion: true, visibilidad: 'publico', fechaAutorizacion: 'fecha', publicada: false };
  assert.equal(motivosPublicacion(saved).length, 1);
  assert.match(motivosPublicacion(saved)[0], /consulta pública/);
  assert.deepEqual(motivosPublicacion({ ...saved, publicada: true }), []);
});

test('lee solo al propietario y usa la solicitud con mayor número de intento', async () => {
  const e = entorno();
  const data = await e.api.leer(userId, id);
  assert.equal(data.estadoSolicitud, 'aprobada');
  assert.equal(data.tieneUbicacion, true);
  assert.equal(data.publicada, false);
  const own = e.calls.find(x => x.tabla === 'meliponarios');
  assert.deepEqual(own.filtros, [['id', id], ['responsable_principal_id', userId]]);
  const latest = e.calls.find(x => x.tabla === 'solicitudes_meliponario');
  assert.deepEqual(latest.orden, ['numero_intento', { ascending: false }]);
  assert.equal(latest.limite, 1);
  assert.ok(e.calls.some(x => x.tipo === 'lectura_anonima' && x.id === id));
  assert.equal(e.calls.some(x => x.tipo === 'rpc'), false);
});

test('los campos de cuentas y comentarios no se propagan al control de publicación', async () => {
  const e = entorno({ row: { ...row(), email: 'SECRETO', comentario: 'INTERNO', perfil: { telefono: 'PRIVADO' } } });
  const data = await e.api.leer(userId, id);
  assert.equal(/SECRETO|INTERNO|PRIVADO|responsable_principal_id/.test(JSON.stringify(data)), false);
});

test('los permisos antiguos nulos se presentan desmarcados para poder completarlos', async () => {
  const e = entorno({ row: { ...row(), autorizacion_ubicacion_exacta: null, autorizacion_contacto_publico: null } });
  const data = await e.api.leer(userId, id);
  assert.equal(data.autorizarUbicacion, false);
  assert.equal(data.autorizarContacto, false);
});

test('una sesión diferente impide leer o guardar sin llegar a las tablas', async () => {
  const e = entorno({ sessionId: otroId });
  await assert.rejects(e.api.leer(userId, id), /sesión cambió/);
  await assert.rejects(e.api.guardar(userId, id, form()), /sesión cambió/);
  assert.ok(e.calls.every(x => x.tipo === 'sesion'));
});

test('un perfil inactivo o un rol distinto de Cliente no puede escribir', async () => {
  for (const perfil of [{ id: userId, rol_id: 5, activo: false }, { id: userId, rol_id: 4, activo: true }]) {
    const e = entorno({ perfil });
    await assert.rejects(e.api.guardar(userId, id, form()), /Cliente con perfil activo/);
    assert.equal(e.calls.some(x => x.tipo === 'rpc'), false);
  }
});

test('un registro ajeno se rechaza aunque una respuesta manipulada lo incluya', async () => {
  const e = entorno({ row: { ...row(), responsable_principal_id: otroId } });
  await assert.rejects(e.api.guardar(userId, id, form()), /registros de tu cuenta/);
  assert.equal(e.calls.some(x => x.tipo === 'rpc'), false);
});

test('una lectura pública fallida se distingue de una ficha privada y permite retirar permisos', async () => {
  const e = entorno({ publicReadError: true });
  assert.equal((await e.api.leer(userId, id)).publicada, null);
  const saved = await e.api.guardar(userId, id, { ...form(), autorizarContacto: false });
  assert.equal(saved.guardadoConfirmado, true);
  assert.equal(saved.visibilidad, 'privado');
  assert.equal(saved.state.publicada, null);
});

test('una respuesta pública con UUID diferente no se considera publicada', async () => {
  const e = entorno({ publica: true, idPublico: otroId });
  assert.equal((await e.api.leer(userId, id)).publicada, null);
});

test('el aprobado existente se publica mediante una sola RPC y se vuelve a consultar sin sesión', async () => {
  const e = entorno();
  const saved = await e.api.guardar(userId, id, form());
  assert.equal(saved.guardadoConfirmado, true);
  assert.equal(saved.visibilidad, 'publico');
  assert.equal(saved.state.publicada, true);
  assert.equal(e.calls.filter(x => x.tipo === 'rpc').length, 1);
  assert.ok(e.calls.findIndex(x => x.tipo === 'lectura_anonima') > e.calls.findIndex(x => x.tipo === 'rpc'));
});

test('un aprobado privado con permisos ya marcados se puede volver a guardar para reevaluar su publicación', async () => {
  const e = entorno({ row: { ...row(), autorizacion_ubicacion_exacta: true, autorizacion_contacto_publico: true,
    nombre_contacto_publico: form().nombreContacto, telefono_contacto_publico: form().telefonoContacto } });
  const previous = await e.api.leer(userId, id);
  assert.equal(previous.publicada, false);
  const result = await e.api.guardar(userId, id, formularioPublicacion(previous));
  assert.equal(result.state.publicada, true);
});

test('una pendiente guarda las autorizaciones pero conserva la privacidad', async () => {
  const e = entorno({ solicitud: { estado: 'en_revision', numero_intento: 3 } });
  const saved = await e.api.guardar(userId, id, form());
  assert.equal(saved.visibilidad, 'privado');
  assert.equal(saved.state.publicada, false);
  assert.equal(saved.state.autorizarContacto, true);
});

test('no promete publicación si el backend devuelve privado aunque los permisos estén marcados', async () => {
  const e = entorno({ forzarPrivado: true });
  const saved = await e.api.guardar(userId, id, form());
  assert.equal(saved.state.publicada, false);
});

test('retirar cualquiera de las autorizaciones vuelve privada la ficha completa', async () => {
  for (const campo of ['autorizarUbicacion', 'autorizarContacto']) {
    const e = entorno({ publica: true, row: { ...row(), visibilidad: 'publico' } });
    const saved = await e.api.guardar(userId, id, { ...form(), [campo]: false });
    assert.equal(saved.visibilidad, 'privado');
    assert.equal(saved.state.publicada, false);
    if (campo === 'autorizarContacto') assert.equal(saved.state.nombreContacto, '');
  }
});

test('un fallo de red informa resultado incierto y no repite la escritura', async () => {
  const e = entorno({ networkError: true });
  await assert.rejects(e.api.guardar(userId, id, form()), error => error.resultadoIncierto && !error.message.includes('DETALLE_INTERNO'));
  assert.equal(e.calls.filter(x => x.tipo === 'rpc').length, 1);
});

test('un error sin código y una respuesta inesperada requieren comprobar el resultado', async () => {
  for (const options of [{ rpcError: { message: 'DETALLE_INTERNO' } }, { badResponse: true }]) {
    const e = entorno(options);
    await assert.rejects(e.api.guardar(userId, id, form()), error => error.resultadoIncierto === true);
    assert.equal(e.calls.filter(x => x.tipo === 'rpc').length, 1);
  }
});

test('los rechazos de permisos y validación no muestran detalles internos', async () => {
  for (const code of ['42501', '22023', '23514', 'PGRST202']) {
    const e = entorno({ rpcError: { code, message: 'DETALLE_INTERNO' } });
    await assert.rejects(e.api.guardar(userId, id, form()), error => !error.resultadoIncierto && !error.message.includes('DETALLE_INTERNO'));
  }
});

test('un guardado confirmado no se reporta como fallido si después falla la lectura', async () => {
  const e = entorno({ fallaLecturaPosterior: true });
  assert.deepEqual(await e.api.guardar(userId, id, form()), { guardadoConfirmado: true, visibilidad: 'publico', state: null });
  assert.equal(e.calls.filter(x => x.tipo === 'rpc').length, 1);
});

test('si cambia la sesión después de guardar no reutiliza el acceso anterior', async () => {
  const e = entorno({ cambioTrasGuardar: true });
  const saved = await e.api.guardar(userId, id, form());
  assert.equal(saved.guardadoConfirmado, true);
  assert.equal(saved.state, null);
  assert.equal(e.calls.some(x => x.tipo === 'lectura_anonima'), false);
});

test('un fallo previo de lectura no llega a la función de escritura', async () => {
  const e = entorno({ readError: true });
  await assert.rejects(e.api.guardar(userId, id, form()), /consultar|comprobar/);
  assert.equal(e.calls.some(x => x.tipo === 'rpc'), false);
});
