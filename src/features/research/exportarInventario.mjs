import { fechaMexico, fechaVisible, instanteVisible, nombreArchivoReporte, numero, sumarMedida, textoEstado } from './inventarioModel.mjs';
import { crearImagenesGraficas } from './renderGraficas.mjs';

const verde = '#145B42';
const celda = (value, estilo = {}) => ({ value: value ?? 'Sin dato', type: typeof value === 'number' ? Number : String, wrap: true, verticalAlignment: 'top', ...estilo });
const tituloCelda = value => celda(value, { fontWeight: 'bold', backgroundColor: verde, textColor: '#FFFFFF', height: 30 });
const filaCombinada = (value, columnas = 10, estilo = {}) => [celda(value, { columnSpan: columnas, height: 25, ...estilo }), ...Array(columnas - 1).fill(null)];
const detalleEspecies = registro => registro.inventario.length
  ? registro.inventario.map(fila => `${fila.nombreComun} · ${fila.nombreCientifico}\n${numero(fila.cajas)} cajas · ${numero(fila.jobones)} jobones`).join('\n\n')
  : 'Sin inventario registrado';
const encabezados = ['Meliponario', 'Zona', 'Municipio', 'Localidad', 'Especies y conteos', 'Cajas registradas', 'Jobones registrados', 'Última ficha aprobada', 'Estado operativo', 'Visibilidad'];

// Una fila por meliponario. Las especies se agrupan sin perder sus conteos.
export function filasReporte(reporte) {
  return reporte.registros.map(r => [r.nombre, r.zonas.map(z => z.nombre).join(' / ') || 'Sin zona', r.municipio, r.localidad,
    detalleEspecies(r), sumarMedida([r], 'cajas').total, sumarMedida([r], 'jobones').total,
    fechaVisible(r.fechaFicha), textoEstado(r.estadoOperativo), textoEstado(r.visibilidad)]);
}

export function prepararHojasExcel(reporte, imagenes = []) {
  const r = reporte.resumen;
  const inicio = [
    filaCombinada('KAABMAP · INVESTIGACIÓN', 10, { backgroundColor: verde, textColor: '#FFFFFF', fontSize: 12, fontWeight: 'bold', height: 25 }),
    filaCombinada(reporte.titulo, 10, { fontSize: 22, fontWeight: 'bold', textColor: verde, height: 42 }),
    filaCombinada(reporte.fuente, 10, { textColor: '#607660', fontSize: 11, height: 25 }),
    filaCombinada(`${reporte.registros.length} meliponarios · ${reporte.alcance} · ${instanteVisible(reporte.generado)} · CDMX`, 10, { height: 28 }),
  ];
  const indicadores = [['Meliponarios', r.meliponarios], ['Especies', r.especies], ['Localidades', r.localidades], ['Cajas registradas', r.cajas.total], ['Jobones registrados', r.jobones.total]];
  const hojas = [
    { sheet: 'Resumen', showGridLines: false, columns: Array(10).fill({ width: 16 }), data: [
      ...inicio, [],
      indicadores.flatMap(([nombre]) => [celda(nombre, { columnSpan: 2, backgroundColor: '#EAF2E5', textColor: '#3F6B47', height: 28 }), null]),
      indicadores.flatMap(([, total]) => [celda(total, { columnSpan: 2, backgroundColor: '#F2F7EF', fontSize: 26, fontWeight: 'bold', textColor: verde, height: 45 }), null]),
      [], filaCombinada('Lectura del inventario', 10, { fontSize: 14, fontWeight: 'bold', textColor: verde, height: 30 }),
      filaCombinada(`Filas de especie sin conteo: ${r.cajas.faltantes} en cajas y ${r.jobones.faltantes} en jobones. Los valores registrados en cero se conservan.`, 10, { height: 32 }),
      filaCombinada(reporte.nota, 10, { height: 50 }),
      filaCombinada('Inventario: una fila por meliponario, con todas sus especies. Consulta: filtros y alcance. Gráficas: visualizaciones elegidas en el panel, cuando se incluyan.', 10, { height: 38 }),
    ] },
    { sheet: 'Inventario', showGridLines: false, orientation: 'landscape', stickyRowsCount: 6,
      columns: [32, 27, 20, 22, 60, 18, 18, 26, 23, 18].map(width => ({ width })),
      data: [...inicio, [], encabezados.map(tituloCelda), ...filasReporte(reporte).map((fila, indice) => fila.map(value => celda(value, {
        backgroundColor: indice % 2 ? '#F0F6ED' : '#FFFFFF', height: Math.max(58, reporte.registros[indice].inventario.length * 55),
        ...(typeof value === 'number' ? { format: '#,##0' } : {}),
      }))), [], filaCombinada(`TOTAL DEL ALCANCE · ${r.meliponarios} meliponarios · ${numero(r.cajas.total)} cajas registradas · ${numero(r.jobones.total)} jobones registrados`, 10, { fontWeight: 'bold', backgroundColor: '#DDEDD6', height: 32 })],
    },
    { sheet: 'Consulta', showGridLines: false, columns: Array(10).fill({ width: 16 }), data: [
      ...inicio, [], filaCombinada('Filtros y alcance del reporte', 10, { fontSize: 16, fontWeight: 'bold', textColor: verde, height: 33 }),
      ...[...reporte.criterios, ['Alcance', reporte.alcance], ['Consulta de datos', instanteVisible(reporte.fechaConsulta) + ' · CDMX'], ['Gráficas', reporte.incluirGraficas ? 'Incluidas con los tipos elegidos en el panel' : 'No incluidas']].map(([nombre, value]) => [
        celda(nombre, { columnSpan: 3, fontWeight: 'bold', backgroundColor: '#EAF2E5', height: 28 }), null, null,
        celda(value, { columnSpan: 7, backgroundColor: '#F5F8F1', height: 28 }), ...Array(6).fill(null),
      ]), [], filaCombinada('Estos criterios describen cómo se obtuvo el reporte; no son conclusiones del estudio.', 10, { height: 32 }),
    ] },
  ];
  if (imagenes.length) {
    const data = [...inicio, []], images = [];
    imagenes.forEach(imagen => {
      data.push(filaCombinada(imagen.titulo, 10, { fontWeight: 'bold', textColor: verde, height: 28 }));
      const filaImagen = data.length + 1;
      for (let i = 0; i < 26; i += 1) data.push([celda('', { height: 18 })]);
      images.push({ content: imagen.blob, contentType: 'image/png', width: 1000, height: 591, dpi: 96,
        anchor: { row: filaImagen, column: 1 }, title: imagen.titulo, description: imagen.nota });
      data.push([]);
    });
    hojas.splice(2, 0, { sheet: 'Gráficas', showGridLines: false, columns: Array(10).fill({ width: 16 }), data, images });
  }
  return hojas;
}

