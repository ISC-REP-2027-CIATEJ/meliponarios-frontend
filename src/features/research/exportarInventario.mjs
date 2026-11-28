import { fechaVisible, instanteVisible, nombreArchivoReporte, numero, textoEstado } from './inventarioModel.mjs';

const tituloCelda = value => ({ value, type: String, fontWeight: 'bold', backgroundColor: '#064C3B', textColor: '#FFFFFF', wrap: true });
const celda = value => ({ value: value ?? 'Sin dato', type: typeof value === 'number' ? Number : String, wrap: true, verticalAlignment: 'top' });
const encabezados = ['Meliponario', 'Zona', 'Municipio', 'Localidad', 'Especie', 'Nombre científico', 'Cajas', 'Jobones', 'Última ficha aprobada', 'Estado operativo', 'Visibilidad'];
export function filasReporte(reporte) {
  return reporte.registros.flatMap(r => (r.inventario.length ? r.inventario : [null]).map(fila => [r.nombre, r.zonas.map(z => z.nombre).join(' / ') || 'Sin zona', r.municipio, r.localidad, fila?.nombreComun || 'Sin inventario registrado', fila?.nombreCientifico || 'Sin dato', fila?.cajas ?? null, fila?.jobones ?? null, r.fechaFicha ? fechaVisible(r.fechaFicha) : 'Sin fecha', textoEstado(r.estadoOperativo), textoEstado(r.visibilidad)]));
}
export function prepararHojasExcel(reporte) {
  const r = reporte.resumen;
  const inicio = [[tituloCelda(reporte.titulo)], [celda(reporte.fuente)], [celda('Generado: ' + instanteVisible(reporte.generado) + ' · Ciudad de México')]];
  return [
    { sheet: 'Resumen', columns: [{ width: 38 }, { width: 22 }, { width: 55 }], data: [
      ...inicio, [], [tituloCelda('Indicador'), tituloCelda('Valor registrado'), tituloCelda('Observación')],
      [celda('Meliponarios únicos'), celda(r.meliponarios), celda(reporte.alcance)],
      [celda('Especies distintas'), celda(r.especies), celda('Presencia por especie; no es un conteo de abejas')],
      [celda('Localidades representadas'), celda(r.localidades), celda('Localidades distintas en el alcance del reporte')],
      ...['cajas', 'jobones'].map(medida => [celda(medida[0].toUpperCase() + medida.slice(1)), celda(r[medida].total), celda(r[medida].faltantes + ' filas de especie sin dato')]),
      [celda('Meliponarios sin inventario'), celda(r.sinInventario)],
      [celda('Meliponarios sin punto GPS'), celda(r.sinGPS)], [], [celda(reporte.nota)],
    ] },
    { sheet: 'Inventario', stickyRowsCount: 5, columns: [34, 32, 22, 22, 30, 36, 14, 14, 26, 24, 18].map(width => ({ width })), data: [...inicio, [], encabezados.map(tituloCelda), ...filasReporte(reporte).map(fila => fila.map(celda))] },
    { sheet: 'Criterios', columns: [{ width: 30 }, { width: 100 }], data: [
      ...inicio, [], [tituloCelda('Criterio'), tituloCelda('Valor')],
      ...reporte.criterios.map(fila => fila.map(celda)),
      [celda('Alcance'), celda(reporte.alcance)],
      [celda('Fecha de consulta'), celda(instanteVisible(reporte.fechaConsulta) + ' · Ciudad de México')],
      [celda('Método'), celda(reporte.nota)],
      [celda('Datos personales'), celda('El reporte no incluye teléfonos, correos, responsables ni identificadores internos.')],
    ] },
  ];
}
export async function crearExcel(reporte) {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  return writeExcelFile(prepararHojasExcel(reporte)).toBlob();
}

async function cargarFuente() {
  const respuesta = await fetch(new URL('./assets/DejaVuSans.ttf', import.meta.url));
  if (!respuesta.ok) throw new Error('No se pudo cargar la tipografía del reporte. Vuelve a intentar.');
  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  let binario = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binario += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binario);
}

