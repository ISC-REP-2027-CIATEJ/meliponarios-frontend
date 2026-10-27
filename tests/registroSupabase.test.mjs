import test from 'node:test';
import assert from 'node:assert/strict';
import { construirDatosRegistro, validarFormularioRemoto, combinarRegistros, crearApiRegistroSupabase } from '../src/features/ownerMeliponarios/registroSupabase.mjs';

const uid = '10000000-0000-0000-0000-000000000001';
const otro = '10000000-0000-0000-0000-000000000002';
const mid = '20000000-0000-0000-0000-000000000001';
const lid = '30000000-0000-0000-0000-000000000001';
const eid = '40000000-0000-0000-0000-000000000001';
const rid = '50000000-0000-0000-0000-000000000001';
const sid = '60000000-0000-0000-0000-000000000001';
const catalogo = { municipios: [{ id: mid, nombre: 'Municipio de prueba' }], localidades: [{ id: lid, municipioId: mid, nombre: 'Localidad de prueba' }], abejas: [{ id: eid, nombre: 'Tipo de prueba' }] };
const formulario = () => ({ nombre: '  Registro de prueba  ', municipioId: mid, localidadId: lid, descripcion: '', referencia: '', abejas: [], coordenadas: null, vendeMiel: false, recibeVisitas: false, productos: [] });

