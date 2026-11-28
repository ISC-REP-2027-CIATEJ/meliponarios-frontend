import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tieneGPS } from '../../features/research/inventarioModel.mjs';

export default function ResearchMap({ registros }) {
  const contenedor = useRef(null);
  const instancia = useRef(null);
  useEffect(() => {
    const mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView([20.95, -89.05], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 18 }).addTo(mapa);
    const capa = L.layerGroup().addTo(mapa);
    instancia.current = { mapa, capa, puntos: [] };
    const centrar = () => {
      mapa.invalidateSize({ pan: false });
      const puntos = instancia.current?.puntos || [];
      if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [38, 38], maxZoom: puntos.length === 1 ? 13 : 10, animate: false });
      else mapa.setView([20.95, -89.05], 8, { animate: false });
    };
    const observador = new ResizeObserver(centrar);
    observador.observe(contenedor.current);
    instancia.current.centrar = centrar;
    return () => { observador.disconnect(); instancia.current = null; mapa.remove(); };
  }, []);
  useEffect(() => {
    const actual = instancia.current;
    if (!actual) return;
    actual.capa.clearLayers();
    actual.puntos = [];
    registros.filter(tieneGPS).forEach(registro => {
      const punto = [registro.latitud, registro.longitud];
      actual.puntos.push(punto);
      const etiqueta = document.createElement('div');
      const titulo = document.createElement('strong'); titulo.textContent = registro.nombre;
      const lugar = document.createElement('div'); lugar.textContent = registro.localidad + ' · ' + registro.municipio;
      etiqueta.append(titulo, lugar);
      L.circleMarker(punto, { radius: 7, color: '#FFFFFF', weight: 2, fillColor: '#086B53', fillOpacity: 1 }).bindPopup(etiqueta).addTo(actual.capa);
    });
    actual.centrar();
  }, [registros]);
  return <div className="research-map" ref={contenedor} role="region" aria-label="Mapa de los meliponarios filtrados. Consulta los mismos resultados en Inventario territorial."/>;
}
