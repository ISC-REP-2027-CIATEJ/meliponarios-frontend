import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { crearApiPublica, crearClienteLecturaPublica, normalizarFichaPublica, filtrarPublicos, enlaceTelefono } from '../src/features/publicMeliponarios/publicApi.mjs';

const id = n => '50000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ficha = (n = 1) => ({
  id: id(n), nombre: 'Meliponario ' + n, descripcion: 'Descripción autorizada',
  municipio: 'Valladolid', localidad: 'Localidad autorizada', latitud: 20.7, longitud: -88.2,
  nombre_contacto: 'Contacto público', telefono_contacto: '9991234567',
  categoria_marcador: 'venta_miel', ofrece_venta_miel: true, ofrece_visitas: false,
  informacion_tecnica_verificada: false,
});
const origen = 'https://kaabmap.invalid';
const ruta = n => id(1) + '/' + id(n) + '.webp';
const imagen = (n = 2, posicion = 1) => ({ id: id(n), ruta_storage: ruta(n), posicion, descripcion: 'Colmenas' });
const firma = path => ({ path, signedUrl: origen + '/storage/v1/object/sign/kaabmap-meliponarios/' + path + '?token=firma-de-prueba' });

function cliente(handle, firmar) {
  return {
    rpc(name, args) {
      if (name === 'listar_imagenes_meliponario') return handle(name, args);
      const consulta = { order(column) { assert.equal(column, 'id'); return consulta; },
        range(from, to) { return handle(name, args, { from, to }); } };
      return consulta;
    },
    auth: new Proxy({}, { get() { throw Error('La lectura pública no debe solicitar una sesión'); } }),
    from() { throw Error('No consultar tablas de cuentas, revisiones ni registros privados'); },
    storage: { from(bucket) { assert.equal(bucket, 'kaabmap-meliponarios'); return {
      createSignedUrls(paths, expires) { assert.equal(expires, 60); return firmar(paths); },
    }; } },
  };
}
const apiFotos = (data, firmar = paths => ({ data: paths.map(firma) })) =>
  crearApiPublica(cliente((name, args) => {
    assert.equal(name, 'listar_imagenes_meliponario');
    assert.deepEqual(args, { p_meliponario_id: id(1) });
    return { data };
  }, firmar), { origenAlmacenamiento: origen });

test('el visitante consulta la RPC real con p_id nulo y orden estable', async () => {
  const calls = [];
  const api = crearApiPublica(cliente((name, args, range) => {
    calls.push({ name, args, range });
    return { data: range.from === 0 ? [ficha()] : [] };
  }));
  assert.equal((await api.listar())[0].id, id(1));
  assert.deepEqual(calls, [
    { name: 'listar_meliponarios_publicos', args: { p_id: null }, range: { from: 0, to: 499 } },
    { name: 'listar_meliponarios_publicos', args: { p_id: null }, range: { from: 1, to: 500 } },
  ]);
});

test('la paginación tolera un límite del servidor menor al solicitado y elimina duplicados', async () => {
  const offsets = [];
  const api = crearApiPublica(cliente((_, args, range) => {
    assert.equal(args.p_id, null);
    offsets.push(range.from);
    return { data: ({ 0: [ficha(1), ficha(2)], 2: [ficha(2), ficha(3)], 4: [] })[range.from] };
  }));
  assert.deepEqual((await api.listar()).map(x => x.id), [id(1), id(2), id(3)]);
  assert.deepEqual(offsets, [0, 2, 4]);
});

test('se detiene ante una paginación que repite la misma página', async () => {
  let calls = 0;
  const api = crearApiPublica(cliente(() => { calls++; return { data: [ficha()] }; }));
  await assert.rejects(api.listar(), /verificar/);
  assert.equal(calls, 2);
});

test('la ficha consulta el UUID real mediante la misma RPC, sin sesión ni tablas', async () => {
  const api = crearApiPublica(cliente((name, args, range) => {
    assert.equal(name, 'listar_meliponarios_publicos');
    assert.deepEqual(args, { p_id: id(1) });
    assert.deepEqual(range, { from: 0, to: 1 });
    return { data: [ficha()] };
  }));
  assert.equal((await api.ficha(encodeURIComponent(id(1).toUpperCase()))).id, id(1));
});

test('un privado y un ID inexistente reciben la misma respuesta pública vacía', async () => {
  const api = crearApiPublica(cliente(() => ({ data: [] })));
  assert.equal(await api.ficha(id(2)), null);
  assert.equal(await api.ficha(id(3)), null);
});

test('no consulta IDs locales ni valores malformados', async () => {
  const api = crearApiPublica(cliente(() => { throw Error('No llamar'); }));
  for (const value of ['xunaan-kab', '%ZZ', '../registro', null, '', {}, undefined]) {
    assert.equal(await api.ficha(value), null);
    assert.deepEqual(await api.fotos(value), { fotos: [], faltantes: 0 });
  }
});

