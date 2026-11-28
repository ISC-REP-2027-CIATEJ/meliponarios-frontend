export const TIPOS_GRAFICA = Object.freeze({
  horizontal: 'Barras horizontales', vertical: 'Barras verticales',
  pastel: 'Pastel', dona: 'Dona', tabla: 'Tabla',
});
export const GRAFICAS_INICIALES = Object.freeze({
  tipos: Object.freeze({ municipios: 'horizontal', especies: 'horizontal', inventario: 'vertical', estados: 'dona' }),
  medida: 'cajas',
});
export const COLORES_GRAFICA = Object.freeze(['#147653', '#4D8F87', '#5C739C', '#A2AD82', '#8A7491', '#63876C', '#557E94', '#9A866D']);

export function validarGraficas(opciones = GRAFICAS_INICIALES) {
  const tipos = Object.fromEntries(Object.entries(GRAFICAS_INICIALES.tipos).map(([clave, defecto]) => {
    const tipo = opciones.tipos?.[clave] ?? defecto;
    if (!TIPOS_GRAFICA[tipo]) throw new Error('El tipo de gráfica no está disponible.');
    return [clave, tipo];
  }));
  const medida = opciones.medida ?? 'cajas';
  if (!['cajas', 'jobones'].includes(medida)) throw new Error('La medida de inventario no es válida.');
  return { tipos, medida };
}

export function definirGraficas(resumen, opciones = GRAFICAS_INICIALES) {
  const config = validarGraficas(opciones);
  const medida = config.medida === 'cajas' ? 'Cajas' : 'Jobones';
  return [
    { id: 'municipios', titulo: 'Meliponarios por municipio', unidad: 'Meliponarios', filtro: 'municipio', filas: resumen.municipios, nota: 'Cada meliponario cuenta una sola vez en su municipio.' },
    { id: 'especies', titulo: 'Presencia de especies', unidad: 'Meliponarios con la especie', filtro: 'especie', filas: resumen.distribucionEspecies,
      nota: ['pastel', 'dona'].includes(config.tipos.especies) ? 'Porcentaje de presencias por especie. Un meliponario puede aportar varias especies.' : 'Un meliponario puede tener varias especies. Estos valores no se suman como meliponarios únicos.' },
    { id: 'inventario', titulo: 'Inventario por especie', unidad: medida + ' registradas', filtro: 'especie', filas: resumen.inventarioEspecies.map(fila => ({ ...fila, total: fila[config.medida].total, faltantes: fila[config.medida].faltantes })), nota: 'Solo se suman los conteos registrados; los faltantes se indican como «Sin dato».' },
    { id: 'estados', titulo: 'Estado de los meliponarios', unidad: 'Meliponarios', filtro: 'estado', filas: resumen.estados, nota: 'Cada meliponario cuenta una sola vez. Selecciona una categoría para filtrar.', notaReporte: 'Cada meliponario cuenta una sola vez en su estado operativo.' },
  ].map(grafica => ({ ...grafica, tipo: config.tipos[grafica.id] }));
}

export function alcanceInicial(seleccion) {
  return seleccion.length ? 'seleccionados' : 'filtrados';
}

export function graficasParaExportar(resumen, opciones) {
  return definirGraficas(resumen, opciones).flatMap(original => {
    const grafica = { ...original, nota: original.notaReporte || original.nota };
    if (grafica.filas.length <= 8) return [grafica];
    if (['pastel', 'dona'].includes(grafica.tipo)) {
      const ordenadas = [...grafica.filas].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
      const otras = ordenadas.slice(7);
      const conocidos = otras.filter(fila => fila.total !== null);
      return [{ ...grafica, filas: [...ordenadas.slice(0, 7), { id: 'otras', nombre: `Otras ${otras.length} categorías`, total: conocidos.length ? conocidos.reduce((s, f) => s + f.total, 0) : null }], nota: grafica.nota + ' Se agrupan las categorías restantes para facilitar la lectura; el inventario conserva el detalle completo.' }];
    }
    return Array.from({ length: Math.ceil(grafica.filas.length / 8) }, (_, indice) => ({ ...grafica, id: grafica.id + '-' + indice, titulo: grafica.titulo + ` (${indice + 1}/${Math.ceil(grafica.filas.length / 8)})`, filas: grafica.filas.slice(indice * 8, indice * 8 + 8) }));
  });
}
