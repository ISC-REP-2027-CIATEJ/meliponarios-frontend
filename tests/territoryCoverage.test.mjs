import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerritoryApi } from '../src/features/territory/territoryApi.mjs';
import {
  filtrarLocalidades, HISTORIAL_POR_PAGINA, planMunicipal, SIN_ZONA, zonasDestino,
} from '../src/features/territory/territoryCoverageModel.mjs';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const admin = id(1);
const municipio = id(10);
const zonaA = id(20);
const zonaB = id(21);
const zonaInactiva = id(22);
const localidad = id(100);
const motivo = 'Se ajustó la cobertura del municipio.';

function entorno({ datos = {}, rol = 1, activa = true, sesion = admin, limite = 250, respuesta } = {}) {
  const consultas = [];
  const escrituras = [];
  const tablas = {
    perfiles: [{ id: admin, rol_id: rol, activo: activa }],
    municipios: [{ id: municipio, nombre: 'Mérida', activo: true }],
    zonas: [
      { id: zonaA, nombre: 'Zona Centro', codigo: 'C', activo: true },
      { id: zonaB, nombre: 'Zona Sur', codigo: 'S', activo: true },
      { id: zonaInactiva, nombre: 'Zona anterior', codigo: 'A', activo: false },
    ],
    localidades: [{ id: localidad, nombre: 'Localidad de prueba', municipio_id: municipio, clave_localidad: '0001', activo: true }],
    zonas_localidades: [],
    historial_zonas_localidades: [],
    ...datos,
  };
  const client = {
    auth: { async getUser() { return { data: { user: { id: sesion } }, error: null }; } },
    from(tabla) {
      let columnas, rango, opciones;
      const condiciones = [], ordenes = [];
      let max = limite;
      function leer() {
        consultas.push({ tabla, columnas, condiciones, rango, ordenes });
        const filas = tablas[tabla].filter(row => condiciones.every(({ key, valor, op }) =>
          op === 'eq' ? row[key] === valor : row[key] > valor));
        filas.sort((a, b) => {
          for (const { key, ascending } of ordenes) {
            if (a[key] < b[key]) return ascending ? -1 : 1;
            if (a[key] > b[key]) return ascending ? 1 : -1;
          }
          return 0;
        });
        const pagina = rango ? filas.slice(rango[0], rango[1] + 1) : filas;
        const keys = columnas.split(',').map(selection => selection.split(':', 1)[0]);
        const data = pagina.slice(0, max).map(row => Object.fromEntries(keys.map(key => [key, row[key]])));
        return { data, error: null, count: opciones?.count === 'exact' ? filas.length : null };
      }
      const metodo = {
        select(value, opts) { columnas = value; opciones = opts; return metodo; },
        eq(key, valor) { condiciones.push({ key, valor, op: 'eq' }); return metodo; },
        gt(key, valor) { condiciones.push({ key, valor, op: 'gt' }); return metodo; },
        order(key, { ascending = true } = {}) { ordenes.push({ key, ascending }); return metodo; },
        range(desde, hasta) { rango = [desde, hasta]; return metodo; },
        limit(value) { max = Math.min(value, limite); return metodo; },
        async maybeSingle() { const { data, error } = leer(); return { data: data[0] ?? null, error }; },
        then(ok, fail) { return Promise.resolve().then(leer).then(ok, fail); },
      };
      return metodo;
    },
    async rpc(nombre, args) {
      escrituras.push({ nombre, args });
      if (respuesta) return respuesta(nombre, args);
      return { data: args.p_zona_id ?? tablas.zonas_localidades[0].zona_id, error: null };
    },
  };
  return { api: createTerritoryApi(client), consultas, escrituras };
}

test('lee todas las localidades incluso si el servidor devuelve lotes más cortos', async () => {
  const localidades = Array.from({ length: 5 }, (_, i) => ({
    id: id(100 + i), municipio_id: municipio, clave_localidad: '000' + i, nombre: 'Sisal ' + i, activo: true,
  }));
  const { api, consultas } = entorno({ limite: 2, datos: {
    localidades, zonas_localidades: [{ localidad_id: id(104), zona_id: zonaA }],
  } });
  const resultado = await api.coverage(admin);
  assert.equal(resultado.localidades.length, 5);
  assert.equal(resultado.localidades.find(row => row.id === id(104)).zona.nombre, 'Zona Centro');
  assert.equal(filtrarLocalidades(resultado.localidades, { zonaId: SIN_ZONA }).length, 4);
  assert.equal(filtrarLocalidades(resultado.localidades, { busqueda: 'merida', municipioId: municipio, zonaId: zonaA }).length, 1);
  assert.ok(consultas.some(row => row.tabla === 'localidades' && row.condiciones.some(filtro => filtro.op === 'gt')));
});

test('el catálogo rechaza una relación cuyo destino no está en las zonas disponibles para el administrador', async () => {
  const { api } = entorno({ datos: { zonas_localidades: [{ localidad_id: localidad, zona_id: id(999) }] } });
  await assert.rejects(api.coverage(admin), /catálogo de cobertura está incompleto/);
});