function fake({ user = uid, activo = true, rol = 5, tablas = {}, rpcError = null, rpcThrow = false, rpcData = rid, falloTabla = null, maxRows = Infinity } = {}) {
  const calls = [];
  const datos = { perfiles: [{ id: uid, activo, rol_id: rol }], municipios: [{ id: mid, nombre: 'Municipio de prueba', activo: true, clave_entidad: '31' }], especies: [{ id: eid, nombre_cientifico: 'Tipo de prueba', activo: true }], localidades: [{ id: lid, municipio_id: mid, nombre: 'Localidad de prueba', activo: true }], ...tablas };
  function query(tabla) {
    const filtros = [];
    const orden = [];
    let columnas = '';
    function run(inicio = 0, fin = Infinity) {
      calls.push({ tabla, filtros: [...filtros], columnas, inicio, fin });
      if (tabla === falloTabla) return { data: null, error: { code: '42501' } };
      let rows = [...(tabla === 'mapa_rpc' ? datos.puntos ?? [] : datos[tabla] ?? [])];
      for (const [op, campo, valor] of filtros) rows = rows.filter(item => op === 'eq' ? item[campo] === valor : valor.includes(item[campo]));
      rows.sort((a,b) => { for (const campo of orden) { const comparacion = String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')); if (comparacion) return comparacion; } return 0; });
      return { data: rows.slice(inicio, Math.min(fin + 1, inicio + maxRows)), error: null };
    }
    const q = {
      select(value) { columnas = value; return q; },
      eq(campo, value) { filtros.push(['eq', campo, value]); return q; },
      in(campo, value) { filtros.push(['in', campo, value]); return q; },
      order(campo) { orden.push(campo); return q; },
      range(inicio, fin) { return Promise.resolve(run(inicio, fin)); },
      maybeSingle() { const result = run(); return Promise.resolve({ ...result, data: result.data?.[0] ?? null }); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  return {
    calls,
    client: {
      auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
      from: query,
      rpc(name, args) {
        calls.push({ rpc: name, args });
        if (name === 'mis_meliponarios_mapa_privado') return query('mapa_rpc');
        if (rpcThrow) return Promise.reject(new Error('fallo de red'));
        return Promise.resolve({ data: rpcError ? null : rpcData, error: rpcError });
      },
    },
  };
}

test('un borrador real requiere nombre y localidad, aunque el borrador local admita vacíos', () => {
  assert.equal(Object.keys(validarFormularioRemoto(formulario(), catalogo)).length, 0);
  assert.ok(validarFormularioRemoto({ ...formulario(), nombre: '', localidadId: '' }, catalogo).nombre);
  assert.ok(validarFormularioRemoto({ ...formulario(), localidadId: 'demo-localidad' }, catalogo).localidadId);
});
test('límites de textos coinciden con el contrato y respetan caracteres Unicode', () => {
  assert.equal(validarFormularioRemoto({ ...formulario(), nombre: 'a'.repeat(160), referencia: 'b'.repeat(500) }, catalogo).nombre, undefined);
  assert.ok(validarFormularioRemoto({ ...formulario(), nombre: 'a'.repeat(161), descripcion: 'x'.repeat(2001), referencia: 'b'.repeat(501) }, catalogo).descripcion);
  assert.equal(validarFormularioRemoto({ ...formulario(), nombre: '🐝'.repeat(160) }, catalogo).nombre, undefined);
});
test('payload mínimo excluye propietario, estados, productos y campos calculados', () => {
  const payload = construirDatosRegistro({ ...formulario(), ownerId: otro, estado: 'aprobada', productos: [{ nombre: 'producto local' }], categoria_marcador: 'ambos' }, catalogo);
  assert.deepEqual(Object.keys(payload).sort(), ['localidad_id','nombre','descripcion','referencia_ubicacion','ofrece_venta_miel','ofrece_visitas','especies','ubicacion'].sort());
  assert.equal(payload.nombre, 'Registro de prueba');
  assert.equal(payload.descripcion, null);
  assert.deepEqual(payload.especies, []);
  assert.equal(payload.ubicacion, null);
});
test('las abejas se convierten al JSON exacto, sin claves adicionales', () => {
  const payload = construirDatosRegistro({ ...formulario(), abejas: [{ tipoId: eid, cajas: '8', jobones: '4', colonia: 12 }] }, catalogo);
  assert.deepEqual(payload.especies, [{ especie_id: eid, cantidad_cajas: 8, cantidad_jobones: 4 }]);
});
test('rechaza abejas duplicadas, cantidades fuera de rango y cero contenedores', () => {
  for (const abejas of [
    [{ tipoId: eid, cajas: 0, jobones: 0 }],
    [{ tipoId: eid, cajas: 100001, jobones: 0 }],
    [{ tipoId: eid, cajas: 1.5, jobones: 0 }],
    [{ tipoId: eid, cajas: 1, jobones: 0 }, { tipoId: eid, cajas: 1, jobones: 0 }],
  ]) assert.ok(validarFormularioRemoto({ ...formulario(), abejas }, catalogo).abejas);
});
test('el GPS conserva la precisión y el mapa exige precisión nula', () => {
  const gps = { ...formulario(), coordenadas: [20.8,-89], metodoCaptura: 'gps', precisionMetros: 12 };
  assert.deepEqual(construirDatosRegistro(gps, catalogo).ubicacion, { latitud: 20.8, longitud: -89, metodo_captura: 'gps', precision_metros: 12 });
  assert.ok(validarFormularioRemoto({ ...gps, metodoCaptura: 'mapa' }, catalogo).coordenadas);
  assert.ok(validarFormularioRemoto({ ...gps, coordenadas: ['',-89] }, catalogo).coordenadas);
});
test('el catálogo pagina y filtra municipios activos de Yucatán', async () => {
  const municipios = Array.from({ length: 1005 }, (_,i) => ({ id: `m-${i}`, nombre: `Municipio ${String(i).padStart(4,'0')}`, activo: true, clave_entidad: '31' }));
  municipios.push({ id: 'inactivo', nombre: 'no visible', activo: false, clave_entidad: '31' }, { id: 'otro-estado', nombre: 'fuera', activo: true, clave_entidad: '04' });
  const f = fake({ tablas: { municipios } });
  const result = await crearApiRegistroSupabase(f.client).catalogos(uid);
  assert.equal(result.municipios.length, 1005);
  assert.deepEqual(f.calls.filter(c => c.tabla === 'municipios').map(c => c.inicio), [0,500,1000,1005]);
});
test('recupera todo incluso si el servidor limita cada respuesta por debajo de la página solicitada', async () => {
  const municipios = Array.from({ length: 5 }, (_,i) => ({ id: `m-${i}`, nombre: `Municipio ${i}`, activo: true, clave_entidad: '31' }));
  const f = fake({ maxRows: 2, tablas: { municipios } });
  const result = await crearApiRegistroSupabase(f.client).catalogos(uid);
  assert.equal(result.municipios.length, 5);
  assert.deepEqual(f.calls.filter(c => c.tabla === 'municipios').map(c => c.inicio), [0,2,4,5]);
});
test('las localidades se consultan por municipio con paginación completa', async () => {
  const localidades = Array.from({ length: 501 }, (_,i) => ({ id: `l-${i}`, municipio_id: mid, nombre: `Localidad ${i}`, activo: true }));
  localidades.push({ id: 'ajena', municipio_id: otro, nombre: 'Otro municipio', activo: true });
  const f = fake({ tablas: { localidades } });
  const result = await crearApiRegistroSupabase(f.client).localidades(uid, mid);
  assert.equal(result.length, 501);
  assert.ok(result.every(row => row.municipioId === mid));
});
test('una sesión distinta se rechaza antes de leer el perfil o guardar', async () => {
  const f = fake({ user: otro });
  await assert.rejects(crearApiRegistroSupabase(f.client).guardar(uid, formulario(), null, catalogo), /sesión cambió/);
  assert.equal(f.calls.length, 0);
});
test('perfiles inactivos y roles diferentes a Cliente no llegan a la escritura', async () => {
  for (const options of [{ activo: false }, { rol: 4 }, { rol: 1 }]) {
    const f = fake(options);
    await assert.rejects(crearApiRegistroSupabase(f.client).guardar(uid, formulario(), null, catalogo), /Cliente con perfil activo/);
    assert.equal(f.calls.filter(c => c.rpc).length, 0);
  }
});
test('guardar crea mediante una única RPC y actualizar reutiliza el mismo UUID', async () => {
  const f = fake(); const api = crearApiRegistroSupabase(f.client);
  assert.equal(await api.guardar(uid, formulario(), null, catalogo), rid);
  assert.equal(await api.guardar(uid, { ...formulario(), nombre: 'Nombre actualizado' }, rid, catalogo), rid);
  const rpc = f.calls.filter(c => c.rpc);
  assert.deepEqual(rpc.map(c => c.rpc), ['guardar_formulario_meliponario','guardar_formulario_meliponario']);
  assert.deepEqual(rpc.map(c => c.args.p_meliponario_id), [null,rid]);
});
test('un ID demo nunca se envía a la función real', async () => {
  const f = fake();
  await assert.rejects(crearApiRegistroSupabase(f.client).guardar(uid, formulario(), 'demo-meliponario-1', catalogo), /demostración/);
  assert.equal(f.calls.length, 0);
});
test('un error de cobertura se explica y no provoca un segundo intento', async () => {
  const f = fake({ rpcError: { code: '22023', message: 'Localidad fuera de cobertura territorial activa' } });
  await assert.rejects(crearApiRegistroSupabase(f.client).guardar(uid, formulario(), null, catalogo), /zona de atención activa/);
  assert.equal(f.calls.filter(c => c.rpc).length, 1);
});
test('un fallo de red marca el resultado incierto y no repite automáticamente el alta', async () => {
  const f = fake({ rpcThrow: true });
  await assert.rejects(crearApiRegistroSupabase(f.client).guardar(uid, formulario(), null, catalogo), error => error.resultadoIncierto === true);
  assert.equal(f.calls.filter(c => c.rpc).length, 1);
});
test('el listado filtra propietario y utiliza la RPC del mapa privado', async () => {
  const record = { id: rid, responsable_principal_id: uid, localidad_id: lid, nombre: 'Propio', fecha_creacion: '2026-10-27T00:00:00Z', fecha_actualizacion: '2026-10-27T00:00:00Z' };
  const f = fake({ tablas: { meliponarios: [record, { ...record, id: otro, responsable_principal_id: otro }], solicitudes_meliponario: [{ id: sid, meliponario_id: rid, numero_intento: 1, estado: 'borrador' }], puntos: [{ id: rid, latitud: 20.8, longitud: -89 }], ubicaciones_meliponarios: [{ meliponario_id: rid, metodo_captura: 'gps', precision_metros: 5 }] } });
  const records = await crearApiRegistroSupabase(f.client).listar(uid);
  assert.equal(records.length, 1); assert.equal(records[0].id, rid);
  assert.equal(records[0].estado, 'borrador'); assert.equal(records[0].precisionMetros, 5);
  assert.deepEqual(records[0].coordenadas, [20.8,-89]);
  assert.ok(f.calls.some(c => c.rpc === 'mis_meliponarios_mapa_privado'));
  assert.ok(f.calls.filter(c => c.tabla === 'meliponarios').every(c => c.filtros.some(v => v[1] === 'responsable_principal_id' && v[2] === uid)));
});
test('el estado procede de la solicitud más reciente, no de la presencia en el mapa', () => {
  const records = combinarRegistros({ userId: uid, meliponarios: [{ id: rid, responsable_principal_id: uid, localidad_id: lid }], localidades: [], abejas: [], puntos: [{ id: rid, latitud: 20.8, longitud: -89 }], ubicaciones: [], solicitudes: [{ meliponario_id: rid, numero_intento: 1, estado: 'rechazada' }, { meliponario_id: rid, numero_intento: 2, estado: 'correccion' }] });
  assert.equal(records[0].estado, 'correccion');
  assert.equal(combinarRegistros({ userId: uid, meliponarios: [{ id: rid, responsable_principal_id: uid }], solicitudes: [], localidades: [], abejas: [], puntos: [], ubicaciones: [] })[0].estado, 'sin_solicitud');
});
test('un fallo de lectura se informa y no devuelve catálogos demo', async () => {
  const f = fake({ falloTabla: 'municipios' });
  await assert.rejects(crearApiRegistroSupabase(f.client).catalogos(uid), /autorización/);
});
