import { ClientAccountLinks, ClientRegistrationButton } from '../../components/ClientNavigation';
import { useRef, useState } from 'react';
import { filtrarPublicos } from '../../features/publicMeliponarios/publicApi.mjs';
import { usePublicMeliponarios } from '../../features/publicMeliponarios/usePublicMeliponarios';
import PublicPhoto from '../../features/publicMeliponarios/PublicPhoto';
import Icon from './Icon';
import './ExplorePage.css';

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d8ded3] px-5 py-2 text-sm font-semibold transition-colors hover:bg-[#e9eee3]';
function Filtro({ activo, children, ...props }) {
  return <button type="button" aria-pressed={activo} className={`${boton} ${activo ? 'bg-[#123f2d] text-white hover:bg-[#23583e]' : 'bg-white text-[#193e2d]'}`} {...props}>{children}</button>;
}

export default function ExplorePage({ onLogin, onLogout, onOpenMap, onOpenDetail, filtrosBusqueda, onFiltrosChange, user, sessionReady = true }) {
  const { busqueda, municipio, especie, conProductos, activos } = filtrosBusqueda;
  const cambiar = (campo, valor) => onFiltrosChange(anterior => ({ ...anterior, [campo]: valor }));
  const setBusqueda = valor => cambiar('busqueda', valor);
  const setMunicipio = valor => cambiar('municipio', valor);
  const setEspecie = valor => cambiar('especie', valor);
  const setConProductos = valor => cambiar('conProductos', valor);
  const setActivos = valor => cambiar('activos', valor);
  const publicos = usePublicMeliponarios();
  const meliponariosPublicos = publicos.items;
  const municipiosPublicos = [...new Set(meliponariosPublicos.map(m => m.municipio))].sort();
  const [filtros, setFiltros] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [ampliada, setAmpliada] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState('');
  const dialogo = useRef(null);
  const nombreUsuario = user?.name?.trim() || 'Mi cuenta';
  const inicialUsuario = (user?.name?.trim() || user?.email || 'U').charAt(0).toUpperCase();
  const resultados = filtrarPublicos(meliponariosPublicos, { busqueda, municipio, especie, conProductos, activos });
  const hayFiltros = busqueda || municipio || especie || conProductos || activos;
  function limpiar() { setBusqueda(''); setMunicipio(''); setEspecie(''); setConProductos(false); setActivos(false); }
  function abrir(m, foto = false) { setSeleccion(m); setAmpliada(foto); dialogo.current.showModal(); }
  async function cerrarSesion() {
    if (!onLogout || cerrandoSesion) return;
    setCerrandoSesion(true);
    setErrorCuenta('');
    try {
      await onLogout();
      setCuentaAbierta(false);
    } catch (error) {
      setErrorCuenta(error.message || 'No se pudo cerrar la sesión.');
    } finally {
      setCerrandoSesion(false);
    }
  }

  return <div className="explore-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
    <a href="#contenido" onClick={e => { e.preventDefault(); document.getElementById('contenido')?.focus(); }} className="sr-only focus:not-sr-only">Saltar al contenido</a>
    <header className="border-0 border-b border-solid border-[#e3e6db] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 lg:px-10">
        <div className="flex items-center gap-3"><span className="text-[#ac7c20]"><Icon name="bee" size={36}/></span><div><span className="text-2xl font-extrabold tracking-tight">KaabMap</span><p className="pt-1 text-[10px] font-semibold tracking-[0.22em]">MELIPONARIOS DE YUCATÁN</p></div></div>
        <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-3">
          <a href="#explorar" aria-current="page" className={`${boton} bg-[#edf1e7] text-[#163e2c] no-underline`}>Explorar</a>
          {onOpenMap && <button type="button" className={`${boton} bg-white`} onClick={() => onOpenMap({ busqueda, municipio, especie, conProductos, activos })}><Icon name="map"/>Mapa</button>}
          {!sessionReady ? (
            <span className="px-3 text-sm text-[#637063]" role="status">Comprobando sesión…</span>
          ) : user ? (
            <div className="relative">
              <button
                className={`${boton} bg-white`}
                type="button"
                aria-expanded={cuentaAbierta}
                aria-controls="opciones-cuenta"
                onClick={() => { setCuentaAbierta(!cuentaAbierta); setErrorCuenta(''); }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8edde] text-sm font-bold text-[#163e2c]">{inicialUsuario}</span>
                <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                  <span className="max-w-[150px] truncate">{nombreUsuario}</span>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[#80682a]">
                    <Icon name="bee" size={12}/>
                    <span className="max-w-[150px] truncate">{user.roleName || 'Rol no disponible'}</span>
                  </span>
                </span>
                <span className={'grid size-7 shrink-0 place-items-center rounded-full bg-[#edf1e7] text-[#607250] transition-transform ' + (cuentaAbierta ? 'rotate-180' : '')} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </span>
              </button>
              {cuentaAbierta && (
                <div id="opciones-cuenta" className="absolute right-0 top-full z-30 mt-2 min-w-60 rounded-2xl border border-solid border-[#dce1d4] bg-white p-4 shadow-lg">
                  <p className="mb-1 text-sm font-semibold">{nombreUsuario}</p>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[#80682a]">
                    <Icon name="bee" size={14}/>
                    {user.roleName || 'Rol no disponible'}
                  </p>
                  {user.email && <p className="mb-4 break-all text-xs text-[#637063]">{user.email}</p>}
                  <ClientAccountLinks user={user}/>
                  {errorCuenta && <p className="mb-3 rounded-lg bg-[#fff0ed] p-2 text-xs text-[#842a20]" role="alert">{errorCuenta}</p>}
                  <button
                    className="min-h-10 w-full rounded-lg border border-solid border-[#d8ded3] bg-white px-3 py-2 text-left text-sm text-[#163e2c] hover:bg-[#edf1e7]"
                    type="button"
                    onClick={cerrarSesion}
                    disabled={cerrandoSesion}
                  >
                    {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
                  </button>
                </div>
              )}
            </div>
          ) : onLogin ? (
            <button type="button" className={`${boton} bg-white`} onClick={onLogin}>Iniciar sesión <Icon name="arrow"/></button>
          ) : null}
        </nav>
      </div>
    </header>
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-5 pb-14 pt-10 lg:px-10">
      <section aria-labelledby="titulo" className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#7a662e]">ABEJAS NATIVAS · SABERES LOCALES</p><h1 id="titulo" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Explorar meliponarios</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-[#637063]">Conoce a quienes cuidan de las abejas sin aguijón.<br className="hidden sm:block"/> Descubre sus meliponarios y lo que producen.</p></div>
        <div className="flex flex-wrap items-center gap-3"><ClientRegistrationButton user={user} sessionReady={sessionReady}/><span className="rounded-full bg-[#e8edde] px-4 py-2 text-xs font-semibold">Meliponarios aprobados</span></div>
      </section>
      <section aria-label="Buscar y filtrar" className="mb-9">
        <div className="flex items-center gap-2 rounded-2xl border border-solid border-[#dce1d4] bg-white p-2 pl-5 shadow-sm">
          <Icon name="search" size={23}/><label className="sr-only" htmlFor="buscar">Buscar meliponario, municipio o localidad</label><input id="buscar" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="¿Dónde quieres explorar?"/><button className={`${boton} bg-[#edf1e7]`} aria-label="Filtros" aria-expanded={filtros} aria-controls="filtros" onClick={() => setFiltros(!filtros)}><Icon name="filter"/><span className="hidden sm:inline">Filtros</span></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Filtro activo={false} disabled title="Los tipos de abejas aún no están disponibles en la ficha pública"><Icon name="bee"/>Tipos de abejas</Filtro>
          <Filtro activo={conProductos} disabled title="El catálogo público de productos está pendiente" onClick={() => setConProductos(!conProductos)}><Icon name="bag"/>Con productos</Filtro>
          <Filtro activo={activos} onClick={() => setActivos(!activos)}><Icon name="sun"/>Verificación técnica</Filtro>
          {hayFiltros && <button className="min-h-11 border-0 bg-transparent px-3 text-sm text-[#52634f] underline" onClick={limpiar}>Limpiar filtros</button>}
        </div>
        {filtros && <div id="filtros" className="mt-4 grid gap-4 rounded-2xl bg-[#ecefe5] p-5 sm:grid-cols-2">
          <label htmlFor="municipio" className="grid gap-2">Municipio<select aria-label="Municipio" id="municipio" className="min-h-12 w-full rounded-lg border border-solid border-[#ccd4c5] bg-white px-3 text-[#163e2c]" value={municipio} onChange={e => setMunicipio(e.target.value)}><option value="">Todos los municipios</option>{municipiosPublicos.map(m => <option key={m}>{m}</option>)}</select></label>
          <label htmlFor="abeja" className="grid gap-2">Tipos de abejas<select disabled title="Esta información aún no está disponible públicamente" aria-label="Tipos de abejas" id="abeja" className="min-h-12 w-full rounded-lg border border-solid border-[#ccd4c5] bg-white px-3 text-[#163e2c]" value={especie} onChange={e => setEspecie(e.target.value)}><option value="">Información pendiente de publicación</option></select></label>
        </div>}
      </section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Meliponarios para descubrir</h2><p className="mt-2 text-sm text-[#637063]" role="status">{resultados.length} {resultados.length === 1 ? 'meliponario encontrado' : 'meliponarios encontrados'}</p></div>{onOpenMap ? <button className={`${boton} bg-[#123f2d] text-white hover:bg-[#23583e]`} onClick={() => onOpenMap({ ...filtrosBusqueda })}><Icon name="map"/>Ver mapa</button> : <span className="flex items-center gap-2 text-sm text-[#637063]"><Icon name="map"/>Mapa · siguiente entrega</span>}</div>
      <div className="mb-5 flex flex-wrap items-center gap-3"><button type="button" className={`${boton} bg-white`} disabled={publicos.loading} onClick={() => { dialogo.current?.close(); setSeleccion(null); publicos.recargar(); }}>Actualizar meliponarios</button>{publicos.loading && <p role="status" className="text-sm">Cargando meliponarios aprobados…</p>}{publicos.error && <p role="alert" className="text-sm text-[#842a20]">{publicos.error}</p>}</div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {resultados.map(m => <article key={m.id} className="overflow-hidden rounded-3xl border border-solid border-[#e1e5d9] bg-white shadow-sm transition-shadow hover:shadow-lg">
          <div className="relative"><button onClick={() => abrir(m, true)} aria-label={`Ver fotografía de ${m.nombre}`} className="block w-full border-0 bg-[#dfe6d5] p-0"><PublicPhoto id={m.id} nombre={m.nombre} className="aspect-[3/2] w-full"/></button></div>
          <div className="p-5"><p className="mb-2 flex items-center gap-1 text-sm text-[#65705f]"><Icon name="pin" size={16}/>{m.municipio}, Yucatán</p><h3 className="text-xl font-bold">{m.nombre}</h3><p className="mt-4 flex items-center gap-2 text-sm"><span className="text-[#a7791e]"><Icon name="bee"/></span>{m.informacionTecnicaVerificada ? 'Información técnica verificada' : 'Información básica aprobada'}</p><p className="mt-1 pl-7 text-sm text-[#637063]">Tipos de abejas aún no disponibles</p>
            <div className="mt-5 flex flex-wrap gap-2">{m.productos.length > 0 && <span className="flex items-center gap-1 rounded-lg bg-[#fff0bf] px-2 py-2 text-xs text-[#77520d]"><Icon name="bag" size={16}/>Productos publicados</span>}</div>
            <p className="mt-3 min-h-5 text-sm text-[#637063]">{m.productos.length ? m.productos.join(' · ') : 'Catálogo de productos pendiente'}</p><button className="mt-5 flex min-h-12 w-full items-center justify-between rounded-xl border-0 bg-[#123f2d] px-4 py-3 font-semibold text-white hover:bg-[#23583e]" onClick={() => onOpenDetail ? onOpenDetail(m.id) : abrir(m)}>Conocer meliponario<Icon name="arrow"/></button>
          </div>
        </article>)}
      </div>
      {!publicos.loading && !publicos.error && !resultados.length && <div className="rounded-3xl border border-solid border-[#dce1d4] bg-white p-10 text-center"><h2 className="text-xl">No encontramos meliponarios</h2><p className="my-4 text-[#637063]">Prueba otro nombre o quita algunos filtros.</p><button className={`${boton} bg-[#edf1e7]`} onClick={limpiar}>Ver todos</button></div>}
      <p className="mt-8 text-center text-xs leading-relaxed text-[#637063]">Cada meliponario cuenta una historia de cuidado y conservación.<br/>Solo se muestran fichas aprobadas y autorizadas para publicación. Las fotografías corresponden a archivos reales disponibles; el catálogo de productos sigue pendiente.</p>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-0 border-t border-solid border-[#e1e5d9] px-5 py-6 text-xs text-[#637063] lg:px-10"><span>KaabMap · Meliponarios de Yucatán</span><span>Conocer · Conservar · Conectar</span></footer>
    <dialog ref={dialogo} aria-labelledby="ficha-titulo" className="w-full max-w-2xl rounded-3xl border border-solid border-[#dce1d4] bg-[#faf9f5] p-5 text-[#163e2c]">
      {seleccion && <><div className="mb-4 flex items-center justify-between gap-4"><h2 id="ficha-titulo" className="text-xl font-bold">{seleccion.nombre}</h2><button className={`${boton} bg-white`} onClick={() => dialogo.current.close()} aria-label="Cerrar ficha"><Icon name="close"/></button></div><PublicPhoto id={seleccion.id} nombre={seleccion.nombre} className="aspect-[3/2] w-full rounded-xl"/>{!ampliada && <><p className="mt-4 font-semibold">{seleccion.municipio}, Yucatán</p><p className="mt-3 leading-relaxed">{seleccion.descripcion}</p><p className="mt-3 leading-relaxed">Los tipos de abejas todavía no están disponibles en la ficha pública.</p><p className="mt-3">Productos publicados: {seleccion.productos.join(', ') || 'Catálogo de productos pendiente'}.</p><p className="mt-5 rounded-xl bg-[#edf1e7] p-3 text-sm">Información de la ficha pública aprobada.</p></>}</>}
    </dialog>
  </div>;
}
