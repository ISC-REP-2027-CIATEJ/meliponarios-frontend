import { useEffect, useRef, useState } from 'react';
import { getSession, hasBackend, login, logout } from '../../services/authService';

function Eye({ visible }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg>;
}

export default function LoginPage({ onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(hasBackend);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const dialog = useRef(null);
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  const pending = useRef(false);
  const photo = import.meta.env.VITE_LOGIN_IMAGE?.trim();

  useEffect(() => {
    if (!hasBackend) return;
    let active = true;
    getSession().then(value => { if (active) setUser(value); })
      .catch(err => { if (active && err.status !== 401) setError(err.message); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  function showNotice(message) { setNotice(message); dialog.current.showModal(); }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    if (!email.trim()) next.email = 'Escribe tu correo electrónico.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Escribe un correo válido.';
    if (!password) next.password = 'Escribe tu contraseña.';
    setErrors(next); setError('');
    if (Object.keys(next).length) { (next.email ? emailInput : passwordInput).current.focus(); return; }
    pending.current = true; setBusy(true);
    try { setUser(await login(email, password)); }
    catch (err) { setError(err.message); }
    finally { setPassword(''); setVisible(false); setBusy(false); pending.current = false; }
  }

  async function exitSession() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await logout(); setUser(null); setEmail(''); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); pending.current = false; }
  }

  return <main className="login-layout">
    <aside className="brand-panel" style={photo ? { backgroundImage: `linear-gradient(180deg, rgba(5,43,29,.12), rgba(5,43,29,.93)), url(${JSON.stringify(photo)})` } : undefined}>
      <div className="brand"><svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3C10 2 3 6 4 13c0 3 2 5 5 5 7 1 11-6 11-15ZM3 22c2-8 7-12 13-15-5 4-8 8-10 15Z"/></svg>KaabMap</div>
      <div className="brand-copy"><p className="eyebrow">CIATEJ · SEDE SURESTE</p><h1>Gestión y monitoreo geoespacial de meliponarios.</h1><p>Plataforma para el seguimiento técnico de abejas nativas en la región peninsular.</p></div>
      <small className="copyright">© 2026 CIATEJ · UNIDAD SURESTE</small>
    </aside>
    <section className="access-panel" aria-labelledby="access-title">
      <div className="access-content">
        <h2 id="access-title">{user ? 'Sesión iniciada' : 'Acceso al Sistema'}</h2>
        <p className="subtitle">{user ? 'Tu acceso fue validado por el servidor.' : 'Ingrese sus credenciales para continuar.'}</p>
        {checking ? <p role="status">Comprobando sesión…</p> : user ? <div><p className="session-message" role="status">Bienvenido{user.name ? `, ${user.name}` : ''}. El dashboard se implementará en una siguiente etapa.</p><button className="primary" onClick={exitSession} disabled={busy}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div> :
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <div className="field"><label htmlFor="email">Correo electrónico</label><input ref={emailInput} id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="usuario@ciatej.mx" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined}/>{errors.email && <p className="field-error" id="email-error">{errors.email}</p>}</div>
            <div className="field"><div className="label-row"><label htmlFor="password">Contraseña</label><button className="text-button" type="button" disabled={busy} onClick={() => showNotice('La recuperación de contraseña se conectará cuando el backend proporcione el flujo de recuperación. Todavía no se envían correos desde esta pantalla.')}>¿Olvidaste tu contraseña?</button></div><div className="password-wrap"><input ref={passwordInput} id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}/><button className="eye-button" type="button" onClick={() => setVisible(!visible)} disabled={busy} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}><Eye visible={visible}/></button></div>{errors.password && <p className="field-error" id="password-error">{errors.password}</p>}</div>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Ingresando…' : <>Entrar <span aria-hidden="true">→</span></>}</button>
            <button type="button" className="secondary" disabled={busy} onClick={onRegister}>Registrarse</button>
          </form>}
        {error && <p className="error-box" role="alert">{error}</p>}
        <footer className="form-footer">CIATEJ · SURESTE</footer>
      </div>
    </section>
    <dialog ref={dialog} aria-labelledby="notice-title"><h2 id="notice-title">Función pendiente</h2><p>{notice}</p><form method="dialog"><button className="primary">Entendido</button></form></dialog>
  </main>;
}
