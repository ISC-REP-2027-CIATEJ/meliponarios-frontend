import { useState } from 'react';
import Icon from '../../pages/Explore/Icon';
import { usePublicPhotos } from './usePublicMeliponarios';

export default function PublicGallery({ id, nombre }) {
  const { fotos, faltantes, loading, error, recargar } = usePublicPhotos(id);
  const [elegida, setElegida] = useState(null);
  const [fallidas, setFallidas] = useState([]);
  const disponibles = fotos.filter(foto => !fallidas.includes(foto.url));
  const actual = disponibles.find(foto => foto.id === elegida) || disponibles[0];
  const fallo = foto => setFallidas(previas => [...previas, foto.url]);
  return <section aria-label="Fotografías del meliponario" className="km-panel overflow-hidden">
    {actual ? <img src={actual.url} alt={actual.descripcion || 'Fotografía de ' + nombre} className="block aspect-[16/9] w-full object-cover" referrerPolicy="no-referrer" onError={() => fallo(actual)}/> :
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-3 bg-soft p-5 text-center text-muted"><span className="km-icon-tile"><Icon name="bee" size={30}/></span><p role="status">{loading ? 'Cargando fotografías…' : error ? 'No pudimos cargar las fotografías.' : 'Sin fotografías públicas disponibles.'}</p></div>}
    <div className="p-5">
      {disponibles.length > 1 && <div className="mb-4 flex flex-wrap gap-3" aria-label="Elegir fotografía">{disponibles.map((foto, index) => <button type="button" key={foto.id} onClick={() => setElegida(foto.id)} aria-pressed={foto.id === actual?.id} aria-label={'Ver fotografía ' + (index + 1)} className={'overflow-hidden rounded-xl border-2 border-solid bg-[#edf1e7] p-0 ' + (foto.id === actual?.id ? 'border-[#123f2d]' : 'border-transparent')}><img src={foto.url} alt="" className="h-16 w-24 object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => fallo(foto)}/></button>)}</div>}
      {actual?.descripcion && <p className="mb-3 text-sm leading-relaxed text-[#65715f]">{actual.descripcion}</p>}
      {error && <p role="alert" className="mb-3 text-sm text-[#842a20]">{error}</p>}
      {(faltantes > 0 || fallidas.some(url => fotos.some(foto => foto.url === url))) && <p className="mb-3 text-sm text-[#65715f]">Algunas fotografías no están disponibles por ahora.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">{disponibles.length} {disponibles.length === 1 ? 'fotografía pública' : 'fotografías públicas'}</span><button type="button" disabled={loading} onClick={recargar} className="km-button"><Icon name="refresh" size={16}/>Actualizar fotografías</button></div>
    </div>
  </section>;
}