test('las zonas inactivas y la zona actual quedan fuera de los destinos', async () => {
  const { api } = entorno();
  const { zonas } = await api.coverage(admin);
  assert.deepEqual(zonasDestino(zonas, zonaA).map(zona => zona.id), [zonaB]);
});

test('una cuenta ajena al rol administrador no consulta ni cambia cobertura', async () => {
  const { api, consultas, escrituras } = entorno({ rol: 3 });
  await assert.rejects(api.coverage(admin), { code: 'ACCESS_DENIED' });
  await assert.rejects(api.coverageHistory(admin, localidad), { code: 'ACCESS_DENIED' });
  await assert.rejects(api.changeCoverage(admin, {
    localidadId: localidad, accion: 'asignar', zonaActualId: null, zonaId: zonaA, motivo,
  }), { code: 'ACCESS_DENIED' });
  assert.ok(consultas.every(row => row.tabla === 'perfiles'));
  assert.equal(escrituras.length, 0);
});

test('el historial queda limitado a la localidad y se pagina del cambio más reciente al más antiguo', async () => {
  const historial_zonas_localidades = Array.from({ length: HISTORIAL_POR_PAGINA + 2 }, (_, i) => ({
    id: id(300 + i), localidad_id: i === 0 ? id(200) : localidad,
    zona_anterior_id: null, zona_nueva_id: zonaA, fecha_cambio: '2026-11-' + String(1 + i).padStart(2, '0'),
    motivo, tipo_cambio: 'asignacion', realizado_por: admin,
  }));
  const { api, consultas } = entorno({ datos: { historial_zonas_localidades } });
  const primero = await api.coverageHistory(admin, localidad);
  const segundo = await api.coverageHistory(admin, localidad, 2);
  assert.equal(primero.total, HISTORIAL_POR_PAGINA + 1);
  assert.equal(primero.registros[0].id, id(300 + HISTORIAL_POR_PAGINA + 1));
  assert.equal(segundo.registros[0].id, id(301));
  assert.equal(segundo.registros.length, 1);
  assert.ok(consultas.filter(row => row.tabla === 'historial_zonas_localidades').every(row => !row.columnas.includes('realizado_por')));
});

for (const [accion, anterior, destino, respuesta] of [
  ['asignar', null, zonaA, zonaA],
  ['trasladar', zonaA, zonaB, zonaB],
  ['retirar', zonaA, null, zonaA],
]) {
  test('envía al backend la operación ' + accion + ' con su destino y motivo', async () => {
    const { api, escrituras } = entorno({ datos: {
      zonas_localidades: anterior ? [{ localidad_id: localidad, zona_id: anterior }] : [],
    } });
    const confirmada = await api.changeCoverage(admin, {
      localidadId: localidad, accion, zonaActualId: anterior, zonaId: destino, motivo: '  ' + motivo + '  ',
    });
    assert.equal(confirmada, respuesta);
    assert.deepEqual(escrituras, [{
      nombre: 'admin_gestionar_zona_localidad',
      args: { p_localidad_id: localidad, p_accion: accion, p_zona_id: destino, p_motivo: motivo },
    }]);
  });
}

test('bloquea el guardado si otra persona cambió la zona desde que se seleccionó', async () => {
  const { api, escrituras } = entorno({ datos: { zonas_localidades: [{ localidad_id: localidad, zona_id: zonaB }] } });
  await assert.rejects(api.changeCoverage(admin, {
    localidadId: localidad, accion: 'retirar', zonaActualId: zonaA, zonaId: null, motivo,
  }), { code: 'COVERAGE_CHANGED' });
  assert.equal(escrituras.length, 0);
});

test('los motivos cortos y los traslados a la misma zona se detienen antes de escribir', async () => {
  const { api, escrituras } = entorno();
  await assert.rejects(api.changeCoverage(admin, {
    localidadId: localidad, accion: 'asignar', zonaActualId: null, zonaId: zonaA, motivo: 'corto',
  }), /Revisa la localidad/);
  await assert.rejects(api.changeCoverage(admin, {
    localidadId: localidad, accion: 'trasladar', zonaActualId: zonaA, zonaId: zonaA, motivo,
  }), /Revisa la localidad/);
  assert.equal(escrituras.length, 0);
});

test('una respuesta inesperada obliga a comprobar el estado en vez de repetir el cambio', async () => {
  const { api, escrituras } = entorno({ respuesta: () => ({ data: zonaB, error: null }) });
  await assert.rejects(api.changeCoverage(admin, {
    localidadId: localidad, accion: 'asignar', zonaActualId: null, zonaId: zonaA, motivo,
  }), { code: 'RESULT_UNKNOWN', uncertain: true });
  assert.equal(escrituras.length, 1);
});

