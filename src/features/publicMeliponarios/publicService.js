import { createClient } from '@supabase/supabase-js';
import { comprobarConfiguracion } from '../../lib/supabase';
import { crearApiPublica, crearClienteLecturaPublica } from './publicApi.mjs';

let api;
const cacheFotos = new Map();
export function invalidarFotosPublicas(id) { cacheFotos.delete(id); }
function preparar() {
  try {
    comprobarConfiguracion();
    if (!api) {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const cliente = crearClienteLecturaPublica(createClient, url, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      api = crearApiPublica(cliente, { origenAlmacenamiento: url });
    }
    return api;
  } catch { throw new Error('El catálogo público todavía no está disponible. Inténtalo más tarde.'); }
}

export async function obtenerMeliponariosPublicos() { cacheFotos.clear(); return preparar().listar(); }
export async function obtenerFichaPublica(id) { cacheFotos.delete(id); return preparar().ficha(id); }
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