export async function crearExcel(reporte, imagenes) {
  const [{ default: writeExcelFile }, figuras] = await Promise.all([
    import('write-excel-file/universal'), imagenes ? Promise.resolve(imagenes) : crearImagenesGraficas(reporte),
  ]);
  return writeExcelFile(prepararHojasExcel(reporte, figuras)).toBlob();
}

async function cargarFuente() {
  const respuesta = await fetch(new URL('./assets/DejaVuSans.ttf', import.meta.url));
  if (!respuesta.ok) throw new Error('No se pudo cargar la tipografía del reporte. Vuelve a intentar.');
  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  let binario = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binario += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binario);
}

export async function crearPDF(reporte, fuenteBase64, imagenes) {
  const [{ jsPDF }, fuente, figuras] = await Promise.all([
    import('jspdf'), fuenteBase64 ? Promise.resolve(fuenteBase64) : cargarFuente(),
    imagenes ? Promise.resolve(imagenes) : crearImagenesGraficas(reporte),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('KaabMap.ttf', fuente); doc.addFont('KaabMap.ttf', 'KaabMap', 'normal'); doc.setFont('KaabMap');
  doc.setProperties({ title: reporte.titulo, subject: reporte.fuente, author: 'KaabMap' });
  const margen = 14, ancho = 269, limite = 192;
  let y = 14;
  function texto(value, x, altura, size = 9, color = '#244A37') {
    doc.setTextColor(color); doc.setFontSize(size); doc.text(String(value), x, altura);
  }
  function cabecera(titulo = 'Inventario territorial') {
    doc.setFillColor(verde); doc.rect(0, 0, 297, 25, 'F');
    texto('KAABMAP  /  INVESTIGACIÓN', margen, 9, 8, '#D2E6CD');
    texto(titulo, margen, 19, 16, '#FFFFFF');
    texto(reporte.modo === 'ejemplo' ? 'EJEMPLO · DATOS FICTICIOS' : 'CONSULTA AUTORIZADA', 206, 18, 8, '#FFFFFF');
    y = 34;
  }
  const nueva = (titulo = 'Inventario territorial · continuación') => { doc.addPage(); cabecera(titulo); };
  function parrafo(value, size = 8, color = '#54715B') {
    doc.setFontSize(size);
    doc.splitTextToSize(String(value), ancho).forEach(linea => {
      if (y + 5 > limite) nueva();
      texto(linea, margen, y, size, color); y += 4.6;
    });
    y += 2;
  }
  cabecera();
  parrafo('Generado: ' + instanteVisible(reporte.generado) + ' · Ciudad de México  |  Consulta de datos: ' + instanteVisible(reporte.fechaConsulta));
  parrafo(reporte.alcance + ' · ' + reporte.registros.length + ' meliponarios');
  const r = reporte.resumen;
  const indicadores = [['MELIPONARIOS', r.meliponarios], ['ESPECIES', r.especies], ['LOCALIDADES', r.localidades], ['CAJAS REGISTRADAS', r.cajas.total], ['JOBONES REGISTRADOS', r.jobones.total]];
  indicadores.forEach(([etiqueta, total], i) => {
    const x = margen + i * 54;
    doc.setFillColor('#EDF4E8'); doc.roundedRect(x, y, 51, 22, 2, 2, 'F');
    texto(etiqueta, x + 3, y + 6, 6.7, '#53755B'); texto(numero(total), x + 3, y + 17, 18, verde);
  });
  y += 29;
  parrafo(reporte.criterios.map(([nombre, valor]) => nombre + ': ' + valor).join('  ·  '));
  parrafo('Una fila por meliponario. Las especies incluyen sus conteos; los totales suman solo los datos registrados. * indica un total parcial por datos faltantes.', 7.5);
  const columnas = [48, 49, 84, 18, 18, 27, 25];
  const titulos = ['Meliponario', 'Territorio', 'Especies y conteos', 'Cajas', 'Jobones', 'Última ficha', 'Estado'];
  function tablaCabecera() {
    if (y + 13 > limite) nueva();
    doc.setFillColor('#DBEBD5'); doc.rect(margen, y - 4, ancho, 10, 'F');
    let x = margen;
    titulos.forEach((titulo, i) => { texto(titulo, x + 2, y + 2, 8); x += columnas[i]; });
    y += 13;
  }
  tablaCabecera();
  reporte.registros.forEach((registro, indice) => {
    const datoTotal = medida => {
      const dato = sumarMedida([registro], medida);
      return numero(dato.total) + (dato.total !== null && dato.faltantes ? '*' : '');
    };
    const valores = [registro.nombre, [registro.localidad, registro.municipio, ...registro.zonas.map(z => z.nombre)].join('\n'),
      detalleEspecies(registro), datoTotal('cajas'), datoTotal('jobones'), fechaVisible(registro.fechaFicha), textoEstado(registro.estadoOperativo) + '\n' + textoEstado(registro.visibilidad)];
    doc.setFontSize(8);
    const textos = valores.map((value, i) => doc.splitTextToSize(String(value), columnas[i] - 4));
    const lineas = Math.max(...textos.map(t => t.length));
    let cursor = 0;
    const altoCompleto = lineas * 4 + 5;
    if (y + altoCompleto > limite && altoCompleto < 145) { nueva(); tablaCabecera(); }
    while (cursor < lineas) {
      if (y + 9 > limite) { nueva(); tablaCabecera(); }
      const cantidad = Math.min(lineas - cursor, Math.max(1, Math.floor((limite - y - 5) / 4)));
      const alto = cantidad * 4 + 5;
      doc.setFillColor(indice % 2 ? '#F0F6ED' : '#FFFFFF'); doc.rect(margen, y - 3, ancho, alto, 'F');
      let x = margen;
      textos.forEach((lineasCelda, i) => {
        const segmento = lineasCelda.slice(cursor, cursor + cantidad);
        if (segmento.length) { doc.setFontSize(8); doc.setTextColor('#244A37'); doc.text(segmento, x + 2, y + 1, { lineHeightFactor: 1.4 }); }
        x += columnas[i];
      });
      y += alto; cursor += cantidad;
    }
  });
  y += 6;
  parrafo(`TOTAL · ${r.meliponarios} meliponarios · ${r.especies} especies · ${numero(r.cajas.total)} cajas registradas · ${numero(r.jobones.total)} jobones registrados`, 10, verde);
  parrafo(`Datos faltantes: ${r.cajas.faltantes} filas de especie en cajas; ${r.jobones.faltantes} en jobones. No se convierten cajas o jobones en abejas individuales.`, 7.5);
  if (figuras.length) {
    for (let inicio = 0; inicio < figuras.length; inicio += 4) {
      nueva('Gráficas de la consulta');
      figuras.slice(inicio, inicio + 4).forEach((imagen, i) => {
        const x = margen + (i % 2) * 137, arriba = 31 + Math.floor(i / 2) * 83;
        doc.setDrawColor('#D9E6D3'); doc.roundedRect(x, arriba, 132, 79, 2, 2, 'S');
        doc.addImage(imagen.dataURL, 'PNG', x + 2, arriba + 1, 128, 75.6);
      });
    }
  }
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    texto('KaabMap · ' + (reporte.modo === 'ejemplo' ? 'EJEMPLO · ' : '') + 'Inventario territorial · ' + fechaMexico(reporte.generado), margen, 202, 7, '#657D68');
    doc.setFontSize(7); doc.text(`${pagina} / ${paginas}`, 283, 202, { align: 'right' });
  }
  return doc.output('blob');
}

export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob), enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre; document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportarReporte(reporte, formato) {
  if (!['xlsx', 'pdf'].includes(formato)) throw new Error('Formato de reporte no disponible.');
  const imagenes = await crearImagenesGraficas(reporte);
  const blob = formato === 'xlsx' ? await crearExcel(reporte, imagenes) : await crearPDF(reporte, undefined, imagenes);
  descargarArchivo(blob, nombreArchivoReporte(reporte, formato));
}
