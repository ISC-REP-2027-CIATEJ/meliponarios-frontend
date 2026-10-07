// Contrato PROPUESTO de API con sesión en cookie HttpOnly; confirmar con backend.
const API = import.meta.env.VITE_API_URL?.trim();

async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
  if (!API) throw new Error('La conexión al servidor todavía no está configurada.');
  let base;
  try { base = new URL(API); } catch { throw new Error('La dirección del servidor no es válida.'); }
  const local = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))) {
    throw new Error('El servidor debe utilizar HTTPS. HTTP solo se permite en desarrollo local.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API.replace(/\/$/, '')}${path}`, {
      method, credentials: 'include', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Correo o contraseña incorrectos.' : response.status === 429 ? 'Demasiados intentos. Espera un momento antes de volver a intentar.' : 'No fue posible completar la solicitud. Inténtalo nuevamente.');
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    if (error instanceof TypeError) throw new Error('No se pudo conectar al servidor. Revisa la conexión e inténtalo nuevamente.');
    if (error instanceof SyntaxError) throw new Error('El servidor envió una respuesta con formato inesperado.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function getSession() {
  const data = await request('/auth/me');
  if (!data?.user || typeof data.user.id !== 'string') throw new Error('La respuesta de sesión no contiene un usuario válido.');
  return data.user;
}

export async function login(email, password) {
  await request('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
  // Comprueba que el navegador realmente recibió una sesión utilizable.
  return getSession();
}

export async function logout() { await request('/auth/logout', { method: 'POST' }); }
export const hasBackend = Boolean(API);

// Contrato propuesto: confirmar esquema e idempotencia con backend.
export async function register(payload, idempotencyKey) {
  const result = await request('/auth/register', { method: 'POST', body: payload, idempotencyKey });
  if (!result || result.created !== true || typeof result.emailVerificationRequired !== 'boolean') {
    throw new Error('El servidor no confirmó el registro con el formato esperado. Verifica con soporte antes de volver a enviar.');
  }
  return result;
}
