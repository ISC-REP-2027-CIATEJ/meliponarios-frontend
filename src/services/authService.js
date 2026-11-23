import { supabase, comprobarConfiguracion, supabaseConfigurado } from '../lib/supabase';

// LoginPage usa este valor para saber si puede consultar la sesión al abrir.
export const hasBackend = supabaseConfigurado;

// Nombre, apellidos y teléfono se guardan como metadatos de la cuenta.
export async function register(datos) {
  comprobarConfiguracion();

  const { data: resultado, error } = await supabase.auth.signUp({
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    options: {
      data: {
        nombre: datos.nombre.trim(),
        apellidos: datos.apellidos.trim(),
        telefono: datos.telefono?.trim() || null,
      },
    },
  });

  if (error) throw new Error(error.message);
  if (!resultado.user) throw new Error('No se pudo completar el registro.');

  return {
    userId: resultado.user.id,
    email: resultado.user.email,
    emailVerificationRequired: !resultado.session,
  };
}

// Etiquetas correspondientes a los IDs confirmados en public.roles.
const rolesPorId = Object.freeze({
  1: "Administrador general",
  2: "Investigador de consulta",
  3: "Coordinador de campo",
  4: "Trabajador de campo",
  5: "Cliente",
});

// Consultamos el perfil propio para validar su estado y mostrar el rol asignado.
async function prepararUsuario(usuario) {
  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("rol_id, activo")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) {
    await supabase.auth.signOut();
    throw new Error("No se pudo validar tu perfil: " + error.message);
  }

  if (!perfil || perfil.activo !== true) {
    await supabase.auth.signOut();
    throw new Error("No encontramos un perfil activo para esta cuenta.");
  }

  const nombre = usuario.user_metadata?.nombre?.trim() || "";
  const apellidos = usuario.user_metadata?.apellidos?.trim() || "";
  const roleId = Number(perfil.rol_id);

  return {
    id: usuario.id,
    email: usuario.email,
    name: [nombre, apellidos].filter(Boolean).join(" "),
    roleId,
    roleName: rolesPorId[roleId] || "Rol no identificado",
  };
}

export async function login(email, password) {
  comprobarConfiguracion();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) throw new Error(error.message);
  return prepararUsuario(data.user);
}

export async function getSession() {
  if (!supabase) return null;
  comprobarConfiguracion();

  // Primero vemos si el navegador tiene una sesión.
  const { data: datosSesion, error: errorSesion } = await supabase.auth.getSession();
  if (errorSesion) throw new Error(errorSesion.message);
  if (!datosSesion.session) return null;

  // Después confirmamos con Supabase que sigue siendo válida.
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return prepararUsuario(data.user);
}

export async function logout() {
  comprobarConfiguracion();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
