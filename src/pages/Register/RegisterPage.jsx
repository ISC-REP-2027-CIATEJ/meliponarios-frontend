import { useEffect, useRef, useState } from 'react';
import { register } from '../../services/authService';
import { datosIniciales, validarCuenta, prepararCuenta } from './accountRegistration';
import './RegisterPage.css';

export default function RegisterPage({ onLogin }) {
  const [datos, setDatos] = useState({ ...datosIniciales });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const titulo = useRef(null);
  const envioEnCurso = useRef(false);
  const hayCambios = Object.values(datos).some((valor) => valor !== '');

  useEffect(() => {
    titulo.current?.focus();
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
    if (!hayCambios || window.confirm('¿Volver al login? Se perderán los datos sin enviar.')) {
      onLogin();
    }
  }

  async function crearCuenta(event) {
    event.preventDefault();
    if (envioEnCurso.current) return;

    // 1. Revisamos los seis campos antes de contactar al servidor.
    const erroresEncontrados = validarCuenta(datos);
    setErrores(erroresEncontrados);
    setError('');
    const primerError = Object.keys(erroresEncontrados)[0];
    if (primerError) {
      document.getElementById(primerError)?.focus();
      return;
    }

    // 2. Bloqueamos el botón mientras se procesa el envío.
    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const respuesta = await register(prepararCuenta(datos));
      setResultado(respuesta);
      setDatos({ ...datosIniciales });
      setMostrarPassword(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setEnviando(false);
      envioEnCurso.current = false;
    }
  }

  // Reutilizamos el mismo dibujo para no repetir las etiquetas y los errores.
  function campo(nombre, etiqueta, opciones = {}) {
    return (
      <div className="reg-field">
        <label htmlFor={nombre}>{etiqueta}</label>
        <input
          id={nombre}
          name={nombre}
          value={datos[nombre]}
          onChange={cambiarCampo}
          aria-invalid={Boolean(errores[nombre])}
          aria-describedby={errores[nombre] ? `${nombre}-error` : undefined}
          {...opciones}
        />
        {errores[nombre] && <p className="field-error" id={`${nombre}-error`}>{errores[nombre]}</p>}
      </div>
    );
  }

  return (
    <main className="registration-layout">
      <aside className="registration-aside">
        <div className="brand">◒ KaabMap</div>
        <div>
          <p className="eyebrow">CIATEJ · SURESTE</p>
          <h2>Crea tu cuenta</h2>
          <p>Regístrate para acceder a la plataforma.</p>
          <p>El registro de un meliponario se realiza después, en un apartado independiente.</p>
        </div>
        <small className="copyright">© 2026 CIATEJ · UNIDAD SURESTE</small>
      </aside>

      <section className="registration-main">
        <div className="registration-content">
          <h1 ref={titulo} tabIndex="-1">{resultado ? 'Revisa tu acceso' : 'Crear cuenta'}</h1>
          {resultado ? (
            <div role="status">
              <p>{resultado.emailVerificationRequired
                ? 'Si el registro procede, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.'
                : 'Tu sesión está disponible. Puedes continuar al acceso.'}</p>
              <button className="primary" onClick={onLogin}>Ir al login</button>
            </div>
          ) : (
            <form noValidate onSubmit={crearCuenta} aria-busy={enviando}>
              <p className="reg-intro">Completa tus datos para registrarte en la plataforma.</p>
              <fieldset className="registration-fields" disabled={enviando}>
                <div className="personal-grid">
                  {campo('firstName', 'Nombre(s)', { autoComplete: 'given-name', required: true, maxLength: 150 })}
                  {campo('lastName', 'Apellidos', { autoComplete: 'family-name', required: true, maxLength: 150 })}
                </div>
                {campo('phone', 'Teléfono (opcional)', { type: 'tel', autoComplete: 'tel', maxLength: 25, placeholder: '9991234567' })}
                {campo('email', 'Correo electrónico', { type: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false, required: true })}
                {campo('password', 'Contraseña', { type: mostrarPassword ? 'text' : 'password', autoComplete: 'new-password', required: true })}
                {campo('confirmPassword', 'Confirmar contraseña', { type: mostrarPassword ? 'text' : 'password', autoComplete: 'new-password', required: true })}
                <p className="reg-help">Utiliza entre 8 y 128 caracteres.</p>
                <label className="choice">
                  <input type="checkbox" checked={mostrarPassword} onChange={(event) => setMostrarPassword(event.target.checked)} />
                  Mostrar contraseñas
                </label>
              </fieldset>
              {error && <p className="error-box" role="alert">{error}</p>}
              <div className="registration-actions">
                <button className="primary" type="submit" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
              </div>
              <p className="login-return">¿Ya tienes cuenta? <button className="text-button" type="button" onClick={volverAlLogin} disabled={enviando}>Iniciar sesión</button></p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
