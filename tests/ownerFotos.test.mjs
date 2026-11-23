import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { BUCKET_FOTOS, MAX_BYTES_FOTO, crearApiFotos, normalizarFotosPropias, validarFotoPreparada } from '../src/features/ownerMeliponarios/fotosSupabase.mjs';

const id = n => '50000000-0000-4000-8000-' + String(n).padStart(12, '0');
const userId = id(101), mid = id(1), origen = 'https://fotos.example.invalid';
const foto = (n = 2, posicion = 1) => ({ id: id(n), ruta_storage: mid + '/' + id(n) + '.webp', posicion, descripcion: 'Cajas del meliponario' });
const preparada = () => ({ blob: new Blob(['RIFF0000WEBPpixel'], { type: 'image/webp' }), metadatosEliminados: true, descripcion: 'Descripción pública' });
const signed = path => ({ path, signedUrl: origen + '/storage/v1/object/sign/' + BUCKET_FOTOS + '/' + path + '?token=prueba' });

function entorno(options = {}) {
  const rows = (options.rows || []).map(item => ({ ...item }));
  const objects = new Set(options.objects || rows.map(row => row.ruta_storage));
  const calls = [];
  let afterReserve = false;
  const client = {
    auth: { async getUser() {
      calls.push(['auth']);
      return { data: { user: { id: options.sessionId || (afterReserve && options.cambiarSesion ? id(103) : userId) } } };
    } },
    from(table) {
      const query = { table, filtros: [], columnas: '' };
      const builder = {
        select(columns) { query.columnas = columns; return builder; },
        eq(field, value) { query.filtros.push([field, value]); return builder; },
        async maybeSingle() {
          calls.push(['select', query]);
          if (options.readError) return { error: { code: '42501', message: 'SECRETO' } };
          return { data: table === 'perfiles' ? { id: userId, rol_id: options.rol ?? 5, activo: options.activo ?? true } :
            { id: mid, responsable_principal_id: options.ownerId || userId, visibilidad: options.visibilidad || 'privado' } };
        },
      };
      return builder;
    },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (name === 'listar_imagenes_meliponario') {
        assert.deepEqual(args, { p_meliponario_id: mid });
        return options.listError ? { error: { message: 'SECRETO' } } : { data: rows.map(item => ({ ...item })) };
      }
      if (name === 'reservar_imagen_meliponario') {
        if (options.reserveThrow) throw Error('SECRETO');
        if (options.reserveError) return { error: options.reserveError };
        const row = foto(20, rows.length + 1);
        if (args.p_tipo_mime === 'image/png') row.ruta_storage = mid + '/' + row.id + '.png';
        row.descripcion = args.p_descripcion;
        rows.push(row); afterReserve = true;
        return { data: options.badReserve ? { id: id(20), ruta_storage: 'otra/ruta.webp', posicion: 1 } : { ...row } };
      }
      if (name === 'eliminar_imagen_meliponario') {
        if (options.deleteThrow) throw Error('SECRETO');
        if (options.deleteError) return { error: { code: '42501', message: 'SECRETO' } };
        const index = rows.findIndex(row => row.id === args.p_imagen_id);
        if (index >= 0) rows.splice(index, 1);
        return { data: null };
      }
      throw Error('RPC inesperada');
    },
    storage: { from(bucket) {
      assert.equal(bucket, BUCKET_FOTOS);
      return {
        async createSignedUrls(paths, seconds) {
          calls.push(['firmar', paths, seconds]); assert.equal(seconds, 60);
          if (options.signThrow) throw Error('SECRETO');
          return { data: paths.map(path => options.badSign ? { path, signedUrl: 'javascript:alert(1)' } :
            objects.has(path) ? signed(path) : { path, error: 'Object not found' }) };
        },
        async info(path) {
          calls.push(['info', path]);
          if (options.infoError) return { error: { status: 403, message: 'SECRETO' } };
          if (options.bucketMissing) return { error: { status: 404, code: 'NoSuchBucket', message: 'Bucket not found' } };
          return objects.has(path) ? { data: { size: 10, name: path } } :
            { error: options.legacy404 ? { status: 400, statusCode: '404', message: 'Object not found' } :
              { status: 404, error: 'NoSuchKey', message: 'The specified key does not exist.' } };
        },
        async upload(path, blob, settings) {
          calls.push(['upload', path, blob, settings]);
          if (options.uploadThrow) { objects.add(path); throw Error('SECRETO'); }
          if (options.uploadError) return { error: { status: 413, message: 'SECRETO' } };
          objects.add(path); return { data: { path } };
        },
        async remove(paths) {
          calls.push(['remove', paths]);
          if (options.removeThrow) throw Error('SECRETO');
          if (options.removeError) return { error: { status: 403, message: 'SECRETO' } };
          if (!options.removeSinEfecto) paths.forEach(path => objects.delete(path));
          return { data: [] };
        },
      };
    } },
  };
  return { api: crearApiFotos(client, { origenAlmacenamiento: origen }), calls, rows, objects };
}

