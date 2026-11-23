import { useImperativeHandle, useRef, useState } from 'react';
import Icon from '../Explore/Icon';
import { categoriasProducto, crearProducto, imagenesProducto, normalizarProducto, presentacionProducto, tiposProducto, unidadesProducto, validarProducto } from '../../features/ownerMeliponarios/productos';

const button = 'km-button';

export function ProductImage({ imageId, name = '', small = false }) {
  const file = imagenesProducto[imageId];
  return file ? <img src={`${import.meta.env.BASE_URL}images/detalle/${file}`} alt={`Imagen ilustrativa de catálogo para ${name}`} className={`block w-full rounded-2xl object-cover ${small ? 'aspect-square' : 'aspect-[4/3]'}`}/> : <div role="img" aria-label="Ilustración de producto de catálogo" className={`grid w-full place-items-center rounded-2xl bg-[#edf2e4] text-[#9d7b2c] ${small ? 'aspect-square' : 'aspect-[4/3]'}`}><Icon name="bag" size={small ? 30 : 58}/></div>;
}

export default function OwnerProducts({ value = [], onChange, onDirty, readOnly, editorRef }) {
  const [product, setProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const titleRef = useRef(null);
  const composer = useRef(null);
  const selectedType = tiposProducto.find(item => item.id === product?.tipoId);
  useImperativeHandle(editorRef, () => ({
    validatePending() {
      if (!product) return true;
      setError('Agrega el producto que estás preparando o cancela esta tarjeta antes de guardar el meliponario.');
      composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titleRef.current?.focus();
      return false;
    },
  }), [product]);

  function change(field, next) { setProduct(previous => ({ ...previous, [field]: next })); setError(''); onDirty(); }
  function begin(typeId) { setProduct(crearProducto(typeId)); setEditing(null); setError(''); onDirty(); }
  function cancel() { setProduct(null); setEditing(null); setError(''); }
  function commit() {
    const others = value.filter((_, index) => index !== editing);
    const invalid = validarProducto(product, others);
    if (invalid) { setError(invalid); titleRef.current?.focus(); return; }
    const next = normalizarProducto(product);
    onChange(editing === null ? [...value, next] : value.map((item,index) => index === editing ? next : item));
    cancel();
  }

  return <div>
    {!!value.length && <div className="mb-6 grid gap-4 sm:grid-cols-2">{value.map((item,index) => <article key={item.id} className="overflow-hidden rounded-2xl border border-solid border-[#dce5d3] bg-[#fafcf6]"><div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4 p-4"><ProductImage imageId={item.imagenId} name={item.nombre} small/><div className="min-w-0"><span className="text-[11px] font-semibold uppercase tracking-wide text-[#8b7134]">{categoriasProducto.find(category => category.id === item.categoria)?.nombre}</span><h3 className="mt-2 break-words text-lg font-bold">{item.nombre}</h3>{presentacionProducto(item) && <p className="mt-2 text-sm text-[#67765d]">{presentacionProducto(item)}</p>}<p className="mt-2 text-[11px] text-[#7a856e]">Imagen ilustrativa de catálogo</p></div></div>{!readOnly && <div className="flex justify-end gap-2 border-0 border-t border-solid border-[#e1e8d9] p-3"><button type="button" className={button} aria-label={`Editar ${item.nombre} ${presentacionProducto(item)}`} onClick={() => { setProduct(crearProducto('',item)); setEditing(index); setError(''); onDirty(); }}>Editar</button><button type="button" className={button} aria-label={`Quitar ${item.nombre} ${presentacionProducto(item)}`} onClick={() => { onChange(value.filter((_,i) => i !== index)); cancel(); }}>Quitar</button></div>}</article>)}</div>}
    {!readOnly && !product && <div className="rounded-2xl border border-dashed border-[#c9d6bb] bg-[#f7f9f0] p-4 sm:p-5"><h3 className="text-base font-bold">¿Qué producto quieres mostrar?</h3><p className="mb-4 mt-2 text-sm leading-relaxed text-[#69785f]">Elige uno para empezar. Puedes agregar varias presentaciones de un mismo producto.</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{tiposProducto.map(item => <button key={item.id} type="button" className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-solid border-[#dbe4d1] bg-white p-3 text-sm font-semibold text-[#315239] hover:border-[#8ba476] hover:bg-[#edf3e4]" onClick={() => begin(item.id)} aria-label={`Preparar producto: ${item.nombre}`}><Icon name={item.id === 'miel' ? 'bee' : 'bag'} size={23}/>{item.nombre}</button>)}</div></div>}
    {!readOnly && product && <div ref={composer} className="rounded-3xl border border-solid border-[#c9d9bd] bg-[#f5f9ee] p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-[#927334]">TU PRODUCTO</p><h3 className="mt-2 text-xl font-bold">{editing === null ? 'Prepara una nueva tarjeta' : 'Edita esta tarjeta'}</h3></div><button type="button" className={button} onClick={cancel}>Cancelar tarjeta</button></div>
      <div className="grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)]"><div><ProductImage imageId={product.imagenId} name={product.nombre}/><p className="mt-3 text-xs leading-relaxed text-[#6f7d64]">Imagen de catálogo. Las fotografías propias necesitarán revisión antes de publicarse.</p>{selectedType?.imagenId !== 'generica' && <fieldset className="mt-4 grid gap-2"><legend className="mb-2 text-sm font-semibold">Imagen de la tarjeta</legend>{[[selectedType?.imagenId,'Imagen ilustrativa'],['generica','Ilustración general']].map(([id,label]) => <label className="flex items-center gap-2 text-sm font-normal" key={id}><input type="radio" name="imagen-producto" checked={product.imagenId === id} onChange={() => change('imagenId',id)}/>{label}</label>)}</fieldset>}</div>
      <div className="grid gap-4"><div><label htmlFor="producto-nombre">Nombre del producto</label><input ref={titleRef} id="producto-nombre" className="owner-field" maxLength={100} value={product.nombre} placeholder="Ej. Miel de abejas nativas" onChange={event => change('nombre',event.target.value)}/></div><div><label htmlFor="producto-categoria">Categoría</label><select id="producto-categoria" className="owner-field" value={product.categoria} onChange={event => change('categoria',event.target.value)}>{categoriasProducto.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
      <div className="rounded-2xl bg-white p-4"><p className="text-sm font-semibold">Contenido por envase <span className="font-normal text-[#74816a]">· opcional</span></p>{product.tipoId === 'miel' && <div className="my-3 flex flex-wrap gap-2" aria-label="Presentaciones frecuentes de miel">{[50,100,250,500,1000].map(amount => <button type="button" key={amount} aria-pressed={Number(product.cantidad) === amount && product.unidad === 'mL'} className={`${button} ${Number(product.cantidad) === amount && product.unidad === 'mL' ? '!border-[#587c43] !bg-[#e8f0df]' : ''}`} onClick={() => { setProduct(previous => ({...previous,cantidad:amount,unidad:'mL'})); setError(''); onDirty(); }}>{amount} mL</button>)}</div>}<div className="mt-3 grid grid-cols-[minmax(0,1fr)_105px] gap-3"><div><label htmlFor="producto-cantidad">Cantidad</label><input id="producto-cantidad" className="owner-field" type="number" min="0.001" max="1000000" step="any" value={product.cantidad} placeholder="Ej. 250" onChange={event => change('cantidad',event.target.value)}/></div><div><label htmlFor="producto-unidad">Unidad</label><select id="producto-unidad" className="owner-field" value={product.unidad} onChange={event => change('unidad',event.target.value)}>{unidadesProducto.map(item => <option key={item}>{item}</option>)}</select></div></div><div className="mt-4"><label htmlFor="producto-presentacion">Tipo de envase o presentación <span className="font-normal text-[#74816a]">· opcional</span></label><input id="producto-presentacion" className="owner-field" maxLength={80} value={product.presentacion} placeholder="Ej. Gotero, frasco o barra" onChange={event => change('presentacion',event.target.value)}/></div></div>
      <p className="text-xs leading-relaxed text-[#728067]">La categoría organiza la tarjeta; no certifica propiedades medicinales.</p>
      </div></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e9] p-3 text-sm text-[#92422c]">{error}</p>}
      <div className="mt-5 flex justify-end"><button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-full border-0 bg-[#16462f] px-6 py-3 text-sm font-bold text-white hover:bg-[#2d5b3d]" onClick={commit}><Icon name="bag" size={18}/>{editing === null ? 'Agregar producto' : 'Guardar producto'}</button></div>
    </div>}
    {readOnly && !value.length && <p className="py-4 text-sm text-[#6a785f]">No agregaste productos a esta solicitud.</p>}
    {!readOnly && <p className="mt-4 text-xs leading-relaxed text-[#718064]">Este apartado es opcional. Las tarjetas se guardan junto con el borrador y quedan bloqueadas al simular el envío.</p>}
  </div>;
}
