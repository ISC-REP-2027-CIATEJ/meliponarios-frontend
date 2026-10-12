import { useEffect, useMemo, useRef, useState } from 'react';
import { meliponarios, municipios, especies, filtrarMeliponarios } from '../../data/meliponarios';
import { filtrosIniciales } from '../../data/filtros';
import { distanciaKm, ubicacionesDemo } from '../../data/ubicacionesDemo';
import Icon from '../Explore/Icon';
import MapCanvas from './MapCanvas';

const boton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d6dece] px-4 py-2 text-sm font-semibold transition-colors';
const claro = `${boton} bg-white text-[#163e2c] hover:bg-[#edf1e7]`;
const oscuro = `${boton} bg-[#123f2d] text-white hover:bg-[#23583e]`;
const imagen = nombre => `${import.meta.env.BASE_URL}images/meliponarios/${nombre}`;
const datosMapa = meliponarios.map(m => ({ ...m, coordenadas: ubicacionesDemo[m.id] })).filter(m => m.coordenadas);

export default function MapPage({ filtros, onFiltrosChange, onExplore, onLogin }) {
  const mapa = useRef(null);
  const ficha = useRef(null);
  const dialogo = useRef(null);
  const solicitud = useRef(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [mostrarPuntos, setMostrarPuntos] = useState(true);
  const [seleccionId, setSeleccionId] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [fotoAbierta, setFotoAbierta] = useState(null);
  const resultados = useMemo(() => filtrarMeliponarios(datosMapa, filtros), [filtros]);
  const ordenados = useMemo(() => ubicacion ? [...resultados].sort((a, b) => distanciaKm(ubicacion.coordenadas, a.coordenadas) - distanciaKm(ubicacion.coordenadas, b.coordenadas)) : resultados, [resultados, ubicacion]);
  const seleccionado = resultados.find(m => m.id === seleccionId);
  const hayFiltros = Object.values(filtros).some(Boolean);

  useEffect(() => () => { solicitud.current++; }, []);
  useEffect(() => { if (!resultados.some(m => m.id === seleccionId)) setSeleccionId(null); }, [resultados, seleccionId]);
  const cambiar = (campo, valor) => onFiltrosChange(anterior => ({ ...anterior, [campo]: valor }));
  function seleccionar(id) {
    const punto = resultados.find(m => m.id === id);
    if (!punto) return;
    setSeleccionId(id);
    setMostrarPuntos(true);
    mapa.current?.seleccionar(punto);
    // La ficha recibe el foco para anunciar la selección también con teclado.
    requestAnimationFrame(() => {
      ficha.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1023px)').matches) ficha.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function localizar() {
    if (localizando) return;
    if (!navigator.geolocation || !window.isSecureContext) { setAviso('Tu navegador no permite obtener la ubicación aquí. Puedes seguir explorando el mapa.'); return; }
    setLocalizando(true); setAviso('Solicitando tu ubicación…');
    const token = ++solicitud.current;
    navigator.geolocation.getCurrentPosition(pos => {
      if (solicitud.current !== token) return;
      const valor = { coordenadas: [pos.coords.latitude, pos.coords.longitude], precision: pos.coords.accuracy };
      setUbicacion(valor); setLocalizando(false);
      setAviso('Lista ordenada por cercanía. Las distancias son en línea recta a puntos de demostración.');
      mapa.current?.localizar(valor.coordenadas);
    }, error => {
      if (solicitud.current !== token) return;
      setLocalizando(false);
      setAviso(error.code === 1 ? 'No se autorizó la ubicación. Puedes usar los filtros y el mapa sin compartirla.' : error.code === 3 ? 'La ubicación tardó demasiado. Puedes intentarlo de nuevo.' : 'No se pudo obtener tu ubicación. Puedes seguir explorando el mapa.');
    }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false });
  }
  function quitarUbicacion() { solicitud.current++; setUbicacion(null); setLocalizando(false); setAviso('Ubicación retirada.'); }
  function abrirFoto(m) { setFotoAbierta(m); dialogo.current.showModal(); }

  return <div className="map-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
    <header className="border-0 border-b border-solid border-[#e0e5d7] bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><span className="text-[#ac7c20]"><Icon name="bee" size={34}/></span><div><span className="text-2xl font-extrabold tracking-tight">KaabMap</span><p className="pt-1 text-[10px] tracking-[0.2em]">MELIPONARIOS DE YUCATÁN</p></div></div>
        <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-2"><button className={claro} onClick={onExplore}>Explorar</button><span aria-current="page" className={`${boton} bg-[#edf1e7]`}><Icon name="map"/>Mapa</span><button className={claro} onClick={onLogin}>Iniciar sesión</button></nav>
      </div>
    </header>
    <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">Explora la península</h1><p className="mt-2 text-sm leading-relaxed text-[#65715f]">Yucatán · Campeche · Quintana Roo</p></div><span className="rounded-full bg-[#fff0bf] px-4 py-2 text-xs font-semibold text-[#765310]">Ubicaciones de demostración</span></div>
      <section aria-label="Buscar meliponarios en el mapa" className="mb-5">
        <div className="flex items-center gap-3 rounded-2xl border border-solid border-[#dce1d4] bg-white px-4 py-2 shadow-sm"><Icon name="search"/><label className="sr-only" htmlFor="buscar-mapa">Buscar meliponario, municipio o especie</label><input id="buscar-mapa" className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base text-[#163e2c]" type="search" value={filtros.busqueda} onChange={e => cambiar('busqueda', e.target.value)} placeholder="¿Dónde quieres explorar?"/><button className={claro} aria-label="Filtros" aria-expanded={filtrosAbiertos} aria-controls="filtros-mapa" onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}><Icon name="filter"/><span className="hidden sm:inline">Filtros</span></button></div>
        <div className="mt-3 flex flex-wrap gap-2"><button className={ubicacion ? oscuro : claro} disabled={localizando} onClick={localizar}><Icon name="pin"/>{localizando ? 'Buscando ubicación…' : 'Cerca de mí'}</button><button className={filtros.conProductos ? oscuro : claro} aria-pressed={filtros.conProductos} onClick={() => cambiar('conProductos', !filtros.conProductos)}><Icon name="bag"/>Con productos</button><button className={filtros.activos ? oscuro : claro} aria-pressed={filtros.activos} onClick={() => cambiar('activos', !filtros.activos)}><Icon name="sun"/>Activos</button>{hayFiltros && <button className={claro} onClick={() => onFiltrosChange({ ...filtrosIniciales })}>Limpiar filtros</button>}{ubicacion && <button className={claro} onClick={quitarUbicacion}>Quitar mi ubicación</button>}</div>
        {filtrosAbiertos && <div id="filtros-mapa" className="mt-3 grid gap-4 rounded-2xl bg-[#edf1e7] p-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Municipio<select aria-label="Municipio" className="min-h-12 w-full rounded-lg border border-solid border-[#d1d8c9] bg-white px-3" value={filtros.municipio} onChange={e => cambiar('municipio', e.target.value)}><option value="">Todos los municipios</option>{municipios.map(m => <option key={m}>{m}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Especie<select aria-label="Especie" className="min-h-12 w-full rounded-lg border border-solid border-[#d1d8c9] bg-white px-3" value={filtros.especie} onChange={e => cambiar('especie', e.target.value)}><option value="">Todas las especies</option>{especies.map(e => <option key={e}>{e}</option>)}</select></label></div>}
        {aviso && <p className="mt-3 rounded-xl bg-[#edf1e7] px-4 py-3 text-sm leading-relaxed" role="status">{aviso}</p>}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section aria-label="Vista del mapa" className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex flex-wrap items-center gap-2"><button className={oscuro} onClick={() => mapa.current?.peninsula()}><Icon name="map"/>Ver península</button><button className={claro} disabled={!resultados.length} onClick={() => { setMostrarPuntos(true); mapa.current?.resultados(); }}>Ver resultados</button><button className={claro} aria-expanded={capasAbiertas} aria-controls="capas-mapa" onClick={() => setCapasAbiertas(!capasAbiertas)}><Icon name="layers"/>Capas</button><button className={`${claro} lg:ml-auto`} onClick={onExplore}>Ver lista <Icon name="arrow"/></button></div>
          {capasAbiertas && <div id="capas-mapa" className="mb-3 rounded-xl border border-solid border-[#dce1d4] bg-white p-4"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[#164c35]" checked={mostrarPuntos} onChange={e => setMostrarPuntos(e.target.checked)}/>Mostrar meliponarios</label><p className="mt-1 text-xs text-[#65715f]">Mapa base: OpenStreetMap</p></div>}
          <div className="h-[60svh] min-h-[420px] overflow-hidden rounded-3xl border border-solid border-[#d6dece] shadow-sm lg:h-[650px]">
            <MapCanvas ref={mapa} puntos={resultados} seleccionId={seleccionado?.id} onSelect={seleccionar} ubicacion={ubicacion} mostrarPuntos={mostrarPuntos}/>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#53634e]"><span>🟢 Activo</span><span>🟡 Pendiente</span><span>Número = grupo de meliponarios</span></div><p className="mt-3 text-xs leading-relaxed text-[#65715f]">Arrastra para recorrer el mapa. Usa + / − o dos dedos para acercarte. Los puntos son ejemplos cercanos a cabeceras municipales, no direcciones reales.</p>
        </section>
        <aside className="order-2 min-w-0 lg:order-1" aria-label="Meliponarios del mapa">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{ubicacion ? 'Ordenados por cercanía' : 'Meliponarios'}</h2><span role="status" className="rounded-full bg-[#e8edde] px-3 py-2 text-xs">{resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}</span></div>
          <div ref={ficha} tabIndex={-1} className="mb-4 rounded-2xl border border-solid border-[#d7dfcf] bg-white p-4" aria-label={seleccionado ? `Seleccionado: ${seleccionado.nombre}` : 'Selecciona un meliponario'}>
            {seleccionado ? <><div className="mb-3 flex items-start justify-between gap-2"><p className="text-xs font-bold tracking-wide text-[#8a6a20]">MELIPONARIO SELECCIONADO</p><button className="min-h-11 min-w-11 rounded-full border-0 bg-[#edf1e7]" aria-label="Cerrar selección" onClick={() => setSeleccionId(null)}>×</button></div><button className="block w-full border-0 bg-transparent p-0" onClick={() => abrirFoto(seleccionado)} aria-label={`Ampliar foto de ${seleccionado.nombre}`}><img src={imagen(seleccionado.imagen)} alt={`Imagen ilustrativa de ${seleccionado.nombre}`} className="block aspect-[3/2] w-full rounded-xl object-cover"/></button><h3 className="mt-3 text-lg font-bold">{seleccionado.nombre}</h3><p className="mt-2 text-sm text-[#65715f]">{seleccionado.municipio}, Yucatán · {seleccionado.estado}</p><p className="mt-3 text-sm leading-relaxed">{seleccionado.descripcion}</p><p className="mt-3 text-sm">{seleccionado.colonias} colonias · {seleccionado.especies.length} {seleccionado.especies.length === 1 ? 'especie' : 'especies'}</p><p className="mt-2 text-sm text-[#65715f]">{seleccionado.productos.join(' · ') || 'Sin productos publicados'}</p></> : <><span className="text-[#b58a28]"><Icon name="bee" size={30}/></span><p className="mt-3 font-semibold">Cada punto, una historia</p><p className="mt-2 text-sm leading-relaxed text-[#65715f]">Toca una abeja en el mapa o elige una tarjeta para conocer el meliponario.</p></>}
          </div>
          {!resultados.length && <div className="rounded-2xl bg-white p-5"><h3 className="text-base">No hay coincidencias</h3><p className="my-3 text-sm text-[#65715f]">Prueba otro municipio o quita algunos filtros.</p><button className={claro} onClick={() => onFiltrosChange({ ...filtrosIniciales })}>Ver todos</button></div>}
          <div className="grid gap-3">{ordenados.map(m => <button key={m.id} aria-pressed={seleccionado?.id === m.id} onClick={() => seleccionar(m.id)} className={`flex w-full items-center gap-3 rounded-2xl border border-solid p-3 text-left hover:bg-[#edf1e7] ${seleccionado?.id === m.id ? 'border-[#164c35] bg-[#edf1e7]' : 'border-[#e0e5d7] bg-white'}`}><img src={imagen(m.imagen)} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover"/><span className="min-w-0"><span className="block text-sm font-bold leading-snug">{m.nombre}</span><span className="mt-1 block text-xs text-[#65715f]">{m.municipio} · {m.estado}</span><span className="mt-2 block text-xs">{m.especies.length} {m.especies.length === 1 ? 'especie' : 'especies'}{m.productos.length > 0 ? ' · Con productos' : ''}</span>{ubicacion && <span className="mt-2 block text-xs text-[#765310]">≈ {distanciaKm(ubicacion.coordenadas, m.coordenadas).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km · punto demo</span>}</span></button>)}</div>
        </aside>
      </div>
    </main>
    <dialog ref={dialogo} aria-labelledby="foto-titulo" className="m-auto w-[calc(100%-32px)] max-w-3xl rounded-3xl border border-solid border-[#dce1d4] bg-[#faf9f5] p-5 text-[#163e2c]">{fotoAbierta && <><div className="mb-4 flex items-center justify-between gap-3"><h2 id="foto-titulo" className="text-lg font-bold">{fotoAbierta.nombre}</h2><button className={claro} onClick={() => dialogo.current.close()}>Cerrar</button></div><img src={imagen(fotoAbierta.imagen)} alt={`Vista ilustrativa ampliada de ${fotoAbierta.nombre}`} className="block max-h-[65svh] w-full rounded-xl object-contain"/></>}</dialog>
  </div>;
}
