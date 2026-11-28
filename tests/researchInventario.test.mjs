import test from 'node:test';
import assert from 'node:assert/strict';
import { crearInventarioEjemplo } from '../src/features/research/inventarioEjemplo.mjs';
import { FILTROS_INICIALES, cambiarFiltro, crearReporte, esInvestigador, esRutaInvestigacion, filtrarInventario, normalizarInventario, opcionesTerritoriales, resumirInventario, sumarMedida, tieneGPS, nombreArchivoReporte } from '../src/features/research/inventarioModel.mjs';
import { filasReporte, prepararHojasExcel } from '../src/features/research/exportarInventario.mjs';

const base = () => crearInventarioEjemplo('2026-11-27T18:00:00.000Z');
const filtros = cambios => ({ ...FILTROS_INICIALES, ...cambios });
const crudo = () => structuredClone(base());

test('las rutas y la entrada del investigador conservan el rol de solo consulta', () => {
  assert.equal(esInvestigador({ roleId: 2 }), true);
  assert.equal(esInvestigador({ roleId: '2' }), true);
  [1, 3, 4, 5, undefined].forEach(roleId => assert.equal(esInvestigador({ roleId }), false));
  assert.equal(esRutaInvestigacion('investigacion'), true);
  assert.equal(esRutaInvestigacion('investigacion/inventario'), true);
  assert.equal(esRutaInvestigacion('administracion/usuarios'), false);
});
test('el resumen cuenta meliponarios únicos aunque contengan varias especies y zonas', () => {
  const datos = crudo();
  datos.registros[0].zonas.push({ id: 'z9', nombre: 'Zona compartida' });
  const resumen = resumirInventario(normalizarInventario(datos).registros);
  assert.equal(resumen.meliponarios, 12);
  assert.equal(resumen.especies, 4);
  assert.equal(resumen.municipios.reduce((s, r) => s + r.total, 0), 12);
  assert.ok(resumen.distribucionEspecies.reduce((s, r) => s + r.total, 0) > 12);
});
test('el filtro de especie proyecta exclusivamente los conteos de esa especie', () => {
  const datos = base();
  const elegidos = filtrarInventario(datos.registros, filtros({ especie: 's1' }));
  assert.ok(elegidos.length);
  assert.ok(elegidos.every(r => r.inventario.length === 1 && r.inventario[0].especieId === 's1'));
  const esperado = datos.registros.flatMap(r => r.inventario).filter(f => f.especieId === 's1' && f.cajas !== null).reduce((s, f) => s + f.cajas, 0);
  assert.equal(resumirInventario(elegidos).cajas.total, esperado);
  assert.equal(resumirInventario(elegidos).especies, 1);
  assert.ok(datos.registros.some(r => r.inventario.length > 1));
});
test('los datos faltantes se distinguen de cero y se informa su cobertura', () => {
  const datos = crudo();
  datos.registros = datos.registros.slice(0, 2);
  datos.registros[0].inventario = [{ ...datos.registros[0].inventario[0], cajas: 0, jobones: null }];
  datos.registros[1].inventario = [{ ...datos.registros[1].inventario[0], cajas: null, jobones: null }];
  const normalizados = normalizarInventario(datos).registros;
  assert.deepEqual(sumarMedida(normalizados, 'cajas'), { total: 0, faltantes: 1, registrados: 1 });
  assert.deepEqual(sumarMedida(normalizados, 'jobones'), { total: null, faltantes: 2, registrados: 0 });
  assert.equal(resumirInventario([]).cajas.total, null);
});
test('rechaza conteos imposibles, duplicados y respuestas incompletas antes de reportar', () => {
  for (const valor of [-1, 1.5, '15', Number.MAX_SAFE_INTEGER + 1, NaN]) {
    const datos = crudo(); datos.registros[0].inventario[0].cajas = valor;
    assert.throws(() => normalizarInventario(datos), /conteo inválido/);
  }
  const duplicados = crudo(); duplicados.registros.push(duplicados.registros[0]);
  assert.throws(() => normalizarInventario(duplicados), /duplicados/);
  const especieRepetida = crudo(); especieRepetida.registros[0].inventario.push(especieRepetida.registros[0].inventario[0]);
  assert.throws(() => normalizarInventario(especieRepetida), /especie.*repetida/);
  assert.throws(() => normalizarInventario({ modo: 'real', registros: [] }), /incompleta/);
  const fecha = crudo(); fecha.registros[0].fechaFicha = '2026-02-31';
  assert.throws(() => normalizarInventario(fecha), /Fecha/);
});
test('no presenta un inventario vacío como un conteo de cero cajas', () => {
  const datos = crudo(); datos.registros[0].inventario = [];
  const resumen = resumirInventario([normalizarInventario(datos).registros[0]]);
  assert.equal(resumen.sinInventario, 1);
  assert.equal(resumen.cajas.total, null);
});
test('filtros territoriales combinables y búsqueda tolerante a acentos', () => {
  const datos = base();
  const opciones = opcionesTerritoriales(datos.registros, filtros({ zona: 'z2', municipio: 'm2' }));
  assert.equal(opciones.municipios.length, 2);
  assert.equal(opciones.localidades.length, 2);
  const resultado = filtrarInventario(datos.registros, filtros({ zona: 'z2', municipio: 'm2', localidad: 'l3' }));
  assert.ok(resultado.length && resultado.every(r => r.localidadId === 'l3'));
  assert.equal(filtrarInventario(datos.registros, filtros({ busqueda: 'merida' })).length, 4);
  assert.equal(filtrarInventario(datos.registros, filtros({ municipio: 'm1', zona: 'z2' })).length, 0);
  assert.deepEqual(cambiarFiltro(filtros({ municipio: 'm1', localidad: 'l1', especie: 's1' }), 'zona', 'z2'), filtros({ zona: 'z2', especie: 's1' }));
});
test('GPS ausente se contabiliza sin inventar un punto y rechaza coordenadas fuera de rango', () => {
  assert.equal(resumirInventario(base().registros).sinGPS, 1);
  assert.equal(tieneGPS({ latitud: 0, longitud: 0 }), true);
  assert.equal(tieneGPS({ latitud: null, longitud: null }), false);
  const datos = crudo(); datos.registros[0].latitud = 95;
  assert.throws(() => normalizarInventario(datos), /coordenadas/);
});
test('el reporte exporta todos los resultados filtrados y no depende de la paginación', () => {
  const reporte = crearReporte({ datos: base(), filtros: filtros(), ahora: '2026-11-27T19:00:00Z' });
  assert.equal(reporte.registros.length, 12);
  assert.equal(reporte.resumen.meliponarios, 12);
  assert.equal(filasReporte(reporte).length, reporte.registros.length);
  assert.match(reporte.fuente, /EJEMPLO/);
  assert.match(nombreArchivoReporte(reporte, 'xlsx'), /EJEMPLO.*\.xlsx$/);
});
test('selecciones y filtros se intersectan y una selección vacía no genera un reporte', () => {
  const datos = base();
  const reporte = crearReporte({ datos, filtros: filtros({ municipio: 'm1' }), seleccion: ['ejemplo-1', 'ejemplo-3'], alcance: 'seleccionados' });
  assert.equal(reporte.registros.length, 1);
  assert.equal(reporte.registros[0].id, 'ejemplo-1');
  assert.throws(() => crearReporte({ datos, filtros: filtros(), alcance: 'seleccionados' }), /No hay/);
  assert.throws(() => crearReporte({ datos, filtros: filtros({ busqueda: 'no existe' }) }), /No hay/);
});
test('el reporte captura una copia inmutable para mantener idénticos criterios en ambos formatos', () => {
  const datos = crudo(), actuales = filtros({ especie: 's1' });
  const reporte = crearReporte({ datos, filtros: actuales });
  const original = reporte.registros[0].nombre;
  datos.registros[0].nombre = 'Otro nombre'; actuales.especie = 's3';
  assert.equal(reporte.registros[0].nombre, original);
  assert.ok(Object.isFrozen(reporte.registros[0].inventario));
  assert.equal(reporte.resumen.especies, 1);
});
test('Excel conserva números, marca el ejemplo y trata textos tipo fórmula como cadenas', () => {
  const datos = crudo(); datos.registros[0].nombre = '=HYPERLINK("https://invalid.example")';
  datos.registros[0].inventario[0].jobones = 0;
  const reporte = crearReporte({ datos, filtros: filtros() });
  const hojas = prepararHojasExcel(reporte);
  assert.deepEqual(hojas.map(h => h.sheet), ['Resumen', 'Inventario', 'Consulta']);
  hojas.forEach(h => assert.ok(h.data.flat().some(c => c?.value?.includes?.('EJEMPLO'))));
  const inventario = hojas.find(h => h.sheet === 'Inventario');
  const fila = inventario.data.find(f => f[0]?.value === datos.registros[0].nombre);
  assert.equal(fila[0].type, String);
  assert.equal(fila[6].type, Number);
  assert.equal(fila[6].value, 0);
  assert.equal(filasReporte(reporte)[0].length, 10);
});
test('la exportación no contiene UUID, teléfonos, correos ni coordenadas', () => {
  const datos = crudo(); datos.registros[0].telefono = '5555555555'; datos.registros[0].email = 'prueba@invalid.example';
  const serializado = JSON.stringify(prepararHojasExcel(crearReporte({ datos, filtros: filtros() })));
  assert.ok(!serializado.includes('5555555555'));
  assert.ok(!serializado.includes('prueba@invalid.example'));
  assert.ok(!serializado.includes('ejemplo-1'));
  assert.ok(!serializado.includes('-89.5926'));
});
