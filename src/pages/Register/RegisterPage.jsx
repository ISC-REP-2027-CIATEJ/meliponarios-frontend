import { useEffect, useRef, useState } from 'react';
import AuthLayout from '../../components/AuthLayout';
import { register } from '../../services/authService';
import Icon from '../Explore/Icon';
import { datosIniciales, validarCuenta, prepararCuenta } from './accountRegistration';

export default function RegisterPage({ onLogin }) {
  const [datos, setDatos] = useState({ ...datosIniciales });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const titulo = useRef(null);
  const envioEnCurso = useRef(false);
  const hayCambios = Object.values(datos).some(valor => valor !== '');
  const photo = import.meta.env.VITE_LOGIN_IMAGE?.trim();

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [resultado]);

  useEffect(() => {
    if (!hayCambios || resultado) return;
    function avisarSalida(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', avisarSalida);
    return () => window.removeEventListener('beforeunload', avisarSalida);
  }, [hayCambios, resultado]);

  function cambiarCampo(event) {
    const { name, value } = event.target;
    setDatos({ ...datos, [name]: value });
    setErrores({ ...errores, [name]: undefined });
    setError('');
  }

  function volverAlLogin() {
    if (!hayCambios || window.confirm('¿Volver al login? Se perderán los datos sin enviar.')) onLogin();
  }

  async function crearCuenta(event) {
    event.preventDefault();
    if (envioEnCurso.current) return;
    const erroresEncontrados = validarCuenta(datos);
    setErrores(erroresEncontrados);
    setError('');
    const primerError = Object.keys(erroresEncontrados)[0];
    if (primerError) {
      document.getElementById(primerError)?.focus();
      return;
    }
    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const respuesta = await register(prepararCuenta(datos));
      setResultado(respuesta);
      setDatos({ ...datosIniciales });
      setMostrarPassword(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
      envioEnCurso.current = false;
    }
  }

  function campo(nombre, etiqueta, opciones) {
    const errorId = nombre + '-error';
    return <div className="min-w-0">
      <label className="km-auth-label" htmlFor={nombre}>{etiqueta}</label>
      <input className="km-field" id={nombre} name={nombre} value={datos[nombre]} onChange={cambiarCampo}
        aria-invalid={Boolean(errores[nombre])} aria-describedby={errores[nombre] ? errorId : undefined} {...opciones}/>
      {errores[nombre] && <p id={errorId} className="km-auth-error mt-1.5">{errores[nombre]}</p>}
    </div>;
  }

  return <AuthLayout photo={photo}>
    <div className="km-panel km-auth-card km-auth-card--register">
      {!resultado && <button type="button" className="km-button km-button--quiet mb-3" onClick={volverAlLogin} disabled={enviando}><Icon name="back" size={16}/>Iniciar sesión</button>}
      <h1 className="km-page-title" id="access-title" ref={titulo} tabIndex={-1}>{resultado ? 'Activa tu cuenta' : 'Crear cuenta'}</h1>
      {resultado ? <section className="mt-4" role="status">
        <span className="km-icon-tile mb-3"><Icon name="mail" size={24}/></span>
        <h2 className="km-section-title">{resultado.emailVerificationRequired ? 'Confirma tu correo electrónico' : 'Tu cuenta está lista'}</h2>
        {resultado.emailVerificationRequired ? <>
          <p className="mt-3 text-muted">Enviamos un enlace de confirmación a <strong className="wrap-anywhere">{resultado.email}</strong>. Ábrelo para activar tu cuenta.</p>
          <p className="mt-3 text-sm text-muted">Si no encuentras el mensaje, revisa la carpeta de correo no deseado.</p>
        </> : <p className="mt-3 text-muted">Tu sesión está disponible. Puedes continuar al acceso.</p>}
        <button type="button" className="km-button km-button--primary mt-5" onClick={onLogin}>Ir a iniciar sesión<Icon name="arrow" size={17}/></button>
      </section> : <form noValidate onSubmit={crearCuenta} aria-busy={enviando}>
        <p className="km-auth-intro">Completa tus datos. Podrás registrar tu meliponario desde Mis registros.</p>
        <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0" disabled={enviando}>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo('firstName', 'Nombre(s)', { autoComplete: 'given-name', required: true, maxLength: 150 })}
            {campo('lastName', 'Apellidos', { autoComplete: 'family-name', required: true, maxLength: 150 })}
          </div>
          {campo('phone', 'Teléfono (opcional)', { type: 'tel', autoComplete: 'tel', maxLength: 25 })}
          {campo('email', 'Correo electrónico', { type: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false, required: true })}
          <div className="grid gap-4 sm:grid-cols-2">
            {campo('password', 'Contraseña', { type: mostrarPassword ? 'text' : 'password', autoComplete: 'new-password', required: true })}
            {campo('confirmPassword', 'Confirmar contraseña', { type: mostrarPassword ? 'text' : 'password', autoComplete: 'new-password', required: true })}
          </div>
          <p className="text-sm text-muted">Utiliza entre 8 y 128 caracteres.</p>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input className="size-5 accent-bosque" type="checkbox" checked={mostrarPassword} onChange={event => setMostrarPassword(event.target.checked)}/>Mostrar contraseñas</label>
        </fieldset>
        {error && <p className="km-status mt-3" role="alert">{error}</p>}
        <div className="km-auth-actions"><button type="submit" className="km-button km-button--primary" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}<Icon name="arrow" size={18}/></button></div>
      </form>}
    </div>
  </AuthLayout>;
}
