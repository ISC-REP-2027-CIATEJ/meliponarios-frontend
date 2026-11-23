import { useId, useState } from 'react';
import Icon from '../../pages/Explore/Icon';
import { filtrarPublicos } from './publicApi.mjs';
import './PublicBrowseControls.css';

export const ofertasPublicas = [
  { value: 'miel', icon: 'honey', label: 'Miel' },
  { value: 'difusion', icon: 'visit', label: 'Visitas' },
  { value: 'ambos', icon: 'both', label: 'Miel y visitas' },
];

export function filtrarVistaPublica(items, filtros) {
  return filtrarPublicos(items, filtros).filter(item =>
    (!filtros.localidad || item.localidad === filtros.localidad) &&
    (!filtros.oferta || item.ofertaVisualDemo === filtros.oferta),
  );
}

export function OfertaTag({ item }) {
  const oferta = ofertasPublicas.find(option => option.value === item.ofertaVisualDemo);
  return oferta ? <span className="km-tag" data-tone={oferta.value}>{oferta.label}</span> : null;
}

export function PublicSearch({ value, onChange, children, placeholder = 'Buscar por nombre, lugar o especie' }) {
  const id = useId();
  return <div className="km-search">
    <label htmlFor={id} className="km-search-label"><Icon name="search"/><span className="sr-only">Buscar por nombre, lugar o especie</span></label>
    <input id={id} type="search" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}/>
    {children}
  </div>;
}

function FilterSelect({ icon, label, value, options, onChange }) {
  return <label className="km-filter-select">
    <Icon name={icon} size={15}/>
    <select aria-label={label} value={value ?? ''} onChange={event => onChange(event.target.value)}>
      <option value="">{label}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span className="km-filter-chevron"><Icon name="chevron" size={14}/></span>
  </label>;
}

function opciones(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')).map(value => ({ value, label: value }));
}

export function PublicFilters({ items, filtros, update, clear }) {
  const [more, setMore] = useState(false);
  const id = useId();
  const municipios = opciones(items.map(item => item.municipio));
  const localidades = opciones(items.filter(item => !filtros.municipio || item.municipio === filtros.municipio).map(item => item.localidad));
  const especies = opciones(items.flatMap(item => item.especies));
  const productosDisponibles = items.some(item => item.productosDisponibles);
  return <>
    <div className="km-filters" aria-label="Filtros de meliponarios">
      <FilterSelect icon="both" label="Municipio" value={filtros.municipio} options={municipios} onChange={municipio => update({ municipio, localidad: '' })}/>
      <FilterSelect icon="pin" label="Localidad" value={filtros.localidad} options={localidades} onChange={localidad => update({ localidad })}/>
      <FilterSelect icon="honey" label="Oferta" value={filtros.oferta} options={ofertasPublicas} onChange={oferta => update({ oferta })}/>
      <button type="button" className="km-button" aria-expanded={more} aria-controls={more ? id : undefined} onClick={() => setMore(value => !value)}><Icon name="filter" size={16}/>Filtros</button>
      {Object.values(filtros).some(Boolean) && <button type="button" className="km-button km-button--quiet" onClick={clear}>Limpiar</button>}
    </div>
    {more && <div className="km-panel km-extra-filters" id={id}>
      <label><input type="checkbox" checked={filtros.activos} onChange={event => update({ activos: event.target.checked })}/>Verificación técnica</label>
      {especies.length ? <FilterSelect icon="bee" label="Especie" value={filtros.especie} options={especies} onChange={especie => update({ especie })}/> : null}
      {productosDisponibles && <label><input type="checkbox" checked={filtros.conProductos} onChange={event => update({ conProductos: event.target.checked })}/>Con productos</label>}
      {(!especies.length || !productosDisponibles) && <p>Los filtros de especies y productos aparecen cuando esos datos están disponibles.</p>}
    </div>}
  </>;
}
