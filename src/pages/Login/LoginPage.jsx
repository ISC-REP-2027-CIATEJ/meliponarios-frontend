import { useRef, useState } from 'react';
import AuthLayout from '../../components/AuthLayout';
import { login } from '../../services/authService';
import Icon from '../Explore/Icon';
import PasswordRecoveryDialog from './PasswordRecoveryDialog';

function Eye({ visible }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}
  </svg>;
}

export default function LoginPage({ onRegister, onExplore, onLoginSuccess, sessionReady = true }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const dialog = useRef(null);
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const pending = useRef(false);
  const photo = import.meta.env.VITE_LOGIN_IMAGE?.trim();

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    if (!email.trim()) next.email = 'Escribe tu correo electrónico.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Escribe un correo válido.';
    if (!password) next.password = 'Escribe tu contraseña.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      (next.email ? emailInput : passwordInput).current.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const usuario = await login(email, password);
      onLoginSuccess(usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setPassword('');
      setVisible(false);
      setBusy(false);
      pending.current = false;
    }
  }

  return <AuthLayout photo={photo}>
    <div className="km-panel km-auth-card">
      {onExplore && <button type="button" className="km-button km-button--quiet mb-4" onClick={onExplore} disabled={busy}><Icon name="back" size={16}/>Volver a Explorar</button>}
      <h1 id="access-title" className="km-page-title">Iniciar sesión</h1>
      <p className="km-auth-intro">Usa tu correo y contraseña para acceder a tu cuenta.</p>
      {!sessionReady && <p className="km-status" role="status">Comprobando sesión…</p>}
      {sessionReady && <form onSubmit={submit} noValidate aria-busy={busy}>
        <div className="mb-4">
          <label htmlFor="email" className="km-auth-label">Correo electrónico</label>
          <input className="km-field" ref={emailInput} id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder="correo@ejemplo.mx" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} required
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined}/>
          {errors.email && <p id="email-error" className="km-auth-error mt-1.5">{errors.email}</p>}
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="km-auth-label">Contraseña</label>
          <div className="km-auth-input-row">
            <input className="km-field" ref={passwordInput} id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password"
              value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}/>
            <button type="button" className="km-button km-button--icon km-auth-eye" disabled={busy} onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}><Eye visible={visible}/></button>
          </div>
          {errors.password && <p id="password-error" className="km-auth-error mt-1.5">{errors.password}</p>}
        </div>
        <button type="button" className="km-auth-link" onClick={() => dialog.current.showModal()} disabled={busy}>¿Olvidaste tu contraseña?</button>
        {error && <p className="km-status mt-3" role="alert">{error}</p>}
        <div className="km-auth-actions">
          <button type="submit" className="km-button km-button--primary" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar'}<Icon name="arrow" size={18}/></button>
          <button type="button" className="km-button" disabled={busy} onClick={onRegister}>Crear cuenta</button>
        </div>
      </form>}
    </div>
    <PasswordRecoveryDialog dialog={dialog} emailInicial={email}/>
  </AuthLayout>;
}