test('el catálogo municipal inicia con municipios y zonas sin descargar localidades', async () => {
  const { api, consultas, escrituras } = entorno({
    respuesta: () => ({ data: {
      version: 1,
      municipios: [{ id: municipio, nombre: 'Mérida', activo: true, localidades: 1230, con_zona: 90 }],
      zonas: [{ id: zonaA, nombre: 'Zona Centro', codigo: 'C', activo: true }],
    }, error: null }),
  });
  const catalogo = await api.coverageMunicipalCatalog(admin);
  assert.equal(catalogo.gestionMunicipal, true);
  assert.equal(catalogo.municipios[0].localidades, 1230);
  assert.deepEqual(escrituras.map(llamada => llamada.nombre), ['km_admin_catalogo_cobertura_municipal']);
  assert.ok(consultas.every(consulta => consulta.tabla === 'perfiles'));
});

test('si falta el SQL municipal, el catálogo previo permite seguir por localidad', async () => {
  const { api, consultas } = entorno({ respuesta: () => ({ data: null, error: { code: 'PGRST202' } }) });
  const catalogo = await api.coverageMunicipalCatalog(admin);
  assert.equal(catalogo.gestionMunicipal, false);
  assert.equal(catalogo.municipios[0].id, municipio);
  assert.equal(catalogo.zonas.length, 3);
  assert.ok(!consultas.some(consulta => consulta.tabla === 'localidades'));
});

test('solo lee localidades del municipio elegido y reconoce cobertura nula y asociada', async () => {
  const { api, consultas } = entorno({ limite: 1, datos: {
    localidades: [
      { id: localidad, municipio_id: municipio, cobertura: { zona_id: zonaA } },
      { id: id(101), municipio_id: municipio, cobertura: null },
      { id: id(102), municipio_id: municipio, cobertura: [{ zona_id: zonaB }] },
      { id: id(103), municipio_id: id(11), cobertura: null },
    ],
  } });
  const datos = await api.coverageByMunicipality(admin, municipio);
  assert.deepEqual(datos.localidades.map(row => row.id), [localidad, id(101), id(102)]);
  assert.deepEqual(datos.relaciones, [
    { localidad_id: localidad, zona_id: zonaA }, { localidad_id: id(102), zona_id: zonaB },
  ]);
  assert.ok(consultas.filter(consulta => consulta.tabla === 'localidades').every(consulta =>
    consulta.condiciones.some(({ key, valor }) => key === 'municipio_id' && valor === municipio)));
});

test('crear zona pasa Código y Nombre sin pedir datos adicionales', async () => {
  const { api, escrituras } = entorno({ respuesta: () => ({ data: zonaA, error: null }) });
  const creada = await api.createCoverageZone(admin, { codigo: '  CTR  ', nombre: '  Centro  ' });
  assert.equal(creada, zonaA);
  assert.deepEqual(escrituras, [{
    nombre: 'km_admin_crear_zona_cobertura', args: { p_codigo: 'CTR', p_nombre: 'Centro' },
  }]);
});

test('la vista previa distingue incorporaciones, traslados y localidades que ya estaban', () => {
  const plan = planMunicipal([
    { id: localidad, zona: null },
    { id: id(101), zona: { id: zonaB, nombre: 'Zona Sur' } },
    { id: id(102), zona: { id: zonaA, nombre: 'Zona Centro' } },
  ], zonaA);
  assert.deepEqual([plan.total, plan.sinZona, plan.enOtras, plan.enDestino], [3, 1, 1, 1]);
  assert.deepEqual(plan.estadoEsperado, { [localidad]: null, [id(101)]: zonaB, [id(102)]: zonaA });
  assert.equal(plan.origenes[0].nombre, 'Zona Sur');
});

test('un municipio dividido requiere confirmar traslados y luego se escribe con una sola llamada', async () => {
  const { api, escrituras } = entorno({ respuesta: () => ({
    data: { asignadas: 1, trasladadas: 1, sin_cambios: 1, total: 3 }, error: null,
  }) });
  const estadoEsperado = { [localidad]: null, [id(101)]: zonaB, [id(102)]: zonaA };
  const cambio = { municipioId: municipio, zonaId: zonaA, estadoEsperado, motivo };
  await assert.rejects(api.assignMunicipality(admin, cambio), /Confirma si también quieres trasladar/);
  assert.equal(escrituras.length, 0);
  const resultado = await api.assignMunicipality(admin, { ...cambio, trasladar: true });
  assert.equal(resultado.total, 3);
  assert.deepEqual(escrituras, [{
    nombre: 'km_admin_asignar_municipio_zona',
    args: { p_municipio_id: municipio, p_zona_id: zonaA, p_estado_esperado: estadoEsperado,
      p_motivo: motivo, p_trasladar: true },
  }]);
});

test('un resultado municipal incompleto obliga a revisar la zona y no repite escrituras', async () => {
  const { api, escrituras } = entorno({ respuesta: () => ({
    data: { asignadas: 0, trasladadas: 0, sin_cambios: 1, total: 1 }, error: null,
  }) });
  await assert.rejects(api.assignMunicipality(admin, {
    municipioId: municipio, zonaId: zonaA, estadoEsperado: { [localidad]: null }, motivo,
  }), { code: 'RESULT_UNKNOWN', uncertain: true });
  assert.equal(escrituras.length, 1);
});
