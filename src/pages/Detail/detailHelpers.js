export const imagenDetalle = (nombre) =>
  `${import.meta.env.BASE_URL}images/detalle/${nombre}`;
export const imagenSitio = (nombre) =>
  `${import.meta.env.BASE_URL}images/meliponarios/${nombre}`;
export const recursoAudio = (ruta) =>
  ruta ? `${import.meta.env.BASE_URL}${ruta.replace(/^\/+/, "")}` : null;

export function enlacesContacto(persona) {
  const links = [];
  const telefono = persona.telefono?.trim();
  const whatsapp = persona.whatsapp?.replace(/\D/g, "");
  if (telefono && /^\+?[\d\s()-]{7,22}$/.test(telefono))
    links.push({
      nombre: "Llamar",
      url: `tel:${telefono.replace(/[\s()-]/g, "")}`,
    });
  if (whatsapp && /^\d{10,15}$/.test(whatsapp))
    links.push({ nombre: "WhatsApp", url: `https://wa.me/${whatsapp}` });
  if (persona.correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(persona.correo))
    links.push({
      nombre: "Enviar correo",
      url: `mailto:${encodeURIComponent(persona.correo)}`,
    });
  return links;
}

export function enlaceRuta(venta) {
  const c = venta.coordenadas;
  if (
    !venta.ubicacionVerificada ||
    !Array.isArray(c) ||
    c.length !== 2 ||
    !c.every(Number.isFinite) ||
    Math.abs(c[0]) > 90 ||
    Math.abs(c[1]) > 180
  )
    return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.join(","))}`;
}
