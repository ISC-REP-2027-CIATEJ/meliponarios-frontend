import { OwnMapNotice, PrivateMapSelection } from './OwnMapLayer';
import { useOwnMapRecords } from './useOwnMapRecords';
import { abrirRegistroPropio } from '../../features/ownerMeliponarios/privateMap';
import { ClientAccountLinks } from '../../components/ClientNavigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { filtrarPublicos } from '../../features/publicMeliponarios/publicApi.mjs';
import { usePublicMeliponarios } from '../../features/publicMeliponarios/usePublicMeliponarios';
import PublicPhoto from '../../features/publicMeliponarios/PublicPhoto';
import { filtrosIniciales } from '../../data/filtros';
import { distanciaKm } from '../../data/ubicacionesDemo';
import Icon from '../Explore/Icon';
import MapCanvas from './MapCanvas';

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d6dece] px-4 py-2 text-sm font-semibold transition-colors';
const claro = `${boton} bg-white text-[#163e2c] hover:bg-[#edf1e7]`;
const oscuro = `${boton} bg-[#123f2d] text-white hover:bg-[#23583e]`;

// Actividades aprobadas: se conserva la paleta del mapa.
const tiposOferta = Object.freeze({
  miel: { etiqueta: 'Vende miel', punto: '#e6b632', fondo: '#fff3c9', texto: '#76520d', marcador: 'kaab-miel' },
  difusion: { etiqueta: 'Recibe visitas', punto: '#55a66b', fondo: '#e6f3e8', texto: '#245b35', marcador: 'kaab-difusion' },
  ambos: { etiqueta: 'Vende miel · recibe visitas', punto: '#438fc0', fondo: '#e5f1f8', texto: '#245477', marcador: 'kaab-ambos' },
});

