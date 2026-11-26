// Presentación de los datos autorizados por las RPC existentes; no cambia la ficha.
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const etiquetas = {
  visita: 'Datos de la visita', ficha: 'Ficha técnica', formulario: 'Ficha técnica',
  fecha_visita: 'Fecha de la visita', fecha_envio: 'Enviada el', fecha_aprobacion: 'Aprobada el',
  fecha_asignacion: 'Asignación registrada', fecha_revision: 'Revisada el',
  estado: 'Estado de la ficha', estado_formulario: 'Estado de la ficha',
  estado_asignacion: 'Estado de la asignación', tipo_visita: 'Tipo de visita',
  motivo_asignacion: 'Motivo de la visita', observaciones: 'Observaciones del trabajador',
  comentario_correccion: 'Indicaciones de corrección', comentario_revision: 'Comentario de revisión',
  comentario_aprobacion: 'Comentario de aprobación', comentario_resolucion: 'Comentario de resolución',
  nombre_meliponario: 'Meliponario', nombre_comun: 'Nombre común', nombre_cientifico: 'Nombre científico',
  cantidad_cajas: 'Cajas', cantidad_jobones: 'Jobones', cantidad_colonias: 'Colonias',
  especies: 'Especies registradas', inventario: 'Inventario verificado',
  inventario_especies: 'Inventario de especies', respuestas: 'Respuestas del cuestionario',
  pregunta: 'Pregunta', respuesta: 'Respuesta', texto_pregunta: 'Pregunta', texto_respuesta: 'Respuesta',
  valor: 'Respuesta', opciones: 'Opciones seleccionadas', seleccionadas: 'Opciones seleccionadas',
  otro: 'Otro: especificación', texto_otro: 'Otro: especificación', otro_texto: 'Otro: especificación',
  techo: '¿De qué está hecho el techo del meliponario?',
  material_techo: '¿De qué está hecho el techo del meliponario?',
  materiales_techo: '¿De qué está hecho el techo del meliponario?',
  piso: '¿De qué está hecho el piso del meliponario?',
  material_piso: '¿De qué está hecho el piso del meliponario?',
  materiales_piso: '¿De qué está hecho el piso del meliponario?',
  sella_tapa: '¿Sella la orilla de la tapa de las cajas?',
  sellado_tapa: '¿Sella la orilla de la tapa de las cajas?',
  utiliza_acetato: '¿Utiliza acetato transparente o cartón debajo de la tapa?',
  alimenta: '¿Alimenta a las abejas en temporada de lluvias/nortes o cuando están débiles?',
  alimento_energetico: 'Alimento energético utilizado', alimento_proteico: 'Alimento proteico utilizado',
  cosecha_miel: '¿Con qué cosecha la miel?', metodo_cosecha: '¿Con qué cosecha la miel?',
  metodos_cosecha: '¿Con qué cosecha la miel?', trabajador_nombre: 'Trabajador de campo',
};
const estados = {
  enviada: 'Enviada', en_revision: 'En revisión', aprobada: 'Aprobada',
  en_correccion: 'En corrección', rechazada: 'Rechazada', borrador: 'Borrador',
  asignada: 'Asignada', completada: 'Completada', cancelada: 'Cancelada',
  levantamiento_tecnico: 'Primera visita', seguimiento: 'Seguimiento', correccion_datos: 'Corrección de datos',
};
export function etiquetaFicha(clave) {
  const texto = String(clave).replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim();
  return etiquetas[clave] || (texto ? texto[0].toLocaleUpperCase('es-MX') + texto.slice(1) : 'Información');
}
export function formatoDatoFicha(valor, clave = '') {
  if (valor === null || valor === undefined || valor === '') return 'Sin respuesta registrada';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  const texto = String(valor);
  if (uuid.test(texto)) return '';
  if (/^fecha/.test(clave) && /^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const fecha = new Date(texto + 'T12:00:00Z');
    return Number.isNaN(fecha.getTime()) ? texto : new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(fecha);
  }
  if (/^fecha/.test(clave) && /^\d{4}-\d{2}-\d{2}T/.test(texto) && !Number.isNaN(Date.parse(texto))) {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(texto));
  }
  return estados[texto] || texto.replaceAll('_', ' ');
}
export function campoVisibleFicha(clave) {
  return !/(^id$|_id$|^id_|uuid|token|password|storage|bucket|^ruta|^path|^email$|^correo|^created_at$|^updated_at$|^fecha_creacion$|^fecha_actualizacion$)/i.test(clave);
}
export function limpiarFicha(valor) {
  if (Array.isArray(valor)) return valor.map(limpiarFicha).filter(v => v !== undefined);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor)
    .filter(([clave]) => campoVisibleFicha(clave))
    .map(([clave, v]) => [clave, limpiarFicha(v)]).filter(([, v]) => v !== undefined));
  return typeof valor === 'string' && uuid.test(valor) ? undefined : valor;
}

