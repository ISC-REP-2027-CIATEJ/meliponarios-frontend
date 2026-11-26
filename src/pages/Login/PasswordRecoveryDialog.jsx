import { useRef, useState } from 'react';
import { recuperacionPassword } from '../../lib/supabase';
import Icon from '../Explore/Icon';

export default function PasswordRecoveryDialog({ dialog, emailInicial = '' }) {
  const [email, setEmail] = useState(emailInicial);
  const [estado, setEstado] = useState('formulario');
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function enviar(event) {
    event.preventDefault();
    if (lock.current || estado === 'enviada') return;
    lock.current = true; setEstado('enviando'); setError('');
    try { await recuperacionPassword.solicitar(email); setEstado('enviada'); }
    catch (err) { setError(err.message); setEstado('formulario'); }
    finally { lock.current = false; }
  }
  return <dialog className="km-dialog" ref={dialog} aria-labelledby="recovery-title" onCancel={event => { if (lock.current) event.preventDefault(); }}>
    <div className="km-dialog-heading"><h2 id="recovery-title" className="km-section-title">Recuperar contraseña</h2>
      <button type="button" className="km-button km-button--icon" disabled={estado === 'enviando'} aria-label="Cerrar recuperación" onClick={() => dialog.current.close()}><Icon name="close"/></button></div>
    {estado === 'enviada' ? <div role="status" className="grid gap-4">
      <span className="km-icon-tile"><Icon name="mail"/></span>
      <p>Si el correo corresponde a una cuenta registrada, recibirás un enlace para establecer una nueva contraseña.</p>
      <p className="text-sm text-muted">Revisa tu bandeja de entrada y correo no deseado. Abre el enlace más reciente; tiene un tiempo de validez limitado.</p>
      <button type="button" className="km-button km-button--primary" onClick={() => dialog.current.close()}>Volver al acceso</button>
      <button type="button" className="km-button" onClick={() => setEstado('formulario')}>Usar otro correo o solicitar de nuevo</button>
    </div> : <form onSubmit={enviar} className="grid gap-4" aria-busy={estado === 'enviando'}>
      <p className="text-muted">Escribe el correo de tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.</p>
      <label className="grid gap-2">Correo electrónico<input autoFocus className="km-field" type="email" name="recovery-email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={estado === 'enviando'} value={email} onChange={e => setEmail(e.target.value)}/></label>
      {error && <p className="km-status" role="alert">{error}</p>}
      <button className="km-button km-button--primary" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando solicitud…' : 'Enviar enlace de recuperación'}</button>
    </form>}
  </dialog>;
}

