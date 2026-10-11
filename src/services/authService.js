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

// Adaptamos el usuario para que el login siga mostrando su nombre.
function prepararUsuario(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.user_metadata?.nombre || '',
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
