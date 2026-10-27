import { validarCuenta } from '../Register/accountRegistration';
import { useEffect, useRef, useState } from 'react';
import { obtenerCuentaAdmin, guardarDatosCuentaAdmin, cambiarCorreoCuentaAdmin, cambiarPasswordCuentaAdmin, crearCuentaAdmin } from '../../services/adminUsersService';

const control = 'mt-2 min-h-11 w-full rounded-xl border border-solid border-[#d5ded0] bg-white px-3 py-2 text-sm text-[#163e2c] disabled:opacity-50';
const base = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-solid px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const button = `${base} border-[#d5ded0] bg-white text-[#163e2c] hover:bg-[#edf2e7]`;
const primary = `${base} border-[#163e2c] bg-[#163e2c] text-white hover:bg-[#285940]`;

const empty = { nombre: '', apellidos: '', telefono: '', email: '', password: '', repeatPassword: '', roleId: '', active: true, confirmEmail: false };

export default function AdminAccountDialog({ mode, profile, roles, actorId, onClose, onSaved, onPartial, onDenied }) {
  const creating = mode === 'create';
  const [values, setValues] = useState({ ...empty });
  const [tab, setTab] = useState('profile');
  const [showPasswords, setShowPasswords] = useState(false);
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(!creating);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const dialog = useRef(null);
  const lock = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    // Se abre después de cerrar el diálogo de detalle anterior.
    const timer = setTimeout(() => { if (element && !element.open) element.showModal(); }, 0);
    return () => { clearTimeout(timer); if (element?.open) element.close(); };
  }, []);

  useEffect(() => {
    if (creating) return undefined;
    let current = true;
    Promise.resolve().then(() => obtenerCuentaAdmin(profile.id)).then(result => {
      if (!current) return;
      const account = result.user;
      setValues(previous => ({ ...previous, nombre: account.nombre, apellidos: account.apellidos, telefono: account.telefono || '', email: account.email || '' }));
      setOriginalEmail(account.email || '');
    }).catch(err => {
      if (!current) return;
      setLoadError(err.message || 'No se pudo cargar la cuenta.');
      if (err.code === 'ADMIN_ACCESS_DENIED' || err.code === 'AUTH_REQUIRED') onDenied(err.message);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [creating, profile?.id, revision, onDenied]);

  function update(key, value) { setValues(previous => ({ ...previous, [key]: value })); setError(''); }
  function close() { if (!lock.current) onClose(); }
  function chooseTab(value) { if (lock.current) return; setTab(value); setShowPasswords(false); setConfirming(false); setError(''); update('password', ''); update('repeatPassword', ''); }
  function requestConfirmation(event) {
    event.preventDefault();
    if (lock.current || uncertain || loading || loadError) return;
    if (creating) {
      const errors = validarCuenta({ firstName: values.nombre, lastName: values.apellidos, phone: values.telefono, email: values.email, password: values.password, confirmPassword: values.repeatPassword });
      const firstError = Object.values(errors)[0];
      if (firstError) { setError(firstError); return; }
    }
    if (!creating && tab === 'password' && (Array.from(values.password).length < 8 || Array.from(values.password).length > 128)) { setError('Utiliza entre 8 y 128 caracteres.'); return; }
    if ((creating || tab === 'password') && values.password !== values.repeatPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (!creating && tab === 'email' && values.email.trim().toLowerCase() === originalEmail.toLowerCase()) { setError('Escribe un correo diferente al actual.'); return; }
    setError(''); setConfirming(true);
  }
  async function save() {
    if (lock.current || uncertain) return;
    lock.current = true; setBusy(true); setError('');
    try {
      let result;
      if (creating) result = await crearCuentaAdmin(values);
      else if (tab === 'profile') result = await guardarDatosCuentaAdmin(profile.id, values);
      else if (tab === 'email') result = await cambiarCorreoCuentaAdmin(profile.id, values.email.trim());
      else result = await cambiarPasswordCuentaAdmin(profile.id, values.password);
      setValues(previous => ({ ...previous, password: '', repeatPassword: '' }));
      await onSaved({ message: result.message, userId: creating ? result.user.id : profile.id, own: !creating && profile.id === actorId, credentials: tab !== 'profile' });
      onClose();
    } catch (err) {
      setError((err.message || 'No se pudo confirmar la operación.') + (err.userId ? ` Identificador de la cuenta: ${err.userId}` : ''));
      setConfirming(false);
      if (creating && err.partial) { setUncertain(true); setValues(previous => ({ ...previous, password: '', repeatPassword: '' })); }
      if (err.partial) onPartial();
      if (err.code === 'ADMIN_ACCESS_DENIED' || err.code === 'AUTH_REQUIRED') onDenied(err.message);
    } finally { lock.current = false; setBusy(false); }
  }

  const title = creating ? 'Crear cuenta' : 'Editar datos y acceso';
  return <dialog ref={dialog} aria-labelledby="admin-account-title" className="m-auto max-h-[92vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-solid border-[#dce3d5] bg-white p-0 text-[#163e2c] shadow-2xl backdrop:bg-[#15271b]/45" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-widest text-[#8b702c]">Administración de usuarios</p><h2 id="admin-account-title" className="mt-2 text-2xl font-bold">{title}</h2></div><button type="button" className={button} aria-label="Cerrar formulario de cuenta" disabled={busy} onClick={close}>×</button></div>
      <p className="mt-4 text-sm leading-relaxed text-[#64705e]">{creating ? 'Da de alta una cuenta con sus datos y el rol que necesita dentro de KaabMap.' : 'Los datos personales, el correo de acceso y la contraseña se guardan por separado.'}</p>
      {!creating && <p className="mt-3 break-all text-xs text-[#75806b]">Identificador: {profile.id}</p>}

      {!creating && !confirming && <nav aria-label="Datos de la cuenta" className="mt-5 flex flex-wrap gap-2">{[['profile', 'Datos personales'], ['email', 'Correo'], ['password', 'Contraseña']].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} className={tab === value ? primary : button} disabled={busy || loading || Boolean(loadError)} onClick={() => chooseTab(value)}>{label}</button>)}</nav>}

      {loading ? <p role="status" className="py-10 text-center text-sm">Consultando los datos de acceso…</p> : loadError ? <div role="alert" className="mt-5 rounded-xl bg-[#fff0e9] p-4 text-sm text-[#873f2a]"><p>{loadError}</p><button type="button" className={`${button} mt-4`} onClick={() => { setLoadError(''); setLoading(true); setRevision(value => value + 1); }}>Volver a consultar</button></div> : confirming ? <div className="mt-6">
        <h3 className="text-lg font-bold">{creating ? 'Confirmar alta de cuenta' : 'Confirmar actualización'}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#64705e]">{creating ? `Se creará la cuenta de ${values.nombre.trim()} ${values.apellidos.trim()} con el correo ${values.email.trim()} y el rol ${roles.find(role => Number(role.id) === Number(values.roleId))?.nombre || ''}.` : tab === 'profile' ? 'Se actualizarán nombre, apellidos y teléfono en el perfil y en Auth.' : tab === 'email' ? `El correo de acceso cambiará a ${values.email.trim()}. El administrador confirma el cambio directamente.` : 'Se establecerá una nueva contraseña para esta cuenta. La anterior no se muestra ni se recupera.'}</p>
        {creating && <p className="mt-4 rounded-xl bg-[#fff5df] p-3 text-sm leading-relaxed text-[#7b6021]">El correo quedará confirmado por administración. La persona podrá iniciar sesión con la contraseña asignada si la cuenta está activa.</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={() => setConfirming(false)}>Volver</button><button type="button" className={primary} disabled={busy} onClick={save}>{busy ? 'Guardando…' : creating ? 'Confirmar creación' : 'Confirmar cambio'}</button></div>
      </div> : <form className="mt-6" onSubmit={requestConfirmation}>
        {(creating || tab === 'profile') && <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#64705e]">Nombre(s)<input className={control} value={values.nombre} maxLength={150} required autoComplete="off" disabled={busy || uncertain} onChange={event => update('nombre', event.target.value)}/></label>
          <label className="text-xs font-semibold text-[#64705e]">Apellidos<input className={control} value={values.apellidos} maxLength={150} required autoComplete="off" disabled={busy || uncertain} onChange={event => update('apellidos', event.target.value)}/></label>
          <label className="text-xs font-semibold text-[#64705e] sm:col-span-2">Teléfono <span className="font-normal">(opcional)</span><input type="tel" className={control} value={values.telefono} maxLength={25} autoComplete="off" disabled={busy || uncertain} onChange={event => update('telefono', event.target.value)}/></label>
        </div>}
        {(creating || tab === 'email') && <label className="mt-5 block text-xs font-semibold text-[#64705e]">{creating ? 'Correo electrónico' : 'Nuevo correo de acceso'}<input type="email" className={control} value={values.email} maxLength={254} required autoComplete="off" disabled={busy || uncertain} onChange={event => update('email', event.target.value)}/></label>}
        {!creating && tab === 'email' && <p className="mt-3 text-xs leading-relaxed text-[#7b6833]">Este cambio administrativo se aplica directamente. Comprueba que el correo pertenezca a la persona y esté escrito correctamente.</p>}
        {(creating || tab === 'password') && <div className="mt-5 space-y-4"><label className="block text-xs font-semibold text-[#64705e]">{creating ? 'Contraseña' : 'Nueva contraseña'}<input type={showPasswords ? 'text' : 'password'} className={control} value={values.password} required autoComplete="new-password" disabled={busy || uncertain} onChange={event => update('password', event.target.value)}/></label><label className="block text-xs font-semibold text-[#64705e]">Confirmar contraseña<input type={showPasswords ? 'text' : 'password'} className={control} value={values.repeatPassword} required autoComplete="new-password" disabled={busy || uncertain} onChange={event => update('repeatPassword', event.target.value)}/></label><p className="text-xs leading-relaxed text-[#75806b]">Utiliza entre 8 y 128 caracteres. También se aplican los requisitos de contraseña configurados en Supabase. No se consulta la contraseña anterior.</p><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-solid border-[#d5ded0] p-3 text-sm"><input type="checkbox" checked={showPasswords} disabled={busy || uncertain} onChange={event => setShowPasswords(event.target.checked)}/>Mostrar contraseñas</label></div>}
        {creating && <div className="mt-5"><label className="block text-xs font-semibold text-[#64705e]">Rol de la cuenta<select className={control} required value={values.roleId} disabled={busy || uncertain} onChange={event => update('roleId', event.target.value)}><option value="">Selecciona un rol</option>{roles.map(role => <option key={role.id} value={role.id}>{role.nombre}</option>)}</select></label><label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={values.active} disabled={busy || uncertain} onChange={event => update('active', event.target.checked)}/>Cuenta activa</label><label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f5f6ed] p-4 text-sm leading-relaxed"><input type="checkbox" className="mt-1" required checked={values.confirmEmail} disabled={busy || uncertain} onChange={event => update('confirmEmail', event.target.checked)}/><span>Confirmo el correo de esta persona para dar de alta la cuenta desde administración. No se enviará un correo de verificación por este flujo.</span></label></div>}
        {error && <p role="alert" className="mt-5 break-words rounded-xl bg-[#fff0e9] p-4 text-sm leading-relaxed text-[#873f2a]">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={close}>Cerrar</button><button type="submit" className={primary} disabled={busy || uncertain}>{creating ? 'Revisar nueva cuenta' : tab === 'profile' ? 'Guardar datos' : tab === 'email' ? 'Cambiar correo' : 'Establecer contraseña'}</button></div>
      </form>}
    </div>
  </dialog>;
}
