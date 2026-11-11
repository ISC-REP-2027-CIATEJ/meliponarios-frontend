import { useState } from 'react';
import { isAdminUser } from '../features/adminUsers/adminUsersModel.mjs';
import Icon from '../pages/Explore/Icon';
import { isCliente } from '../features/ownerMeliponarios/model';

const navButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d8ded3] bg-white px-5 py-2 text-sm font-semibold text-[#163e2c] no-underline transition-colors hover:bg-[#edf1e7]';

export function ClientAccountLinks({ user }) {
  if (isAdminUser(user)) return <><a href="#administracion/usuarios" className={`${navButton} mb-2 w-full`}>Administrar usuarios</a><a href="#administracion/asignaciones" className={`${navButton} mb-2 w-full`}>Asignaciones</a></>;
  if ([3,4].includes(Number(user?.roleId))) return <><a href="#campo/solicitudes" className={`${navButton} mb-2 w-full`}>Solicitudes básicas</a><a href="#campo/asignaciones-tecnicas" className={`${navButton} mb-2 w-full`}>{Number(user.roleId) === 3 ? 'Asignar meliponarios' : 'Meliponarios asignados'}</a></>;
  if (!isCliente(user)) return null;
  return <a href="#mis-meliponarios" className="mb-2 flex min-h-11 items-center gap-2 rounded-xl bg-[#edf2e7] px-3 py-2 text-sm font-semibold text-[#163e2c] no-underline hover:bg-[#e1e9d7]"><Icon name="bee" size={18}/>Mis meliponarios<Icon name="arrow" size={16}/></a>;
}

export function ClientRegistrationButton({ user, sessionReady = true }) {
  if (!sessionReady || !isCliente(user)) return null;
  return <a href="#nuevo-meliponario" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#123f2d] bg-[#123f2d] px-5 py-2 text-sm font-semibold text-white no-underline hover:bg-[#23583e]"><span aria-hidden="true" className="text-xl leading-none">+</span>Registrar meliponario</a>;
}

export function OwnerHeader({ user, sessionReady, onLogout }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const name = user?.name?.trim() || 'Mi cuenta';
  async function closeSession() {
    if (closing || !onLogout) return;
    setClosing(true); setError('');
    try { await onLogout(); setOpen(false); return true; }
    catch (err) { setError(err.message || 'No se pudo cerrar la sesión.'); return false; }
    finally { setClosing(false); }
  }
  function requestLogout() {
    const event = new CustomEvent('kaabmap:before-owner-leave', { cancelable: true, detail: { continuar: closeSession } });
    if (window.dispatchEvent(event)) void closeSession();
  }
  return <header className="border-0 border-b border-solid border-[#dfe5d8] bg-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-10">
      <a href="#explorar" className="flex items-center gap-3 text-[#163e2c] no-underline"><span className="text-[#ad7f25]"><Icon name="bee" size={36}/></span><span><span className="block text-2xl font-extrabold tracking-tight">KaabMap</span><span className="mt-1 block text-[10px] tracking-[0.2em]">MELIPONARIOS DE YUCATÁN</span></span></a>
      <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-2">
        <a href="#explorar" className={navButton}>Explorar</a><a href="#mapa" className={navButton}><Icon name="map"/>Mapa</a>
        {!sessionReady ? <span role="status" className="px-3 text-sm text-[#637063]">Comprobando sesión…</span> : !user ? <a href="#login" className={navButton}>Iniciar sesión<Icon name="arrow" size={17}/></a> : <div className="relative">
          <button type="button" className={navButton} aria-expanded={open} aria-controls="owner-account" onClick={() => setOpen(value => !value)}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8edde]">{(user.name?.trim() || user.email || 'U').charAt(0).toUpperCase()}</span>
            <span className="flex min-w-0 flex-col items-start text-left leading-tight"><span className="max-w-[150px] truncate">{name}</span><span className="flex items-center gap-1 text-[10px] font-medium text-[#80682a]"><Icon name="bee" size={12}/>{user.roleName || 'Rol no disponible'}</span></span>
            <span className={`grid size-7 place-items-center rounded-full bg-[#edf1e7] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
          </button>
          {open && <div id="owner-account" className="absolute right-0 top-full z-[1300] mt-2 min-w-64 rounded-2xl border border-solid border-[#dce1d4] bg-white p-4 text-left shadow-lg">
            <p className="text-sm font-bold">{name}</p><p className="mt-1 text-xs text-[#80682a]">{user.roleName}</p>{user.email && <p className="mb-4 mt-3 break-all text-xs text-[#637063]">{user.email}</p>}
            <ClientAccountLinks user={user}/>{error && <p role="alert" className="my-2 text-sm text-[#963f28]">{error}</p>}
            <button type="button" className="min-h-11 w-full rounded-xl border border-solid border-[#d8ded3] bg-white px-3 py-2 text-left text-sm text-[#163e2c] hover:bg-[#edf1e7]" disabled={closing || !onLogout} onClick={requestLogout}>{closing ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
          </div>}
        </div>}
      </nav>
    </div>
  </header>;
}
