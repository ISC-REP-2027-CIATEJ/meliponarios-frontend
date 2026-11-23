// Opciones de esta prueba de interfaz. No son IDs ni categorías del backend.
export const categoriasProducto = Object.freeze([
  { id: 'miel', nombre: 'Miel' },
  { id: 'cuidado', nombre: 'Cuidado personal' },
  { id: 'tradicional', nombre: 'Uso tradicional' },
  { id: 'otros', nombre: 'Otros productos' },
]);
export const tiposProducto = Object.freeze([
  { id: 'miel', nombre: 'Miel', categoria: 'miel', imagenId: 'miel', unidad: 'mL' },
  { id: 'polen', nombre: 'Polen', categoria: 'otros', imagenId: 'generica', unidad: 'g' },
  { id: 'cerumen', nombre: 'Cerumen', categoria: 'otros', imagenId: 'cerumen', unidad: 'g' },
  { id: 'resina', nombre: 'Resina', categoria: 'otros', imagenId: 'generica', unidad: 'g' },
  { id: 'geopropoleo', nombre: 'Geopropóleo', categoria: 'otros', imagenId: 'generica', unidad: 'g' },
  { id: 'propoleo', nombre: 'Propóleo', categoria: 'tradicional', imagenId: 'propoleo', unidad: 'mL' },
  { id: 'crema', nombre: 'Crema', categoria: 'cuidado', imagenId: 'generica', unidad: 'g' },
  { id: 'jabon', nombre: 'Jabón', categoria: 'cuidado', imagenId: 'jabon', unidad: 'g' },
  { id: 'shampoo', nombre: 'Shampoo', categoria: 'cuidado', imagenId: 'generica', unidad: 'mL' },
  { id: 'otro', nombre: 'Otro producto', categoria: 'otros', imagenId: 'generica', unidad: 'pieza' },
]);
export const unidadesProducto = ['mL', 'L', 'g', 'kg', 'pieza'];
// Solo se resuelven estas imágenes ya incluidas en KaabMap; nunca una URL del usuario.
export const imagenesProducto = Object.freeze({ miel: 'miel.png', cerumen: 'cera.png', propoleo: 'propoleo.png', jabon: 'jabon.png', generica: null });

export function crearProducto(tipoId = '', existente = null) {
  if (existente) return { ...existente };
  const tipo = tiposProducto.find(item => item.id === tipoId);
  return { id: '', tipoId, nombre: tipo?.id === 'otro' ? '' : tipo?.nombre || '', categoria: tipo?.categoria || 'otros', cantidad: '', unidad: tipo?.unidad || 'mL', presentacion: '', imagenId: tipo?.imagenId || 'generica' };
}

export function validarProducto(producto, otros = []) {
  const tipo = tiposProducto.find(item => item.id === producto?.tipoId);
  if (!tipo) return 'Elige el tipo de producto que quieres agregar.';
  if (typeof producto.nombre !== 'string' || !producto.nombre.trim() || producto.nombre.trim().length > 100) return 'Escribe un nombre de hasta 100 caracteres.';
  if (!categoriasProducto.some(item => item.id === producto.categoria)) return 'Elige una categoría de la lista.';
  if (!unidadesProducto.includes(producto.unidad)) return 'Selecciona una unidad de contenido.';
  if (producto.cantidad !== '' && ((typeof producto.cantidad !== 'string' && typeof producto.cantidad !== 'number') || String(producto.cantidad).trim() === '' || !Number.isFinite(Number(producto.cantidad)) || Number(producto.cantidad) <= 0 || Number(producto.cantidad) > 1000000)) return 'El contenido debe ser mayor que cero y no superar 1 000 000.';
  if (typeof producto.presentacion !== 'string' || producto.presentacion.length > 80) return 'La descripción de la presentación debe tener hasta 80 caracteres.';
  if (!['generica', tipo.imagenId].includes(producto.imagenId)) return 'Elige una de las imágenes de catálogo disponibles para este producto.';
  if (otros.some(item => typeof item?.nombre === 'string' && typeof item.presentacion === 'string' && item.nombre.trim().toLocaleLowerCase() === producto.nombre.trim().toLocaleLowerCase() && String(item.cantidad) === String(producto.cantidad) && item.unidad === producto.unidad && item.presentacion.trim().toLocaleLowerCase() === producto.presentacion.trim().toLocaleLowerCase())) return 'Ya agregaste este producto con la misma presentación. Puedes editar su tarjeta.';
  return '';
}

export function normalizarProducto(producto) {
  return { id: producto.id || 'demo-producto-' + (globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(36).slice(2)), tipoId: producto.tipoId, nombre: producto.nombre.trim(), categoria: producto.categoria, cantidad: producto.cantidad === '' ? '' : Number(producto.cantidad), unidad: producto.unidad, presentacion: producto.presentacion.trim(), imagenId: producto.imagenId };
}

export function presentacionProducto(producto) {
  const contenido = producto.cantidad === '' ? '' : `${producto.cantidad} ${producto.unidad}`;
  return [producto.presentacion, contenido].filter(Boolean).join(' · ');
}
