import { useRef, useState } from 'react';
import { meliponarios, municipios, especies, filtrarMeliponarios } from '../../data/meliponarios';
import Icon from './Icon';
import './ExplorePage.css';

const imagen = nombre => `${import.meta.env.BASE_URL}images/meliponarios/${nombre}`;
const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d8ded3] px-5 py-2 text-sm font-semibold transition-colors hover:bg-[#e9eee3]';
function Filtro({ activo, children, ...props }) {
  return <button type="button" aria-pressed={activo} className={`${boton} ${activo ? 'bg-[#123f2d] text-white hover:bg-[#23583e]' : 'bg-white text-[#193e2d]'}`} {...props}>{children}</button>;
}

export default function ExplorePage({ onLogin, onOpenMap, onOpenDetail }) {
  const [busqueda, setBusqueda] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [especie, setEspecie] = useState('');
  const [conProductos, setConProductos] = useState(false);
  const [activos, setActivos] = useState(false);
  const [filtros, setFiltros] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [ampliada, setAmpliada] = useState(false);
  const dialogo = useRef(null);
  const resultados = filtrarMeliponarios(meliponarios, { busqueda, municipio, especie, conProductos, activos });
  const hayFiltros = busqueda || municipio || especie || conProductos || activos;
  function limpiar() { setBusqueda(''); setMunicipio(''); setEspecie(''); setConProductos(false); setActivos(false); }
  function abrir(m, foto = false) { setSeleccion(m); setAmpliada(foto); dialogo.current.showModal(); }

  return <div className="explore-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
    <a href="#contenido" className="sr-only focus:not-sr-only">Saltar al contenido</a>
    <header className="border-0 border-b border-solid border-[#e3e6db] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 lg:px-10">
        <div className="flex items-center gap-3"><span className="text-[#ac7c20]"><Icon name="bee" size={36}/></span><div><span className="text-2xl font-extrabold tracking-tight">KaabMap</span><p className="pt-1 text-[10px] font-semibold tracking-[0.22em]">MELIPONARIOS DE YUCATÁN</p></div></div>
        <nav aria-label="Navegación principal" className="flex items-center gap-3"><a href="#contenido" aria-current="page" className={`${boton} bg-[#edf1e7] text-[#163e2c] no-underline`}>Explorar</a>{onLogin && <button className={`${boton} bg-white`} onClick={onLogin}>Iniciar sesión <Icon name="arrow"/></button>}</nav>
      </div>
    </header>
    <main id="contenido" className="mx-auto max-w-7xl px-5 pb-14 pt-10 lg:px-10">
      <section aria-labelledby="titulo" className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><p className="mb-3 text-xs font-bold tracking-[0.2em] text-[#7a662e]">ABEJAS NATIVAS · SABERES LOCALES</p><h1 id="titulo" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Explorar meliponarios</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-[#637063]">Conoce a quienes cuidan de las abejas sin aguijón.<br className="hidden sm:block"/> Descubre sus meliponarios y lo que producen.</p></div>
        <span className="rounded-full bg-[#e8edde] px-4 py-2 text-xs font-semibold">Datos e imágenes de demostración</span>
      </section>
      <section aria-label="Buscar y filtrar" className="mb-9">
        <div className="flex items-center gap-2 rounded-2xl border border-solid border-[#dce1d4] bg-white p-2 pl-5 shadow-sm">
          <Icon name="search" size={23}/><label className="sr-only" htmlFor="buscar">Buscar meliponario, municipio o especie</label><input id="buscar" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="¿Dónde quieres explorar?"/><button className={`${boton} bg-[#edf1e7]`} aria-label="Filtros" aria-expanded={filtros} aria-controls="filtros" onClick={() => setFiltros(!filtros)}><Icon name="filter"/><span className="hidden sm:inline">Filtros</span></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Filtro activo={especie === 'Melipona beecheii'} onClick={() => setEspecie(especie === 'Melipona beecheii' ? '' : 'Melipona beecheii')}><Icon name="bee"/>Melipona beecheii</Filtro>
          <Filtro activo={conProductos} onClick={() => setConProductos(!conProductos)}><Icon name="bag"/>Con productos</Filtro>
          <Filtro activo={activos} onClick={() => setActivos(!activos)}><Icon name="sun"/>Activos</Filtro>
          {hayFiltros && <button className="min-h-11 border-0 bg-transparent px-3 text-sm text-[#52634f] underline" onClick={limpiar}>Limpiar filtros</button>}
        </div>
        {filtros && <div id="filtros" className="mt-4 grid gap-4 rounded-2xl bg-[#ecefe5] p-5 sm:grid-cols-2">
          <label htmlFor="municipio" className="grid gap-2">Municipio<select aria-label="Municipio" id="municipio" className="min-h-12 w-full rounded-lg border border-solid border-[#ccd4c5] bg-white px-3 text-[#163e2c]" value={municipio} onChange={e => setMunicipio(e.target.value)}><option value="">Todos los municipios</option>{municipios.map(m => <option key={m}>{m}</option>)}</select></label>
          <label htmlFor="especie" className="grid gap-2">Especie<select aria-label="Especie" id="especie" className="min-h-12 w-full rounded-lg border border-solid border-[#ccd4c5] bg-white px-3 text-[#163e2c]" value={especie} onChange={e => setEspecie(e.target.value)}><option value="">Todas las especies</option>{especies.map(e => <option key={e}>{e}</option>)}</select></label>
        </div>}
      </section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Meliponarios para descubrir</h2><p className="mt-2 text-sm text-[#637063]" role="status">{resultados.length} {resultados.length === 1 ? 'meliponario encontrado' : 'meliponarios encontrados'}</p></div>{onOpenMap ? <button className={`${boton} bg-[#123f2d] text-white hover:bg-[#23583e]`} onClick={() => onOpenMap({ busqueda, municipio, especie, conProductos, activos })}><Icon name="map"/>Ver mapa</button> : <span className="flex items-center gap-2 text-sm text-[#637063]"><Icon name="map"/>Mapa · siguiente entrega</span>}</div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {resultados.map(m => <article key={m.id} className="overflow-hidden rounded-3xl border border-solid border-[#e1e5d9] bg-white shadow-sm transition-shadow hover:shadow-lg">
          <div className="relative"><button onClick={() => abrir(m, true)} aria-label={`Ampliar foto de ${m.nombre}`} className="block w-full border-0 bg-[#dfe6d5] p-0"><img src={imagen(m.imagen)} alt={`Imagen ilustrativa de ${m.nombre}`} className="block aspect-[3/2] w-full object-cover"/></button><span className="pointer-events-none absolute left-4 top-4 rounded-full bg-[#123f2d] px-3 py-2 text-xs font-semibold text-white"><span className={m.estado === 'Activo' ? 'text-[#e4f1cf]' : 'text-[#ffd16b]'}>●</span> {m.estado}</span></div>
          <div className="p-5"><p className="mb-2 flex items-center gap-1 text-sm text-[#65705f]"><Icon name="pin" size={16}/>{m.municipio}, Yucatán</p><h3 className="text-xl font-bold">{m.nombre}</h3><p className="mt-4 flex items-center gap-2 text-sm"><span className="text-[#a7791e]"><Icon name="bee"/></span>{m.especies[0]}</p><p className="mt-1 pl-7 text-sm text-[#637063]">{m.especies.length > 1 ? `y ${m.especies.length - 1} ${m.especies.length === 2 ? 'especie más' : 'especies más'}` : 'Abeja nativa sin aguijón'}</p>
            <div className="mt-5 flex flex-wrap gap-2"><span className="flex items-center gap-1 rounded-lg bg-[#eef2e9] px-2 py-2 text-xs"><Icon name="layers" size={16}/>{m.especies.length} {m.especies.length === 1 ? 'especie' : 'especies'}</span><span className="rounded-lg bg-[#eef2e9] px-2 py-2 text-xs">{m.colonias} colonias</span>{m.productos.length > 0 && <span className="flex items-center gap-1 rounded-lg bg-[#fff0bf] px-2 py-2 text-xs text-[#77520d]"><Icon name="bag" size={16}/>Productos disponibles</span>}</div>
            <p className="mt-3 min-h-5 text-sm text-[#637063]">{m.productos.length ? m.productos.join(' · ') : 'Sin productos publicados'}</p><button className="mt-5 flex min-h-12 w-full items-center justify-between rounded-xl border-0 bg-[#123f2d] px-4 py-3 font-semibold text-white hover:bg-[#23583e]" onClick={() => onOpenDetail ? onOpenDetail(m.id) : abrir(m)}>Conocer meliponario<Icon name="arrow"/></button>
          </div>
        </article>)}
      </div>
      {!resultados.length && <div className="rounded-3xl border border-solid border-[#dce1d4] bg-white p-10 text-center"><h2 className="text-xl">No encontramos meliponarios</h2><p className="my-4 text-[#637063]">Prueba otro nombre o quita algunos filtros.</p><button className={`${boton} bg-[#edf1e7]`} onClick={limpiar}>Ver todos</button></div>}
      <p className="mt-8 text-center text-xs leading-relaxed text-[#637063]">Cada meliponario cuenta una historia de cuidado y conservación.<br/>Las fotografías son ilustrativas; los registros reales se incorporarán con el centro.</p>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-0 border-t border-solid border-[#e1e5d9] px-5 py-6 text-xs text-[#637063] lg:px-10"><span>KaabMap · Meliponarios de Yucatán</span><span>Conocer · Conservar · Conectar</span></footer>
    <dialog ref={dialogo} aria-labelledby="ficha-titulo" className="w-full max-w-2xl rounded-3xl border border-solid border-[#dce1d4] bg-[#faf9f5] p-5 text-[#163e2c]">
      {seleccion && <><div className="mb-4 flex items-center justify-between gap-4"><h2 id="ficha-titulo" className="text-xl font-bold">{seleccion.nombre}</h2><button className={`${boton} bg-white`} onClick={() => dialogo.current.close()} aria-label="Cerrar ficha"><Icon name="close"/></button></div><img className="block max-h-[60svh] w-full rounded-xl object-contain" src={imagen(seleccion.imagen)} alt={`Vista ampliada ilustrativa de ${seleccion.nombre}`}/>{!ampliada && <><p className="mt-4 font-semibold">{seleccion.municipio}, Yucatán · {seleccion.estado}</p><p className="mt-3 leading-relaxed">{seleccion.descripcion}</p><p className="mt-3 leading-relaxed">Especies: {seleccion.especies.join(', ')}.</p><p className="mt-3">Productos: {seleccion.productos.join(', ') || 'Sin productos publicados'}.</p><p className="mt-5 rounded-xl bg-[#edf1e7] p-3 text-sm">Ficha breve de demostración. El detalle completo se incorpora en la tercera entrega.</p></>}</>}
    </dialog>
  </div>;
}
