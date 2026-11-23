// Se llama con el cliente anónimo y una ficha que acaba de devolver la consulta pública.
export function rutaFotoProducto(ruta) {
  return typeof ruta === 'string' && /^catalogo\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:jpe?g|png|webp)$/i.test(ruta) ? ruta : null;
}

export async function completarInventario(cliente, ficha) {
  async function filas(rpc, clave) {
    const filas = [];
    let ultimo;
    for (;;) {
      let consulta = cliente.rpc(rpc, { p_meliponario_id: ficha.id }).order(clave).limit(100);
      if (ultimo) consulta = consulta.gt(clave, ultimo);
      const { data, error } = await consulta;
      if (error || !Array.isArray(data)) throw new Error('Lectura pública no disponible.');
      if (!data.length) return filas;
      for (const row of data) {
        if (typeof row?.[clave] !== 'string' || (ultimo && row[clave] <= ultimo)) throw new Error('Página pública incompleta.');
        ultimo = row[clave];
        filas.push(row);
      }
    }
  }
  const [insectos, oferta] = await Promise.allSettled([
    filas('listar_especies_meliponario_publicas', 'especie_id'),
    ficha.vendeMiel ? filas('listar_productos_meliponario', 'producto_id') : Promise.resolve([]),
  ]);
  const abejas = (insectos.value || []).flatMap(row => {
    const nombre = row.nombre_comun || row.nombre_cientifico;
    return typeof nombre === 'string' && nombre.trim() ? [{ nombre,
      cientifico: typeof row.nombre_cientifico === 'string' ? row.nombre_cientifico : '',
      cajas: Number.isInteger(row.cantidad_cajas) ? row.cantidad_cajas : null,
      jobones: Number.isInteger(row.cantidad_jobones) ? row.cantidad_jobones : null }] : [];
  });
  const productosPublicos = (oferta.value || []).filter(row => row.producto_activo === true &&
    typeof row.nombre === 'string' && row.nombre.trim() && ['disponible', 'bajo_pedido'].includes(row.estado))
    .map(row => ({ nombre: row.nombre, descripcion: typeof row.descripcion === 'string' ? row.descripcion : '',
      foto: rutaFotoProducto(row.imagen_storage), disponibilidad: row.estado === 'bajo_pedido' ? 'Bajo pedido' : 'Disponible' }));
  return { ...ficha, abejas, especies: abejas.map(row => row.nombre), productosPublicos,
    productos: productosPublicos.map(row => row.nombre), especiesDisponibles: insectos.status === 'fulfilled',
    productosDisponibles: oferta.status === 'fulfilled' };
}

export async function completarListado(cliente, fichas) {
  const resultado = new Array(fichas.length);
  let cursor = 0;
  async function cargar() {
    while (cursor < fichas.length) {
      const i = cursor++;
      resultado[i] = await completarInventario(cliente, fichas[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(fichas.length, 4) }, cargar));
  return resultado;
}
