import { useState, useEffect } from 'react';
import { descargarFotoProductoPublico } from './publicService';

export default function FotoProductoPublico({ producto }) {
  const [imagen, mostrar] = useState(null);
  useEffect(() => {
    if (!producto.foto) return;
    let vigente = true;
    let url;
    descargarFotoProductoPublico(producto.foto).then(blob => {
      if (vigente && blob) {
        url = URL.createObjectURL(blob);
        mostrar({ ruta: producto.foto, url });
      }
    }).catch(() => {});
    return () => { vigente = false; if (url) URL.revokeObjectURL(url); };
  }, [producto.foto]);
  return imagen && imagen.ruta === producto.foto
    ? <img className="mb-2 size-20 rounded-xl object-cover" src={imagen.url} alt={producto.nombre} onError={() => mostrar(null)}/> : null;
}
