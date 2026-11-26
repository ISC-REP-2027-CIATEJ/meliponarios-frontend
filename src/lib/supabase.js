import { crearRecuperacion } from "../features/auth/passwordRecovery.mjs";
import { createClient } from "@supabase/supabase-js";

// Estas variables son públicas. Nunca poner una clave service_role aquí.
const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(url && clave);

// Dejamos ver los formularios aunque todavía falte configurar Supabase.
export const supabase = supabaseConfigurado ? createClient(url, clave) : null;

export const recuperacionPassword = crearRecuperacion(supabase, window);

export function comprobarConfiguracion() {
  if (!supabase) {
    throw new Error(
      "Falta configurar la URL y la clave pública de Supabase en .env.local.",
    );
  }
  const servidor = new URL(url);
  const esLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    servidor.hostname,
  );
  if (
    servidor.protocol !== "https:" &&
    !(import.meta.env.DEV && esLocal && servidor.protocol === "http:")
  ) {
    throw new Error(
      "Usa HTTPS para conectar a Supabase fuera del desarrollo local.",
    );
  }
}
