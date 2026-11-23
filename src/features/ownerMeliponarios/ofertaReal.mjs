import { validId } from '../territory/territoryApi.mjs';

export const disponibilidad = Object.freeze({
  disponible: 'Disponible',
  bajo_pedido: 'Bajo pedido',
  no_disponible: 'No disponible',
});

export function crearOfertaReal(cliente) {
  async function verificarSesion(usuario) {
    const { data, error } = await cliente.auth.getUser();
    if (error || !validId(usuario) || data?.user?.id !== usuario) {
      throw new Error('La sesión cambió. Vuelve a abrir Mis meliponarios con tu cuenta.');
    }
  }

  async function filas(nombre, argumentos, clave) {
    const resultado = [];
    let cursor;
    for (;;) {
      let consulta = cliente.rpc(nombre, argumentos).order(clave).limit(100);
      if (cursor) consulta = consulta.gt(clave, cursor);
      const { data, error } = await consulta;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('No se pudo leer la lista de productos.');
      if (!data.length) return resultado;
      for (const fila of data) {
        if (!validId(fila[clave]) || (cursor && fila[clave] <= cursor)) {
          throw new Error('El catálogo cambió durante la lectura. Actualiza la lista.');
        }
        cursor = fila[clave];
        resultado.push(fila);
      }
    }
  }

  return {
    async leer(usuario, registro) {
      if (!validId(registro)) throw new Error('Primero guarda el meliponario.');
      await verificarSesion(usuario);
      const [catalogo, oferta] = await Promise.all([
        filas('listar_catalogo_productos', {}, 'id'),
        filas('listar_productos_meliponario', { p_meliponario_id: registro }, 'producto_id'),
      ]);
      const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es-MX');
      return { catalogo: catalogo.sort(porNombre), oferta: oferta.sort(porNombre) };
    },

    async guardar(usuario, registro, producto, estado) {
      if (!validId(registro) || !validId(producto) || !Object.hasOwn(disponibilidad, estado)) {
        throw new Error('Selecciona un producto y su disponibilidad.');
      }
      await verificarSesion(usuario);
      const { data, error } = await cliente.rpc('guardar_producto_meliponario', {
        p_meliponario_id: registro, p_producto_id: producto, p_estado: estado,
      });
      if (error) throw error;
      if (!validId(data)) throw new Error('No se recibió la confirmación del guardado.');
    },
  };
}
