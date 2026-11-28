import { COLORES_GRAFICA, graficasParaExportar, TIPOS_GRAFICA } from './researchCharts.mjs';
import { numero } from './inventarioModel.mjs';

function lineasTexto(ctx, texto, ancho, maximo = 3) {
  const palabras = String(texto).split(/\s+/), lineas = [];
  let linea = '';
  palabras.forEach(palabra => {
    const siguiente = linea ? linea + ' ' + palabra : palabra;
    if (ctx.measureText(siguiente).width > ancho && linea) { lineas.push(linea); linea = palabra; }
    else linea = siguiente;
  });
  if (linea) lineas.push(linea);
  return lineas.length > maximo ? [...lineas.slice(0, maximo - 1), lineas[maximo - 1].slice(0, -1) + '…'] : lineas;
}

async function imagenGrafica(grafica) {
  const canvas = document.createElement('canvas');
  canvas.width = 1100; canvas.height = 650;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen de la gráfica.');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1100, 650);
  const fuente = (tamano, negrita = false) => { ctx.font = `${negrita ? '600 ' : ''}${tamano}px Arial, sans-serif`; };
  const escribir = (texto, x, y, tamano = 24, negrita = false, color = '#224A37') => {
    fuente(tamano, negrita); ctx.fillStyle = color; ctx.fillText(String(texto), x, y);
  };
  const bloque = (texto, x, y, ancho, tamano = 24, maximo = 2) => {
    fuente(tamano); ctx.fillStyle = '#42624C';
    lineasTexto(ctx, texto, ancho, maximo).forEach((linea, i) => ctx.fillText(linea, x, y + i * (tamano + 5)));
  };
  escribir(grafica.titulo, 30, 46, 32, true);
  escribir(grafica.unidad + ' · ' + TIPOS_GRAFICA[grafica.tipo], 30, 84, 22, false, '#66816B');
  const filas = grafica.filas;
  const maximo = Math.max(1, ...filas.map(f => f.total ?? 0));
  const suma = filas.reduce((s, f) => s + (f.total ?? 0), 0);
  if (!filas.length) escribir('Sin resultados en este alcance', 30, 290, 28);
  else if (grafica.tipo === 'horizontal') {
    const paso = Math.min(88, 420 / filas.length);
    filas.forEach((fila, i) => {
      const y = 135 + i * paso;
      bloque(fila.nombre, 30, y + 15, 280, 23, 2);
      ctx.fillStyle = '#EDF3EC'; ctx.fillRect(340, y, 640, 21);
      ctx.fillStyle = COLORES_GRAFICA[i % COLORES_GRAFICA.length]; ctx.fillRect(340, y, 640 * (fila.total ?? 0) / maximo, 21);
      escribir(numero(fila.total), 994, y + 20, 24, true);
    });
  } else if (grafica.tipo === 'vertical') {
    const paso = 1000 / filas.length;
    ctx.strokeStyle = '#D8E4D6'; ctx.beginPath(); ctx.moveTo(40, 455); ctx.lineTo(1060, 455); ctx.stroke();
    filas.forEach((fila, i) => {
      const alto = (fila.total ?? 0) / maximo * 300;
      const x = 45 + paso * i, ancho = Math.min(80, paso * 0.6);
      ctx.fillStyle = COLORES_GRAFICA[i % COLORES_GRAFICA.length]; ctx.fillRect(x + paso * 0.15, 455 - alto, ancho, alto);
      escribir(numero(fila.total), x + paso * 0.15, 440 - alto, 24, true);
      bloque(fila.nombre, x, 493, paso - 16, 22, 3);
    });
  } else if (['pastel', 'dona'].includes(grafica.tipo)) {
    let inicio = -Math.PI / 2;
    if (!suma) { ctx.fillStyle = '#E9F0E7'; ctx.beginPath(); ctx.arc(245, 325, 158, 0, Math.PI * 2); ctx.fill(); }
    filas.forEach((fila, i) => {
      const angulo = suma ? (fila.total ?? 0) / suma * Math.PI * 2 : 0;
      ctx.fillStyle = COLORES_GRAFICA[i % COLORES_GRAFICA.length];
      if (angulo > 0) { ctx.beginPath(); ctx.moveTo(245, 325); ctx.arc(245, 325, 158, inicio, inicio + angulo); ctx.closePath(); ctx.fill(); }
      inicio += angulo;
      const y = 150 + i * 47;
      ctx.fillRect(470, y - 16, 16, 16);
      escribir(fila.nombre, 500, y, 22);
      escribir(numero(fila.total), 947, y, 22, true);
      escribir(fila.total !== null && suma ? `${(fila.total / suma * 100).toFixed(1)}%` : '—', 1010, y, 20, false, '#617D65');
    });
    if (grafica.tipo === 'dona') {
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(245, 325, 105, 0, Math.PI * 2); ctx.fill();
      const totalVisible = filas.some(fila => fila.total !== null) ? numero(suma) : 'Sin dato';
      ctx.textAlign = 'center'; escribir(totalVisible, 245, 333, 40, true); ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = '#EAF2E7'; ctx.fillRect(30, 115, 1040, 49);
    escribir('Categoría', 45, 148, 23, true); escribir(grafica.unidad, 660, 148, 23, true);
    filas.forEach((fila, i) => {
      const y = 182 + i * 46;
      if (i % 2 === 0) { ctx.fillStyle = '#F5F8F2'; ctx.fillRect(30, y - 25, 1040, 46); }
      escribir(fila.nombre, 45, y + 5, 23); escribir(numero(fila.total), 660, y + 5, 23, true);
    });
  }
  bloque(grafica.nota, 30, 592, 1040, 21, 2);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(valor => valor ? resolve(valor) : reject(new Error('No se pudo crear la gráfica.')), 'image/png'));
  return { id: grafica.id, titulo: grafica.titulo, tipo: grafica.tipo, blob, dataURL: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, nota: grafica.nota };
}

export async function crearImagenesGraficas(reporte) {
  if (!reporte.incluirGraficas) return [];
  return Promise.all(graficasParaExportar(reporte.resumen, reporte.graficas).map(imagenGrafica));
}
