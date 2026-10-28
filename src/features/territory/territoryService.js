import { supabase, comprobarConfiguracion } from '../../lib/supabase';
import { createTerritoryApi } from './territoryApi.mjs';
const service = createTerritoryApi(supabase);
function api() { comprobarConfiguracion(); return service; }
export const obtenerAsignaciones = userId => api().assignments(userId);
export const asignarZona = (userId, values) => api().assign(userId, values);
export const finalizarAsignacion = (userId, id) => api().finish(userId, id);
export const obtenerSolicitudesCampo = (userId, filters) => api().list(userId, filters);
export const obtenerFichaCampo = (userId, id) => api().detail(userId, id);
export const tomarSolicitudCampo = (userId, id) => api().take(userId, id);
export const resolverSolicitudCampo = (userId, id, decision, comment) => api().resolve(userId, id, decision, comment);
export const enviarSolicitudReal = (userId, id, state) => api().send(userId, id, state);
export const obtenerRevisionesCliente = (userId, id) => api().ownerReviews(userId, id);