test('valida el archivo preparado, su tamaño, formato y descripción antes de una reserva', () => {
  assert.equal(validarFotoPreparada(preparada()).descripcion, 'Descripción pública');
  for (const value of [{ ...preparada(), metadatosEliminados: false }, { ...preparada(), blob: new Blob([], { type: 'image/webp' }) },
    { ...preparada(), blob: new Blob([new Uint8Array(MAX_BYTES_FOTO + 1)], { type: 'image/webp' }) },
    { ...preparada(), blob: new Blob(['svg'], { type: 'image/svg+xml' }) }, { ...preparada(), descripcion: '🐝'.repeat(251) }]) {
    assert.throws(() => validarFotoPreparada(value));
  }
  assert.equal(validarFotoPreparada({ ...preparada(), descripcion: '🐝'.repeat(250) }).descripcion.length, 500);
});

test('rechaza datos, rutas y posiciones de imágenes ajenas o mal formadas', () => {
  for (const data of [[{ ...foto(), ruta_storage: id(3) + '/foto.webp' }], [{ ...foto(), ruta_storage: mid + '/../foto.webp' }],
    [{ ...foto(), ruta_storage: mid + '/foto.webp?token=otro' }], [{ ...foto(), posicion: 6 }],
    [foto(2, 1), foto(3, 1)], Array.from({ length: 6 }, (_, i) => foto(i + 2, i + 1))]) {
    assert.throws(() => normalizarFotosPropias(data, mid), /contrato/);
  }
});

test('la galería vacía no solicita firmas ni representa un error de lectura', async () => {
  const e = entorno();
  assert.deepEqual(await e.api.listar(userId, mid), { items: [], visibilidad: 'privado', aviso: '' });
  assert.equal(e.calls.some(c => c[0] === 'firmar'), false);
});

test('el propietario ve sus fotos privadas por RPC y firma sin consultar la tabla de imágenes', async () => {
  const e = entorno({ rows: [foto(3, 2), foto(2, 1)] });
  const result = await e.api.listar(userId, mid);
  assert.deepEqual(result.items.map(item => item.id), [id(2), id(3)]);
  assert.ok(result.items.every(item => item.estadoArchivo === 'disponible' && item.url));
  assert.ok(e.calls.filter(c => c[0] === 'select').every(c => ['perfiles', 'meliponarios'].includes(c[1].table)));
  assert.deepEqual(e.calls.find(c => c[0] === 'select' && c[1].table === 'meliponarios')[1].filtros, [['id', mid], ['responsable_principal_id', userId]]);
});

test('una reserva sin objeto se distingue de una imagen no comprobada', async () => {
  const missing = await entorno({ rows: [foto()], objects: [] }).api.listar(userId, mid);
  assert.equal(missing.items[0].estadoArchivo, 'sin_archivo');
  const unknown = await entorno({ rows: [foto()], signThrow: true, infoError: true }).api.listar(userId, mid);
  assert.equal(unknown.items[0].estadoArchivo, 'sin_comprobar');
  assert.ok(unknown.aviso);
});

