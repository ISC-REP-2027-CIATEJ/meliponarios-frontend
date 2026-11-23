import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapConfig } from '../Map/mapConfig';
import { actividad } from '../../features/ownerMeliponarios/model';

const SIN_REGISTROS = [];
const CENTRO_YUCATAN = [20.8, -89];
const COLORES = {
  amarillo: '#c28c16', yellow: '#c28c16', miel: '#c28c16',
  verde: '#25824b', green: '#25824b', difusion: '#25824b',
  azul: '#2764bb', blue: '#2764bb', ambas: '#2764bb', ambos: '#2764bb',
};

function coordenadasValidas(valor) {
  return Array.isArray(valor) && valor.length === 2
    && valor.every(numero => typeof numero === 'number' && Number.isFinite(numero))
    && Math.abs(valor[0]) <= 90 && Math.abs(valor[1]) <= 180;
}

// El SVG es fijo; los nombres y descripciones siempre se insertan como texto.
function iconoAbeja(color = '#174f3b') {
  const pin = document.createElement('span');
  pin.style.cssText = `display:grid;place-items:center;width:42px;height:42px;background:${color};color:#fff;border:3px solid #fff;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);box-shadow:0 3px 10px #123b3440;`;
  pin.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" style="transform:rotate(45deg)" aria-hidden="true"><ellipse cx="12" cy="14" rx="4" ry="7"/><path d="M8 12h8M8 16h8M10 7 8 3m6 4 2-4M8 10C0 1 0 15 8 14m8-4c8-9 8 5 0 4"/></svg>';
  return L.divIcon({ html: pin, className: 'owner-map__marker', iconSize: [46, 52], iconAnchor: [23, 48], tooltipAnchor: [0, -40] });
}

function colorActividad(registro) {
  const color = actividad(registro).color;
  if (COLORES[color]) return COLORES[color];
  // Solo admite colores hexadecimales, nunca estilos provenientes del registro.
  return typeof color === 'string' && /^#[\da-f]{3,8}$/i.test(color) ? color : '#174f3b';
}

export default function OwnerMap({ value = null, onChange, records = SIN_REGISTROS, onOpen, readOnly = false }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const marcadores = useRef(null);
  const acciones = useRef({ onChange, onOpen, editar: !readOnly && records.length === 0 });
  const [estado, setEstado] = useState('cargando');
  const [intento, setIntento] = useState(0);
  const editar = !readOnly && records.length === 0;

  useEffect(() => {
    acciones.current = { onChange, onOpen, editar };
  }, [onChange, onOpen, editar]);

  useEffect(() => {
    const elemento = contenedor.current;
    // Evita que la animación de acercamiento termine después de salir de esta pantalla.
    const map = L.map(elemento, { zoomControl: false, zoomAnimation: false, scrollWheelZoom: false, minZoom: 3, maxZoom: mapConfig.maxZoom });
    mapa.current = map;
    map.setView(CENTRO_YUCATAN, 7);
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar el mapa', zoomOutTitle: 'Alejar el mapa' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    marcadores.current = L.layerGroup().addTo(map);
    const seleccionar = evento => {
      if (acciones.current.editar) acciones.current.onChange?.([evento.latlng.lat, evento.latlng.lng]);
    };
    map.on('click', seleccionar);
    const observador = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observador.observe(elemento);
    return () => {
      observador.disconnect();
      map.off('click', seleccionar);
      map.remove();
      mapa.current = null;
      marcadores.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapa.current;
    let activo = true;
    let huboFallo = false;
    let cargoUna = false;
    const tiles = L.tileLayer(mapConfig.url, { attribution: mapConfig.attribution, maxZoom: mapConfig.maxZoom });
    tiles.on('tileload', () => {
      cargoUna = true;
      if (activo && !huboFallo) setEstado('listo');
    });
    tiles.on('tileerror', () => {
      huboFallo = true;
      if (activo) setEstado('error');
    });
    tiles.addTo(map);
    const espera = setTimeout(() => {
      if (activo && !cargoUna) setEstado('error');
    }, 12000);
    return () => {
      activo = false;
      clearTimeout(espera);
      tiles.off();
      if (map.hasLayer(tiles)) map.removeLayer(tiles);
    };
  }, [intento]);

  useEffect(() => {
    const map = mapa.current;
    const capa = marcadores.current;
    const creados = [];
    const puntos = records.filter(registro => coordenadasValidas(registro.coordenadas));
    for (const registro of puntos) {
      const nombre = registro.nombre || 'Meliponario sin nombre';
      const marker = L.marker(registro.coordenadas, { icon: iconoAbeja(colorActividad(registro)), title: nombre, alt: nombre, keyboard: true }).addTo(capa);
      const texto = document.createElement('span');
      texto.textContent = nombre;
      marker.bindTooltip(texto);
      marker.getElement()?.setAttribute('aria-label', `Abrir ${nombre}`);
      marker.on('click', () => acciones.current.onOpen?.(registro.id));
      creados.push(marker);
    }
    if (!records.length && coordenadasValidas(value)) {
      const marker = L.marker(value, { icon: iconoAbeja(), title: editar ? 'Ubicación del meliponario. Arrastra para moverla.' : 'Ubicación del meliponario', alt: 'Ubicación del meliponario', draggable: editar, keyboard: true }).addTo(capa);
      marker.on('dragend', () => {
        const punto = marker.getLatLng();
        if (acciones.current.editar) acciones.current.onChange?.([punto.lat, punto.lng]);
      });
      creados.push(marker);
      map.setView(value, Math.max(map.getZoom(), 11));
    } else if (puntos.length) {
      map.fitBounds(puntos.map(registro => registro.coordenadas), { padding: [48, 48], maxZoom: 12 });
    } else {
      map.setView(CENTRO_YUCATAN, 7);
    }
    return () => {
      for (const marker of creados) {
        marker.off();
        marker.unbindTooltip();
        if (capa.hasLayer(marker)) capa.removeLayer(marker);
      }
    };
  }, [value, records, editar]);

  function reintentar() {
    setEstado('cargando');
    setIntento(anterior => anterior + 1);
  }

  return (
    <div className="owner-map">
      <div ref={contenedor} className="owner-map__canvas" style={{ minHeight: 330 }} role="region" aria-label={editar ? 'Mapa de Yucatán. Selecciona un punto para ubicar tu meliponario.' : 'Mapa privado de tus meliponarios'} />
      {estado === 'cargando' && <p className="owner-map__notice" role="status">Cargando el mapa…</p>}
      {estado === 'error' && (
        <div className="owner-map__notice" role="status">
          <span>No se pudo cargar todo el mapa. Tu ubicación se conserva.</span>
          <button className="owner-map__retry" type="button" onClick={reintentar}>Volver a cargar</button>
        </div>
      )}
      {editar && <p className="mt-3 text-sm leading-relaxed text-[#687760]">Haz clic para colocar el punto. Después puedes arrastrarlo para ajustar la ubicación.</p>}
    </div>
  );
}
