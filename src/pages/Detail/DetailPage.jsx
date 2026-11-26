import EstadoOperativoTag from '../../features/publicMeliponarios/EstadoOperativoTag';
import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { OfertaTag } from '../../features/publicMeliponarios/PublicBrowseControls';
import { enlaceTelefono } from '../../features/publicMeliponarios/publicApi.mjs';
import { usePublicFicha } from '../../features/publicMeliponarios/usePublicMeliponarios';
import FotoProductoPublico from '../../features/publicMeliponarios/FotoProductoPublico';
import PublicGallery from '../../features/publicMeliponarios/PublicGallery';
import Icon from '../Explore/Icon';
import LocationMap from './LocationMap';
import './DetailPage.css';

const panel = 'km-panel km-inset';
const boton = 'km-button';
const primario = 'km-button km-button--primary';

export default function DetailPage({ id, onBack, onExplore, onMap, onLogin, user, sessionReady = true, onLogout }) {
  const publicacion = usePublicFicha(id);
  const sitio = publicacion.item;
  const telefono = enlaceTelefono(sitio?.telefonoContacto);
  const [compartido, setCompartido] = useState('');
  const [mapaAmpliado, setMapaAmpliado] = useState(false);
  const inicio = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    inicio.current?.focus({ preventScroll: true });
  }, [id]);

  async function compartir() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCompartido('Enlace copiado.');
    } catch {
      setCompartido('Puedes copiar la dirección desde la barra del navegador.');
    }
  }

  return <div className="detail-page km-with-nav">
    <OwnerHeader onExplore={onExplore} onMap={onMap} onLogin={onLogin} user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    <main ref={inicio} tabIndex={-1} className="km-container km-workspace">
      <div className="km-heading-row">
        <button type="button" className={boton} onClick={onBack}><Icon name="back" size={18}/>Volver</button>
        <button type="button" className={boton} disabled={publicacion.loading} onClick={publicacion.recargar}><Icon name="refresh" size={18}/>Actualizar ficha</button>
      </div>
      {publicacion.loading ? <div className="km-status" role="status">Cargando ficha pública…</div>
        : publicacion.error ? <section className={panel} role="alert"><h1 className="km-section-title">No pudimos cargar la ficha</h1><p className="my-3">{publicacion.error}</p><button type="button" className={primario} onClick={publicacion.recargar}>Reintentar</button></section>
        : !sitio ? <section className="km-panel km-empty"><span className="km-icon-tile"><Icon name="bee" size={24}/></span><h1 className="km-section-title">Ficha pública no disponible</h1><p>La dirección no corresponde a un meliponario publicado.</p><button type="button" className={primario} onClick={onExplore}>Volver a Explorar</button></section>
        : <>
          <header className="km-work-banner km-page-heading">
            <div>
              <h1 className="km-page-title">{sitio.nombre}</h1>
              <p className="flex items-center gap-2 text-muted"><Icon name="pin" size={18}/>{[sitio.localidad, sitio.municipio, 'Yucatán'].filter(Boolean).join(', ')}</p>
              <div className="mt-3 flex flex-wrap gap-2"><OfertaTag item={sitio}/><EstadoOperativoTag item={sitio}/><span className="km-tag"><Icon name="check" size={15}/>{sitio.informacionTecnicaVerificada ? 'Verificación técnica' : 'Información básica aprobada'}</span></div>
            </div>
            <div><button type="button" className={boton} onClick={compartir}>Copiar enlace</button>{compartido && <p role="status" className="mt-2 text-sm text-muted">{compartido}</p>}</div>
          </header>
          <div className="km-detail-grid">
            <div className="km-detail-column">
              <PublicGallery key={sitio.id} id={sitio.id} nombre={sitio.nombre}/>
              <section className={panel}>
                <h2 className="km-section-title">Acerca del meliponario</h2>
                <p className="mt-3 whitespace-pre-line text-muted">{sitio.descripcion || 'Esta ficha no incluye una descripción.'}</p>
              </section>
              <section className={panel} aria-labelledby="detail-species-title">
                <div className="detail-section-heading"><span className="km-icon-tile"><Icon name="bee"/></span>
                  <div><h2 id="detail-species-title" className="km-section-title">Tipos de abejas</h2><p>Especies e inventario de la ficha pública.</p></div>
                  {sitio.abejas.length > 0 && <span className="km-tag">{sitio.abejas.length} {sitio.abejas.length === 1 ? 'especie' : 'especies'}</span>}
                </div>
                {sitio.abejas.length ? <ul className="detail-species-list" role="list">{sitio.abejas.map((a, i) => <li className="detail-species-card" key={(a.cientifico || a.nombre) + i}>
                  <div className="detail-species-name"><Icon name="bee" size={22}/><div><h3>{a.nombre}</h3>{a.cientifico && a.cientifico !== a.nombre && <p><i>{a.cientifico}</i></p>}</div></div>
                  <dl className="detail-species-counts"><div><dt>Cajas</dt><dd>{a.cajas === null ? 'Sin dato' : a.cajas}</dd></div><div><dt>Jobones</dt><dd>{a.jobones === null ? 'Sin dato' : a.jobones}</dd></div></dl>
                </li>)}</ul> : <p className="detail-empty">{sitio.especiesDisponibles ? 'Sin especies en la ficha pública.' : 'No se pudo consultar el inventario de abejas.'}</p>}
              </section>
              {sitio.vendeMiel && <section className={panel} aria-labelledby="detail-products-title">
                <div className="detail-section-heading"><span className="km-icon-tile"><Icon name="bag"/></span>
                  <div><h2 id="detail-products-title" className="km-section-title">Productos de la colmena</h2><p>Consulta qué ofrece este meliponario.</p></div>
                </div>
                {sitio.productosPublicos.length ? <ul className="detail-products-list" role="list">{sitio.productosPublicos.map((p, i) => <li className="detail-product-card" key={p.nombre + i}>
                  <FotoProductoPublico producto={p}/><div className="detail-product-body"><h3>{p.nombre}</h3>
                    <span className="detail-availability" data-available={p.disponibilidad === 'Disponible'}>{p.disponibilidad}</span>
                    {p.descripcion && <p>{p.descripcion}</p>}
                  </div>
                </li>)}</ul> : <p className="detail-empty">{sitio.productosDisponibles ? 'Sin productos disponibles por ahora.' : 'No se pudo consultar la oferta.'}</p>}
              </section>}
            </div>
            <aside className="km-detail-column">
              <section className={panel}>
                <h2 className="km-section-title flex items-center gap-2"><Icon name="phone"/>Contacto y visitas</h2>
                <dl className="mt-4 grid gap-4 text-sm">
                  <div><dt className="font-semibold">Nombre de contacto</dt><dd className="mt-1 wrap-anywhere text-muted">{sitio.nombreContacto}</dd></div>
                  <div><dt className="font-semibold">Teléfono de contacto</dt><dd className="mt-1 wrap-anywhere">{telefono ? <a href={telefono} className={primario}><Icon name="phone" size={17}/>{sitio.telefonoContacto}</a> : sitio.telefonoContacto || 'Sin teléfono público'}</dd></div>
                </dl>
              </section>
              <section className={panel}>
                <h2 className="km-section-title mb-3 flex items-center gap-2"><Icon name="map"/>Ubicación pública</h2>
                {sitio.ubicacionAproximada && <p className="km-status mb-3">Ubicación aproximada. No usar para llegar al lugar.</p>}
                <LocationMap coordenadas={sitio.coordenadas} nombre={sitio.nombre} aproximada={sitio.ubicacionAproximada} ampliado={mapaAmpliado}/>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={boton} aria-pressed={mapaAmpliado} onClick={() => setMapaAmpliado(value => !value)}>{mapaAmpliado ? 'Reducir mapa' : 'Ampliar mapa'}</button>
                  {!sitio.ubicacionAproximada && <a className={primario} href={'https://www.google.com/maps/dir/?api=1&destination=' + sitio.coordenadas.join(',')} target="_blank" rel="noopener noreferrer">Consultar ruta</a>}
                </div>
              </section>
            </aside>
          </div>
        </>}
    </main>
  </div>;
}
