import AdminAccountDialog from './AdminAccountDialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import Icon from '../Explore/Icon';
import { listarUsuariosAdmin, adminCambiarRolUsuario, adminCambiarEstadoUsuario } from '../../services/adminUsersService';
import { isAdminUser, fullName, roleName, filterUsers, formatDate, blockedAction } from '../../features/adminUsers/adminUsersModel.mjs';

const button = 'km-button';
const primary = 'km-button km-button--primary';
const field = 'km-field';

function Status({ active }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-[#e8f1df] text-[#365d20]' : 'bg-[#f1eee9] text-[#6d6050]'}`}><span className={`size-1.5 rounded-full ${active ? 'bg-[#628443]' : 'bg-[#9d907e]'}`} aria-hidden="true"/>{active ? 'Activo' : 'Inactivo'}</span>;
}

function ProfileName({ profile, own }) {
  return <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-soft text-sm font-bold text-bosque" aria-hidden="true">{fullName(profile).slice(0, 1).toUpperCase()}</span><div className="min-w-0"><span className="block font-semibold">{fullName(profile)}</span><span className="mt-1 block text-xs font-normal text-muted">{own ? 'Tu cuenta' : `ID: ${profile.id.slice(0, 8)}…`}</span></div></div>;
}

export default function AdminUsersPage({ user, sessionReady = true, onLogout, onAccountChanged }) {
  const [accountModal, setAccountModal] = useState(null);
  const allowed = sessionReady && isAdminUser(user);
  const [data, setData] = useState({ perfiles: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [denied, setDenied] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedAt, setLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [nextRole, setNextRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const dialog = useRef(null);
  const writeLock = useRef(false);

  useEffect(() => {
    if (!allowed) return undefined;
    let current = true;
    Promise.resolve().then(listarUsuariosAdmin).then(value => {
      if (!current) return;
      setData(value); setLoadedAt(new Date());
    }).catch(err => {
      if (!current) return;
      setData({ perfiles: [], roles: [] }); setLoadedAt(null);
      setError(err.message || 'No se pudo cargar la lista.');
      setDenied(err.code === 'ADMIN_ACCESS_DENIED');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [allowed, user?.id, revision]);

  const modalOpen = Boolean(modal);
  useEffect(() => {
    if (modalOpen && !dialog.current.open) dialog.current.showModal();
    if (!modalOpen && dialog.current?.open) dialog.current.close();
  }, [modalOpen]);

  const filtered = useMemo(() => filterUsers(data.perfiles, { search, role, status }), [data.perfiles, search, role, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const active = data.perfiles.filter(profile => profile.activo === true).length;
  const admins = data.perfiles.filter(profile => profile.activo === true && Number(profile.rol_id) === 1).length;
  const target = modal?.profile;
  const isOwn = target?.id === user?.id;
  const roleBlock = target ? blockedAction(target, user?.id, data.perfiles, nextRole) : '';
  const statusBlock = target ? blockedAction(target, user?.id, data.perfiles) : '';

  const accountDenied = useCallback(message => {
    setData({ perfiles: [], roles: [] }); setDenied(true); setError(message);
    setAccountModal(null); setModal(null);
  }, []);
  async function accountSaved(result) {
    let message = result.message || 'Cuenta actualizada.';
    if (result.own && onAccountChanged) {
      try { await onAccountChanged(); }
      catch { message += ' El cambio se guardó, pero debes volver a iniciar sesión para actualizar tu cuenta en pantalla.'; }
    }
    setNotice(message); refresh();
  }
  function editAccount() {
    const selected = target; closeModal(); setAccountModal({ mode: 'edit', profile: selected });
  }
  function detail(profile) {
    setNextRole(String(profile.rol_id)); setModalError(''); setModal({ type: 'detail', profile });
  }
  function refresh() {
    setLoading(true); setError(''); setDenied(false); setRevision(value => value + 1);
  }
  function closeModal() {
    if (writeLock.current) return;
    setModal(null); setModalError('');
  }
  function confirm(type) {
    setModalError(''); setModal({ type, profile: target, roleId: Number(nextRole) });
  }
  async function save() {
    if (writeLock.current || !target) return;
    const reason = blockedAction(target, user.id, data.perfiles, modal.type === 'role' ? modal.roleId : null);
    if (reason) { setModalError(reason); return; }
    writeLock.current = true; setSaving(true); setModalError(''); setNotice('');
    try {
      if (modal.type === 'role') await adminCambiarRolUsuario(target.id, modal.roleId);
      else await adminCambiarEstadoUsuario(target.id, !target.activo);
      setModal(null);
      setNotice('El servidor aceptó el cambio. Consulta la lista actualizada para verificarlo.');
      refresh();
    } catch (err) {
      setModalError(err.message || 'No se pudo confirmar el cambio. Actualiza la lista antes de reintentar.');
      if (err.code === 'ADMIN_ACCESS_DENIED') {
        setData({ perfiles: [], roles: [] }); setDenied(true); setError(err.message); setModal(null);
      }
    } finally { writeLock.current = false; setSaving(false); }
  }

  return <div className="km-with-nav km-admin-users">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="mx-auto max-w-7xl px-5 py-16" role="status">Comprobando tu sesión…</main> : !allowed ? <main className="mx-auto max-w-2xl px-5 py-16"><div className="rounded-3xl border border-solid border-line bg-white p-8"><p className="text-xs font-bold uppercase tracking-widest text-bosque">Administración de usuarios</p><h1 className="mt-3 text-3xl font-bold">Acceso restringido</h1><p className="mt-4 leading-relaxed text-muted">Este apartado requiere una cuenta de administrador general activa.</p><a href={user ? '#explorar' : '#login'} className={`${primary} mt-6 no-underline`}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a></div></main> : <main className="km-container km-workspace">
      <nav className="km-tab-strip km-workspace-bar" aria-label="Administración">
        <a href="#administracion/usuarios" className="km-button" aria-current="page"><Icon name="user" size={18}/>Usuarios</a>
        <a href="#administracion/asignaciones" className="km-button"><Icon name="records" size={18}/>Asignaciones</a>
        <a href="#administracion/cobertura" className="km-button"><Icon name="map" size={18}/>Cobertura territorial</a>
      </nav>
        <div className="km-work-banner km-page-heading"><div><h1 className="km-page-title">Usuarios de KaabMap</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Consulta los perfiles y administra los permisos de acceso de tu equipo.</p></div><div className="flex flex-wrap gap-3"><button type="button" className={primary} disabled={loading || saving || Boolean(error) || !data.roles.length} onClick={() => setAccountModal({ mode: 'create' })}><span aria-hidden="true">+</span>Crear cuenta</button><button type="button" className={button} disabled={loading || saving} onClick={() => { setNotice(''); refresh(); }}><span aria-hidden="true">↻</span>{loading ? 'Actualizando…' : 'Actualizar lista'}</button></div></div>
        <section aria-label="Resumen de usuarios" className="km-summary-grid">{[['Usuarios registrados', data.perfiles.length, 'Perfiles en la plataforma'], ['Activos', active, 'Con acceso habilitado'], ['Inactivos', data.perfiles.length - active, 'Con acceso deshabilitado'], ['Administradores activos', admins, 'Administración general']].map(([label, value, caption]) => <div key={label} className="km-panel km-summary-card"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{loading || error ? '—' : value}</p><p className="mt-2 text-[11px] leading-relaxed text-muted">{caption}</p></div>)}</section>
        {notice && <p role="status" className="mt-5 rounded-xl border border-solid border-[#ccddbe] bg-soft p-4 text-sm">{notice}</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-solid border-[#e4c8be] bg-[#fff2ed] p-4 text-sm text-[#873f2a]"><p className="font-bold">{denied ? 'Acceso no disponible' : 'No se pudo consultar la lista'}</p><p className="mt-2 leading-relaxed">{error}</p>{notice && <p className="mt-2">El cambio anterior fue aceptado; su lectura actualizada sigue pendiente.</p>}</div>}
        <section aria-labelledby="list-title" className="km-panel mt-6 overflow-hidden">
          <div className="border-0 border-b border-solid border-line p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="list-title" className="text-lg font-bold">Directorio de usuarios</h2><span className="text-xs text-muted">{loadedAt ? `Actualizado a las ${loadedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Pendiente de consulta'}</span></div><div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_150px]"><label className="text-xs font-semibold text-muted">Buscar usuario<input type="search" className={`${field} mt-2`} placeholder="Nombre, teléfono o identificador" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} disabled={loading || Boolean(error)}/></label><label className="text-xs font-semibold text-muted">Rol<select className={`${field} mt-2`} value={role} onChange={event => { setRole(event.target.value); setPage(1); }} disabled={loading || Boolean(error)}><option value="">Todos los roles</option>{data.roles.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-xs font-semibold text-muted">Estado<select className={`${field} mt-2`} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} disabled={loading || Boolean(error)}><option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></label></div></div>
          {loading ? <p role="status" className="p-12 text-center text-sm text-muted">Cargando perfiles y roles…</p> : error ? <p className="p-10 text-center text-sm text-muted">{denied ? 'Cierra sesión para comprobar tus permisos de nuevo.' : 'Actualiza la lista para volver a consultar los datos.'}</p> : !filtered.length ? <div className="p-10 text-center"><h3 className="font-bold">{data.perfiles.length ? 'No encontramos coincidencias' : 'No hay perfiles disponibles'}</h3><p className="mt-2 text-sm text-muted">{data.perfiles.length ? 'Prueba con otro nombre o ajusta los filtros.' : 'Comprueba con backend que tu cuenta puede leer el directorio.'}</p>{(search || role || status) && <button type="button" className={`${button} mt-5`} onClick={() => { setSearch(''); setRole(''); setStatus(''); setPage(1); }}>Limpiar filtros</button>}</div> : <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead className="bg-[#f7f8f3] text-xs text-muted"><tr>{['Usuario', 'Teléfono', 'Rol', 'Estado', 'Acciones'].map(label => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead><tbody>{visible.map(profile => <tr key={profile.id} className="border-0 border-t border-solid border-[#edf0e7] align-middle hover:bg-[#fbfcf8]"><td className="px-5 py-4"><ProfileName profile={profile} own={profile.id === user.id}/></td><td className="px-5 py-4 text-muted">{profile.telefono || 'Sin registrar'}</td><td className="max-w-52 px-5 py-4 text-[#526249]">{roleName(profile, data.roles)}</td><td className="px-5 py-4"><Status active={profile.activo}/></td><td className="px-5 py-4"><button type="button" className={button} onClick={() => detail(profile)}>Ver detalles</button></td></tr>)}</tbody></table></div>
            <div className="divide-x-0 divide-y divide-solid divide-[#e7ebdf] md:hidden">{visible.map(profile => <article key={profile.id} className="p-5"><div className="flex items-start justify-between gap-3"><ProfileName profile={profile} own={profile.id === user.id}/><Status active={profile.activo}/></div><p className="mt-4 text-sm text-muted">{roleName(profile, data.roles)}</p><p className="mt-2 text-xs text-muted">Teléfono: {profile.telefono || 'Sin registrar'}</p><button type="button" className={`${button} mt-4 w-full`} onClick={() => detail(profile)}>Ver detalles</button></article>)}</div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-line px-5 py-4"><p className="text-xs text-muted">{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, filtered.length)} de {filtered.length} resultados</p><div className="flex items-center gap-2"><button type="button" className={button} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span className="px-1 text-xs">{currentPage} / {pageCount}</span><button type="button" className={button} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div></div>
          </>}
        </section><p className="mt-4 text-xs leading-relaxed text-muted">Los cambios de rol y estado se confirman antes de enviarse. Puedes dar de alta otras cuentas con el botón Crear cuenta.</p>
    </main>}
    <dialog ref={dialog} aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-description" className="km-dialog km-dialog--edge-to-edge" onCancel={event => { event.preventDefault(); closeModal(); }}>
      {target && <div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-widest text-bosque">Administración de usuarios</p><h2 id="admin-dialog-title" className="mt-2 text-2xl font-bold">{modal.type === 'detail' ? 'Detalle del usuario' : modal.type === 'role' ? 'Confirmar cambio de rol' : target.activo ? 'Desactivar usuario' : 'Activar usuario'}</h2></div><button type="button" aria-label="Cerrar detalle" className={`${button} shrink-0 px-3`} disabled={saving} onClick={closeModal}>×</button></div>
        <p id="admin-dialog-description" className="mt-4 text-sm leading-relaxed text-muted">{modal.type === 'detail' ? 'Consulta el perfil y elige la acción que deseas realizar.' : 'Revisa los datos antes de confirmar este cambio en la plataforma.'}</p>
        <div className="mt-5 rounded-2xl bg-soft p-4"><ProfileName profile={target} own={isOwn}/><p className="mt-4 break-all text-xs leading-relaxed text-muted">Identificador: {target.id}</p><div className="mt-4"><Status active={target.activo}/></div></div>
        {modal.type === 'detail' ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Teléfono</dt><dd className="mt-1 font-semibold">{target.telefono || 'Sin registrar'}</dd></div><div><dt className="text-xs text-muted">Fecha de registro</dt><dd className="mt-1 font-semibold">{formatDate(target.fecha_creacion)}</dd></div></dl><button type="button" className={`${primary} mt-5 w-full`} onClick={editAccount}>Editar datos y acceso</button><label className="mt-6 block text-xs font-semibold text-muted">Rol asignado<select className={`${field} mt-2`} value={nextRole} onChange={event => setNextRole(event.target.value)} disabled={isOwn || saving}>{!data.roles.some(item => Number(item.id) === Number(target.rol_id)) && <option value={target.rol_id}>Rol sin catálogo</option>}{data.roles.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>{isOwn && <p className="mt-3 text-xs leading-relaxed text-[#7c6830]">{roleBlock}</p>}<div className="mt-5 flex flex-wrap gap-3"><button type="button" className={primary} disabled={Boolean(roleBlock) || Number(nextRole) === Number(target.rol_id) || !data.roles.some(item => Number(item.id) === Number(nextRole))} title={roleBlock || undefined} onClick={() => confirm('role')}>Cambiar rol</button><button type="button" className={button} disabled={Boolean(statusBlock)} title={statusBlock || undefined} onClick={() => confirm('status')}>{target.activo ? 'Desactivar usuario' : 'Activar usuario'}</button></div></> : <><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-muted">Situación actual</dt><dd className="mt-1 font-semibold">{modal.type === 'role' ? roleName(target, data.roles) : target.activo ? 'Activo' : 'Inactivo'}</dd></div><div><dt className="text-xs text-muted">Nuevo valor</dt><dd className="mt-1 font-bold">{modal.type === 'role' ? roleName({ rol_id: modal.roleId }, data.roles) : target.activo ? 'Inactivo' : 'Activo'}</dd></div></dl>{modal.type === 'status' && target.activo && <p className="mt-5 rounded-xl bg-[#fff5df] p-3 text-sm leading-relaxed text-[#7b6021]">Al desactivar el perfil, esta persona dejará de tener acceso según las reglas del servidor.</p>}{modalError && <p role="alert" className="mt-4 rounded-xl bg-[#fff0e9] p-3 text-sm leading-relaxed text-[#873f2a]">{modalError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={saving} onClick={closeModal}>Cancelar</button><button type="button" className={primary} disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Confirmar cambio'}</button></div></>}
      </div>}
    </dialog>
    {accountModal && <AdminAccountDialog mode={accountModal.mode} profile={accountModal.profile} roles={data.roles} actorId={user?.id} onClose={() => setAccountModal(null)} onSaved={accountSaved} onPartial={refresh} onDenied={accountDenied}/>}
  </div>;
}
