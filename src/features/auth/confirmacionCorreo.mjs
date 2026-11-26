const tiposConfirmacion = new Set(['signup', 'email']);

export function esRutaConfirmacion(location) {
  if (/^\/reset-password\/?$/.test(location.pathname || '')) return false;
  const query = new URLSearchParams(location.search || '');
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return /^\/confirm-email\/?$/.test(location.pathname || '') || location.hash === '#confirm-email' ||
    tiposConfirmacion.has(query.get('type')) || tiposConfirmacion.has(hash.get('type'));
}

export function urlConfirmacion(location) {
  const url = new URL('/confirm-email', location.origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Abre KaabMap mediante una conexión HTTPS.');
  }
  return url.href;
}

function leerEnlace(location) {
  const query = new URLSearchParams(location.search || '');
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const todos = key => [...query.getAll(key), ...hash.getAll(key)];
  const uno = key => todos(key).length === 1 ? todos(key)[0] : '';
  const sensible = (valor, max) => typeof valor === 'string' && valor.length > 0 && valor.length <= max && !/\s/.test(valor);
  const campos = ['token_hash', 'code', 'access_token', 'refresh_token', 'type'];
  if (campos.some(key => todos(key).length > 1) || ['error','error_code','error_description'].some(key => todos(key).length)) return { modo: 'invalido' };
  const modos = [todos('token_hash').length, todos('code').length, todos('access_token').length || todos('refresh_token').length].filter(Boolean).length;
  if (!modos) return { modo: 'sin_enlace' };
  if (modos !== 1) return { modo: 'invalido' };
  const tipo = uno('type');
  if (query.has('token_hash') && tiposConfirmacion.has(tipo) && sensible(uno('token_hash'), 1024)) {
    return { modo: 'otp', argumentos: { token_hash: uno('token_hash'), type: tipo } };
  }
  if (query.has('code') && (!tipo || tiposConfirmacion.has(tipo)) && sensible(uno('code'), 4096)) {
    return { modo: 'pkce', codigo: uno('code') };
  }
  if (tiposConfirmacion.has(tipo) && hash.has('access_token') && hash.has('refresh_token') &&
      sensible(uno('access_token'), 16384) && sensible(uno('refresh_token'), 4096)) {
    return { modo: 'sesion', argumentos: { access_token: uno('access_token'), refresh_token: uno('refresh_token') } };
  }
  return { modo: 'invalido' };
}

// Una instancia por carga de la aplicación: React StrictMode no repite el canje.
// Los parámetros del enlace solo viven en memoria y nunca forman parte del estado visible.
export function crearConfirmacionCorreo(cliente, browser) {
  const solicitada = esRutaConfirmacion(browser.location);
  const listeners = new Set();
  let estado = Object.freeze({ fase: solicitada ? 'comprobando' : 'inactiva', error: '', saliendo: false });
  let entrada = solicitada ? leerEnlace(browser.location) : null;
  let usuarioDelEnlace = null;
  let vigente = true;
  let cerrando = false;
  const emitir = next => { if (vigente) { estado = Object.freeze(next); listeners.forEach(fn => fn()); } };
  const invalidar = () => emitir({ fase: 'invalida', error: 'El enlace no es válido, ya se utilizó o venció. Abre el correo de confirmación más reciente. Si ya confirmaste tu cuenta, intenta iniciar sesión.', saliendo: false });

  if (solicitada) {
    // Limpiar antes de mostrar contenido. No conservar el token en la barra ni en enlaces de navegación.
    browser.history.replaceState(null, '', '/confirm-email');
    const modo = entrada.modo;
    if (modo === 'sin_enlace') { entrada = null; emitir({ fase: 'sin_enlace', error: '', saliendo: false }); }
    else if (!cliente || modo === 'invalido') { entrada = null; invalidar(); }
    else Promise.resolve().then(async () => {
      try {
        const inicio = await cliente.auth.initialize();
        if (!vigente) return;
        if (inicio.error) throw new Error('Inicialización no confirmada');
        const enlace = entrada;
        entrada = null;
        let respuesta;
        if (enlace.modo === 'otp') respuesta = await cliente.auth.verifyOtp(enlace.argumentos);
        else if (enlace.modo === 'pkce') respuesta = await cliente.auth.exchangeCodeForSession(enlace.codigo);
        else respuesta = await cliente.auth.setSession(enlace.argumentos);
        if (!vigente) return;
        const sesion = respuesta.data?.session;
        if (respuesta.error || !sesion?.access_token || !sesion.user?.id || respuesta.data.user?.id !== sesion.user.id) throw new Error('Enlace no confirmado');
        usuarioDelEnlace = sesion.user.id;
        const actual = await cliente.auth.getUser();
        if (!vigente) return;
        const usuario = actual.data?.user;
        if (actual.error || usuario?.id !== usuarioDelEnlace || !usuario.email_confirmed_at || !Number.isFinite(Date.parse(usuario.email_confirmed_at))) throw new Error('Correo no confirmado');
        emitir({ fase: 'confirmada', error: '', saliendo: false });
      } catch { if (vigente) invalidar(); }
      finally { entrada = null; }
    });
  }

  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => estado,
    async continuar() {
      if (cerrando || estado.fase === 'comprobando') return;
      cerrando = true;
      emitir({ ...estado, error: '', saliendo: true });
      try {
        if (usuarioDelEnlace) {
          const actual = await cliente.auth.getSession();
          if (actual.error) throw new Error('Sesión no disponible');
          const usuarioActual = actual.data?.session?.user?.id;
          if (usuarioActual && usuarioActual !== usuarioDelEnlace) throw new Error('La sesión cambió');
          if (usuarioActual) {
            const cierre = await cliente.auth.signOut({ scope: 'local' });
            if (cierre.error) throw new Error('Cierre no confirmado');
          }
        }
        usuarioDelEnlace = null;
        browser.location.assign('/#login');
      } catch {
        emitir({ ...estado, error: 'No pudimos preparar el inicio de sesión. Comprueba tu conexión y vuelve a pulsar el botón.', saliendo: false });
      } finally { cerrando = false; }
    },
    dispose() { vigente = false; entrada = null; listeners.clear(); },
  };
}
