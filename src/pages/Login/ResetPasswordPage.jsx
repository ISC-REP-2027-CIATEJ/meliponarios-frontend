import { useRef, useState } from 'react';
import AuthLayout from '../../components/AuthLayout';
import Icon from '../Explore/Icon';
import { recuperacionPassword } from '../../lib/supabase';
import { validarNuevaPassword } from '../../features/auth/passwordRecovery.mjs';

export default function ResetPasswordPage({ estado }) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const busy = ['guardando', 'cerrando'].includes(estado.fase);
  async function guardar(event) {
    event.preventDefault();
    if (lock.current || busy) return;
    const invalid = validarNuevaPassword(password, confirmacion);
    if (invalid) { setError(invalid); return; }
    lock.current = true; setError('');
    try { await recuperacionPassword.guardar(password, confirmacion); }
    catch (err) { setError(err.message); }
    finally { setPassword(''); setConfirmacion(''); setVisible(false); lock.current = false; }
  }
  return <AuthLayout>
    <section className="km-panel km-auth-card" aria-labelledby="reset-title">
      <span className="km-icon-tile mb-4"><Icon name={estado.fase === 'completada' ? 'check' : 'user'} size={25}/></span>
      <h1 id="reset-title" className="km-page-title">Nueva contraseña</h1>
      {estado.fase === 'comprobando' ? <p className="km-status mt-5" role="status">Comprobando el enlace de recuperación…</p>
        : estado.fase === 'completada' ? <div className="grid gap-4 mt-5" role="status">
          <h2 className="km-section-title">Contraseña actualizada</h2><p>La sesión de recuperación se cerró. Ya puedes entrar con tu nueva contraseña.</p>
          <button className="km-button km-button--primary" onClick={() => recuperacionPassword.salir()}>Ir a iniciar sesión</button></div>
        : estado.fase === 'invalida' ? <div className="grid gap-4 mt-5"><p className="km-status" role="alert">{estado.error}</p>
          <button className="km-button km-button--primary" onClick={() => recuperacionPassword.salir()}>Volver y solicitar otro enlace</button></div>
        : ['salida_pendiente', 'cerrando'].includes(estado.fase) ? <div className="grid gap-4 mt-5">
          <p role="status">{estado.error || 'Cerrando la sesión de recuperación…'}</p>
          <button className="km-button km-button--primary" disabled={busy} onClick={() => recuperacionPassword.terminar()}>Cerrar sesión y terminar</button></div>
        : <form className="grid gap-4 mt-5" onSubmit={guardar} aria-busy={busy}>
          <p className="text-muted">Elige una contraseña que utilices únicamente para tu cuenta de KaabMap.</p>
          <label className="grid gap-2">Nueva contraseña<input className="km-field" name="new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} aria-describedby="password-help"/></label>
          <p id="password-help" className="text-sm text-muted">Entre 8 y 128 caracteres. Si tu cuenta requiere una contraseña más segura, se indicará al guardar.</p>
          <label className="grid gap-2">Confirmar contraseña<input className="km-field" name="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required value={confirmacion} disabled={busy} onChange={e => setConfirmacion(e.target.value)}/></label>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={visible} disabled={busy} onChange={e => setVisible(e.target.checked)}/>Mostrar contraseñas</label>
          {(error || estado.error) && <p className="km-status" role="alert">{error || estado.error}</p>}
          <button className="km-button km-button--primary" disabled={busy}>{busy ? 'Actualizando contraseña…' : 'Guardar nueva contraseña'}</button>
          <button type="button" className="km-button" disabled={busy} onClick={() => recuperacionPassword.salir()}>Cancelar y volver al acceso</button>
        </form>}
    </section>
  </AuthLayout>;
}

