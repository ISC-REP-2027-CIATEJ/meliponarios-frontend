import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { crearApiRegistroSupabase } from './registroSupabase.mjs';

function api() {
  comprobarConfiguracion();
  return crearApiRegistroSupabase(supabase);
}

export const obtenerCatalogosReales = userId => api().catalogos(userId);
export const obtenerLocalidadesReales = (userId, municipioId) => api().localidades(userId, municipioId);
export const obtenerRegistrosReales = userId => api().listar(userId);
export const guardarBorradorReal = (userId, form, id, catalogo) => api().guardar(userId, form, id, catalogo);
