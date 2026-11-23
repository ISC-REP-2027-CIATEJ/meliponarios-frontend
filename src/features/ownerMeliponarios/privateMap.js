import { isCliente } from './model.js';
import { presentacionProducto } from './productos.js';

function puntoValido(value) {
  return Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
}

// Proyección exclusivamente local para la cuenta dueña. No modifica el catálogo público
// ni contiene los conteos privados de cajas/jobones. Los estados no equivalen a aprobación.
export function crearPuntosPropios(registros, user, catalogo) {
  if (!isCliente(user) || !catalogo) return [];
  return registros.filter(record => record.ownerId === user.id && ['borrador','enviado_demo'].includes(record.estado) && puntoValido(record.coordenadas)).map(record => ({
    id: 'privado:' + record.id,
    registroPropioId: record.id,
    privadoDemo: true,
    estado: record.estado === 'borrador' ? 'Borrador' : 'Pendiente',
    etiquetaPrivada: record.estado === 'borrador' ? 'Borrador · aún no enviado' : 'Solicitud de prueba · aún no aprobada',
    nombre: record.nombre || 'Borrador sin nombre',
    municipio: catalogo.municipios.find(item => item.id === record.municipioId)?.nombre || 'Municipio por completar',
    descripcion: record.descripcion || 'Este registro pertenece a tu cuenta y todavía no está aprobado para consulta pública.',
    imagen: 'sendero.png', // Ilustración ya existente, no fotografía del registro del cliente.
    coordenadas: [...record.coordenadas],
    especies: record.abejas.map(bee => catalogo.abejas.find(item => item.id === bee.tipoId)?.nombre).filter(Boolean),
    productos: [...new Set((record.productos ?? []).map(producto => [producto.nombre, presentacionProducto(producto)].filter(Boolean).join(' · ')))],
    ofertaVisualDemo: record.vendeMiel && record.recibeVisitas ? 'ambos' : record.vendeMiel ? 'miel' : record.recibeVisitas ? 'difusion' : null,
  }));
}

export function abrirRegistroPropio(point) {
  return point?.privadoDemo && typeof point.registroPropioId === 'string' ? '#mi-meliponario/' + encodeURIComponent(point.registroPropioId) : null;
}
