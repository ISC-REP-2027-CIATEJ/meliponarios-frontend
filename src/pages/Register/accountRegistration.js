// Estos son únicamente los datos de una cuenta, no de un meliponario.
export const datosIniciales = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function validarCuenta(datos) {
  const errores = {};

  if (!datos.firstName.trim()) errores.firstName = 'Escribe tu nombre.';
  if (!datos.lastName.trim()) errores.lastName = 'Escribe tus apellidos.';

  // El teléfono se valida solamente cuando la persona decide escribirlo.
  const telefono = datos.phone.trim();
  const digitos = telefono.replace(/\D/g, '');
  if (telefono && (!/^\+?[\d\s()-]+$/.test(telefono) || digitos.length < 10 || digitos.length > 15)) {
    errores.phone = 'Escribe un teléfono de 10 a 15 dígitos o deja el campo vacío.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    errores.email = 'Escribe un correo válido.';
  }

  const longitud = Array.from(datos.password).length;
  if (longitud < 8 || longitud > 128) {
    errores.password = 'Utiliza entre 8 y 128 caracteres.';
  }
  if (!datos.confirmPassword || datos.password !== datos.confirmPassword) {
    errores.confirmPassword = 'Las contraseñas deben coincidir.';
  }

  return errores;
}

export function prepararCuenta(datos) {
  // Conservamos temporalmente el formato de authService actual.
  // En el siguiente cambio lo adaptaremos a Supabase.
  return {
    profile: {
      firstName: datos.firstName.trim(),
      lastName: datos.lastName.trim(),
      phone: datos.phone.trim() || null,
    },
    credentials: {
      email: datos.email.trim().toLowerCase(),
      password: datos.password,
    },
  };
}