export async function crearPDF(reporte, fuenteBase64) {
  const [{ jsPDF }, fuente] = await Promise.all([import('jspdf'), fuenteBase64 ? Promise.resolve(fuenteBase64) : cargarFuente()]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('KaabMap.ttf', fuente);
  doc.addFont('KaabMap.ttf', 'KaabMap', 'normal');
  doc.setFont('KaabMap');
  doc.setProperties({ title: reporte.titulo, subject: reporte.fuente, author: 'KaabMap' });
  const margen = 14, ancho = 269, limite = 193;
  let y = 14;
  function cabecera(continuacion = false) {
    doc.setFillColor('#064C3B');
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(continuacion ? 13 : 16);
    doc.text(reporte.titulo, margen, 11);
    doc.setFontSize(8);
    doc.text(reporte.modo === 'ejemplo' ? 'EJEMPLO · Datos ficticios; no son registros de CIATEJ' : 'Consulta de investigación · Datos autorizados', margen, 19);
    doc.setTextColor('#153C32');
    y = 33;
  }
  const nueva = () => { doc.addPage(); cabecera(true); };
  function parrafo(texto, size = 9) {
    doc.setFontSize(size);
    const lineas = doc.splitTextToSize(String(texto), ancho);
    lineas.forEach(linea => {
      if (y + 5 > limite) nueva();
      doc.text(linea, margen, y);
      y += 4.6;
    });
    y += 2;
  }
  cabecera();
  parrafo('Generado: ' + instanteVisible(reporte.generado) + ' · Ciudad de México');
  parrafo('Consulta: ' + instanteVisible(reporte.fechaConsulta) + ' · ' + reporte.alcance);
  parrafo(reporte.criterios.map(([etiqueta, valor]) => etiqueta + ': ' + valor).join(' | '));
  y += 2;
  const r = reporte.resumen;
  parrafo(`${r.meliponarios} meliponarios únicos · ${r.especies} especies · ${r.localidades} localidades · Cajas: ${numero(r.cajas.total)} · Jobones: ${numero(r.jobones.total)}`, 11);
  parrafo(`Filas de especie sin conteo: cajas ${r.cajas.faltantes}, jobones ${r.jobones.faltantes}. Meliponarios sin inventario: ${r.sinInventario}.`);
  parrafo(reporte.nota, 8);
  y += 3;
  const columnas = [50, 50, 60, 20, 20, 35, 34];
  const titulos = ['Meliponario', 'Territorio', 'Especie', 'Cajas', 'Jobones', 'Última ficha', 'Estado'];
  const tablaCabecera = () => {
    if (y + 13 > limite) nueva();
    doc.setFillColor('#E8F1EA');
    doc.rect(margen, y - 4, ancho, 10, 'F');
    doc.setFontSize(8);
    let x = margen;
    titulos.forEach((titulo, i) => { doc.text(titulo, x + 2, y + 1); x += columnas[i]; });
    y += 12;
  };
  tablaCabecera();
  let indice = 0;
  reporte.registros.forEach(registro => (registro.inventario.length ? registro.inventario : [null]).forEach(fila => {
    const valores = [registro.nombre, [registro.localidad, registro.municipio, ...registro.zonas.map(z => z.nombre)].join(' · '), fila ? fila.nombreComun + '\n' + fila.nombreCientifico : 'Sin inventario registrado', numero(fila?.cajas), numero(fila?.jobones), fechaVisible(registro.fechaFicha), textoEstado(registro.estadoOperativo) + '\n' + textoEstado(registro.visibilidad)];
    doc.setFontSize(8);
    const textos = valores.map((v, i) => doc.splitTextToSize(String(v), columnas[i] - 4));
    const lineas = Math.max(...textos.map(t => t.length));
    let cursor = 0;
    while (cursor < lineas) {
      if (y + 9 > limite) { nueva(); tablaCabecera(); }
      const cantidad = Math.min(lineas - cursor, Math.max(1, Math.floor((limite - y - 5) / 4)));
      const alto = cantidad * 4 + 5;
      doc.setFillColor(indice % 2 ? '#F3F6F1' : '#FFFFFF');
      doc.rect(margen, y - 3, ancho, alto, 'F');
      let x = margen;
      textos.forEach((lineasCelda, i) => {
        const segmento = lineasCelda.slice(cursor, cursor + cantidad);
        if (segmento.length) doc.text(segmento, x + 2, y + 1, { lineHeightFactor: 1.4 });
        x += columnas[i];
      });
      y += alto;
      cursor += cantidad;
    }
    indice += 1;
  }));
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(7);
    doc.setTextColor('#51685F');
    doc.text('KaabMap · ' + (reporte.modo === 'ejemplo' ? 'EJEMPLO · ' : '') + 'Inventario territorial · ' + reporte.generado.slice(0, 10), margen, 202);
    doc.text(`${pagina} / ${paginas}`, 283, 202, { align: 'right' });
  }
  return doc.output('blob');
}
export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre;
  document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportarReporte(reporte, formato) {
  if (!['xlsx', 'pdf'].includes(formato)) throw new Error('Formato de reporte no disponible.');
  const blob = formato === 'xlsx' ? await crearExcel(reporte) : await crearPDF(reporte);
  descargarArchivo(blob, nombreArchivoReporte(reporte, formato));
}
