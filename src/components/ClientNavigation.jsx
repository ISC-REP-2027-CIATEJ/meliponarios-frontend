import { useEffect, useId, useRef, useState } from 'react';
import { isAdminUser } from '../features/adminUsers/adminUsersModel.mjs';
import { isCliente } from '../features/ownerMeliponarios/model';
import { ADMIN_COVERAGE_ROUTE } from '../features/territory/territoryCoverageModel.mjs';
import Icon from '../pages/Explore/Icon';

export function KaabMapBrand({ link = true }) {
  const mark = <><span className="km-brand-mark"><Icon name="bee" size={23}/></span><span>KaabMap</span></>;
  return link ? <a href="#explorar" className="km-brand" aria-label="KaabMap, inicio">{mark}</a> : <span className="km-brand">{mark}</span>;
}

function ClientAccountLinks({ user }) {
  if (isAdminUser(user)) return <div className="km-account-links">
    <a href="#administracion/usuarios" className="km-button km-button--soft"><Icon name="user" size={18}/>Administrar usuarios</a>
    <a href="#administracion/asignaciones" className="km-button km-button--soft"><Icon name="records" size={18}/>Asignaciones</a>
    <a href={'#' + ADMIN_COVERAGE_ROUTE} className="km-button km-button--soft"><Icon name="map" size={18}/>Cobertura territorial</a>
  </div>;
  if ([3, 4].includes(Number(user?.roleId))) return <div className="km-account-links">
    <a href="#campo/solicitudes" className="km-button km-button--soft"><Icon name="records" size={18}/>Solicitudes básicas</a>
    <a href="#campo/asignaciones-tecnicas" className="km-button km-button--soft"><Icon name="pin" size={18}/>{Number(user.roleId) === 3 ? 'Asignar meliponarios' : 'Meliponarios asignados'}</a>
  </div>;
  if (!isCliente(user)) return null;
  return <a href="#mis-meliponarios" className="km-button km-button--soft"><Icon name="records" size={18}/>Mis meliponarios</a>;
}

export function ClientRegistrationButton({ user, sessionReady = true }) {
  if (!sessionReady || !isCliente(user)) return null;
  return <a href="#nuevo-meliponario" className="km-button km-button--primary"><span aria-hidden="true">+</span>Registrar meliponario</a>;
}

function NavLink({ to, icon, active, onNavigate, children }) {
  return <a href={'#' + to} className="km-nav-item" aria-current={active ? 'page' : undefined}
    onClick={onNavigate ? event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onNavigate();
    } : undefined}>
    <Icon name={icon} size={21}/>{children}
  </a>;
}

export function OwnerHeader({ user, sessionReady = true, onLogout, onLogin, onExplore, onMap, current, verde = false }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const account = useRef(null);
  const toggle = useRef(null);
  const id = useId();
  const name = user?.name?.trim() || 'Mi cuenta';

  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!account.current?.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function closeSession() {
    if (closing || !onLogout) return;
    setClosing(true);
    setError('');
    try {
      await onLogout();
      setOpen(false);
      return true;
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la sesión.');
      return false;
    } finally {
      setClosing(false);
    }
  }

  function requestLogout() {
    const event = new CustomEvent('kaabmap:before-owner-leave', { cancelable: true, detail: { continuar: closeSession } });
    if (window.dispatchEvent(event)) void closeSession();
  }

  return <header className={verde ? 'km-header km-header--verde' : 'km-header'}>
    <div className="km-container km-header-inner">
      <KaabMapBrand/>
      <nav aria-label="Navegación principal" className="km-nav">
        <NavLink to="explorar" icon="home" active={current === 'explorar'} onNavigate={onExplore}>Inicio</NavLink>
        <NavLink to="mapa" icon="map" active={current === 'mapa'} onNavigate={onMap}>Mapa</NavLink>
        {sessionReady && isCliente(user) && <NavLink to="mis-meliponarios" icon="records" active={current === 'registros'}>Mis registros</NavLink>}
        {!sessionReady ? <span role="status" className="sr-only">Comprobando sesión…</span>
          : !user ? <NavLink to="login" icon="user" onNavigate={onLogin}>Iniciar sesión</NavLink>
          : <div ref={account} className="km-account">
            <button type="button" ref={toggle} className="km-nav-item" aria-label="Opciones de cuenta" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setOpen(value => !value); setError(''); }}>
              <span className="km-account-avatar">{(user.name?.trim() || user.email || 'U').charAt(0).toUpperCase()}</span>
              <span className="km-account-label">{name}</span>
              <span className="km-account-chevron"><Icon name="chevron" size={14}/></span>
              <span className="km-account-mobile"><Icon name="user" size={21}/></span>
              <span className="km-account-mobile">Cuenta</span>
            </button>
            {open && <div id={id} className="km-account-popover">
              <div className="km-account-data"><strong>{name}</strong><p>{user.roleName || 'Rol no disponible'}</p>{user.email && <p>{user.email}</p>}</div>
              <ClientAccountLinks user={user}/>
              {error && <p className="km-status" role="alert">{error}</p>}
              <button type="button" className="km-button" disabled={closing || !onLogout} onClick={requestLogout}>{closing ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
            </div>}
          </div>}
      </nav>
    </div>
  </header>;
}
