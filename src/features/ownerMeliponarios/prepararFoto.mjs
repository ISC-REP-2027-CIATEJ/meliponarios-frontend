import { ErrorFotos, MAX_BYTES_FOTO, TIPOS_FOTO, validarFotoPreparada } from './fotosSupabase.mjs';

export const LADO_MAXIMO_FOTO = 2400;

// El nombre se utiliza solo en la selección privada; no determina la ruta de Storage.
export async function validarOriginalFoto(file) {
  if (!(file instanceof Blob) || file.size < 1 || file.size > MAX_BYTES_FOTO) throw new ErrorFotos('Selecciona una fotografía de hasta 5 MiB.');
  if (file.type && !TIPOS_FOTO.includes(file.type)) throw new ErrorFotos('Solo se admiten JPEG, PNG y WebP. Convierte HEIC u otros formatos antes de seleccionarlos.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  let mime = null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) mime = 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') mime = 'image/webp';
  if (!mime || file.type && file.type !== mime) throw new ErrorFotos('El contenido del archivo no corresponde a una fotografía JPEG, PNG o WebP válida.');
  return mime;
}

async function decodificarEnNavegador(file) {
  if (typeof globalThis.createImageBitmap === 'function') return globalThis.createImageBitmap(file, { imageOrientation: 'from-image' });
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close() { URL.revokeObjectURL(url); image.src = ''; } };
  } catch { URL.revokeObjectURL(url); throw new ErrorFotos('El navegador no pudo abrir esa fotografía. Prueba con una copia exportada como JPEG, PNG o WebP.'); }
}

export async function prepararFoto(file, { decodificar = decodificarEnNavegador, crearLienzo = () => document.createElement('canvas') } = {}) {
  await validarOriginalFoto(file);
  let image, canvas;
  try {
    image = await decodificar(file);
    if (![image.width, image.height].every(Number.isFinite) || image.width < 1 || image.height < 1 ||
        image.width * image.height > 50000000) throw new ErrorFotos('Reduce la resolución de esa fotografía antes de prepararla en este navegador.');
    const factor = Math.min(1, LADO_MAXIMO_FOTO / Math.max(image.width, image.height));
    const ancho = Math.max(1, Math.round(image.width * factor));
    const alto = Math.max(1, Math.round(image.height * factor));
    canvas = crearLienzo(); canvas.width = ancho; canvas.height = alto;
    const context = canvas.getContext('2d');
    if (!context) throw new ErrorFotos('El navegador no pudo preparar la fotografía.');
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(image.image || image, 0, 0, ancho, alto);
    // Subir únicamente esta copia de píxeles: no trasladar EXIF ni el archivo original.
    // Si WebP no está disponible, canvas puede producir PNG; se respeta su tipo real.
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
    const prepared = { blob, metadatosEliminados: true, descripcion: '' };
    validarFotoPreparada(prepared);
    return { ...prepared, ancho, alto, nombreLocal: typeof file.name === 'string' ? file.name : 'Fotografía' };
  } catch (error) {
    throw error instanceof ErrorFotos ? error : new ErrorFotos('No pudimos preparar esa fotografía. Prueba con otra copia o reduce su resolución.');
  } finally {
    image?.close?.();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
