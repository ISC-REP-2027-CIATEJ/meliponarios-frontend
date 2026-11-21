import { useEffect, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { filtrosIniciales } from '../../data/filtros';
import { distanciaKm } from '../../data/ubicacionesDemo';
import { abrirRegistroPropio } from '../../features/ownerMeliponarios/privateMap';
import { OfertaTag, PublicFilters, PublicSearch, filtrarVistaPublica, ofertasPublicas } from '../../features/publicMeliponarios/PublicBrowseControls';
import PublicPhoto from '../../features/publicMeliponarios/PublicPhoto';
import { usePublicMeliponarios } from '../../features/publicMeliponarios/usePublicMeliponarios';
import Icon from '../Explore/Icon';
import MapCanvas from './MapCanvas';

const control = 'km-button km-button--icon';

function Leyenda() {
  return <div className="km-map-legend" aria-label="Leyenda del mapa">
    {ofertasPublicas.map(({ value, label }) => <span key={value} data-tone={value}>{label}</span>)}
  </div>;
}

function ResultadoMapa({ item, seleccionado, ubicacion, elegir }) {
  const lugar = [item.localidad, item.municipio].filter(Boolean).join(', ');
  return <li>
    <button type="button" className="km-map-result" aria-pressed={seleccionado} onClick={() => elegir(item.id)}>
      <span className="km-icon-tile" data-tone={item.ofertaVisualDemo || undefined}><Icon name="pin" size={21}/></span>
      <span className="km-map-result-text">
        <strong>{item.nombre}</strong><span>{lugar}</span>
        <span className="km-map-result-tags">
          <OfertaTag item={item}/>
          {item.privadoDemo && <span className="km-tag">Solo tú</span>}
          {ubicacion && <span>≈ {distanciaKm(ubicacion.coordenadas, item.coordenadas).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km</span>}
        </span>
      </span>
      <Icon name="next" size={17}/>
    </button>
  </li>;
}

export default function MapPage({ filtros, onFiltrosChange, onExplore, onLogin, onOpenDetail, user, sessionReady = true, onLogout }) {
  const mapa = useRef(null);
  const ficha = useRef(null);
  const dialogo = useRef(null);
  const solicitud = useRef(0);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [mostrarPuntos, setMostrarPuntos] = useState(true);
  const [seleccionId, setSeleccionId] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fotoAbierta, setFotoAbierta] = useState(null);
  const publicos = usePublicMeliponarios();
  const resultados = useMemo(() => filtrarVistaPublica(publicos.items, filtros), [filtros, publicos.items]);
  const ordenados = useMemo(() => ubicacion ? [...resultados].sort((a, b) =>
    distanciaKm(ubicacion.coordenadas, a.coordenadas) - distanciaKm(ubicacion.coordenadas, b.coordenadas)
  ) : resultados, [resultados, ubicacion]);
  const seleccionado = resultados.find(item => item.id === seleccionId);
  const hayFiltros = Object.values(filtros).some(Boolean);

  useEffect(() => {
    window.scrollTo(0, 0);
    return () => { solicitud.current++; };
  }, []);

  function cambiar(cambio) {
    setSeleccionId(null);
    onFiltrosChange(previous => ({ ...previous, ...cambio }));
  }

  function limpiarFiltros() {
    setSeleccionId(null);
    onFiltrosChange({ ...filtrosIniciales });
  }

  function seleccionar(id) {
    const punto = resultados.find(item => item.id === id);
    if (!punto) return;
    setSeleccionId(id);
    setListaAbierta(false);
    setMostrarPuntos(true);
    mapa.current?.seleccionar(punto);
    requestAnimationFrame(() => ficha.current?.focus({ preventScroll: true }));
  }

  function localizar() {
    if (localizando) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      setAviso('Tu navegador no permite obtener la ubicación aquí. Puedes seguir explorando el mapa.');
      return;
    }
    setLocalizando(true);
    setAviso('Solicitando tu ubicación…');
    const token = ++solicitud.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (solicitud.current !== token) return;
      const valor = { coordenadas: [position.coords.latitude, position.coords.longitude], precision: position.coords.accuracy };
      setUbicacion(valor);
      setLocalizando(false);
      setAviso('Lista ordenada por cercanía. Las distancias son en línea recta y pueden usar ubicaciones aproximadas.');
      mapa.current?.localizar(valor.coordenadas);
    }, error => {
      if (solicitud.current !== token) return;
      setLocalizando(false);
      setAviso(error.code === 1 ? 'No se autorizó la ubicación. Puedes usar el mapa sin compartirla.' : error.code === 3 ? 'La ubicación tardó demasiado. Puedes intentarlo de nuevo.' : 'No se pudo obtener tu ubicación. Puedes seguir explorando el mapa.');
    }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false });
  }

  function quitarUbicacion() {
    solicitud.current++;
    setUbicacion(null);
    setLocalizando(false);
    setAviso('Ubicación retirada.');
  }

  function actualizar() {
    setSeleccionId(null);
    setFotoAbierta(null);
    dialogo.current?.close();
    publicos.recargar();
  }

  function abrirFoto(item) {
    setFotoAbierta(item);
    dialogo.current?.showModal();
  }

  function abrirDetalle() {
    const rutaPropia = abrirRegistroPropio(seleccionado);
    if (rutaPropia) { window.location.assign(rutaPropia); return; }
    if (seleccionado && onOpenDetail) onOpenDetail(seleccionado.id);
  }

  return <div className="map-page km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout} onLogin={onLogin} onExplore={onExplore} current="mapa"/>
    <main className="km-container km-map-main">
      <h1 className="km-page-title km-map-heading">Mapa de meliponarios</h1>
      <div className="km-map-workspace">
        <section aria-label="Buscar meliponarios en el mapa" className="km-map-filters">
          <PublicSearch value={filtros.busqueda} placeholder="Buscar meliponarios" onChange={busqueda => cambiar({ busqueda })}>
            <button type="button" className={control + ' km-button--quiet'} aria-label="Actualizar meliponarios" title="Actualizar meliponarios" disabled={publicos.loading} onClick={actualizar}><Icon name="refresh"/></button>
          </PublicSearch>
          <PublicFilters items={publicos.items} filtros={filtros} update={cambiar} clear={limpiarFiltros}/>
          {aviso && <p role="status" className="km-status">{aviso}{ubicacion && <button type="button" className="km-button km-button--quiet ml-1" onClick={quitarUbicacion}>Quitar mi ubicación</button>}</p>}
        </section>

        <div className="km-map-grid">
          <section className="km-map-view" aria-label="Vista del mapa">
            <div className="km-map-canvas">
              <MapCanvas ref={mapa} puntos={resultados} seleccionId={seleccionId} onSelect={seleccionar} ubicacion={ubicacion} mostrarPuntos={mostrarPuntos}/>
            </div>
            <div className="km-map-tools" aria-label="Controles del mapa">
              <button type="button" className={control} aria-label="Ver península" title="Ver península" onClick={() => mapa.current?.peninsula()}><Icon name="map"/></button>
              <button type="button" className={control} disabled={!resultados.length} aria-label="Ver resultados en el mapa" title="Ver resultados en el mapa" onClick={() => { setMostrarPuntos(true); mapa.current?.resultados(); }}><Icon name="pin"/></button>
              <button type="button" className={control} aria-expanded={capasAbiertas} aria-controls={capasAbiertas ? 'capas-mapa' : undefined} aria-label="Capas" title="Capas" onClick={() => setCapasAbiertas(value => !value)}><Icon name="layers"/></button>
              <button type="button" className={control} disabled={localizando} aria-label="Cerca de mí" title="Cerca de mí" onClick={localizar}><Icon name="locate"/></button>
            </div>
            {capasAbiertas && <div id="capas-mapa" className="km-panel km-map-layer-controls">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={mostrarPuntos} onChange={event => setMostrarPuntos(event.target.checked)}/>Mostrar meliponarios</label>
              <p className="mt-2 text-xs text-muted">Mapa base de OpenStreetMap</p>
            </div>}
          </section>

          <aside aria-label="Resultados del mapa" className="km-panel km-map-sheet" data-open={listaAbierta}>
            <div className="km-map-sheet-head">
              <div><h2 className="km-section-title">{resultados.length} {resultados.length === 1 ? 'meliponario' : 'meliponarios'}</h2><Leyenda/></div>
              <button type="button" className="km-button km-button--soft km-map-sheet-toggle" aria-expanded={listaAbierta} aria-controls="map-records" onClick={() => setListaAbierta(value => !value)}>
                {listaAbierta ? 'Mapa' : 'Lista'}<Icon name="chevron" size={16}/>
              </button>
            </div>

            {seleccionado && <section tabIndex={-1} ref={ficha} className="km-map-selected" aria-label={'Seleccionado: ' + seleccionado.nombre}>
              <div className="km-map-selected-info">
                <button type="button" className="km-map-selected-photo" onClick={() => abrirFoto(seleccionado)} aria-label={'Ver fotografía de ' + seleccionado.nombre}>
                  <PublicPhoto id={seleccionado.privadoDemo ? null : seleccionado.id} nombre={seleccionado.nombre} className="h-full w-full" compact/>
                </button>
                <div><h3>{seleccionado.nombre}</h3>
                  <p className="text-sm text-muted">{[seleccionado.localidad, seleccionado.municipio].filter(Boolean).join(', ')}</p>
                  <div className="mt-1 flex flex-wrap gap-1"><OfertaTag item={seleccionado}/>{seleccionado.privadoDemo && <span className="km-tag">Solo tú · {seleccionado.etiquetaPrivada}</span>}</div>
                </div>
                <button type="button" className={control + ' km-button--quiet'} aria-label="Cerrar selección" onClick={() => setSeleccionId(null)}><Icon name="close" size={18}/></button>
              </div>
              {seleccionado.ubicacionAproximada && <p className="mt-2 text-xs text-muted">Ubicación aproximada. No usar para llegar al lugar.</p>}
              <button type="button" className="km-button km-button--primary mt-3 w-full" onClick={abrirDetalle} disabled={!seleccionado.privadoDemo && !onOpenDetail}>
                {seleccionado.privadoDemo ? 'Ver mi registro' : 'Ver detalles'}<Icon name="arrow" size={17}/>
              </button>
            </section>}

            {publicos.loading && <p className="km-status" role="status">Cargando meliponarios aprobados…</p>}
            {publicos.error && <p className="km-status" role="alert">{publicos.error}</p>}
            <div id="map-records" className="km-map-records">
              {ubicacion && <p className="km-map-distance-note">Ordenados por cercanía</p>}
              {!publicos.loading && !publicos.error && !resultados.length && <div className="km-inset">
                <p>{hayFiltros ? 'No hay coincidencias.' : 'Aún no hay meliponarios publicados.'}</p>
                {hayFiltros && <button type="button" className="km-button km-button--soft mt-3" onClick={limpiarFiltros}>Ver todos</button>}
              </div>}
              <ul>{ordenados.map(item => <ResultadoMapa item={item} key={item.id} seleccionado={seleccionId === item.id} ubicacion={ubicacion} elegir={seleccionar}/>)}</ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
    <dialog ref={dialogo} aria-labelledby="foto-titulo" className="km-dialog km-photo-dialog">
      {fotoAbierta && <><div className="km-dialog-heading"><h2 id="foto-titulo" className="km-section-title">{fotoAbierta.nombre}</h2><button type="button" className={control} aria-label="Cerrar fotografía" onClick={() => dialogo.current?.close()}><Icon name="close"/></button></div><PublicPhoto id={fotoAbierta.privadoDemo ? null : fotoAbierta.id} nombre={fotoAbierta.nombre} className="aspect-[3/2] w-full rounded-xl"/></>}
    </dialog>
  </div>;
}
