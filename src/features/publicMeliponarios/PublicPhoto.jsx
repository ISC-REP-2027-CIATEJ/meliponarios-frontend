import { useState } from 'react';
import Icon from '../../pages/Explore/Icon';
import { usePublicPhotos } from './usePublicMeliponarios';

export default function PublicPhoto({ id, nombre, className = '' }) {
  const { fotos, loading, error } = usePublicPhotos(id);
  const [fallidas, setFallidas] = useState([]);
  const foto = fotos.find(item => !fallidas.includes(item.url));
  if (foto) return <img src={foto.url} alt={foto.descripcion || 'Fotografía de ' + nombre} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={'block object-cover ' + className} onError={() => setFallidas(previas => [...previas, foto.url])}/>;
  return <div role="img" aria-label={'Fotografía no disponible de ' + nombre} className={'flex min-h-20 flex-col items-center justify-center gap-2 bg-[#edf1e7] p-4 text-center text-[#637063] ' + className}>
    <Icon name="bee" size={32}/><span className="text-xs">{loading ? 'Cargando fotografía…' : error ? 'Fotografía no disponible' : 'Sin fotografías públicas disponibles'}</span>
  </div>;
}
