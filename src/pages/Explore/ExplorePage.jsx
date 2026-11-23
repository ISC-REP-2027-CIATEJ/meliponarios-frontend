import { useEffect, useMemo, useRef, useState } from 'react';
import { ClientRegistrationButton, OwnerHeader } from '../../components/ClientNavigation';
import { filtrosIniciales } from '../../data/filtros';
import { OfertaTag, PublicFilters, PublicSearch, filtrarVistaPublica, ofertasPublicas } from '../../features/publicMeliponarios/PublicBrowseControls';
import { usePublicMeliponarios, usePublicPhotos } from '../../features/publicMeliponarios/usePublicMeliponarios';
import PublicPhoto from '../../features/publicMeliponarios/PublicPhoto';
import MapCanvas from '../Map/MapCanvas';
import Icon from './Icon';
import './ExplorePage.css';

const formato = new Intl.NumberFormat('es-MX');

function Resumen({ items }) {
  const datos = [
    ['records', items.length, 'Meliponarios'],
    ['both', new Set(items.map(item => item.municipio).filter(Boolean)).size, 'Municipios'],
    ['honey', items.filter(item => item.vendeMiel).length, 'Venden miel'],
  ];
  return <dl className="km-home-stats" aria-label="Resumen del catálogo público">
    {datos.map(([icon, number, label]) => <div className="km-panel" key={label}>
      <Icon name={icon} size={18}/><dt>{label}</dt><dd>{formato.format(number)}</dd>
    </div>)}
  </dl>;
}

function ConFoto({ item, abrir }) {
  const { fotos } = usePublicPhotos(item.id);
  const [fallidas, setFallidas] = useState([]);
  const foto = fotos.find(candidate => !fallidas.includes(candidate.url));
  if (!foto) return null;
  return <button type="button" className="km-feature-card" onClick={() => abrir(item)}>
    <img src={foto.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFallidas(previous => [...previous, foto.url])}/>
    <span className="km-feature-card-tag"><OfertaTag item={item}/></span>
    <span className="km-feature-card-title"><strong>{item.nombre}</strong><span><Icon name="pin" size={15}/>{[item.localidad, item.municipio].filter(Boolean).join(', ')}</span></span>
  </button>;
}

function Fila({ item, abrir, abrirFoto }) {
  return <article className="km-panel km-home-card">
    <button type="button" className="km-home-card-photo" onClick={() => abrirFoto(item)} aria-label={'Ver fotografía de ' + item.nombre}>
      <PublicPhoto id={item.id} nombre={item.nombre} className="h-full w-full" compact/>
    </button>
    <button type="button" className="km-home-card-body" onClick={() => abrir(item)}>
      <span className="km-home-card-text">
        <strong>{item.nombre}</strong>
        <span className="km-home-place"><Icon name="pin" size={14}/>{[item.localidad, item.municipio].filter(Boolean).join(', ')}</span>
        {item.descripcion && <span className="line-clamp-2 text-sm text-muted">{item.descripcion}</span>}
        {item.especies.length > 0 && <span className="text-sm">Abejas · {item.especies.join(', ')}</span>}
        {item.vendeMiel && item.productos.length > 0 && <span className="text-sm">Productos · {item.productos.join(', ')}</span>}
        <span className="km-home-card-tags">
          <OfertaTag item={item}/>
          {item.informacionTecnicaVerificada && <span className="km-tag"><Icon name="check" size={14}/>Verificado</span>}
        </span>
      </span>
      <span className="km-home-card-arrow"><Icon name="next" size={17}/></span>
    </button>
  </article>;
}