test('admite el error legado de objeto no encontrado sin confundir otros errores de acceso', async () => {
  const e = entorno({ rows: [foto()], objects: [], legacy404: true });
  assert.equal((await e.api.listar(userId, mid)).items[0].estadoArchivo, 'sin_archivo');
});

test('un bucket ausente no se confunde con una reserva sin archivo ni autoriza borrar metadatos', async () => {
  const e = entorno({ rows: [foto()], signThrow: true, bucketMissing: true });
  assert.equal((await e.api.listar(userId, mid)).items[0].estadoArchivo, 'sin_comprobar');
  await assert.rejects(e.api.eliminar(userId, mid, id(2)), error => error.requiereComprobar);
  assert.equal(e.calls.some(c => c[1] === 'eliminar_imagen_meliponario'), false);
});

test('un enlace inválido o de otro origen no se inserta como imagen', async () => {
  const data = await entorno({ rows: [foto()], badSign: true }).api.listar(userId, mid);
  assert.equal(data.items[0].url, null);
  assert.equal(data.items[0].estadoArchivo, 'sin_comprobar');
});

test('un fallo en el listado no se disfraza de una galería vacía', async () => {
  await assert.rejects(entorno({ listError: true }).api.listar(userId, mid), /consultar/);
});

test('rechaza sesiones distintas, perfiles inactivos, otros roles y registros ajenos', async () => {
  for (const options of [{ sessionId: id(103) }, { activo: false }, { rol: 4 }, { ownerId: id(103) }]) {
    const e = entorno(options);
    await assert.rejects(e.api.subir(userId, mid, preparada()));
    assert.equal(e.calls.some(c => c[0] === 'rpc'), false);
    assert.equal(e.calls.some(c => c[0] === 'upload'), false);
  }
});

test('no reserva para IDs demo ni para fotos sin preparar', async () => {
  const e = entorno();
  await assert.rejects(e.api.subir(userId, 'demo-local', preparada()));
  await assert.rejects(e.api.subir(userId, mid, { ...preparada(), metadatosEliminados: false }));
  assert.equal(e.calls.length, 0);
});

test('la subida reserva primero y usa la ruta real, tipo correcto y upsert falso', async () => {
  const e = entorno();
  const result = await e.api.subir(userId, mid, { ...preparada(), nombreLocal: 'nombre-privado-de-mi-archivo.webp' });
  assert.equal(result.subidaConfirmada, true);
  const reserve = e.calls.findIndex(c => c[0] === 'rpc' && c[1] === 'reservar_imagen_meliponario');
  const uploaded = e.calls.findIndex(c => c[0] === 'upload');
  assert.ok(reserve < uploaded);
  assert.deepEqual(e.calls[reserve][2], { p_meliponario_id: mid, p_tipo_mime: 'image/webp', p_descripcion: 'Descripción pública' });
  assert.equal(e.calls[uploaded][1], mid + '/' + id(20) + '.webp');
  assert.deepEqual(e.calls[uploaded][3], { contentType: 'image/webp', cacheControl: '60', upsert: false });
  assert.equal(JSON.stringify(e.calls).includes('nombre-privado'), false);
});

test('respeta el PNG real que canvas haya generado como alternativa', async () => {
  const e = entorno();
  const result = await e.api.subir(userId, mid, { ...preparada(), blob: new Blob(['png'], { type: 'image/png' }) });
  assert.ok(result.ruta.endsWith('.png'));
});

test('los cinco espacios incluyen reservas sin archivo y no permiten otra reserva local', async () => {
  const e = entorno({ rows: Array.from({ length: 5 }, (_, i) => foto(i + 2, i + 1)), objects: [] });
  await assert.rejects(e.api.subir(userId, mid, preparada()), /cinco espacios/);
  assert.equal(e.calls.some(c => c[0] === 'rpc' && c[1] === 'reservar_imagen_meliponario'), false);
});

