import { useEffect, useRef } from 'react';
import AuthLayout from '../../components/AuthLayout';
import Icon from '../Explore/Icon';
import './ConfirmEmailPage.css';

export default function ConfirmEmailPage({ estado, onContinuar }) {
  const titulo = useRef(null);
  const lista = estado.fase === 'confirmada';
  const comprobando = estado.fase === 'comprobando';
  useEffect(() => {
    const anterior = document.title;
    document.title = 'Confirma tu cuenta · KaabMap';
    return () => { document.title = anterior; };
  }, []);
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [estado.fase]);

  return <AuthLayout>
    <section className="km-panel km-auth-card km-confirm-card" aria-labelledby="access-title" aria-busy={comprobando || estado.saliendo}>
      <span className={'km-confirm-symbol' + (lista ? ' km-confirm-symbol--success' : '')}>
        <Icon name={lista ? 'check' : 'mail'} size={38}/>
      </span>
      <p className="km-confirm-eyebrow">{lista ? 'Correo verificado' : 'Confirmación de correo'}</p>
      <h1 className="km-page-title" id="access-title" ref={titulo} tabIndex={-1}>
        {lista ? '¡Tu cuenta está lista!' : comprobando ? 'Confirmando tu cuenta' : estado.fase === 'sin_enlace' ? 'Confirma tu correo' : 'Revisa tu enlace'}
      </h1>
      <div className="km-confirm-copy" aria-live="polite">
        {comprobando ? <p role="status">Estamos comprobando el enlace de tu correo. Espera un momento.</p>
          : lista ? <>
            <p>Tu correo electrónico se verificó correctamente. Ya puedes iniciar sesión en KaabMap.</p>
            <div className="km-confirm-next"><Icon name="bee" size={25}/><p>Al entrar podrás registrar tu meliponario y consultar el avance de tus solicitudes.</p></div>
          </> : estado.fase === 'sin_enlace' ? <p>Para confirmar tu cuenta, abre el mensaje que enviamos a tu correo y pulsa el botón de verificación.</p> : null}
      </div>
      {estado.error && <p className="km-status mt-4" role="alert">{estado.error}</p>}
      {!comprobando && <button className="km-button km-button--primary km-confirm-action" disabled={estado.saliendo} onClick={onContinuar}>
        {estado.saliendo ? 'Preparando el acceso…' : 'Ir a iniciar sesión'}<Icon name="arrow" size={19}/>
      </button>}
    </section>
  </AuthLayout>;
}
