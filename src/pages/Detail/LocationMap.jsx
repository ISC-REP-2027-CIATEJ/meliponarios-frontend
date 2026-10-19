import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapConfig } from "../Map/mapConfig";

export default function LocationMap({ coordenadas, nombre, ampliado = false }) {
  const host = useRef(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [lat, lng] = coordenadas;
  useEffect(() => {
    setError(false);
    const map = L.map(host.current, {
      zoomControl: ampliado,
      scrollWheelZoom: false,
      dragging: ampliado,
      touchZoom: ampliado,
      doubleClickZoom: ampliado,
      boxZoom: ampliado,
      keyboard: ampliado,
    }).setView([lat, lng], ampliado ? 13 : 11);
    const tiles = L.tileLayer(mapConfig.url, {
      attribution: mapConfig.attribution,
      maxZoom: 19,
    }).addTo(map);
    let cargado = false;
    tiles.on("tileload", () => {
      cargado = true;
    });
    tiles.on("tileerror", () => setError(true));
    const timer = setTimeout(() => {
      if (!cargado) setError(true);
    }, 10000);
    const icon = L.divIcon({
      className: "detalle-pin",
      html: '<span aria-hidden="true">⌖</span>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker([lat, lng], { icon, keyboard: ampliado, title: nombre }).addTo(
      map,
    );
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(host.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      tiles.off();
      map.remove();
    };
  }, [lat, lng, nombre, ampliado, intento]);
  return (
    <div className="relative">
      <div
        ref={host}
        className={`detalle-location rounded-2xl ${ampliado ? "h-[55svh] min-h-[300px]" : "h-56"}`}
        role="region"
        aria-label={ampliado ? "Ubicación ampliada" : "Mapa del punto de venta"}
      />
      {error && (
        <div
          className="absolute bottom-8 left-2 right-2 z-[800] rounded-lg bg-white p-3 text-sm"
          role="status"
        >
          No se pudo cargar el mapa.{" "}
          <button
            className="min-h-11 border-0 bg-transparent font-semibold text-[#164c35] underline"
            onClick={() => setIntento((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