test('también respeta el límite atómico que devuelva el servidor ante otra ventana', async () => {
  const e = entorno({ reserveError: { code: '23514', message: 'SECRETO' } });
  await assert.rejects(e.api.subir(userId, mid, preparada()), /servidor indica/);
  assert.equal(e.calls.some(c => c[0] === 'upload'), false);
});

test('un rechazo de permisos, formato o función ausente no reintenta ni filtra mensajes internos', async () => {
  for (const code of ['42501', '22023', 'PGRST202']) {
    const e = entorno({ reserveError: { code, message: 'SECRETO' } });
    await assert.rejects(e.api.subir(userId, mid, preparada()), error => !error.requiereComprobar && !error.message.includes('SECRETO'));
    assert.equal(e.calls.filter(c => c[0] === 'rpc' && c[1] === 'reservar_imagen_meliponario').length, 1);
  }
});

test('la reserva incierta o inválida exige comprobar sin volver a reservar ni subir', async () => {
  for (const options of [{ reserveThrow: true }, { badReserve: true }, { reserveError: { message: 'SECRETO' } }]) {
    const e = entorno(options);
    await assert.rejects(e.api.subir(userId, mid, preparada()), error => error.requiereComprobar && error.fase === 'reserva');
    assert.equal(e.calls.some(c => c[0] === 'upload'), false);
  }
});

test('una pérdida de respuesta al subir conserva archivo y metadatos, sin borrar ni reintentar', async () => {
  const e = entorno({ uploadThrow: true });
  await assert.rejects(e.api.subir(userId, mid, preparada()), error => error.requiereComprobar && error.reserva.id === id(20));
  assert.equal(e.rows.length, 1);
  assert.equal(e.objects.size, 1);
  assert.equal(e.calls.filter(c => c[0] === 'upload').length, 1);
  assert.equal(e.calls.some(c => c[0] === 'remove' || c[1] === 'eliminar_imagen_meliponario'), false);
});

test('un archivo rechazado conserva su reserva para que el propietario la compruebe', async () => {
  const e = entorno({ uploadError: true });
  await assert.rejects(e.api.subir(userId, mid, preparada()), error => error.requiereComprobar && error.fase === 'archivo');
  assert.equal(e.rows.length, 1); assert.equal(e.objects.size, 0);
  assert.equal((await e.api.listar(userId, mid)).items[0].estadoArchivo, 'sin_archivo');
});

test('un cambio de sesión después de reservar impide la subida con otra cuenta', async () => {
  const e = entorno({ cambiarSesion: true });
  await assert.rejects(e.api.subir(userId, mid, preparada()), error => error.requiereComprobar);
  assert.equal(e.calls.some(c => c[0] === 'upload'), false);
  assert.equal(e.rows.length, 1);
});

test('elimina y verifica el archivo antes de borrar el registro de metadatos', async () => {
  const e = entorno({ rows: [foto()] });
  assert.equal((await e.api.eliminar(userId, mid, id(2))).eliminacionConfirmada, true);
  const remove = e.calls.findIndex(c => c[0] === 'remove');
  const metadata = e.calls.findIndex(c => c[0] === 'rpc' && c[1] === 'eliminar_imagen_meliponario');
  assert.ok(remove > 0 && metadata > remove);
  assert.ok(e.calls.slice(remove + 1, metadata).some(c => c[0] === 'info'));
  assert.deepEqual(e.calls[remove][1], [foto().ruta_storage]);
  assert.deepEqual(e.calls[metadata][2], { p_imagen_id: id(2) });
  assert.equal(e.rows.length, 0); assert.equal(e.objects.size, 0);
});

test('una reserva incompleta se puede eliminar comprobando que el archivo no existe', async () => {
  const e = entorno({ rows: [foto()], objects: [] });
  await e.api.eliminar(userId, mid, id(2));
  assert.equal(e.calls.some(c => c[0] === 'remove'), false);
  assert.equal(e.rows.length, 0);
});

