import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

// Nueva función propuesta. Se despliega en Supabase, nunca se importa en React.
const PROFILE_FIELDS = 'id,nombre,apellidos,telefono,rol_id,activo,fecha_creacion';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message); this.status = status; this.code = code; this.extra = extra;
  }
}

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}): never { throw new ApiError(status, code, message, extra); }
function check(result: any, message: string): any {
  if (result.error) fail(502, 'BACKEND_ERROR', message);
  return result.data;
}
function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'INVALID_INPUT', `Revisa el campo ${label}.`);
  return value.trim();
}
function profileInput(value: Record<string, any>) {
  const phone = text(value.telefono ?? '', 'teléfono', 25, false);
  const digits = phone.replace(/\D/g, '');
  if (phone && (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 15)) fail(400, 'INVALID_INPUT', 'Escribe un teléfono de 10 a 15 dígitos o deja el campo vacío.');
  return {
    nombre: text(value.nombre, 'nombre', 150),
    apellidos: text(value.apellidos, 'apellidos', 150),
    telefono: phone || null,
  };
}
function emailInput(value: unknown): string {
  const email = text(value, 'correo', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'INVALID_INPUT', 'Escribe un correo válido.');
  return email;
}
function passwordInput(value: unknown): string {
  if (typeof value !== 'string' || Array.from(value).length < 8 || Array.from(value).length > 128) fail(400, 'INVALID_INPUT', 'La contraseña debe tener entre 8 y 128 caracteres.');
  return value;
}
function allowKeys(payload: Record<string, unknown>, keys: string[]) {
  if (Object.keys(payload).some(key => !keys.includes(key))) fail(400, 'INVALID_INPUT', 'La solicitud contiene campos no permitidos.');
}

