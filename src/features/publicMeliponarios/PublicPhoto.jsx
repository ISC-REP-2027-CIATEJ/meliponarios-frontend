import { useState } from 'react';
import Icon from '../../pages/Explore/Icon';
import { usePublicPhotos } from './usePublicMeliponarios';

export default function PublicPhoto({ id, nombre, className = '', compact = false }) {
  const { fotos, loading, error } = usePublicPhotos(id);
  const [fallidas, setFallidas] = useState([]);
  const foto = fotos.find(item => !fallidas.includes(item.url));
  if (foto) return <img src={foto.url} alt={foto.descripcion || 'Fotografía de ' + nombre} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={'block object-cover ' + className} onError={() => setFallidas(previas => [...previas, foto.url])}/>;
  const mensaje = loading ? 'Cargando fotografía…' : error ? 'Fotografía no disponible' : 'Sin fotografías públicas disponibles';
  return <div role="img" aria-label={mensaje + ' · ' + nombre} className={'km-public-photo-empty flex flex-col items-center justify-center gap-2 text-center ' + (compact ? 'km-public-photo-empty--compact ' : 'min-h-20 p-4 ') + className}>
    <Icon name={compact ? 'records' : 'bee'} size={compact ? 25 : 34}/>
    {!compact && <span className="text-xs">{mensaje}</span>}
  </div>;
}
