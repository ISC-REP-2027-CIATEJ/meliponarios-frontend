import { lazy, Suspense, useId, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import Icon from '../Explore/Icon';
import { FILTROS_INICIALES, NOTA_METODOLOGICA, RUTA_INVENTARIO, ESTADOS, cambiarFiltro, crearReporte, esInvestigador, fechaVisible, filtrarInventario, instanteVisible, numero, opcionesTerritoriales, resumirInventario, sumarMedida, textoEstado } from '../../features/research/inventarioModel.mjs';
import './ResearchDashboardPage.css';

const ResearchMap = lazy(() => import('./ResearchMap'));
const boton = 'km-button';
const primario = 'km-button km-button--primary';
const SIN_REGISTROS = Object.freeze([]);

function Filtro({ titulo, valor, opciones, todos, cambiar }) {
  const id = useId();
  return <label className="research-filter" htmlFor={id}><span>{titulo}</span><select id={id} value={valor} onChange={event => cambiar(event.target.value)}>
    <option value="">{todos}</option>{opciones.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
  </select></label>;
}
function Indicador({ nombre, valor, detalle, icono }) {
  return <article className="research-metric"><div className="research-metric-head"><span>{nombre}</span><span className="research-icon"><Icon name={icono} size={19}/></span></div><strong>{valor}</strong><small>{detalle}</small></article>;
}
function Barras({ titulo, subtitulo, filas, elegido, elegir, pie }) {
  const maximo = Math.max(1, ...filas.map(fila => fila.total));
  return <section className="research-card"><div className="research-card-heading"><h2>{titulo}</h2><p>{subtitulo}</p></div>
    {filas.length ? <div className="research-bars">{filas.map(fila => <button type="button" key={fila.id} className="research-bar" aria-pressed={elegido === fila.id} onClick={() => elegir(elegido === fila.id ? '' : fila.id)}>
      <span className="research-bar-heading"><span>{fila.nombre}{fila.cientifico && <i>{fila.cientifico}</i>}</span><strong>{numero(fila.total)}</strong></span>
      <span className="research-bar-track" aria-hidden="true"><span style={{ width: `${fila.total / maximo * 100}%` }}/></span>
    </button>)}</div> : <p className="research-empty-small">Sin resultados con estos filtros.</p>}
    <p className="research-footnote">{pie}</p>
    <details className="research-chart-values"><summary>Consultar valores de la gráfica</summary><table><caption>{titulo}: meliponarios únicos</caption><thead><tr><th scope="col">Categoría</th><th scope="col">Meliponarios</th></tr></thead><tbody>{filas.map(fila => <tr key={fila.id}><th scope="row">{fila.nombre}</th><td>{numero(fila.total)}</td></tr>)}</tbody></table></details>
  </section>;
}
const coloresEstado = { activo: '#08775B', inactivo: '#708B85', fuera_de_operacion: '#4D6588', sin_dato: '#A0AAA6' };
function Distribucion({ resumen, elegido, elegir }) {
  const circunferencia = 2 * Math.PI * 49;
  return <section className="research-card"><div className="research-card-heading"><h2>Estado de los meliponarios</h2><p>Distribución de los resultados actuales.</p></div><div className="research-distribution">
    <svg className="research-donut" viewBox="0 0 140 140" role="img" aria-label={`${numero(resumen.meliponarios)} meliponarios. Los valores por estado aparecen al lado.`}>
      <circle cx="70" cy="70" r="49" fill="none" stroke="#EDF2EC" strokeWidth="16"/>
      {resumen.estados.map((fila, indice) => {
        const longitud = fila.total / Math.max(resumen.meliponarios, 1) * circunferencia;
        const offset = resumen.estados.slice(0, indice).reduce((total, anterior) => total + anterior.total, 0) / Math.max(resumen.meliponarios, 1) * circunferencia;
        return <circle key={fila.id} cx="70" cy="70" r="49" fill="none" stroke={coloresEstado[fila.id] || coloresEstado.sin_dato} strokeWidth="16" strokeDasharray={`${longitud} ${circunferencia - longitud}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)"/>;
      })}
      <text x="70" y="70" textAnchor="middle" className="research-donut-number">{numero(resumen.meliponarios)}</text><text x="70" y="88" textAnchor="middle" className="research-donut-label">meliponarios</text>
    </svg>
    <ul className="research-legend">{resumen.estados.map(fila => <li key={fila.id}><button type="button" disabled={!ESTADOS[fila.id]} aria-pressed={elegido === fila.id} onClick={() => elegir(elegido === fila.id ? '' : fila.id)}>
      <span className="research-swatch" style={{ backgroundColor: coloresEstado[fila.id] || coloresEstado.sin_dato }}/><span>{fila.nombre}</span><strong>{numero(fila.total)}</strong><small>{Math.round(fila.total / Math.max(resumen.meliponarios, 1) * 100)}%</small>
    </button></li>)}</ul>
  </div><p className="research-footnote">Cada meliponario cuenta una vez. Selecciona un estado para filtrar.</p></section>;
}

export default function ResearchDashboardPage({ user, sessionReady, onLogout, route }) {
  return <div className="research-page km-with-nav"><OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout} current="investigacion"/>
    {!sessionReady ? <main className="km-container research-access" role="status">Comprobando tu sesión…</main>
      : !esInvestigador(user) ? <main className="km-container research-access"><div className="research-card"><h1>Espacio de investigación</h1><p>Este panel está disponible para las cuentas con el rol Investigador de consulta.</p><a href={user ? '#explorar' : '#login'} className={primario}>{user ? 'Volver al inicio' : 'Iniciar sesión'}</a></div></main>
        : <Dashboard key={user.id} route={route}/>}
  </div>;
}
function Dashboard({ route }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIALES });
  const [seleccion, setSeleccion] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [reporte, setReporte] = useState(null);
  const [exportando, setExportando] = useState('');
  const [aviso, setAviso] = useState('');
  const dialogo = useRef(null);
  const encabezado = useId();
  const registros = datos?.registros || SIN_REGISTROS;
  const opciones = useMemo(() => opcionesTerritoriales(registros, filtros), [registros, filtros]);
  const filtrados = useMemo(() => filtrarInventario(registros, filtros), [registros, filtros]);
  const resumen = useMemo(() => resumirInventario(filtrados), [filtrados]);
  const esInventario = route === RUTA_INVENTARIO;
  const cantidadFiltros = Object.values(filtros).filter(value => value.trim()).length;
  const porPagina = 10;
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const visibles = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  async function explorarEjemplo() {
    if (cargando) return;
    setCargando(true); setError('');
    try {
      const { crearInventarioEjemplo } = await import('../../features/research/inventarioEjemplo.mjs');
      setDatos(crearInventarioEjemplo());
      setFiltros({ ...FILTROS_INICIALES }); setSeleccion([]); setPagina(1);
    } catch { setError('No se pudo abrir la vista previa. Intenta de nuevo.'); }
    finally { setCargando(false); }
  }
  function volverConsulta() { setDatos(null); setFiltros({ ...FILTROS_INICIALES }); setSeleccion([]); setPagina(1); setAviso(''); }
  function filtrar(clave, valor) { setFiltros(actual => cambiarFiltro(actual, clave, valor)); setSeleccion([]); setPagina(1); setAviso(''); }
  function limpiar() { setFiltros({ ...FILTROS_INICIALES }); setSeleccion([]); setPagina(1); setAviso(''); }
  function seleccionar(id) { setSeleccion(actual => actual.includes(id) ? actual.filter(v => v !== id) : [...actual, id]); }
  function abrirReporte(alcance = 'filtrados') {
    try {
      setReporte(crearReporte({ datos, filtros, seleccion, alcance })); setError(''); setAviso('');
      dialogo.current.showModal();
    } catch (err) { setError(err.message); }
  }
  async function descargar(formato) {
    if (exportando || !reporte) return;
    setExportando(formato); setError('');
    try {
      const { exportarReporte } = await import('../../features/research/exportarInventario.mjs');
      await exportarReporte(reporte, formato);
      setAviso('Se generó el reporte ' + formato.toUpperCase() + '. Revisa las descargas de tu navegador.');
    } catch { setError('No se pudo generar el archivo. Conservamos tu selección para que vuelvas a intentarlo.'); }
    finally { setExportando(''); }
  }
  const valor = medida => datos ? numero(resumen[medida].total) : '—';
  const detalle = medida => !datos ? 'Pendiente de consulta' : resumen[medida].faltantes ? `${resumen[medida].faltantes} filas de especie sin dato` : 'Conteos registrados en las fichas';

  return <>
    <section className="research-hero"><div className="km-container research-hero-inner"><div className="research-hero-heading"><div><p className="research-eyebrow">KaabMap / Investigación</p><h1>Panorama de los meliponarios</h1><p className="research-hero-description">Explora el territorio, conoce las especies y construye tu reporte de inventario.</p></div><a href="#investigacion/inventario" className="research-hero-link"><Icon name="records" size={18}/>Inventario territorial<Icon name="next" size={16}/></a></div>
      <nav className="research-sections" aria-label="Secciones de investigación"><a href="#investigacion" aria-current={!esInventario ? 'page' : undefined}>Panorama general</a><a href="#investigacion/inventario" aria-current={esInventario ? 'page' : undefined}>Inventario territorial</a></nav>
    </div></section>
    <main className="km-container research-main">
      {datos ? <div className="research-example" role="status"><span><strong>Vista previa · datos de ejemplo</strong><span>Los nombres, cantidades y ubicaciones son ilustrativos. No son datos de CIATEJ.</span></span><button type="button" onClick={volverConsulta}>Volver a consulta real<Icon name="next" size={16}/></button></div>
        : <section className="research-connect"><span className="research-icon"><Icon name="layers" size={24}/></span><div><h2>Prepara tu espacio de investigación</h2><p>La consulta de inventario aún está pendiente de habilitar. Puedes explorar el diseño con datos de ejemplo.</p></div><button type="button" className={primario} disabled={cargando} onClick={explorarEjemplo}>{cargando ? 'Preparando vista…' : 'Explorar con datos de ejemplo'}</button></section>}
      <section className="research-filters" aria-labelledby={encabezado}><div className="research-filter-heading"><h2 id={encabezado}><Icon name="filter" size={18}/>Filtrar inventario</h2><button type="button" className="research-text-button" disabled={!cantidadFiltros} onClick={limpiar}>Limpiar filtros{cantidadFiltros ? ` (${cantidadFiltros})` : ''}</button></div>
        <fieldset disabled={!datos} className="research-filter-grid"><Filtro titulo="Zona" valor={filtros.zona} opciones={opciones.zonas} todos="Todas las zonas" cambiar={value => filtrar('zona', value)}/><Filtro titulo="Municipio" valor={filtros.municipio} opciones={opciones.municipios} todos="Todos los municipios" cambiar={value => filtrar('municipio', value)}/><Filtro titulo="Localidad" valor={filtros.localidad} opciones={opciones.localidades} todos="Todas las localidades" cambiar={value => filtrar('localidad', value)}/><Filtro titulo="Especie" valor={filtros.especie} opciones={opciones.especies} todos="Todas las especies" cambiar={value => filtrar('especie', value)}/><Filtro titulo="Estado operativo" valor={filtros.estado} opciones={Object.entries(ESTADOS).map(([id, nombre]) => ({ id, nombre }))} todos="Todos los estados" cambiar={value => filtrar('estado', value)}/><label className="research-filter"><span>Buscar</span><span className="research-search"><Icon name="search" size={17}/><input type="search" value={filtros.busqueda} placeholder="Meliponario, lugar o especie" onChange={event => filtrar('busqueda', event.target.value)}/></span></label></fieldset>
      </section>
      {error && !reporte && <p className="research-error" role="alert">{error}</p>}
      <div className="research-result-line"><span aria-live="polite">{datos ? <><strong>{numero(filtrados.length)}</strong> meliponarios encontrados · {numero(resumen.localidades)} localidades</> : 'Esperando la consulta de inventario'}</span><span>{datos ? 'Consulta: ' + instanteVisible(datos.fechaConsulta) + ' · CDMX' : 'Inventario vigente'}</span></div>
      <div className="research-metrics"><Indicador nombre="Meliponarios" valor={datos ? numero(resumen.meliponarios) : '—'} detalle="Registros únicos en la consulta" icono="home"/><Indicador nombre="Especies" valor={datos ? numero(resumen.especies) : '—'} detalle="Especies distintas registradas" icono="bee"/><Indicador nombre="Localidades" valor={datos ? numero(resumen.localidades) : '—'} detalle="Localidades representadas" icono="pin"/><Indicador nombre="Cajas" valor={valor('cajas')} detalle={detalle('cajas')} icono="records"/><Indicador nombre="Jobones" valor={valor('jobones')} detalle={detalle('jobones')} icono="layers"/></div>
      {!datos ? <section className="research-card research-empty"><Icon name="map" size={38}/><h2>Una mirada al territorio</h2><p>Aquí podrás consultar gráficas, ubicaciones y el inventario de los meliponarios autorizados para tu cuenta.</p></section>
        : esInventario ? <section className="research-card research-inventory"><div className="research-table-heading"><div><p className="research-eyebrow">Consulta y reportes</p><h2>Inventario territorial</h2><p>Selecciona meliponarios o descarga todos los resultados de tus filtros.</p></div><button type="button" className={primario} disabled={!filtrados.length} onClick={() => abrirReporte()}>Preparar reporte<Icon name="records" size={18}/></button></div>
          <div className="research-selection"><label><input type="checkbox" checked={filtrados.length > 0 && seleccion.length === filtrados.length} disabled={!filtrados.length} onChange={event => setSeleccion(event.target.checked ? filtrados.map(r => r.id) : [])}/>Seleccionar los {numero(filtrados.length)} resultados</label><span aria-live="polite">{numero(seleccion.length)} seleccionados</span>{seleccion.length > 0 && <button type="button" className="research-text-button" onClick={() => abrirReporte('seleccionados')}>Reporte de la selección</button>}</div>
          <div className="research-table-scroll" tabIndex="0" role="region" aria-label="Tabla de inventario territorial, desplazamiento horizontal"><table className="research-table"><caption className="sr-only">Inventario territorial. Cada fila corresponde a un meliponario. Los conteos respetan la especie seleccionada.</caption><thead><tr><th scope="col"><span className="sr-only">Seleccionar</span></th><th scope="col">Meliponario / territorio</th><th scope="col">Especies</th><th scope="col">Cajas</th><th scope="col">Jobones</th><th scope="col">Última ficha</th><th scope="col">Estado</th></tr></thead><tbody>{visibles.map(r => <tr key={r.id}><td><input type="checkbox" aria-label={'Seleccionar ' + r.nombre} checked={seleccion.includes(r.id)} onChange={() => seleccionar(r.id)}/></td><th scope="row"><strong>{r.nombre}</strong><span>{r.localidad} · {r.municipio}</span><small>{r.zonas.map(z => z.nombre).join(' / ') || 'Sin zona'}</small></th><td><ul className="research-species-list">{r.inventario.map(fila => <li key={fila.especieId}><strong>{fila.nombreComun}</strong><i>{fila.nombreCientifico}</i></li>)}</ul>{!r.inventario.length && 'Sin inventario'}</td>{['cajas', 'jobones'].map(medida => { const total = sumarMedida([r], medida); return <td className="research-numeric" key={medida}>{numero(total.total)}{total.faltantes > 0 && <small>{total.faltantes} sin dato</small>}</td>; })}<td>{fechaVisible(r.fechaFicha)}</td><td><span className={'research-badge research-badge--' + (r.estadoOperativo || 'sin_dato')}>{textoEstado(r.estadoOperativo)}</span><small>{textoEstado(r.visibilidad)}</small></td></tr>)}</tbody></table></div>
          {!filtrados.length && <p className="research-empty-small">No encontramos meliponarios con estos filtros. Prueba otra selección.</p>}
          <div className="research-pagination"><span>{filtrados.length ? `${(pagina - 1) * porPagina + 1}–${Math.min(pagina * porPagina, filtrados.length)} de ${filtrados.length} meliponarios` : '0 resultados'}</span><div><button type="button" className={boton} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {paginas}</span><button type="button" className={boton} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div></div>
        </section> : <>
          <div className="research-charts"><Barras titulo="Meliponarios por municipio" subtitulo="Identifica la distribución territorial." filas={resumen.municipios} elegido={filtros.municipio} elegir={value => filtrar('municipio', value)} pie="Selecciona una barra para consultar ese municipio."/><Barras titulo="Especies en el territorio" subtitulo="Meliponarios con presencia de cada especie." filas={resumen.distribucionEspecies} elegido={filtros.especie} elegir={value => filtrar('especie', value)} pie="Un meliponario puede tener varias especies. Los valores de estas barras no se suman entre sí."/></div>
          <div className="research-lower"><Distribucion resumen={resumen} elegido={filtros.estado} elegir={value => filtrar('estado', value)}/><section className="research-card research-map-card"><div className="research-card-heading"><h2>Distribución en el mapa</h2><p>{numero(filtrados.length - resumen.sinGPS)} puntos · {resumen.sinGPS ? `${numero(resumen.sinGPS)} registros sin ubicación` : 'Ubicaciones de los resultados filtrados'}</p></div><Suspense fallback={<p role="status" className="research-empty-small">Cargando mapa…</p>}><ResearchMap registros={filtrados}/></Suspense><p className="research-footnote">Los puntos se ajustan a los filtros. Consulta los datos completos en Inventario territorial.</p></section></div>
          <section className="research-report-callout"><div><span className="research-eyebrow">Del análisis al reporte</span><h2>El inventario que necesitas, listo para consultar</h2><p>Revisa los resultados por meliponario y elige el alcance de tu descarga.</p></div><a className={primario} href="#investigacion/inventario">Ver inventario<Icon name="arrow" size={18}/></a></section>
        </>}
      <aside className="research-method"><Icon name="check" size={20}/><div><h2>Cómo leer este inventario</h2><p>{NOTA_METODOLOGICA}</p>{datos && resumen.sinInventario > 0 && <p>{numero(resumen.sinInventario)} meliponarios no tienen inventario registrado en esta consulta.</p>}<p>La fecha indica la consulta actual; no representa una reconstrucción del inventario en meses anteriores.</p></div></aside>
    </main>
    <dialog ref={dialogo} className="research-report-dialog" aria-labelledby="research-report-title" onClose={() => setReporte(null)} onCancel={event => { if (exportando) event.preventDefault(); }}>
      {reporte && <><div className="research-dialog-heading"><div><p className="research-eyebrow">Exportar consulta</p><h2 id="research-report-title">Tu reporte territorial</h2></div><button type="button" autoFocus aria-label="Cerrar reporte" className={boton} disabled={Boolean(exportando)} onClick={() => dialogo.current.close()}><Icon name="close" size={19}/></button></div>
        {reporte.modo === 'ejemplo' && <p className="research-dialog-example"><strong>EJEMPLO</strong> · El archivo contendrá datos ficticios identificados como vista previa.</p>}
        <div className="research-report-summary"><strong>{numero(reporte.resumen.meliponarios)} meliponarios</strong><span>{numero(reporte.resumen.especies)} especies · {reporte.alcance}</span></div><dl className="research-criteria">{reporte.criterios.map(([nombre, value]) => <div key={nombre}><dt>{nombre}</dt><dd>{value}</dd></div>)}</dl>
        <p className="research-footnote">El reporte incluye todos los resultados del alcance elegido, aunque la tabla tenga varias páginas. Los dos formatos usan la misma consulta.</p>
        {error && <p className="research-error" role="alert">{error}</p>}{aviso && <p role="status" className="research-success">{aviso}</p>}
        <div className="research-export-buttons"><button type="button" className={primario} disabled={Boolean(exportando)} onClick={() => descargar('xlsx')}>{exportando === 'xlsx' ? 'Generando Excel…' : 'Descargar Excel (.xlsx)'}</button><button type="button" className={boton} disabled={Boolean(exportando)} onClick={() => descargar('pdf')}>{exportando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}</button></div></>}
    </dialog>
  </>;
}