test('rechaza UUID distinto, duplicados y el formato de la propuesta antigua', async () => {
  for (const data of [[ficha(2)], [ficha(), ficha()], ficha(), { meliponarios: [ficha()], total: 1 }]) {
    await assert.rejects(crearApiPublica(cliente(() => ({ data }))).ficha(id(1)), /verificar/);
  }
});

test('la lista blanca muestra solo contacto autorizado y no arrastra cuentas ni comentarios', () => {
  const raw = { ...ficha(), email: 'SECRETO', responsable_principal_id: id(90), comentario: 'INTERNO',
    telefono: 'PRIVADO', referencia: 'PRIVADA', imagenes: ['foto-no-autorizada'], productos: [{ precio: 10 }],
    especies: [{ cantidad_cajas: 900 }], estado_operativo: 'sin_verificar' };
  const clean = normalizarFichaPublica(raw);
  assert.equal(clean.nombreContacto, 'Contacto público');
  assert.equal(clean.telefonoContacto, '9991234567');
  assert.equal(clean.estado, 'Publicado');
  assert.equal(clean.informacionTecnicaVerificada, false);
  assert.equal(clean.especiesDisponibles, false);
  assert.equal(clean.productosDisponibles, false);
  assert.deepEqual(clean.especies, []);
  assert.deepEqual(clean.productos, []);
  for (const secret of ['SECRETO', 'INTERNO', 'PRIVADO', 'PRIVADA', 'cantidad_cajas', 'foto-no-autorizada', 'responsable_principal_id']) {
    assert.equal(JSON.stringify(clean).includes(secret), false);
  }
});

test('no inventa coordenadas, estado operativo, fecha de publicación ni especies', () => {
  const clean = normalizarFichaPublica(ficha());
  assert.deepEqual(clean.coordenadas, [20.7, -88.2]);
  assert.equal(clean.ubicacionAproximada, false);
  assert.equal('publicadaEn' in clean, false);
  assert.notEqual(clean.estado, 'Activo');
  for (const latitud of [null, '20.7', NaN, 91]) assert.throws(() => normalizarFichaPublica({ ...ficha(), latitud }), /verificar/);
  for (const field of ['nombre_contacto', 'telefono_contacto', 'informacion_tecnica_verificada']) {
    assert.throws(() => normalizarFichaPublica({ ...ficha(), [field]: null }), /verificar/);
  }
});

test('los colores derivan de actividades reales y no de etiquetas arbitrarias', () => {
  for (const [ofrece_venta_miel, ofrece_visitas, expected] of [[true, false, 'miel'], [false, true, 'difusion'], [true, true, 'ambos'], [false, false, null]]) {
    assert.equal(normalizarFichaPublica({ ...ficha(), ofrece_venta_miel, ofrece_visitas, categoria_marcador: 'inventado' }).ofertaVisualDemo, expected);
  }
});

test('la búsqueda usa nombre, municipio y localidad; los filtros sin datos públicos no ocultan registros', () => {
  const item = normalizarFichaPublica({ ...ficha(), nombre: 'Abejas de Yucatán' });
  assert.equal(filtrarPublicos([item], { busqueda: 'yucatan' }).length, 1);
  assert.equal(filtrarPublicos([item], { busqueda: 'localidad autorizada' }).length, 1);
  assert.equal(filtrarPublicos([item], { municipio: 'Valladolid', especie: 'filtro antiguo', conProductos: true }).length, 1);
  assert.equal(filtrarPublicos([item], { activos: true }).length, 0);
  assert.equal(filtrarPublicos([{ ...item, informacionTecnicaVerificada: true }], { activos: true }).length, 1);
  assert.equal(filtrarPublicos([item], { municipio: 'Izamal' }).length, 0);
});

test('conserva los filtros de los puntos privados propios sin mezclarlos con fichas públicas', () => {
  const privado = { id: 'local', nombre: 'Propio', estado: 'Borrador', municipio: 'Izamal', localidad: '', especies: ['Abeja'], productos: [] };
  assert.equal(filtrarPublicos([privado], { especie: 'otra' }).length, 0);
  assert.equal(filtrarPublicos([privado], { especie: 'Abeja' }).length, 1);
});

test('los fallos no activan datos demo ni revelan mensajes internos', async () => {
  for (const error of [{ code: '42501', message: 'TABLA_INTERNA' }, { message: 'SECRETO' }]) {
    await assert.rejects(crearApiPublica(cliente(() => ({ error }))).listar(),
      result => !/SECRETO|TABLA_INTERNA/.test(result.message) && /cargar/.test(result.message));
  }
  await assert.rejects(crearApiPublica(cliente(() => { throw Error('SECRETO'); })).listar(), /conexión/);
  await assert.rejects(crearApiPublica(cliente(() => ({ error: { code: 'PGRST202' } }))).listar(), /todavía no está disponible/);
});

