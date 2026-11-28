import { lazy, Suspense, useId, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import Icon from '../Explore/Icon';
import ResearchChart from './ResearchChart';
import {
  FILTROS_INICIALES, NOTA_METODOLOGICA, RUTA_INVENTARIO, ESTADOS,
  cambiarFiltro, crearReporte, esInvestigador, fechaVisible, filtrarInventario,
  instanteVisible, numero, opcionesTerritoriales, resumirInventario, sumarMedida, textoEstado,
} from '../../features/research/inventarioModel.mjs';
import { alcanceInicial, definirGraficas, GRAFICAS_INICIALES, TIPOS_GRAFICA } from '../../features/research/researchCharts.mjs';
import './ResearchDashboardPage.css';

const ResearchMap = lazy(() => import('./ResearchMap'));
const boton = 'km-button';
const primario = 'km-button km-button--primary';
const SIN_REGISTROS = Object.freeze([]);

function Filtro({ titulo, valor, opciones, todos, cambiar }) {
  const id = useId();
  return <label className="research-filter" htmlFor={id}>
    <span>{titulo}</span>
    <select id={id} value={valor} onChange={event => cambiar(event.target.value)}>
      <option value="">{todos}</option>
      {opciones.map(opcion => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}
    </select>
  </label>;
}

function Indicador({ nombre, valor, detalle, icono }) {
  return <article className="research-metric">
    <div className="research-metric-head"><span>{nombre}</span><span className="research-icon"><Icon name={icono} size={19}/></span></div>
    <strong>{valor}</strong><small>{detalle}</small>
  </article>;
}

export default function ResearchDashboardPage({ user, sessionReady, onLogout, route }) {
  return <div className="research-page km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout} current="investigacion"/>
    {!sessionReady ? <main className="km-container research-access" role="status">Comprobando tu sesión…</main>
      : !esInvestigador(user) ? <main className="km-container research-access"><div className="research-card">
        <h1>Espacio de investigación</h1><p>Este panel está disponible para las cuentas con el rol Investigador de consulta.</p>
        <a href={user ? '#explorar' : '#login'} className={primario}>{user ? 'Volver al inicio' : 'Iniciar sesión'}</a>
      </div></main> : <Dashboard key={user.id} route={route}/>}
  </div>;
}

function Dashboard({ route }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIALES });
  const [seleccion, setSeleccion] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [graficas, setGraficas] = useState(GRAFICAS_INICIALES);
  const [reporte, setReporte] = useState(null);
  const [exportando, setExportando] = useState('');
  const [aviso, setAviso] = useState('');
  const dialogo = useRef(null);
  const encabezado = useId();
  const registros = datos?.registros || SIN_REGISTROS;
  const opciones = useMemo(() => opcionesTerritoriales(registros, filtros), [registros, filtros]);
  const filtrados = useMemo(() => filtrarInventario(registros, filtros), [registros, filtros]);
  const resumen = useMemo(() => resumirInventario(filtrados), [filtrados]);
  const paneles = useMemo(() => definirGraficas(resumen, graficas), [resumen, graficas]);
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
  function filtrar(clave, valor) {
    setFiltros(actual => cambiarFiltro(actual, clave, valor));
    setSeleccion([]); setPagina(1); setAviso('');
  }
  function limpiar() {
    setFiltros({ ...FILTROS_INICIALES }); setSeleccion([]); setPagina(1); setAviso('');
  }
  function seleccionar(id) {
    setSeleccion(actual => actual.includes(id) ? actual.filter(v => v !== id) : [...actual, id]);
  }
  function cambiarTipo(id, tipo) {
    setGraficas(actual => ({ ...actual, tipos: { ...actual.tipos, [id]: tipo } }));
  }
  function capturarReporte(alcance, incluirGraficas = true, generado) {
    return crearReporte({ datos, filtros, seleccion, alcance, graficas, incluirGraficas, ...(generado ? { ahora: generado } : {}) });
  }
  function abrirReporte() {
    try {
      setReporte(capturarReporte(alcanceInicial(seleccion)));
      setError(''); setAviso(''); dialogo.current.showModal();
    } catch (err) { setError(err.message); }
  }
  function actualizarAlcance(alcance) {
    setReporte(capturarReporte(alcance, reporte.incluirGraficas, reporte.generado));
    setError(''); setAviso('');
  }
  async function descargar(formato) {
    if (exportando || !reporte) return;
    setExportando(formato); setError('');
    try {
      const { exportarReporte } = await import('../../features/research/exportarInventario.mjs');
      await exportarReporte(reporte, formato);
      setAviso('Se generó el reporte de ' + reporte.registros.length + ' meliponarios. Revisa las descargas de tu navegador.');
    } catch { setError('No se pudo generar el archivo. Conservamos tu selección para que vuelvas a intentarlo.'); }
    finally { setExportando(''); }
  }
  const valor = medida => datos ? numero(resumen[medida].total) : '—';
  const detalle = medida => !datos ? 'Pendiente de consulta' : resumen[medida].faltantes
    ? `${resumen[medida].faltantes} filas de especie sin dato` : 'Conteos registrados en las fichas';

  return <main className="km-container research-main">
    <header className="km-panel research-work-banner">
      <p className="research-eyebrow">Investigador de consulta</p>
      <h1 className="km-page-title">Panorama de los meliponarios</h1>
      <p>Explora el territorio, compara las especies y prepara tu reporte de inventario.</p>
    </header>
    <nav className="research-sections" aria-label="Secciones de investigación">
      <a className={!esInventario ? primario : boton} href="#investigacion" aria-current={!esInventario ? 'page' : undefined}>Panorama general</a>
      <a className={esInventario ? primario : boton} href="#investigacion/inventario" aria-current={esInventario ? 'page' : undefined}>Inventario territorial</a>
    </nav>

    {datos ? <div className="research-example" role="status"><span>
      <strong>Vista previa · datos de ejemplo</strong>
      <span>Los nombres, cantidades y ubicaciones son ilustrativos. No son datos de CIATEJ.</span>
    </span></div> : <section className="research-connect">
      <span className="research-icon"><Icon name="layers" size={24}/></span>
      <div><h2>Prepara tu espacio de investigación</h2><p>La consulta de inventario está pendiente de conectar. Puedes revisar el diseño con datos de ejemplo.</p></div>
      <button type="button" className={primario} disabled={cargando} onClick={explorarEjemplo}>{cargando ? 'Preparando vista…' : 'Explorar con datos de ejemplo'}</button>
    </section>}

    <section className="research-filters" aria-labelledby={encabezado}>
      <div className="research-filter-heading"><h2 id={encabezado}><Icon name="filter" size={18}/>Filtrar inventario</h2>
        <button type="button" className="research-text-button" disabled={!cantidadFiltros} onClick={limpiar}>Limpiar filtros{cantidadFiltros ? ` (${cantidadFiltros})` : ''}</button>
      </div>
      <fieldset disabled={!datos} className="research-filter-grid">
        <Filtro titulo="Zona" valor={filtros.zona} opciones={opciones.zonas} todos="Todas las zonas" cambiar={value => filtrar('zona', value)}/>
        <Filtro titulo="Municipio" valor={filtros.municipio} opciones={opciones.municipios} todos="Todos los municipios" cambiar={value => filtrar('municipio', value)}/>
        <Filtro titulo="Localidad" valor={filtros.localidad} opciones={opciones.localidades} todos="Todas las localidades" cambiar={value => filtrar('localidad', value)}/>
        <Filtro titulo="Especie" valor={filtros.especie} opciones={opciones.especies} todos="Todas las especies" cambiar={value => filtrar('especie', value)}/>
        <Filtro titulo="Estado operativo" valor={filtros.estado} opciones={Object.entries(ESTADOS).map(([id, nombre]) => ({ id, nombre }))} todos="Todos los estados" cambiar={value => filtrar('estado', value)}/>
        <label className="research-filter"><span>Buscar</span><span className="research-search"><Icon name="search" size={17}/>
          <input type="search" value={filtros.busqueda} placeholder="Meliponario, lugar o especie" onChange={event => filtrar('busqueda', event.target.value)}/>
        </span></label>
      </fieldset>
    </section>
    {error && !reporte && <p className="research-error" role="alert">{error}</p>}
    <div className="research-result-line"><span aria-live="polite">{datos
      ? <><strong>{numero(filtrados.length)}</strong> meliponarios encontrados · {numero(resumen.localidades)} localidades</>
      : 'Esperando la consulta de inventario'}</span><span>{datos ? 'Consulta: ' + instanteVisible(datos.fechaConsulta) + ' · CDMX' : 'Inventario vigente'}</span>
    </div>
    <div className="research-metrics">
      <Indicador nombre="Meliponarios" valor={datos ? numero(resumen.meliponarios) : '—'} detalle="Registros únicos en la consulta" icono="home"/>
      <Indicador nombre="Especies" valor={datos ? numero(resumen.especies) : '—'} detalle="Especies distintas registradas" icono="bee"/>
      <Indicador nombre="Localidades" valor={datos ? numero(resumen.localidades) : '—'} detalle="Localidades representadas" icono="pin"/>
      <Indicador nombre="Cajas" valor={valor('cajas')} detalle={detalle('cajas')} icono="records"/>
      <Indicador nombre="Jobones" valor={valor('jobones')} detalle={detalle('jobones')} icono="layers"/>
    </div>

    {!datos ? <section className="research-card research-empty"><Icon name="map" size={38}/>
      <h2>Una mirada al territorio</h2><p>Aquí podrás consultar las gráficas, ubicaciones y el inventario autorizado para tu cuenta.</p>
    </section> : esInventario ? <section className="research-card research-inventory">
      <div className="research-table-heading"><div><p className="research-eyebrow">Consulta y reportes</p>
        <h2>Inventario territorial</h2><p>Marca los meliponarios que necesitas. El reporte usará tu selección.</p></div>
        <button type="button" className={primario} disabled={!filtrados.length} onClick={abrirReporte}>
          {seleccion.length ? `Generar reporte de ${seleccion.length}` : 'Generar reporte'}<Icon name="records" size={18}/>
        </button>
      </div>
      <div className="research-selection">
        <label><input type="checkbox" checked={filtrados.length > 0 && seleccion.length === filtrados.length} disabled={!filtrados.length}
          onChange={event => setSeleccion(event.target.checked ? filtrados.map(r => r.id) : [])}/>Seleccionar los {numero(filtrados.length)} resultados</label>
        <span aria-live="polite">{numero(seleccion.length)} seleccionados</span>
        {seleccion.length > 0 && <button type="button" className="research-text-button" onClick={() => setSeleccion([])}>Limpiar selección</button>}
      </div>
      <div className="research-table-scroll" tabIndex="0" role="region" aria-label="Inventario territorial, desplazamiento horizontal">
        <table className="research-table"><caption className="sr-only">Un registro por meliponario. Los conteos respetan la especie filtrada.</caption>
          <thead><tr><th scope="col"><span className="sr-only">Seleccionar</span></th><th scope="col">Meliponario / territorio</th><th scope="col">Especies</th><th scope="col">Cajas</th><th scope="col">Jobones</th><th scope="col">Última ficha</th><th scope="col">Estado</th></tr></thead>
          <tbody>{visibles.map(r => <tr key={r.id}>
            <td><input type="checkbox" aria-label={'Seleccionar ' + r.nombre} checked={seleccion.includes(r.id)} onChange={() => seleccionar(r.id)}/></td>
            <th scope="row"><strong>{r.nombre}</strong><span>{r.localidad} · {r.municipio}</span><small>{r.zonas.map(z => z.nombre).join(' / ') || 'Sin zona'}</small></th>
            <td><ul className="research-species-list">{r.inventario.map(fila => <li key={fila.especieId}>
              <strong>{fila.nombreComun}</strong><i>{fila.nombreCientifico}</i>
              <small>{numero(fila.cajas)} cajas · {numero(fila.jobones)} jobones</small>
            </li>)}</ul>{!r.inventario.length && 'Sin inventario'}</td>
            {['cajas', 'jobones'].map(medida => { const total = sumarMedida([r], medida); return <td className="research-numeric" key={medida}>{numero(total.total)}{total.faltantes > 0 && <small>{total.faltantes} sin dato</small>}</td>; })}
            <td>{fechaVisible(r.fechaFicha)}</td><td><span className={'research-badge research-badge--' + (r.estadoOperativo || 'sin_dato')}>{textoEstado(r.estadoOperativo)}</span><small>{textoEstado(r.visibilidad)}</small></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtrados.length && <p className="research-empty-small">No encontramos meliponarios con estos filtros.</p>}
      <div className="research-pagination"><span>{filtrados.length ? `${(pagina - 1) * porPagina + 1}–${Math.min(pagina * porPagina, filtrados.length)} de ${filtrados.length} meliponarios` : '0 resultados'}</span>
        <div><button type="button" className={boton} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina} de {paginas}</span>
          <button type="button" className={boton} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div>
      </div>
    </section> : <>
      <div className="research-charts">{paneles.map(grafica => <ResearchChart key={grafica.id} grafica={grafica}
        elegido={filtros[grafica.filtro]} elegir={value => filtrar(grafica.filtro, value)}
        cambiarTipo={tipo => cambiarTipo(grafica.id, tipo)} medida={graficas.medida}
        cambiarMedida={grafica.id === 'inventario' ? medida => setGraficas(actual => ({ ...actual, medida })) : undefined}/>)}</div>
      <section className="research-card research-map-card"><div className="research-card-heading"><h2>Distribución en el mapa</h2>
        <p>{numero(filtrados.length - resumen.sinGPS)} puntos · {resumen.sinGPS ? `${numero(resumen.sinGPS)} registros sin ubicación` : 'Ubicaciones de los resultados filtrados'}</p></div>
        <Suspense fallback={<p role="status" className="research-empty-small">Cargando mapa…</p>}><ResearchMap registros={filtrados}/></Suspense>
        <p className="research-footnote">Los puntos y las gráficas se actualizan con los mismos filtros.</p>
      </section>
    </>}
    <aside className="research-method"><Icon name="check" size={20}/><div><h2>Cómo leer este inventario</h2>
      <p>{NOTA_METODOLOGICA}</p><p>La fecha identifica la consulta actual; no reconstruye el inventario de meses anteriores.</p>
    </div></aside>

    <dialog ref={dialogo} className="research-report-dialog" aria-labelledby="research-report-title" onClose={() => setReporte(null)}
      onCancel={event => { if (exportando) event.preventDefault(); }}>
      {reporte && <>
        <div className="research-dialog-heading"><div><p className="research-eyebrow">Preparar descarga</p><h2 id="research-report-title">Tu reporte territorial</h2></div>
          <button type="button" autoFocus aria-label="Cerrar reporte" className={boton} disabled={Boolean(exportando)} onClick={() => dialogo.current.close()}><Icon name="close" size={19}/></button>
        </div>
        {reporte.modo === 'ejemplo' && <p className="research-dialog-example"><strong>EJEMPLO</strong> · El archivo identifica los datos como ficticios.</p>}
        <fieldset className="research-report-scope" disabled={Boolean(exportando)}><legend>Qué incluir</legend>
          <label><input type="radio" name="alcance" value="seleccionados" disabled={!seleccion.length} checked={reporte.alcanceClave === 'seleccionados'} onChange={() => actualizarAlcance('seleccionados')}/>Solo seleccionados <strong>{seleccion.length}</strong></label>
          <label><input type="radio" name="alcance" value="filtrados" checked={reporte.alcanceClave === 'filtrados'} onChange={() => actualizarAlcance('filtrados')}/>Todos los resultados filtrados <strong>{filtrados.length}</strong></label>
        </fieldset>
        <div className="research-report-summary"><strong>{numero(reporte.resumen.meliponarios)} meliponarios</strong>
          <span>{numero(reporte.resumen.especies)} especies · {numero(reporte.resumen.cajas.total)} cajas · {numero(reporte.resumen.jobones.total)} jobones</span>
        </div>
        <label className="research-include-charts"><input type="checkbox" disabled={Boolean(exportando)} checked={reporte.incluirGraficas}
          onChange={event => setReporte(actual => ({ ...actual, incluirGraficas: event.target.checked }))}/>Incluir las gráficas elegidas en Panorama</label>
        {reporte.incluirGraficas && <ul className="research-report-chart-list">{definirGraficas(reporte.resumen, reporte.graficas).map(grafica => <li key={grafica.id}><span>{grafica.titulo}</span><small>{TIPOS_GRAFICA[grafica.tipo]}</small></li>)}</ul>}
        <details className="research-report-criteria"><summary>Ver criterios de esta consulta</summary>
          <dl className="research-criteria">{reporte.criterios.map(([nombre, value]) => <div key={nombre}><dt>{nombre}</dt><dd>{value}</dd></div>)}</dl>
        </details>
        <p className="research-footnote">Una fila por meliponario, con todas sus especies agrupadas. Las gráficas se calculan únicamente con el alcance elegido.</p>
        {error && <p className="research-error" role="alert">{error}</p>}{aviso && <p role="status" className="research-success">{aviso}</p>}
        <div className="research-export-buttons">
          <button type="button" className={primario} disabled={Boolean(exportando)} onClick={() => descargar('xlsx')}>{exportando === 'xlsx' ? 'Generando Excel…' : 'Descargar Excel (.xlsx)'}</button>
          <button type="button" className={boton} disabled={Boolean(exportando)} onClick={() => descargar('pdf')}>{exportando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}</button>
        </div>
      </>}
    </dialog>
  </main>;
}
