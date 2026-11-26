import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapConfig } from '../Map/mapConfig';

export default function LocationMap({ coordenadas, nombre, ampliado = false, aproximada = false }) {
  const host = useRef(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [lat, lng] = coordenadas;
  useEffect(() => {
    const contenedor = host.current;
    const centro = [lat, lng];
    let vigente = true;
    let frame;
    const map = L.map(contenedor, {
      zoomControl: ampliado, zoomAnimation: false, scrollWheelZoom: false,
      dragging: ampliado, touchZoom: ampliado, doubleClickZoom: ampliado,
      boxZoom: ampliado, keyboard: ampliado,
    }).setView(centro, aproximada ? 9 : ampliado ? 14 : 12);
    const tiles = L.tileLayer(mapConfig.url, {
      attribution: mapConfig.attribution, maxZoom: 19,
    }).addTo(map);
    let cargado = false;
    tiles.on('tileload', () => { cargado = true; if (vigente) setError(false); });
    tiles.on('tileerror', () => { if (vigente) setError(true); });
    const timer = setTimeout(() => { if (!cargado && vigente) setError(true); }, 10000);
    const icon = L.divIcon({
      className: 'detalle-pin',
      html: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>',
      iconSize: [40, 40], iconAnchor: [20, 20],
    });
    L.marker(centro, { icon, keyboard: ampliado, title: nombre }).addTo(map);
    // invalidateSize sin desplazar y recentrado explícito después de medir el contenedor.
    // Así un cambio de ancho/alto no deja el marcador fuera del centro visible.
    const centrar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!vigente || !contenedor.clientWidth || !contenedor.clientHeight) return;
        map.invalidateSize({ pan: false });
        map.setView(centro, map.getZoom(), { animate: false });
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(centrar);
    observer?.observe(contenedor);
    window.addEventListener('resize', centrar);
    centrar();
    return () => {
      vigente = false; clearTimeout(timer); cancelAnimationFrame(frame);
      observer?.disconnect(); window.removeEventListener('resize', centrar); tiles.off(); map.remove();
    };
  }, [lat, lng, nombre, ampliado, aproximada, intento]);
  return <div className="relative">
    <div ref={host} className={'detalle-location ' + (ampliado ? 'detalle-location--ampliado' : '')}
      role="region" aria-label={ampliado ? 'Ubicación ampliada' : 'Ubicación pública del meliponario'}/>
    {error && <div className="absolute bottom-8 left-2 right-2 z-[800] rounded-lg bg-white p-3 text-sm" role="status">
      No se pudo cargar el mapa. <button type="button" className="km-button" onClick={() => { setError(false); setIntento(n => n + 1); }}>Reintentar</button>
    </div>}
  </div>;
}