export default function ExplorePage({ onLogin, onLogout, onOpenMap, onOpenDetail, filtrosBusqueda, onFiltrosChange, user, sessionReady = true }) {
  const publicos = usePublicMeliponarios();
  const [seleccion, setSeleccion] = useState(null);
  const [ampliada, setAmpliada] = useState(false);
  const dialogo = useRef(null);
  const resultados = useMemo(() => filtrarVistaPublica(publicos.items, filtrosBusqueda), [publicos.items, filtrosBusqueda]);
  const hayFiltros = Object.values(filtrosBusqueda).some(Boolean);
  const update = cambio => onFiltrosChange(previous => ({ ...previous, ...cambio }));
  const clear = () => onFiltrosChange({ ...filtrosIniciales });
  const irAlMapa = onOpenMap ? () => onOpenMap({ ...filtrosBusqueda }) : undefined;
  const nombre = user?.name?.trim().split(/\s+/)[0];
  useEffect(() => { window.scrollTo(0, 0); }, []);

  function abrir(item, foto = false) {
    if (!foto && onOpenDetail) {
      onOpenDetail(item.id);
      return;
    }
    setSeleccion(item);
    setAmpliada(foto);
    dialogo.current.showModal();
  }

  return <div className="km-with-nav explore-page">
    <a href="#contenido" onClick={event => { event.preventDefault(); document.getElementById('contenido')?.focus(); }} className="km-skip sr-only focus:not-sr-only">Saltar al contenido</a>
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout} onLogin={onLogin} onMap={irAlMapa} current="explorar" verde/>
    <main id="contenido" tabIndex={-1}>
      <section className="km-home-hero" aria-labelledby="titulo">
        <div className="km-container km-page-heading">
          <div>{nombre && <p className="km-home-greeting">Hola, {nombre}</p>}<h1 id="titulo" className="km-page-title">Descubre los meliponarios de Yucatán</h1></div>
          <ClientRegistrationButton user={user} sessionReady={sessionReady}/>
        </div>
      </section>

      <div className="km-container km-home-content">
        <section className="km-home-controls" aria-label="Buscar y filtrar">
          <PublicSearch value={filtrosBusqueda.busqueda} onChange={busqueda => update({ busqueda })}/>
          <PublicFilters items={publicos.items} filtros={filtrosBusqueda} update={update} clear={clear}/>
        </section>

        <div className="km-home-overview">
          <div className="km-home-actions" aria-label="Explorar por actividad">
            {ofertasPublicas.map(({ value, icon, label }) => <button type="button" key={value} aria-pressed={filtrosBusqueda.oferta === value} onClick={() => update({ oferta: filtrosBusqueda.oferta === value ? '' : value })}>
              <span className="km-icon-tile" data-tone={value}><Icon name={icon} size={25}/></span>
              <span>{value === 'ambos' ? 'Ambos' : label}</span>
            </button>)}
            <a href="#mapa" onClick={irAlMapa ? event => { event.preventDefault(); irAlMapa(); } : undefined}>
              <span className="km-icon-tile"><Icon name="pin" size={25}/></span><span>Mapa</span>
            </a>
          </div>
          {!publicos.loading && !publicos.error && <Resumen items={publicos.items}/>}
        </div>

        <div className="km-home-discover">
          <section aria-labelledby="explore-map">
            <div className="km-heading-row">
              <h2 id="explore-map" className="km-section-title">Explora en el mapa</h2>
              <a href="#mapa" className="km-button km-button--quiet" onClick={irAlMapa ? event => { event.preventDefault(); irAlMapa(); } : undefined}>Ver mapa <Icon name="arrow" size={16}/></a>
            </div>
            <div className="km-home-map">
              <MapCanvas puntos={resultados} mostrarPuntos preview/>
            </div>
          </section>
          <section className="km-featured" aria-labelledby="explore-photos">
            <div className="km-heading-row"><h2 id="explore-photos" className="km-section-title">Meliponarios con fotografías</h2></div>
            <div className="km-feature-cards">{resultados.slice(0, 4).map(item => <ConFoto key={item.id} item={item} abrir={abrir}/>)}</div>
          </section>
        </div>

        <section aria-labelledby="explore-results">
          <div className="km-heading-row">
            <div className="km-home-results-title"><h2 id="explore-results" className="km-section-title">{hayFiltros ? 'Resultados' : 'Todos los meliponarios'}</h2>
              {!publicos.loading && !publicos.error && <span className="km-tag" role="status" aria-label={resultados.length + ' meliponarios'}>{formato.format(resultados.length)}</span>}
            </div>
            <button type="button" className="km-button km-button--icon km-button--quiet" aria-label="Actualizar meliponarios" title="Actualizar meliponarios" disabled={publicos.loading} onClick={() => { dialogo.current?.close(); setSeleccion(null); publicos.recargar(); }}><Icon name="refresh" size={21}/></button>
          </div>
          {publicos.loading && <p role="status" className="km-status">Cargando meliponarios aprobados…</p>}
          {publicos.error && <p role="alert" className="km-status">{publicos.error}</p>}
          <div className="km-home-results">
            {resultados.map(item => <Fila key={item.id} item={item} abrir={abrir} abrirFoto={value => abrir(value, true)}/>)}
          </div>
          {!publicos.loading && !publicos.error && !resultados.length && <div className="km-panel km-empty">
            <span className="km-icon-tile"><Icon name="search" size={24}/></span>
            <h3 className="km-section-title">{hayFiltros ? 'No encontramos meliponarios' : 'Aún no hay meliponarios publicados'}</h3>
            {hayFiltros && <><p>Prueba otro nombre o quita algunos filtros.</p><button type="button" className="km-button km-button--soft" onClick={clear}>Ver todos</button></>}
          </div>}
        </section>
      </div>
    </main>
    <dialog ref={dialogo} aria-labelledby="ficha-titulo" className="km-dialog km-photo-dialog">
      {seleccion && <>
        <div className="km-dialog-heading"><h2 id="ficha-titulo" className="km-section-title">{seleccion.nombre}</h2><button type="button" className="km-button km-button--icon" aria-label="Cerrar ficha" onClick={() => dialogo.current.close()}><Icon name="close"/></button></div>
        <PublicPhoto id={seleccion.id} nombre={seleccion.nombre} className="aspect-[3/2] w-full rounded-xl"/>
        {!ampliada && <><p className="mt-4 font-semibold">{seleccion.municipio}, Yucatán</p><p className="mt-3 leading-relaxed">{seleccion.descripcion}</p></>}
      </>}
    </dialog>
  </div>;
}
