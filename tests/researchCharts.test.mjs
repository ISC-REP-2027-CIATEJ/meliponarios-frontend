import test from 'node:test';
import assert from 'node:assert/strict';
import { crearInventarioEjemplo } from '../src/features/research/inventarioEjemplo.mjs';
import { FILTROS_INICIALES, crearReporte, nombreArchivoReporte, resumirInventario } from '../src/features/research/inventarioModel.mjs';
import { alcanceInicial, definirGraficas, graficasParaExportar, validarGraficas, GRAFICAS_INICIALES, TIPOS_GRAFICA } from '../src/features/research/researchCharts.mjs';
import { filasReporte, prepararHojasExcel } from '../src/features/research/exportarInventario.mjs';
const datos = () => crearInventarioEjemplo('2026-11-27T18:00:00Z');
const filtros = { ...FILTROS_INICIALES };

test('el botón principal usa la selección cuando existe y todos los filtrados cuando no existe', () => {
  assert.equal(alcanceInicial(['ejemplo-1', 'ejemplo-2']), 'seleccionados');
  assert.equal(alcanceInicial([]), 'filtrados');
  const seleccion = ['ejemplo-1', 'ejemplo-2'];
  const reporte = crearReporte({ datos: datos(), filtros, seleccion, alcance: alcanceInicial(seleccion) });
  assert.equal(reporte.resumen.meliponarios, 2);
  assert.deepEqual(new Set(reporte.registros.map(r => r.id)), new Set(seleccion));
  assert.equal(definirGraficas(reporte.resumen, reporte.graficas)[0].filas.reduce((s, f) => s + f.total, 0), 2);
});
test('exporta un meliponario una sola vez sin perder especies, cajas o jobones', () => {
  const fuente = datos();
  const registro = fuente.registros.find(r => r.inventario.length === 2);
  const reporte = crearReporte({ datos: fuente, filtros, seleccion: [registro.id], alcance: 'seleccionados' });
  const filas = filasReporte(reporte);
  assert.equal(filas.length, 1);
  registro.inventario.forEach(especie => {
    assert.ok(filas[0][4].includes(especie.nombreComun));
    assert.ok(filas[0][4].includes(especie.nombreCientifico));
  });
  assert.equal(filas[0][5], registro.inventario.reduce((s, f) => s + f.cajas, 0));
  assert.equal(filas[0][6], registro.inventario.reduce((s, f) => s + f.jobones, 0));
});
test('dos meliponarios distintos con el mismo nombre conservan ambos registros', () => {
  const fuente = datos(); fuente.registros[1].nombre = fuente.registros[0].nombre;
  const reporte = crearReporte({ datos: fuente, filtros });
  assert.equal(filasReporte(reporte).length, 12);
});
test('los cinco tipos comunes están disponibles para cada gráfica', () => {
  const resumen = resumirInventario(datos().registros);
  for (const tipo of Object.keys(TIPOS_GRAFICA)) {
    const opciones = { tipos: Object.fromEntries(Object.keys(GRAFICAS_INICIALES.tipos).map(id => [id, tipo])) };
    assert.ok(definirGraficas(resumen, opciones).every(g => g.tipo === tipo));
  }
  assert.throws(() => validarGraficas({ tipos: { estados: 'radar' } }), /tipo/);
  assert.throws(() => validarGraficas({ medida: 'abejas' }), /medida/);
});
test('descargas de selección y territorio completo tienen nombres distinguibles', () => {
  const ahora = '2026-11-27T19:00:00Z';
  const seleccion = crearReporte({ datos: datos(), filtros, seleccion: ['ejemplo-1', 'ejemplo-2'], alcance: 'seleccionados', ahora });
  const todos = crearReporte({ datos: datos(), filtros, ahora });
  assert.match(nombreArchivoReporte(seleccion, 'pdf'), /seleccion_2_/);
  assert.match(nombreArchivoReporte(todos, 'pdf'), /filtrados_12_/);
  assert.notEqual(nombreArchivoReporte(seleccion, 'pdf'), nombreArchivoReporte(todos, 'pdf'));
});
test('el nombre del archivo respeta la fecha de México al cruzar medianoche UTC', () => {
  const reporte = crearReporte({ datos: datos(), filtros, ahora: '2026-11-28T00:15:00Z' });
  assert.match(nombreArchivoReporte(reporte, 'pdf'), /20261127181500\.pdf$/);
});
test('los conteos del gráfico de inventario coinciden con las sumas registradas', () => {
  const resumen = resumirInventario(datos().registros);
  for (const medida of ['cajas', 'jobones']) {
    const inventario = definirGraficas(resumen, { medida }).find(g => g.id === 'inventario');
    assert.equal(inventario.filas.reduce((s, f) => s + (f.total ?? 0), 0), resumen[medida].total);
    assert.equal(inventario.filas.reduce((s, f) => s + (f.faltantes ?? 0), 0), resumen[medida].faltantes);
  }
});
test('inventario sin dato permanece nulo y no se convierte en una barra de cero', () => {
  const fuente = datos(); fuente.registros.forEach(r => r.inventario.forEach(f => { f.cajas = null; }));
  const grafica = definirGraficas(resumirInventario(fuente.registros)).find(g => g.id === 'inventario');
  assert.ok(grafica.filas.every(f => f.total === null && f.faltantes > 0));
});
test('una especie filtrada conserva solo sus valores en la tabla y todas las gráficas', () => {
  const reporte = crearReporte({ datos: datos(), filtros: { ...filtros, especie: 's2' } });
  assert.equal(reporte.resumen.especies, 1);
  assert.equal(definirGraficas(reporte.resumen)[1].filas.length, 1);
  assert.equal(definirGraficas(reporte.resumen)[2].filas.length, 1);
  assert.ok(reporte.registros.every(r => r.inventario.every(f => f.especieId === 's2')));
});
test('la captura mantiene los tipos elegidos aunque cambie la configuración del panel', () => {
  const opciones = { tipos: { ...GRAFICAS_INICIALES.tipos, especies: 'pastel' }, medida: 'jobones' };
  const reporte = crearReporte({ datos: datos(), filtros, graficas: opciones });
  opciones.tipos.especies = 'tabla'; opciones.medida = 'cajas';
  assert.equal(reporte.graficas.tipos.especies, 'pastel');
  assert.equal(reporte.graficas.medida, 'jobones');
  assert.ok(Object.isFrozen(reporte.graficas.tipos));
});
test('el libro incorpora las figuras como imágenes y conserva una fila por meliponario', () => {
  const reporte = crearReporte({ datos: datos(), filtros });
  const imagenes = [{ titulo: 'Gráfica de prueba', blob: new Blob(['png']), nota: 'Datos de la consulta' }];
  const hojas = prepararHojasExcel(reporte, imagenes);
  assert.deepEqual(hojas.map(h => h.sheet), ['Resumen', 'Inventario', 'Gráficas', 'Consulta']);
  const inventario = hojas.find(h => h.sheet === 'Inventario');
  const nombres = reporte.registros.map(r => r.nombre);
  assert.equal(inventario.data.filter(f => nombres.includes(f[0]?.value)).length, 12);
  assert.equal(hojas.find(h => h.sheet === 'Gráficas').images.length, 1);
});
test('las gráficas extensas se dividen o agrupan sin perder su suma', () => {
  const resumen = resumirInventario(datos().registros);
  resumen.municipios = Array.from({ length: 19 }, (_, i) => ({ id: 'm' + i, nombre: 'Municipio ' + i, total: i + 1 }));
  const total = resumen.municipios.reduce((s, f) => s + f.total, 0);
  const barras = graficasParaExportar(resumen, { tipos: { municipios: 'horizontal' } }).filter(g => g.id.startsWith('municipios'));
  assert.equal(barras.length, 3);
  assert.equal(barras.flatMap(g => g.filas).reduce((s, f) => s + f.total, 0), total);
  const pastel = graficasParaExportar(resumen, { tipos: { municipios: 'pastel' } }).find(g => g.id === 'municipios');
  assert.equal(pastel.filas.length, 8);
  assert.equal(pastel.filas.reduce((s, f) => s + f.total, 0), total);
  assert.match(pastel.nota, /agrupan/);
});
