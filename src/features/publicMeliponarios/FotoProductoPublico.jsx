import { useState, useEffect } from 'react';
import { descargarFotoProductoPublico } from './publicService';
import Icon from '../../pages/Explore/Icon';

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
  return <div className="detail-product-photo">
    {imagen && imagen.ruta === producto.foto
      ? <img src={imagen.url} alt={'Fotografía de ' + producto.nombre} loading="lazy" onError={() => mostrar(null)}/>
      : <span className="detail-product-no-photo"><Icon name="bag" size={27}/><span>Sin fotografía</span></span>}
  </div>;
}