test('las fotografías se ordenan y se firman por 60 segundos en el bucket privado', async () => {
  const result = await apiFotos([imagen(3, 2), imagen(2, 1)]).fotos(id(1));
  assert.deepEqual(result.fotos.map(f => [f.id, f.posicion]), [[id(2), 1], [id(3), 2]]);
  assert.equal(result.fotos[0].descripcion, 'Colmenas');
  assert.equal(result.faltantes, 0);
  assert.equal('ruta' in result.fotos[0], false);
});

test('sin metadatos públicos no solicita URLs de Storage', async () => {
  const api = apiFotos([], () => { throw Error('No firmar'); });
  assert.deepEqual(await api.fotos(id(1)), { fotos: [], faltantes: 0 });
});

test('una reserva sin archivo no bloquea las demás fotografías', async () => {
  const result = await apiFotos([imagen(2, 1), imagen(3, 2)], paths => ({
    data: [firma(paths[0]), { path: paths[1], error: 'Object not found', signedUrl: null }],
  })).fotos(id(1));
  assert.equal(result.fotos.length, 1);
  assert.equal(result.faltantes, 1);
});

test('rechaza fotos de otro meliponario, rutas inseguras y posiciones duplicadas', async () => {
  for (const data of [
    [{ ...imagen(), ruta_storage: id(4) + '/foto.jpg' }],
    [{ ...imagen(), ruta_storage: id(1) + '/../foto.jpg' }],
    [{ ...imagen(), ruta_storage: id(1) + '/foto.jpg?token=otro' }],
    [{ ...imagen(), ruta_storage: id(1) + '/foto.svg' }],
    [{ ...imagen(), posicion: 6 }],
    [imagen(2, 1), imagen(3, 1)],
    Array.from({ length: 6 }, (_, index) => imagen(index + 2, index + 1)),
  ]) await assert.rejects(apiFotos(data).fotos(id(1)), /verificar/);
});

test('rechaza enlaces externos, protocolos ejecutables y firmas de otro bucket', async () => {
  for (const url of ['javascript:alert(1)', 'https://otro.invalid/foto.webp', origen + '/storage/v1/object/public/imagenes/foto.webp', 'http://kaabmap.invalid/storage/v1/object/sign/kaabmap-meliponarios/foto.webp']) {
    const result = await apiFotos([imagen()], paths => ({ data: [{ path: paths[0], signedUrl: url }] })).fotos(id(1));
    assert.deepEqual(result, { fotos: [], faltantes: 1 });
  }
});

test('un fallo de Storage mantiene un mensaje público sin filtrar detalles internos', async () => {
  await assert.rejects(apiFotos([imagen()], () => ({ error: { message: 'SECRETO' } })).fotos(id(1)),
    error => /fotografías/.test(error.message) && !error.message.includes('SECRETO'));
});

test('los enlaces telefónicos aceptan solo números de marcación seguros', () => {
  assert.equal(enlaceTelefono('+52 (999) 123-4567'), 'tel:+529991234567');
  for (const value of ['javascript:alert(1)', '9991234567;ext=1', '<script>', null, '123']) assert.equal(enlaceTelefono(value), null);
});

test('el cliente público desactiva persistencia, renovación y captura de tokens de URL', () => {
  const result = crearClienteLecturaPublica((url, key, options) => ({ url, key, options }), origen, 'clave-publica-de-prueba');
  assert.deepEqual(result.options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'kaabmap-public-read-v1' });
});

test('el SDK real envía consultas anónimas, paginación y firma sin utilizar un token de propietario', async () => {
  const calls = [];
  const publicKey = 'clave-publica-de-prueba';
  const real = crearClienteLecturaPublica((url, key, options) => createClient(url, key, {
    ...options,
    global: { fetch: async (url, init) => {
      const request = new URL(url);
      const headers = new Headers(init.headers);
      assert.equal(headers.get('apikey'), publicKey);
      assert.equal(headers.get('authorization'), 'Bearer ' + publicKey);
      calls.push({ path: request.pathname, body: init.body, search: request.search });
      const data = request.pathname.endsWith('/listar_meliponarios_publicos') ? [ficha()] :
        request.pathname.endsWith('/listar_imagenes_meliponario') ? [imagen()] :
          [{ path: ruta(2), signedURL: '/object/sign/kaabmap-meliponarios/' + ruta(2) + '?token=prueba' }];
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  }), origen, publicKey);
  const api = crearApiPublica(real, { origenAlmacenamiento: origen });
  assert.equal((await api.ficha(id(1))).id, id(1));
  assert.equal((await api.fotos(id(1))).fotos.length, 1);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].search.includes('order=id.asc'));
  assert.ok(calls[0].search.includes('limit=2'));
  assert.deepEqual(JSON.parse(calls[2].body), { expiresIn: 60, paths: [ruta(2)] });
});
