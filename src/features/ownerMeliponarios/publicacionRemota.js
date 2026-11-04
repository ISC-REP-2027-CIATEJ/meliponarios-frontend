import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { obtenerFichaPublica } from '../publicMeliponarios/publicService';
import { crearApiPublicacion } from './publicacionSupabase.mjs';

function api() {
  comprobarConfiguracion();
  return crearApiPublicacion(supabase, { consultarPublica: obtenerFichaPublica });
}
export const obtenerPublicacionPropia = (userId, id) => api().leer(userId, id);
export const guardarPublicacionPropia = (userId, id, form) => api().guardar(userId, id, form);
