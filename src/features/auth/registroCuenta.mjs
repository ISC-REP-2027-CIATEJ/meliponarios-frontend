import { urlConfirmacion } from './confirmacionCorreo.mjs';

// Identificadores temporales para las pruebas acordadas del proyecto.
// No representan documentos oficiales. Al publicarlos, actualizar sus versiones
// y el aviso visible en RegisterPage.jsx en la misma entrega.
export const versionesRegistro = Object.freeze({
  terminos: 'pruebas-v1',
  privacidad: 'pruebas-v1',
});

export function crearSolicitudRegistro(datos) {
  if (datos?.consentimientoAceptado !== true) {
    throw new Error('Acepta los términos y condiciones y el aviso de privacidad para crear tu cuenta.');
  }
  if (typeof datos.nombre !== 'string' || !datos.nombre.trim() ||
      typeof datos.apellidos !== 'string' || !datos.apellidos.trim() ||
      typeof datos.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim()) ||
      typeof datos.password !== 'string' || Array.from(datos.password).length < 8 ||
      Array.from(datos.password).length > 128 ||
      (datos.telefono != null && typeof datos.telefono !== 'string')) {
    throw new Error('Revisa tus datos de registro antes de crear la cuenta.');
  }
  for (const version of Object.values(versionesRegistro)) {
    if (!version.trim() || Array.from(version).length > 40) {
      throw new Error('Las versiones de los documentos de registro no están configuradas correctamente.');
    }
  }
  // Contrato confirmado por public.handle_new_user. Las fechas y el rol Cliente
  // los asigna el servidor; nunca se toman de campos editables del navegador.
  return {
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    options: {
      data: {
        nombre: datos.nombre.trim(),
        apellidos: datos.apellidos.trim(),
        telefono: datos.telefono?.trim() || null,
        acepto_terminos: true,
        acepto_aviso_privacidad: true,
        version_terminos: versionesRegistro.terminos,
        version_aviso_privacidad: versionesRegistro.privacidad,
      },
    },
  };
}

export async function registrarCuenta(cliente, datos, location) {
  const solicitud = crearSolicitudRegistro(datos);
  if (location) solicitud.options.emailRedirectTo = urlConfirmacion(location);
  if (!cliente?.auth?.signUp) throw new Error('El servicio de registro no está configurado.');
  let respuesta;
  try {
    // Una sola solicitud: nunca reintentar automáticamente un alta.
    respuesta = await cliente.auth.signUp(solicitud);
  } catch {
    throw new Error('No se pudo confirmar el registro. Comprueba tu correo antes de volver a intentarlo.');
  }
  if (respuesta.error) {
    if (respuesta.error.message === 'Database error saving new user') {
      throw new Error('El servidor no pudo guardar la cuenta. Si el problema continúa, el responsable del sistema debe revisar el registro de errores del alta.');
    }
    throw new Error(respuesta.error.message || 'No se pudo completar el registro.');
  }
  const resultado = respuesta.data;
  if (!resultado?.user?.id) throw new Error('No se pudo confirmar el registro. Comprueba tu correo antes de volver a intentarlo.');
  return {
    userId: resultado.user.id,
    email: resultado.user.email || solicitud.email,
    emailVerificationRequired: !resultado.session,
  };
}
