import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { invalidarFotosPublicas } from '../publicMeliponarios/publicService';
import { crearApiFotos } from './fotosSupabase.mjs';

function api() {
  comprobarConfiguracion();
  return crearApiFotos(supabase, { origenAlmacenamiento: import.meta.env.VITE_SUPABASE_URL });
}
export const obtenerFotosPropias = (userId, id) => api().listar(userId, id);
export async function subirFotoPropia(userId, id, foto) {
  try { return await api().subir(userId, id, foto); }
  finally { invalidarFotosPublicas(id); }
}
export async function eliminarFotoPropia(userId, id, imagenId) {
  try { return await api().eliminar(userId, id, imagenId); }
  finally { invalidarFotosPublicas(id); }
}
