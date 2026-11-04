import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { limitesPeninsula } from '../../data/ubicacionesDemo';
import { mapConfig } from './mapConfig';
import './MapPage.css';

// Solo contiene nuestro SVG fijo: los nombres se pasan como texto, nunca como HTML.
const abeja = '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="14" rx="4" ry="7"/><path d="M8 12h8M8 16h8M10 7 8 3m6 4 2-4M8 10C0 1 0 15 8 14m8-4c8-9 8 5 0 4"/></svg>';

function gruposVisibles(map, puntos) {
  const grupos = [];
  for (const punto of puntos) {
    const pixel = map.project(punto.coordenadas, map.getZoom());
    const grupo = map.getZoom() < 10 && grupos.find(g => g.pixel.distanceTo(pixel) < 65);
    if (grupo) grupo.puntos.push(punto);
    else grupos.push({ pixel, puntos: [punto] });
  }
  return grupos;
}

const MapCanvas = forwardRef(function MapCanvas({ puntos, seleccionId, onSelect, ubicacion, mostrarPuntos }, ref) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const marcadores = useRef(null);
  const ubicacionCapa = useRef(null);
  const elegir = useRef(onSelect);
  const [estado, setEstado] = useState('cargando');
  const [intento, setIntento] = useState(0);
  useEffect(() => { elegir.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const map = L.map(contenedor.current, { zoomControl: false, zoomAnimation: false, minZoom: 3, maxZoom: 19, scrollWheelZoom: false });
    mapa.current = map;
    map.fitBounds(limitesPeninsula, { padding: [18, 18] });
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    marcadores.current = L.layerGroup().addTo(map);
    ubicacionCapa.current = L.layerGroup().addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(contenedor.current);
    return () => { resize.disconnect(); map.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const map = mapa.current;
    let fallo = false;
    let cargadas = 0;
    const tiles = L.tileLayer(mapConfig.url, { attribution: mapConfig.attribution, maxZoom: mapConfig.maxZoom });
    capa.current = tiles;
    tiles.on('tileload', () => { cargadas++; if (!fallo) setEstado('listo'); });
    tiles.on('tileerror', () => { fallo = true; setEstado('error'); });
    tiles.addTo(map);
    const timeout = setTimeout(() => { if (!cargadas) setEstado('error'); }, 12000);
    return () => { clearTimeout(timeout); tiles.off(); if (map.hasLayer(tiles)) map.removeLayer(tiles); };
  }, [intento]);

  useEffect(() => {
    const map = mapa.current;
    const capaMarcadores = marcadores.current;
    function dibujar() {
      capaMarcadores.clearLayers();
      if (!mostrarPuntos) return;
      for (const grupo of gruposVisibles(map, puntos)) {
        const items = grupo.puntos;
        const agrupado = items.length > 1;
        const punto = items[0];
        const privado = items.some(item => item.privadoDemo);
        const centro = agrupado ? L.latLngBounds(items.map(m => m.coordenadas)).getCenter() : punto.coordenadas;
        const nombre = agrupado ? `Acercar grupo de ${items.length} meliponarios` : punto.privadoDemo ? `Privado: ${punto.nombre}. ${punto.etiquetaPrivada}` : punto.nombre;
        const clasesOferta = { miel: 'kaab-miel', difusion: 'kaab-difusion', ambos: 'kaab-ambos' };
        const icon = L.divIcon({
          className: `kaab-marker ${privado ? 'kaab-privado' : ''} ${agrupado ? 'kaab-cluster' : clasesOferta[punto.ofertaVisualDemo] || 'kaab-sin-clasificar'} ${items.some(m => m.id === seleccionId) ? 'kaab-elegido' : ''}`,
          html: `<span class="kaab-pin">${abeja}${agrupado ? `<b>${items.length}</b>` : ''}</span>`,
          iconSize: [46, 52], iconAnchor: [23, 48],
        });
        const marker = L.marker(centro, { icon, title: nombre, alt: nombre, keyboard: true }).addTo(capaMarcadores);
        const element = marker.getElement();
        element.setAttribute('aria-label', nombre);
        marker.on('click', () => {
          if (agrupado) map.fitBounds(items.map(m => m.coordenadas), { padding: [70, 70], maxZoom: 11 });
          else elegir.current(punto.id);
        });
      }
    }
    dibujar();
    map.on('zoomend', dibujar);
    return () => { map.off('zoomend', dibujar); capaMarcadores.clearLayers(); };
  }, [puntos, seleccionId, mostrarPuntos]);

  useEffect(() => {
    const grupo = ubicacionCapa.current;
    grupo.clearLayers();
    if (!ubicacion) return;
    L.circle(ubicacion.coordenadas, { radius: ubicacion.precision, color: '#2563eb', weight: 1, fillOpacity: 0.10 }).addTo(grupo);
    L.circleMarker(ubicacion.coordenadas, { radius: 8, color: 'white', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(grupo).bindTooltip('Tu ubicación aproximada');
  }, [ubicacion]);

  useImperativeHandle(ref, () => ({
    peninsula: () => mapa.current?.fitBounds(limitesPeninsula, { padding: [18, 18] }),
    resultados: () => { if (puntos.length) mapa.current?.fitBounds(puntos.map(m => m.coordenadas), { padding: [65, 65], maxZoom: 11 }); },
    seleccionar: punto => mapa.current?.setView(punto.coordenadas, punto.ubicacionAproximada ? 9 : 12),
    localizar: coordenadas => mapa.current?.setView(coordenadas, 11),
  }), [puntos]);

  return <div className="relative h-full min-h-[420px]">
    <div ref={contenedor} className="kaab-map h-full min-h-[420px]" role="region" aria-label="Mapa interactivo de la península de Yucatán"/>
    {estado !== 'listo' && <div className="absolute bottom-12 left-3 right-16 z-[800] max-w-sm rounded-xl bg-white p-3 text-sm text-[#25452f] shadow-lg" role="status">
      {estado === 'cargando' ? 'Cargando el mapa…' : <>No se pudo cargar parte del mapa. Revisa tu conexión.<button className="mt-2 block min-h-11 rounded-lg border border-solid border-[#ccd6c4] bg-[#edf1e7] px-4" onClick={() => { setEstado('cargando'); setIntento(n => n + 1); }}>Reintentar mapa</button></>}
    </div>}
  </div>;
});
export default MapCanvas;