test('remove vacío sin efecto no provoca borrar metadatos mientras siga el archivo', async () => {
  const e = entorno({ rows: [foto()], removeSinEfecto: true });
  await assert.rejects(e.api.eliminar(userId, mid, id(2)), error => error.requiereComprobar);
  assert.equal(e.objects.size, 1); assert.equal(e.rows.length, 1);
  assert.equal(e.calls.some(c => c[1] === 'eliminar_imagen_meliponario'), false);
});

test('no borra metadatos si falla comprobar o eliminar el archivo', async () => {
  for (const options of [{ infoError: true }, { removeError: true }, { removeThrow: true }]) {
    const e = entorno({ rows: [foto()], ...options });
    await assert.rejects(e.api.eliminar(userId, mid, id(2)), error => error.requiereComprobar);
    assert.equal(e.rows.length, 1);
    assert.equal(e.calls.some(c => c[1] === 'eliminar_imagen_meliponario'), false);
  }
});

test('si falla el borrado del registro, conserva la reserva sin repetir la escritura', async () => {
  for (const options of [{ deleteError: true }, { deleteThrow: true }]) {
    const e = entorno({ rows: [foto()], ...options });
    await assert.rejects(e.api.eliminar(userId, mid, id(2)), error => error.requiereComprobar && error.fase === 'registro');
    assert.equal(e.objects.size, 0); assert.equal(e.rows.length, 1);
    assert.equal(e.calls.filter(c => c[1] === 'eliminar_imagen_meliponario').length, 1);
  }
});

test('un UUID ajeno a la galería nunca se convierte en una ruta para eliminar', async () => {
  const e = entorno({ rows: [foto()] });
  await assert.rejects(e.api.eliminar(userId, mid, id(500)), /ya no aparece/);
  assert.equal(e.calls.some(c => c[0] === 'info' || c[0] === 'remove'), false);
  assert.equal(e.rows.length, 1);
});

test('el SDK real usa reserva, upload, info y remove con los endpoints y cuerpos esperados', async () => {
  const requests = [];
  let row = null, object = false;
  const sdk = createClient(origen, 'clave-publica-de-prueba', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      const path = new URL(url).pathname;
      const method = init.method || 'GET';
      requests.push({ path, method, body: init.body });
      let data, status = 200;
      if (path.endsWith('/perfiles')) data = [{ id: userId, rol_id: 5, activo: true }];
      else if (path.endsWith('/meliponarios')) data = [{ id: mid, responsable_principal_id: userId, visibilidad: 'privado' }];
      else if (path.endsWith('/listar_imagenes_meliponario')) data = row ? [row] : [];
      else if (path.endsWith('/reservar_imagen_meliponario')) { row = foto(); data = { id: row.id, ruta_storage: row.ruta_storage, posicion: row.posicion }; }
      else if (path.includes('/object/info/')) {
        if (object) data = { id: id(90), name: foto().ruta_storage, size: 10 };
        else { status = 404; data = { error: 'NoSuchKey', message: 'The specified key does not exist.', statusCode: '404' }; }
      }
      else if (path.endsWith('/object/' + BUCKET_FOTOS) && method === 'DELETE') { object = false; data = []; }
      else if (path.includes('/object/' + BUCKET_FOTOS + '/') && method === 'POST') { object = true; data = { Id: id(90), Key: BUCKET_FOTOS + '/' + foto().ruta_storage }; }
      else if (path.endsWith('/eliminar_imagen_meliponario')) { row = null; data = null; }
      else throw Error('Ruta inesperada: ' + path);
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  sdk.auth.getUser = async () => ({ data: { user: { id: userId } }, error: null });
  const api = crearApiFotos(sdk, { origenAlmacenamiento: origen });
  assert.equal((await api.subir(userId, mid, preparada())).subidaConfirmada, true);
  const upload = requests.find(request => request.path.includes('/object/' + BUCKET_FOTOS + '/') && request.method === 'POST');
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get('cacheControl'), '60');
  assert.equal((await api.eliminar(userId, mid, id(2))).eliminacionConfirmada, true);
  const remove = requests.find(request => request.method === 'DELETE');
  assert.deepEqual(JSON.parse(remove.body), { prefixes: [foto().ruta_storage] });
});
