import { createAdminAccountsApi } from '../features/adminUsers/adminAccountsApi.mjs';
import { supabase, comprobarConfiguracion } from '../lib/supabase';
import { createAdminUsersApi } from '../features/adminUsers/adminUsersApi.mjs';

const api = createAdminUsersApi(supabase);

export function listarUsuariosAdmin() {
  comprobarConfiguracion();
  return api.listUsers();
}

export function adminCambiarRolUsuario(userId, roleId) {
  comprobarConfiguracion();
  return api.changeRole(userId, roleId);
}

export function adminCambiarEstadoUsuario(userId, active) {
  comprobarConfiguracion();
  return api.changeStatus(userId, active);
}

const accounts = createAdminAccountsApi(supabase);
export function obtenerCuentaAdmin(id) { comprobarConfiguracion(); return accounts.detail(id); }
export function guardarDatosCuentaAdmin(id, values) { comprobarConfiguracion(); return accounts.updateProfile(id, values); }
export function cambiarCorreoCuentaAdmin(id, email) { comprobarConfiguracion(); return accounts.changeEmail(id, email); }
export function cambiarPasswordCuentaAdmin(id, password) { comprobarConfiguracion(); return accounts.changePassword(id, password); }
export function crearCuentaAdmin(values) { comprobarConfiguracion(); return accounts.create(values); }
