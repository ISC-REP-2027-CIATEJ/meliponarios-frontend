import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { almacenProductos } from '../../features/adminProducts/catalogStorage.mjs';
import { rutaObjeto } from '../../features/adminProducts/catalogApi.mjs';
import Icon from '../Explore/Icon';

// Solo descarga la imagen asociada al producto en el catálogo real.
export default function FotoProductoCatalogo({ ruta, nombre, grande = false }) {
  const contenedor = useRef(null);
  const [imagen, mostrar] = useState(null);
  useEffect(() => {
    if (!ruta || !almacenProductos.bucket) return;
    let vigente = true;
    let iniciada = false;
    let temporal;
    const fallo = () => { if (vigente) mostrar({ ruta, fallo: true }); };
    async function cargar() {
      if (iniciada || !vigente) return;
      iniciada = true;
      try {
        const { data, error } = await supabase.storage.from(almacenProductos.bucket).download(rutaObjeto(ruta));
        if (error || !data?.size || !almacenProductos.tipos.includes(data.type) ||
            data.size > almacenProductos.maxBytes) throw new Error('Foto no disponible');
        if (vigente) {
          temporal = URL.createObjectURL(data);
          mostrar({ ruta, url: temporal });
        }
      } catch { fallo(); }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); cargar(); }
    }, { rootMargin: '180px' });
    if (observer) observer.observe(contenedor.current);
    else cargar();
    return () => { vigente = false; observer?.disconnect(); if (temporal) URL.revokeObjectURL(temporal); };
  }, [ruta]);
  const foto = imagen?.ruta === ruta && !imagen.fallo ? imagen.url : null;
  const faltante = !ruta || !almacenProductos.bucket || (imagen?.ruta === ruta && imagen.fallo);
  return <span ref={contenedor} className={'owner-product-photo' + (grande ? ' owner-product-photo--large' : '')}>
    {foto ? <img src={foto} alt={'Fotografía de ' + nombre} decoding="async" onError={() => mostrar({ ruta, fallo: true })}/>
      : <span className="owner-product-placeholder" role="img" aria-label={(faltante ? 'Fotografía no disponible de ' : 'Cargando fotografía de ') + nombre}>
        <Icon name="bag" size={grande ? 27 : 22}/><span>{faltante ? 'Sin foto' : 'Cargando'}</span>
      </span>}
  </span>;
}

