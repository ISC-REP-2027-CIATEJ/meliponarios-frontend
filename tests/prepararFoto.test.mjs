import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararFoto, validarOriginalFoto } from '../src/features/ownerMeliponarios/prepararFoto.mjs';
import { MAX_BYTES_FOTO } from '../src/features/ownerMeliponarios/fotosSupabase.mjs';

const jpeg = () => new File([new Uint8Array([255, 216, 255, 225]), 'Exif\\0GPS_PRUEBA'], 'archivo-privado.jpg', { type: 'image/jpeg' });
const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'pixel'], 'foto.png', { type: 'image/png' });
function navegador({ width = 4800, height = 3200, mime = 'image/webp', large = false, noContext = false, empty = false } = {}) {
  const calls = [];
  const image = { width, height, close() { calls.push(['close']); } };
  const context = { drawImage(...args) { calls.push(['drawImage', ...args]); } };
  const canvas = { getContext(type) { assert.equal(type, '2d'); return noContext ? null : context; },
    toBlob(callback, type, quality) {
      calls.push(['toBlob', type, quality]);
      callback(empty ? null : new Blob([large ? new Uint8Array(MAX_BYTES_FOTO + 1) : 'PIXELES_RECODIFICADOS'], { type: mime }));
    } };
  return { calls, image, canvas, deps: { decodificar: async () => image, crearLienzo: () => canvas } };
}

test('identifica JPEG, PNG y WebP por su contenido y no solo por el nombre', async () => {
  assert.equal(await validarOriginalFoto(jpeg()), 'image/jpeg');
  assert.equal(await validarOriginalFoto(png()), 'image/png');
  assert.equal(await validarOriginalFoto(new File(['RIFF0000WEBPpixel'], 'foto.webp', { type: 'image/webp' })), 'image/webp');
});

test('rechaza archivos vacíos, superiores a 5 MiB y formatos no permitidos', async () => {
  for (const file of [new Blob([], { type: 'image/jpeg' }), new Blob([new Uint8Array(MAX_BYTES_FOTO + 1)], { type: 'image/jpeg' }),
    new File(['svg'], 'foto.svg', { type: 'image/svg+xml' }), new File(['HEIC'], 'foto.heic', { type: 'image/heic' })]) {
    await assert.rejects(validarOriginalFoto(file));
  }
});

test('rechaza una extensión o MIME disfrazados con contenido distinto', async () => {
  await assert.rejects(validarOriginalFoto(new File(['texto'], 'foto.jpg', { type: 'image/jpeg' })), /contenido/);
  await assert.rejects(validarOriginalFoto(new File([await png().arrayBuffer()], 'foto.jpg', { type: 'image/jpeg' })), /contenido/);
});

test('admite un MIME vacío si la firma binaria corresponde a una foto permitida', async () => {
  const file = new File([await png().arrayBuffer()], 'foto-sin-mime');
  assert.equal(await validarOriginalFoto(file), 'image/png');
});

test('redibuja en un lienzo nuevo, reduce proporcionalmente y genera otra copia', async () => {
  const n = navegador();
  const original = jpeg();
  const result = await prepararFoto(original, n.deps);
  assert.deepEqual([result.ancho, result.alto], [2400, 1600]);
  assert.equal(result.metadatosEliminados, true);
  assert.notEqual(result.blob, original);
  assert.equal(result.nombreLocal, 'archivo-privado.jpg');
  assert.ok(n.calls.some(call => call[0] === 'drawImage' && call[1] === n.image));
  assert.ok(n.calls.some(call => call[0] === 'toBlob' && call[1] === 'image/webp'));
  assert.equal(await result.blob.text(), 'PIXELES_RECODIFICADOS');
  assert.ok((await original.text()).includes('GPS_PRUEBA'));
  assert.equal(n.canvas.width, 0); assert.equal(n.canvas.height, 0);
  assert.ok(n.calls.some(call => call[0] === 'close'));
});

test('no amplía imágenes pequeñas y conserva la proporción vertical', async () => {
  const n = navegador({ width: 600, height: 1200 });
  const result = await prepararFoto(png(), n.deps);
  assert.deepEqual([result.ancho, result.alto], [600, 1200]);
});

test('respeta PNG si el navegador lo devuelve como alternativa a WebP', async () => {
  const n = navegador({ mime: 'image/png' });
  assert.equal((await prepararFoto(png(), n.deps)).blob.type, 'image/png');
});

test('no devuelve una copia si falla la codificación o supera el tamaño permitido', async () => {
  for (const options of [{ noContext: true }, { empty: true }, { large: true }, { mime: 'image/svg+xml' }]) {
    const n = navegador(options);
    await assert.rejects(prepararFoto(jpeg(), n.deps));
    assert.ok(n.calls.some(call => call[0] === 'close'));
    assert.equal(n.canvas.width, 0);
  }
});

test('limita dimensiones inválidas y fotos demasiado grandes para el navegador', async () => {
  for (const options of [{ width: 0 }, { width: NaN }, { width: 10000, height: 10000 }]) {
    const n = navegador(options);
    await assert.rejects(prepararFoto(jpeg(), n.deps), /resolución/);
    assert.ok(n.calls.some(call => call[0] === 'close'));
  }
});

test('los errores del decodificador se presentan sin datos internos ni subidas', async () => {
  await assert.rejects(prepararFoto(jpeg(), { decodificar: async () => { throw Error('SECRETO'); } }), error => !error.message.includes('SECRETO'));
});
