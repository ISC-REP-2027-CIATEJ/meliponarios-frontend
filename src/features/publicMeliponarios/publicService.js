import { createClient } from '@supabase/supabase-js';
import { comprobarConfiguracion } from '../../lib/supabase';
import { crearApiPublica, crearClienteLecturaPublica } from './publicApi.mjs';

import { completarInventario, completarListado, rutaFotoProducto } from './inventarioPublico.mjs';

let cliente;
let api;
const cacheFotos = new Map();
export function invalidarFotosPublicas(id) { cacheFotos.delete(id); }
function preparar() {
  try {
    comprobarConfiguracion();
    if (!api) {
      const url = import.meta.env.VITE_SUPABASE_URL;
      cliente = crearClienteLecturaPublica(createClient, url, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      api = crearApiPublica(cliente, { origenAlmacenamiento: url });
    }
    return api;
  } catch { throw new Error('El catálogo público todavía no está disponible. Inténtalo más tarde.'); }
}

export async function obtenerMeliponariosPublicos() {
  cacheFotos.clear();
  const fichas = await preparar().listar();
  return completarListado(cliente, fichas);
}
export async function obtenerFichaPublica(id) {
  cacheFotos.delete(id);
  const ficha = await preparar().ficha(id);
  return ficha ? completarInventario(cliente, ficha) : null;
}
export async function descargarFotoProductoPublico(ruta) {
  if (!rutaFotoProducto(ruta)) return null;
  preparar();
  const { data, error } = await cliente.storage.from('kaabmap-productos').download(ruta);
  return !error && data?.size && ['image/jpeg','image/png','image/webp'].includes(data.type) ? data : null;
}

export function obtenerFotosPublicas(id, renovar = false) {
  const previa = cacheFotos.get(id);
  if (!renovar && previa && previa.hasta > Date.now()) return previa.promesa;
  // Solo memoria; nunca guardar las firmas ni los metadatos fotográficos en localStorage.
  const entrada = { hasta: Date.now() + 45000, promesa: null };
  entrada.promesa = Promise.resolve().then(() => preparar().fotos(id)).catch(error => {
    if (cacheFotos.get(id) === entrada) cacheFotos.delete(id);
    throw error;
  });
  cacheFotos.set(id, entrada);
  return entrada.promesa;
}