function CuentaSesion({ user, sessionReady, onLogin, onLogout }) {
  const [abierta, setAbierta] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const nombre = user?.name?.trim() || 'Mi cuenta';
  const inicial = (user?.name?.trim() || user?.email || 'U').charAt(0).toUpperCase();

  async function cerrarSesion() {
    if (!onLogout || cerrando) return;
    setCerrando(true);
    setError('');
    try {
      await onLogout();
      setAbierta(false);
    } catch (fallo) {
      setError(fallo.message || 'No se pudo cerrar la sesión.');
    } finally {
      setCerrando(false);
    }
  }

  if (!sessionReady) return <span className="px-3 text-sm text-[#637063]" role="status">Comprobando sesión…</span>;
  if (!user) return <button className={claro} type="button" onClick={onLogin}>Iniciar sesión <Icon name="arrow"/></button>;

  return <div className="relative">
    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d8ded3] bg-white px-5 py-2 text-sm font-semibold text-[#163e2c] transition-colors hover:bg-[#e9eee3]" type="button" aria-expanded={abierta} aria-controls="opciones-cuenta-mapa" onClick={() => { setAbierta(!abierta); setError(''); }}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8edde] text-sm font-bold">{inicial}</span>
      <span className="flex min-w-0 flex-col items-start text-left leading-tight">
        <span className="max-w-[145px] truncate">{nombre}</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-[#80682a]"><Icon name="bee" size={12}/><span className="max-w-[145px] truncate">{user.roleName || 'Rol no disponible'}</span></span>
      </span>
      <span className={'grid size-7 shrink-0 place-items-center rounded-full bg-[#edf1e7] text-[#607250] transition-transform ' + (abierta ? 'rotate-180' : '')} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </span>
    </button>
    {abierta && <div id="opciones-cuenta-mapa" className="absolute right-0 top-full z-[1200] mt-2 min-w-60 rounded-2xl border border-solid border-[#dce1d4] bg-white p-4 text-left shadow-lg">
      <p className="text-sm font-semibold">{nombre}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#80682a]"><Icon name="bee" size={14}/>{user.roleName || 'Rol no disponible'}</p>
      {user.email && <p className="mt-3 break-all text-xs text-[#637063]">{user.email}</p>}
      <ClientAccountLinks user={user}/>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#fff0ed] p-2 text-xs text-[#842a20]">{error}</p>}
      <button className="mt-4 min-h-10 w-full rounded-lg border border-solid border-[#d8ded3] bg-white px-3 py-2 text-left text-sm hover:bg-[#edf1e7]" type="button" onClick={cerrarSesion} disabled={cerrando}>{cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
    </div>}
  </div>;
}

export default function MapPage({ filtros, onFiltrosChange, onExplore, onLogin, onOpenDetail, user, sessionReady = true, onLogout }) {
  const mapa = useRef(null);
  const ficha = useRef(null);
  const dialogo = useRef(null);
  const solicitud = useRef(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [mostrarPuntos, setMostrarPuntos] = useState(true);
  const [seleccionId, setSeleccionId] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fotoAbierta, setFotoAbierta] = useState(null);
  const propios = useOwnMapRecords(user, sessionReady);
  const publicos = usePublicMeliponarios();
  const resultados = useMemo(() => [...filtrarPublicos(publicos.items, filtros), ...filtrarPublicos(propios.puntos, { ...filtros, activos: false })], [filtros, propios.puntos, publicos.items]);
  const municipiosVisibles = useMemo(() => [...new Set([...publicos.items.map(point => point.municipio), ...propios.puntos.map(point => point.municipio)])].sort(), [propios.puntos, publicos.items]);
  const ordenados = useMemo(() => ubicacion ? [...resultados].sort((a, b) => distanciaKm(ubicacion.coordenadas, a.coordenadas) - distanciaKm(ubicacion.coordenadas, b.coordenadas)) : resultados, [resultados, ubicacion]);
  const seleccionado = resultados.find(m => m.id === seleccionId);
  const hayFiltros = Object.values(filtros).some(Boolean);

  useEffect(() => () => { solicitud.current++; }, []);
  const cambiar = (campo, valor) => {
    setSeleccionId(null);
    onFiltrosChange(anterior => ({ ...anterior, [campo]: valor }));
  };
  function limpiarFiltros() {
    setSeleccionId(null);
    onFiltrosChange({ ...filtrosIniciales });
  }
  function seleccionar(id) {
    const punto = resultados.find(m => m.id === id);
    if (!punto) return;
    setSeleccionId(id);
    setMostrarPuntos(true);
    mapa.current?.seleccionar(punto);
    requestAnimationFrame(() => {
      ficha.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1023px)').matches) ficha.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function localizar() {
    if (localizando) return;
    if (!navigator.geolocation || !window.isSecureContext) { setAviso('Tu navegador no permite obtener la ubicación aquí. Puedes seguir explorando el mapa.'); return; }
    setLocalizando(true);
    setAviso('Solicitando tu ubicación…');
    const token = ++solicitud.current;
    navigator.geolocation.getCurrentPosition(pos => {
      if (solicitud.current !== token) return;
      const valor = { coordenadas: [pos.coords.latitude, pos.coords.longitude], precision: pos.coords.accuracy };
      setUbicacion(valor);
      setLocalizando(false);
      setAviso('Lista ordenada por cercanía. Las distancias son en línea recta y pueden usar ubicaciones aproximadas.');
      mapa.current?.localizar(valor.coordenadas);
    }, error => {
      if (solicitud.current !== token) return;
      setLocalizando(false);
      setAviso(error.code === 1 ? 'No se autorizó la ubicación. Puedes usar los filtros y el mapa sin compartirla.' : error.code === 3 ? 'La ubicación tardó demasiado. Puedes intentarlo de nuevo.' : 'No se pudo obtener tu ubicación. Puedes seguir explorando el mapa.');
    }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false });
  }
  function quitarUbicacion() {
    solicitud.current++;
    setUbicacion(null);
    setLocalizando(false);
    setAviso('Ubicación retirada.');
  }
  function abrirFoto(m) {
    setFotoAbierta(m);
    dialogo.current?.showModal();
  }
  function abrirDetalle() {
    const rutaPropia = abrirRegistroPropio(seleccionado);
    if (rutaPropia) { window.location.assign(rutaPropia); return; }
    if (seleccionado && onOpenDetail) onOpenDetail(seleccionado.id);
  }

  return <div className="map-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
    <header className="border-0 border-b border-solid border-[#e0e5d7] bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><span className="text-[#ac7c20]"><Icon name="bee" size={34}/></span><div><span className="text-2xl font-extrabold tracking-tight">KaabMap</span><p className="pt-1 text-[10px] tracking-[0.2em]">MELIPONARIOS DE YUCATÁN</p></div></div>
        <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-2"><button type="button" className={claro} onClick={onExplore}>Explorar</button><span aria-current="page" className={`${boton} bg-[#edf1e7] text-[#163e2c]`}><Icon name="map"/>Mapa</span><CuentaSesion user={user} sessionReady={sessionReady} onLogin={onLogin} onLogout={onLogout}/></nav>
      </div>
    </header>

    <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">Explora la península</h1><p className="mt-2 text-sm leading-relaxed text-[#65715f]">Yucatán</p></div><span className="rounded-full bg-[#fff0bf] px-4 py-2 text-xs font-semibold text-[#765310]">Meliponarios aprobados</span></div>

      <OwnMapNotice state={propios}/>
      <div className="mb-5 flex flex-wrap items-center gap-3"><button type="button" className={claro} disabled={publicos.loading} onClick={() => { setSeleccionId(null); setFotoAbierta(null); dialogo.current?.close(); publicos.recargar(); }}>Actualizar meliponarios</button>{publicos.loading && <p role="status" className="text-sm">Cargando meliponarios aprobados…</p>}{publicos.error && <p role="alert" className="text-sm text-[#842a20]">{publicos.error}</p>}</div>
      <section aria-label="Buscar meliponarios en el mapa" className="mb-5">
        <div className="flex items-center gap-3 rounded-2xl border border-solid border-[#dce1d4] bg-white px-4 py-2 shadow-sm"><Icon name="search"/><label className="sr-only" htmlFor="buscar-mapa">Buscar meliponario, municipio o localidad</label><input id="buscar-mapa" className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base text-[#163e2c]" type="search" value={filtros.busqueda} onChange={e => cambiar('busqueda', e.target.value)} placeholder="¿Dónde quieres explorar?"/><button type="button" className={claro} aria-label="Filtros" aria-expanded={filtrosAbiertos} aria-controls="filtros-mapa" onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}><Icon name="filter"/><span className="hidden sm:inline">Filtros</span></button></div>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={ubicacion ? oscuro : claro} disabled={localizando} onClick={localizar}><Icon name="pin"/>{localizando ? 'Buscando ubicación…' : 'Cerca de mí'}</button><button type="button" className={filtros.conProductos ? oscuro : claro} disabled title="El catálogo público de productos está pendiente" aria-pressed={filtros.conProductos} onClick={() => cambiar('conProductos', !filtros.conProductos)}><Icon name="bag"/>Con productos</button><button type="button" className={filtros.activos ? oscuro : claro} aria-pressed={filtros.activos} onClick={() => cambiar('activos', !filtros.activos)}><Icon name="sun"/>Verificación técnica</button>{hayFiltros && <button type="button" className={claro} onClick={limpiarFiltros}>Limpiar filtros</button>}{ubicacion && <button type="button" className={claro} onClick={quitarUbicacion}>Quitar mi ubicación</button>}</div>
        {filtrosAbiertos && <div id="filtros-mapa" className="mt-3 grid gap-4 rounded-2xl bg-[#edf1e7] p-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Municipio<select aria-label="Municipio" className="min-h-12 w-full rounded-lg border border-solid border-[#d1d8c9] bg-white px-3" value={filtros.municipio} onChange={e => cambiar('municipio', e.target.value)}><option value="">Todos los municipios</option>{municipiosVisibles.map(m => <option key={m}>{m}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Tipo de abeja<select disabled title="Esta información aún no está disponible públicamente" aria-label="Tipo de abeja" className="min-h-12 w-full rounded-lg border border-solid border-[#d1d8c9] bg-white px-3" value={filtros.especie} onChange={e => cambiar('especie', e.target.value)}><option value="">Información pendiente de publicación</option></select></label></div>}
        {aviso && <p className="mt-3 rounded-xl bg-[#edf1e7] px-4 py-3 text-sm leading-relaxed" role="status">{aviso}</p>}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-label="Vista del mapa" className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" className={oscuro} onClick={() => mapa.current?.peninsula()}><Icon name="map"/>Ver península</button><button type="button" className={claro} disabled={!resultados.length} onClick={() => { setMostrarPuntos(true); mapa.current?.resultados(); }}>Ver resultados</button><button type="button" className={claro} aria-expanded={capasAbiertas} aria-controls="capas-mapa" onClick={() => setCapasAbiertas(!capasAbiertas)}><Icon name="layers"/>Capas</button><button type="button" className={`${claro} lg:ml-auto`} onClick={onExplore}>Ver lista <Icon name="arrow"/></button></div>
          {capasAbiertas && <div id="capas-mapa" className="mb-3 rounded-xl border border-solid border-[#dce1d4] bg-white p-4"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[#164c35]" checked={mostrarPuntos} onChange={e => setMostrarPuntos(e.target.checked)}/>Mostrar meliponarios</label><p className="mt-1 text-xs text-[#65715f]">Mapa base: OpenStreetMap</p></div>}
          <div className="h-[60svh] min-h-[420px] overflow-hidden rounded-3xl border border-solid border-[#d6dece] shadow-sm lg:h-[650px]"><MapCanvas ref={mapa} puntos={resultados} seleccionId={seleccionado?.id} onSelect={seleccionar} ubicacion={ubicacion} mostrarPuntos={mostrarPuntos}/></div>
          <div className="mt-3 rounded-2xl border border-solid border-[#e0e5d7] bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#65715f]">Actividades declaradas y aprobadas</p>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#465843]">
              {Object.entries(tiposOferta).map(([key, oferta]) => <span key={key} className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: oferta.punto }}/> {oferta.etiqueta}</span>)}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#65715f]">Arrastra para recorrer el mapa. Usa + / − o dos dedos para acercarte. Las ubicaciones aproximadas protegen el punto exacto; no deben usarse para llegar al lugar. Los números agrupan ubicaciones cercanas.</p>
        </section>

        <aside className="order-2 min-w-0 lg:order-1" aria-label="Meliponarios del mapa">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{ubicacion ? 'Ordenados por cercanía' : 'Meliponarios'}</h2><span role="status" className="rounded-full bg-[#e8edde] px-3 py-2 text-xs">{resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}</span></div>

          <div ref={ficha} tabIndex={-1} className="mb-4 overflow-hidden rounded-3xl border border-solid border-[#d7dfcf] bg-white shadow-sm" aria-label={seleccionado ? `Seleccionado: ${seleccionado.nombre}` : 'Selecciona un meliponario'}>
            {seleccionado ? <>
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-[#8a6a20]">Meliponario seleccionado</p><button type="button" className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-[#edf1e7] text-lg" aria-label="Cerrar selección" onClick={() => setSeleccionId(null)}>×</button></div>
              <button type="button" className="block w-full border-0 bg-[#edf1e7] p-0" onClick={() => abrirFoto(seleccionado)} aria-label={`Ver fotografía de ${seleccionado.nombre}`}><PublicPhoto id={seleccionado.privadoDemo ? null : seleccionado.id} nombre={seleccionado.nombre} className="aspect-[3/2] w-full"/></button>
              <div className="p-5">
                <PrivateMapSelection point={seleccionado}/>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-xl font-bold leading-snug"><button type="button" className="border-0 bg-transparent p-0 text-left text-inherit hover:underline" onClick={abrirDetalle}>{seleccionado.nombre}</button></h3>
                  {seleccionado.ofertaVisualDemo && <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: tiposOferta[seleccionado.ofertaVisualDemo].fondo, color: tiposOferta[seleccionado.ofertaVisualDemo].texto }}><span className="size-2.5 rounded-full" style={{ backgroundColor: tiposOferta[seleccionado.ofertaVisualDemo].punto }}/>{tiposOferta[seleccionado.ofertaVisualDemo].etiqueta}</span>}
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#65715f]"><Icon name="pin" size={16}/>{seleccionado.municipio}, Yucatán</p>{!seleccionado.privadoDemo && <p className="mt-2 text-xs text-[#65715f]">{seleccionado.ubicacionAproximada ? 'Ubicación aproximada. No usar para llegar al lugar.' : 'Ubicación exacta autorizada para esta ficha.'}</p>}
                <p className="mt-4 text-sm leading-relaxed text-[#465843]">{seleccionado.descripcion}</p>
                <div className="mt-5 rounded-2xl bg-[#f6f7f1] p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold"><Icon name="bag" size={18}/>Productos de la colmena</h4>
                  {seleccionado.productos.length ? <div className="mt-3 flex flex-wrap gap-2">{seleccionado.productos.map(producto => <span key={producto} className="rounded-full bg-white px-3 py-2 text-xs text-[#465843]">{producto}</span>)}</div> : <p className="mt-2 text-sm text-[#65715f]">El catálogo de productos todavía no está disponible.</p>}
                </div>
                <div className="mt-4 rounded-2xl border border-solid border-[#e6eadf] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#65715f]">Tipos de abejas</p><p className="mt-2 text-sm leading-relaxed">{seleccionado.especies.join(' · ') || 'Esta información aún no está disponible públicamente.'}</p></div>
                <button type="button" className={`${oscuro} mt-5 w-full justify-between rounded-xl`} onClick={abrirDetalle} disabled={!seleccionado.privadoDemo && !onOpenDetail}>{seleccionado.privadoDemo ? 'Ver mi registro' : 'Conocer más del meliponario'} <Icon name="arrow"/></button>
              </div>
            </> : <div className="p-5"><span className="text-[#b58a28]"><Icon name="bee" size={32}/></span><h3 className="mt-3 text-base font-bold">Cada punto, una historia</h3><p className="mt-2 text-sm leading-relaxed text-[#65715f]">Selecciona un marcador para conocer el meliponario y abrir su ficha completa.</p></div>}
          </div>

          {!publicos.loading && !publicos.error && !resultados.length && <div className="rounded-2xl bg-white p-5"><h3 className="text-base font-semibold">No hay coincidencias</h3><p className="my-3 text-sm text-[#65715f]">Prueba otro municipio o quita algunos filtros.</p><button type="button" className={claro} onClick={limpiarFiltros}>Ver todos</button></div>}
          <div className="grid gap-3">{ordenados.map(m => <button key={m.id} type="button" aria-pressed={seleccionado?.id === m.id} onClick={() => seleccionar(m.id)} className={`flex w-full items-center gap-3 rounded-2xl border border-solid p-3 text-left transition-colors hover:bg-[#edf1e7] ${seleccionado?.id === m.id ? 'border-[#164c35] bg-[#edf1e7]' : 'border-[#e0e5d7] bg-white'}`}><PublicPhoto id={m.privadoDemo ? null : m.id} nombre={m.nombre} className="h-20 w-20 shrink-0 rounded-xl"/><span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug">{m.nombre}</span>{m.privadoDemo && <span className="mt-1 block text-xs font-bold text-[#796329]">Solo tú · {m.etiquetaPrivada}</span>}<span className="mt-1 block text-xs text-[#65715f]">{m.municipio} · Yucatán</span><span className="mt-2 flex items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.ofertaVisualDemo ? tiposOferta[m.ofertaVisualDemo].punto : '#8b9987' }}/>{m.ofertaVisualDemo ? tiposOferta[m.ofertaVisualDemo].etiqueta : 'Sin actividades de venta o visitas'}</span><span className="mt-2 block truncate text-xs text-[#65715f]">{m.productos.length ? m.productos.join(' · ') : 'Catálogo de productos pendiente'}</span>{ubicacion && <span className="mt-2 block text-xs text-[#765310]">≈ {distanciaKm(ubicacion.coordenadas, m.coordenadas).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km · {m.privadoDemo ? 'registro local' : m.ubicacionAproximada ? 'ubicación aproximada' : 'ubicación autorizada'}</span>}</span></button>)}</div>
        </aside>
      </div>
    </main>

    <dialog ref={dialogo} aria-labelledby="foto-titulo" className="m-auto w-[calc(100%-32px)] max-w-3xl rounded-3xl border border-solid border-[#dce1d4] bg-[#faf9f5] p-5 text-[#163e2c]">{fotoAbierta && <><div className="mb-4 flex items-center justify-between gap-3"><h2 id="foto-titulo" className="text-lg font-bold">{fotoAbierta.nombre}</h2><button type="button" className={claro} onClick={() => dialogo.current?.close()}>Cerrar</button></div><PublicPhoto id={fotoAbierta.privadoDemo ? null : fotoAbierta.id} nombre={fotoAbierta.nombre} className="aspect-[3/2] w-full rounded-xl"/></>}</dialog>
  </div>;
}

