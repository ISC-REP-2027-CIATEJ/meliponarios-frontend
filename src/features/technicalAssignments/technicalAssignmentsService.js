import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { createTechnicalAssignmentsApi } from './technicalAssignmentsApi.mjs';

const service = createTechnicalAssignmentsApi(supabase);
function api() { comprobarConfiguracion(); return service; }
export const obtenerAsignacionesCoordinador = userId => api().coordinator(userId);
export const obtenerMeliponariosAsignados = userId => api().worker(userId);
export const asignarMeliponarioTecnico = (userId, values) => api().assign(userId, values);
export const cancelarAsignacionTecnica = (userId, values) => api().cancel(userId, values);