// El cliente de servicio se utiliza únicamente en el servidor para Supabase Auth.
// Las lecturas/escrituras de perfiles y las RPC se ejecutan como el administrador
// autenticado, conservando las políticas y funciones existentes del equipo.
export function createAdminAccountsHandler({ createClient, env }: { createClient: any; env: (name: string) => string | undefined }) {
  return async function handle(request: Request): Promise<Response> {
    const origins = (env('ADMIN_ACCOUNTS_ALLOWED_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',').map(value => value.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(origin && origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (origin && !origins.includes(origin)) fail(403, 'ORIGIN_DENIED', 'Este origen no está habilitado para la administración.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') fail(405, 'METHOD_NOT_ALLOWED', 'Utiliza POST.');
      const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
      if (!bearer) fail(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');

      const url = env('SUPABASE_URL');
      let serviceKey: any = env('SUPABASE_SERVICE_ROLE_KEY');
      let publicKey: any = env('SUPABASE_ANON_KEY');
      try {
        if (!serviceKey) serviceKey = Object.values(JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'))[0];
        if (!publicKey) publicKey = Object.values(JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}'))[0];
      } catch { fail(503, 'CONFIGURATION_ERROR', 'Revisa las variables del servidor con backend.'); }
      if (!url || !serviceKey || !publicKey) fail(503, 'CONFIGURATION_ERROR', 'Falta la configuración de Auth en el servidor.');
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const actor = createClient(url, publicKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const identity = await admin.auth.getUser(bearer);
      if (identity.error || !identity.data?.user?.id) fail(401, 'AUTH_REQUIRED', 'La sesión ya no es válida. Vuelve a iniciar sesión.');
      const actorId = identity.data.user.id;
      const actorProfile = check(await actor.from('perfiles').select('rol_id,activo').eq('id', actorId).maybeSingle(), 'No se pudo comprobar el perfil que realiza la operación.');
      if (!actorProfile || Number(actorProfile.rol_id) !== 1 || actorProfile.activo !== true) fail(403, 'ADMIN_ACCESS_DENIED', 'Se requiere un administrador general activo.');

      const raw = await request.text();
      if (raw.length > 16000) fail(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
      let payload: Record<string, any>;
      try { payload = JSON.parse(raw); } catch { fail(400, 'INVALID_INPUT', 'La solicitud no contiene JSON válido.'); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(400, 'INVALID_INPUT', 'La solicitud no es válida.');
      const action = payload.action;
      const allowed: Record<string, string[]> = {
        detail: ['action', 'userId'],
        profile: ['action', 'userId', 'nombre', 'apellidos', 'telefono'],
        email: ['action', 'userId', 'email'],
        password: ['action', 'userId', 'password'],
        create: ['action', 'nombre', 'apellidos', 'telefono', 'email', 'password', 'roleId', 'active', 'confirmEmail'],
      };
      if (!Object.hasOwn(allowed, action)) fail(400, 'UNKNOWN_ACTION', 'Operación no disponible.');
      allowKeys(payload, allowed[action]);

      if (action === 'create') {
        const fields = profileInput(payload);
        const email = emailInput(payload.email);
        const password = passwordInput(payload.password);
        const roleId = Number(payload.roleId);
        if (!Number.isInteger(roleId) || roleId < 1 || roleId > 32767 || typeof payload.active !== 'boolean') fail(400, 'INVALID_INPUT', 'Elige un rol y un estado válidos.');
        if (payload.confirmEmail !== true) fail(400, 'EMAIL_CONFIRMATION_REQUIRED', 'Confirma que darás de alta esta cuenta con el correo verificado por administración.');
        const role = check(await actor.from('roles').select('id,nombre').eq('id', roleId).maybeSingle(), 'No se pudo comprobar el rol solicitado.');
        if (!role) fail(400, 'INVALID_ROLE', 'El rol solicitado no existe.');

        // Se crea sin confirmar para que no pueda iniciar sesión hasta terminar
        // de asignar el rol. El trigger existente crea su perfil como Cliente.
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: fields });
        if (created.error || !created.data?.user?.id) {
          const duplicate = ['email_exists', 'user_already_exists'].includes(created.error?.code) || created.error?.status === 422;
          fail(duplicate ? 409 : 502, duplicate ? 'ACCOUNT_NOT_CREATED' : 'AUTH_CREATE_FAILED', duplicate ? 'No se creó la cuenta. Comprueba si el correo ya existe o si Auth rechazó sus datos.' : 'Auth no pudo crear la cuenta. Comprueba su configuración y los requisitos de contraseña.');
        }
        const newId = created.data.user.id;
        let finalizing = false;
        try {
          const profile = check(await actor.from('perfiles').select(PROFILE_FIELDS).eq('id', newId).maybeSingle(), 'No se pudo leer el perfil recién creado.');
          if (!profile) fail(502, 'PROFILE_NOT_CREATED', 'El trigger no creó el perfil de la cuenta.');
          if (roleId !== Number(profile.rol_id)) check(await actor.rpc('admin_cambiar_rol_usuario', { p_usuario_id: newId, p_rol_id: roleId }), 'No se pudo asignar el rol solicitado.');
          if (payload.active !== profile.activo) check(await actor.rpc('admin_cambiar_estado_usuario', { p_usuario_id: newId, p_activo: payload.active }), 'No se pudo asignar el estado solicitado.');
          const confirmedProfile = check(await actor.from('perfiles').select(PROFILE_FIELDS).eq('id', newId).single(), 'No se pudo verificar el perfil preparado.');
          if (Number(confirmedProfile.rol_id) !== roleId || confirmedProfile.activo !== payload.active) fail(502, 'PROFILE_NOT_READY', 'El perfil no quedó con los valores solicitados.');
          finalizing = true;
          check(await admin.auth.admin.updateUserById(newId, { email_confirm: true }), 'No se pudo confirmar el alta en Auth.');
          return respond(200, { ok: true, user: { ...confirmedProfile, email }, message: 'Cuenta creada con el rol solicitado. Su correo fue confirmado por administración.' });
        } catch (error) {
          // Después de intentar la confirmación, una respuesta perdida puede
          // significar que la cuenta sí quedó habilitada: no se elimina a ciegas.
          if (finalizing) fail(409, 'CREATE_RESULT_UNCERTAIN', 'El perfil se preparó, pero no se pudo confirmar el resultado final de Auth. Revisa esta cuenta antes de intentar crearla de nuevo.', { userId: newId, partial: true });
          let cleanup;
          try { cleanup = await admin.auth.admin.deleteUser(newId); }
          catch { cleanup = { error: true }; }
          if (cleanup.error) fail(409, 'CREATE_CLEANUP_PENDING', 'El alta no terminó y quedó una cuenta sin confirmar que requiere revisión del backend. No repitas el alta todavía.', { userId: newId, partial: true });
          throw error;
        }
      }

      if (typeof payload.userId !== 'string' || !UUID.test(payload.userId)) fail(400, 'INVALID_INPUT', 'El identificador de la cuenta no es válido.');
      const targetId = payload.userId;
      const target = check(await actor.from('perfiles').select(PROFILE_FIELDS).eq('id', targetId).maybeSingle(), 'No se pudo consultar el perfil.');
      if (!target) fail(404, 'NOT_FOUND', 'No se encontró ese perfil.');
      const authTarget = await admin.auth.admin.getUserById(targetId);
      if (authTarget.error || !authTarget.data?.user) fail(404, 'AUTH_USER_NOT_FOUND', 'No se encontró la cuenta correspondiente en Auth.');
      const currentUser = authTarget.data.user;
      if (action === 'detail') return respond(200, { ok: true, user: { ...target, email: currentUser.email || '' } });

      if (action === 'profile') {
        const fields = profileInput(payload);
        const saved = check(await actor.from('perfiles').update(fields).eq('id', targetId).select(PROFILE_FIELDS).single(), 'No se pudieron guardar los datos del perfil.');
        // Auth fusiona las claves recibidas: no reenviamos otros metadatos que
        // otro módulo podría haber actualizado durante esta solicitud.
        const synced = await admin.auth.admin.updateUserById(targetId, { user_metadata: fields });
        if (synced.error) fail(409, 'PROFILE_SAVED_AUTH_PENDING', 'Los datos se guardaron en perfiles, pero su sincronización con Auth no quedó confirmada. Vuelve a guardar estos mismos datos para completar la sincronización.', { partial: true, userId: targetId, profileSaved: true });
        return respond(200, { ok: true, user: { ...saved, email: currentUser.email || '' }, message: 'Datos personales actualizados en el perfil y en Auth.' });
      }
      if (action === 'email') {
        const email = emailInput(payload.email);
        if (email === currentUser.email?.toLowerCase()) fail(400, 'NO_CHANGES', 'El correo es el mismo que ya tiene la cuenta.');
        const result = await admin.auth.admin.updateUserById(targetId, { email });
        if (result.error) fail(409, 'AUTH_EMAIL_FAILED', 'No se pudo confirmar el cambio de correo. Comprueba si ya está registrado y vuelve a consultar el detalle antes de reintentar.');
        return respond(200, { ok: true, message: 'Correo de acceso actualizado por administración.' });
      }
      const password = passwordInput(payload.password);
      const result = await admin.auth.admin.updateUserById(targetId, { password });
      if (result.error) fail(409, 'AUTH_PASSWORD_FAILED', 'No se pudo confirmar el cambio de contraseña. Revisa los requisitos de Auth antes de volver a intentarlo.');
      return respond(200, { ok: true, message: 'Se estableció la nueva contraseña. La contraseña anterior no se consulta ni se muestra.' });
    } catch (error) {
      if (error instanceof ApiError) return respond(error.status, { ok: false, error: { code: error.code, message: error.message, ...error.extra } });
      // No se registran cuerpos de solicitudes, contraseñas, correos o claves.
      return respond(500, { ok: false, error: { code: 'UNEXPECTED_ERROR', message: 'No se pudo confirmar la operación. Revisa el estado de la cuenta antes de reintentar.' } });
    }
  };
}

Deno.serve(createAdminAccountsHandler({ createClient, env: name => Deno.env.get(name) }));
