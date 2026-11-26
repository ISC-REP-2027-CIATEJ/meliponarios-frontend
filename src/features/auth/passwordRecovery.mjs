// Control de recuperación en memoria. Los enlaces y contraseñas no se registran ni se guardan aquí.
export function esRutaRecuperacion(location) {
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return /^\/reset-password\/?$/.test(location.pathname || '') ||
    location.hash === '#reset-password' || hash.get('type') === 'recovery';
}
export function validarNuevaPassword(password, confirmacion) {
  if (Array.from(password).length < 8 || Array.from(password).length > 128) return 'Utiliza entre 8 y 128 caracteres.';
  if (password !== confirmacion) return 'Las contraseñas deben coincidir.';
  return '';
}
export function urlRecuperacion(location) {
  const url = new URL('/reset-password', location.origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Abre KaabMap mediante una conexión HTTPS.');
  }
  return url.href;
}
export function errorRecuperacion(error) {
  if (error?.status === 429 || /rate_limit|over_email_send_rate_limit/.test(error?.code || '')) return 'Se alcanzó el límite de solicitudes. Espera unos minutos antes de intentarlo otra vez.';
  if (error?.code === 'same_password') return 'Elige una contraseña diferente de la anterior.';
  if (error?.code === 'weak_password') return 'La contraseña no cumple los requisitos de seguridad de la cuenta. Elige una más larga y combina letras, números y símbolos.';
  return 'No se pudo completar la operación. Comprueba tu conexión e inténtalo de nuevo.';
}
export function crearRecuperacion(client, browser) {
  const listeners = new Set();
  const solicitada = esRutaRecuperacion(browser.location);
  const query = new URLSearchParams(browser.location.search || '');
  const conHash = solicitada && query.has('token_hash');
  // Captura temporal del enlace; no entra al estado, logs ni almacenamiento.
  let tokenHash = query.get('token_hash');
  const hashValido = conHash && query.getAll('token_hash').length === 1 &&
    query.getAll('type').length === 1 && query.get('type') === 'recovery' &&
    typeof tokenHash === 'string' && tokenHash.length > 0 && tokenHash.length <= 1024 &&
    !/\s/.test(tokenHash);
  let estado = { fase: solicitada ? 'comprobando' : 'inactiva', error: '' };
  let usuario = null;
  let guardando = false;
  let verificacion;
  let vigente = true;
  const emit = next => { if (!vigente) return; estado = Object.freeze(next); listeners.forEach(fn => fn()); };
  const limpiarUrl = () => {
    if (browser.location.pathname === '/reset-password' && !browser.location.hash && !browser.location.search) return;
    browser.history.replaceState(null, '', '/reset-password');
  };
  function invalidar() {
    tokenHash = null; usuario = null; limpiarUrl();
    emit({ fase: 'invalida', error: 'El enlace no es válido, ya se utilizó o venció. Solicita un nuevo correo de recuperación.' });
  }
  const subscription = client?.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user?.id && !conHash) {
      usuario = session.user.id;
      limpiarUrl();
      emit({ fase: 'lista', error: '' });
    } else if (event === 'SIGNED_OUT' && usuario && estado.fase === 'lista') {
      invalidar();
    }
  }).data?.subscription;
  // Un token_hash no se convierte automáticamente en una sesión al cargar la URL.
  // Se limpia la dirección y se verifica una sola vez; una sesión previa no lo sustituye.
  if (solicitada) {
    if (!client || (conHash && !hashValido)) invalidar();
    else if (conHash) {
      limpiarUrl();
      Promise.resolve().then(async () => {
        const inicial = await client.auth.initialize();
        if (!vigente) return;
        if (inicial.error) { invalidar(); return; }
        const hash = tokenHash;
        tokenHash = null;
        const { data, error } = await client.auth.verifyOtp({ token_hash: hash, type: 'recovery' });
        if (!vigente) return;
        const cuenta = data?.session?.user?.id;
        if (error || !data?.session?.access_token || !cuenta || data.user?.id !== cuenta) {
          invalidar();
          return;
        }
        usuario = cuenta;
        emit({ fase: 'lista', error: '' });
      }).catch(() => { if (vigente) invalidar(); });
    } else Promise.resolve(client.auth.initialize()).then(result => {
      if (!vigente) return;
      verificacion = setTimeout(() => {
        if (estado.fase === 'comprobando') invalidar();
      }, 0);
      if (result.error && estado.fase === 'comprobando') invalidar();
    }).catch(() => { if (vigente) invalidar(); });
  }
  async function cerrarRecuperacion() {
    if (!client) throw new Error('El servicio de acceso no está configurado.');
    const result = await client.auth.signOut({ scope: 'local' });
    if (result.error) throw result.error;
    usuario = null;
    emit({ fase: 'completada', error: '' });
  }
  return {
    getSnapshot: () => estado,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async solicitar(email) {
      if (!client) throw new Error('El servicio de acceso no está configurado.');
      const correo = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Escribe un correo electrónico válido.');
      const { error } = await client.auth.resetPasswordForEmail(correo, { redirectTo: urlRecuperacion(browser.location) });
      if (error) throw new Error(errorRecuperacion(error));
    },
    async guardar(password, confirmacion) {
      if (guardando) return;
      const invalid = validarNuevaPassword(password, confirmacion);
      if (invalid) throw new Error(invalid);
      if (estado.fase !== 'lista' || !usuario) throw new Error('Abre el enlace del correo de recuperación antes de cambiar la contraseña.');
      guardando = true;
      emit({ fase: 'guardando', error: '' });
      try {
        const actual = await client.auth.getUser();
        if (actual.error || actual.data?.user?.id !== usuario) {
          invalidar();
          return;
        }
        const { data, error } = await client.auth.updateUser({ password });
        if (error) throw error;
        if (data?.user?.id !== usuario) throw new Error('No se confirmó la actualización.');
        // Una falla al cerrar no vuelve a enviar la contraseña: solo permite reintentar el cierre.
        emit({ fase: 'cerrando', error: '' });
        try { await cerrarRecuperacion(); }
        catch { emit({ fase: 'salida_pendiente', error: 'La contraseña se actualizó. Falta cerrar la sesión de recuperación; pulsa Cerrar sesión para terminar.' }); }
      } catch (error) {
        if (estado.fase !== 'invalida') emit({ fase: 'lista', error: errorRecuperacion(error) });
      } finally { guardando = false; }
    },
    async terminar() {
      if (estado.fase !== 'salida_pendiente' || guardando) return;
      guardando = true; emit({ fase: 'cerrando', error: '' });
      try { await cerrarRecuperacion(); }
      catch { emit({ fase: 'salida_pendiente', error: 'No se pudo cerrar la sesión. Comprueba tu conexión y vuelve a intentar el cierre.' }); }
      finally { guardando = false; }
    },
    async salir() {
      if (guardando || ['guardando', 'cerrando'].includes(estado.fase)) return;
      if (usuario) {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) { emit({ ...estado, error: 'No se pudo cerrar la sesión. Comprueba tu conexión antes de salir.' }); return; }
      }
      usuario = null;
      browser.history.replaceState(null, '', '/#login');
      emit({ fase: 'inactiva', error: '' });
    },
    dispose() { vigente = false; tokenHash = null; clearTimeout(verificacion); subscription?.unsubscribe(); listeners.clear(); },
  };
}

