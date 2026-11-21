import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { isAdminUser } from '../../features/adminUsers/adminUsersModel.mjs';
import {
  ADMIN_COVERAGE_ROUTE, HISTORIAL_POR_PAGINA, LOCALIDADES_POR_PAGINA, SIN_ZONA,
  filtrarLocalidades, unirCobertura, zonasDestino,
} from '../../features/territory/territoryCoverageModel.mjs';
import {
  asignarMunicipioZona, cambiarCobertura, crearZonaCobertura,
  obtenerCatalogoMunicipal, obtenerCoberturaMunicipal, obtenerHistorialCobertura,
} from '../../features/territory/territoryService';
import Icon from '../Explore/Icon';
import { ConfirmarMunicipio, CrearZonaDialog, DialogoCobertura, FormularioMunicipio } from './AdminCoverageMunicipal';
import '../AdminAssignments/AdminAssignmentsPage.css';
import './AdminCoveragePage.css';

const filtrosIniciales = { busqueda: '', zonaId: '' };
const tipoCambio = { asignacion: 'Asignación', reasignacion: 'Traslado', retiro: 'Retiro' };
const acciones = { asignar: 'Asignar zona', trasladar: 'Trasladar localidad', retirar: 'Retirar de la zona' };
const fechaHistorial = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City',
});
const nombreZona = zona => zona?.nombre ?? 'Sin zona';

export default function AdminCoveragePage({ user, sessionReady, onLogout }) {
  return <div className="za-page km-with-nav ct-page">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="za-wrap"><p role="status">Comprobando sesión…</p></main>
      : isAdminUser(user) ? <Cobertura key={user.id} userId={user.id}/>
        : <main className="za-wrap">
          <section className="za-panel za-restricted">
            <h1>Cobertura territorial</h1>
            <p>El acceso está reservado al administrador general.</p>
            <a className="za-button za-button--primary" href={user ? '#explorar' : '#login'}>
              {user ? 'Volver a Explorar' : 'Iniciar sesión'}
            </a>
          </section>
        </main>}
  </div>;
}

function Cobertura({ userId }) {
  const [catalogo, setCatalogo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState(null);
  const [municipioId, setMunicipioId] = useState('');
  const [modo, setModo] = useState('municipio');
  const [consulta, setConsulta] = useState(null);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [pagina, setPagina] = useState(1);
  const [localidadId, setLocalidadId] = useState('');
  const [cambio, setCambio] = useState(null);
  const [creandoZona, setCreandoZona] = useState(false);
  const [errorZona, setErrorZona] = useState('');
  const [zonaInicial, setZonaInicial] = useState('');
  const [guardando, setGuardando] = useState(false);
  const montado = useRef(false);
  const bloqueado = useRef(false);
  const tituloDetalle = useRef(null);
  const municipio = catalogo?.municipios.find(row => row.id === municipioId);
  const claveConsulta = municipioId + ':' + revision;

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    let activo = true;
    obtenerCatalogoMunicipal(userId).then(datos => {
      if (!activo) return;
      setCatalogo(datos);
      setMunicipioId(id => datos.municipios.some(row => row.id === id) ? id : '');
      setFiltros(anteriores => ({
        ...anteriores,
        zonaId: anteriores.zonaId === SIN_ZONA || datos.zonas.some(row => row.id === anteriores.zonaId)
          ? anteriores.zonaId : '',
      }));
    }).catch(error => {
      if (!activo) return;
      setCatalogo(null);
      setErrorCarga(error.message || 'No se pudo consultar el catálogo territorial.');
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [userId, revision]);

  useEffect(() => {
    if (!municipio || cargando) return;
    let activo = true;
    obtenerCoberturaMunicipal(userId, municipio.id).then(datos => {
      if (!activo) return;
      const { localidades } = unirCobertura({ ...datos, municipios: [municipio], zonas: catalogo.zonas });
      setConsulta({ clave: claveConsulta, localidades });
      setLocalidadId(id => localidades.some(row => row.id === id) ? id : '');
    }).catch(error => {
      if (activo) setConsulta({ clave: claveConsulta, error: error.message || 'No se pudo consultar el municipio.' });
    });
    return () => { activo = false; };
  }, [userId, municipio, catalogo, claveConsulta, cargando]);

  useEffect(() => {
    if (localidadId && modo === 'localidades') tituloDetalle.current?.focus();
  }, [localidadId, modo]);

  const consultaActual = !cargando && consulta?.clave === claveConsulta ? consulta : null;
  const localidades = consultaActual?.localidades ?? [];
  const filtradas = filtrarLocalidades(localidades, filtros);
  const paginas = Math.max(1, Math.ceil(filtradas.length / LOCALIDADES_POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const inicio = (paginaActual - 1) * LOCALIDADES_POR_PAGINA;
  const visibles = filtradas.slice(inicio, inicio + LOCALIDADES_POR_PAGINA);
  const localidad = localidades.find(row => row.id === localidadId);
  const habilitado = catalogo?.gestionMunicipal === true;
  const zonasActivas = catalogo?.zonas.filter(zona => zona.activo).length ?? 0;
  const totalLocalidades = habilitado
    ? catalogo.municipios.reduce((total, row) => total + row.localidades, 0) : '—';

  function seleccionarMunicipio(id) {
    setMunicipioId(id);
    setConsulta(null);
    setLocalidadId('');
    setFiltros(filtrosIniciales);
    setPagina(1);
  }

  function actualizarFiltro(nombre, valor) {
    setFiltros(anteriores => ({ ...anteriores, [nombre]: valor }));
    setPagina(1);
  }

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRevision(valor => valor + 1);
  }

  function cancelar() {
    if (!bloqueado.current) {
      setCambio(null);
      setCreandoZona(false);
    }
  }

  function requiereActualizar(error) {
    return error.uncertain || [
      'ACCESS_DENIED', 'COVERAGE_CHANGED', '40001', '23505', 'P0002', 'CONTRACT_MISSING',
    ].includes(error.code);
  }

  async function guardarZona(valores) {
    if (bloqueado.current || !creandoZona || !habilitado || cargando) return;
    bloqueado.current = true;
    setGuardando(true);
    setErrorZona('');
    setAviso(null);
    try {
      const id = await crearZonaCobertura(userId, valores);
      if (!montado.current) return;
      setZonaInicial(id);
      setCreandoZona(false);
      setAviso({ texto: 'Zona creada. Ya puedes elegirla como destino de cobertura.' });
      recargar();
    } catch (error) {
      if (!montado.current) return;
      const texto = error.message || 'No se pudo confirmar la creación de la zona.';
      if (requiereActualizar(error) && error.code !== '23505') {
        setCreandoZona(false);
        setAviso({ texto, error: true });
        recargar();
      } else {
        setErrorZona(texto);
      }
    } finally {
      bloqueado.current = false;
      if (montado.current) setGuardando(false);
    }
  }

  async function guardar(trasladar = false) {
    if (bloqueado.current || !cambio || cargando) return;
    bloqueado.current = true;
    setGuardando(true);
    setAviso(null);
    try {
      let texto = 'Cambio registrado. Consulta la zona y el historial de la localidad.';
      if (cambio.alcance === 'municipio') {
        const resultado = await asignarMunicipioZona(userId, { ...cambio.valores, trasladar });
        texto = cambio.municipio + ' quedó en ' + cambio.hacia.nombre + '. '
          + resultado.asignadas + ' incorporadas y ' + resultado.trasladadas + ' trasladadas.';
      } else {
        await cambiarCobertura(userId, cambio.valores);
      }
      if (!montado.current) return;
      setAviso({ texto });
      setCambio(null);
      setZonaInicial('');
      recargar();
    } catch (error) {
      if (!montado.current) return;
      setAviso({ texto: error.message || 'No se pudo comprobar el cambio de zona.', error: true });
      setCambio(null);
      if (requiereActualizar(error)) recargar();
    } finally {
      bloqueado.current = false;
      if (montado.current) setGuardando(false);
    }
  }

  return <main className="za-wrap">
    <section className="za-hero" aria-labelledby="ct-title">
      <nav className="za-nav" aria-label="Administración">
        <a href="#administracion/usuarios">Usuarios</a>
        <a href="#administracion/asignaciones">Asignaciones</a>
        <a href={'#' + ADMIN_COVERAGE_ROUTE} aria-current="page">Cobertura territorial</a>
      </nav>
      <div className="za-hero-body">
        <div>
          <h1 id="ct-title">Zonas y cobertura</h1>
          <p>Organiza las zonas de trabajo por municipio o por localidad.</p>
        </div>
        <div className="ct-hero-buttons">
          <button className="za-button za-button--soft" type="button" disabled={cargando || guardando}
            onClick={() => { setAviso(null); recargar(); }}>
            {cargando ? 'Actualizando…' : 'Actualizar cobertura'}
          </button>
          <button className="za-button za-button--hero" type="button" disabled={!habilitado || cargando || guardando}
            onClick={() => { setErrorZona(''); setCreandoZona(true); }}>
            <span aria-hidden="true">+</span> Crear zona
          </button>
        </div>
      </div>
      <dl className="za-totals" aria-label="Resumen de cobertura">
        <div><dt>Municipios</dt><dd>{cargando || !catalogo ? '—' : catalogo.municipios.length}</dd></div>
        <div><dt>Zonas activas</dt><dd>{cargando || !catalogo ? '—' : zonasActivas}</dd></div>
        <div><dt>Localidades registradas</dt><dd>{cargando ? '—' : totalLocalidades}</dd></div>
      </dl>
    </section>

    {aviso && <p className={aviso.error ? 'za-notice za-notice--error' : 'za-notice'}
      role={aviso.error ? 'alert' : 'status'}>{aviso.texto}</p>}
    {errorCarga && <p className="za-notice za-notice--error" role="alert">{errorCarga}</p>}
    {!cargando && catalogo && !habilitado && <p className="za-notice" role="status">
      La creación de zonas y la asignación de municipios están pendientes de habilitar en Supabase.
      Puedes consultar la cobertura y seguir asignando por localidad.
    </p>}

    <section className="za-panel ct-controls" aria-label="Municipio y modo de cobertura">
      <div className="za-field">
        <label htmlFor="ct-municipio">Municipio</label>
        <select id="ct-municipio" className="za-control" value={municipio?.id ?? ''}
          disabled={cargando || guardando || !catalogo?.municipios.length}
          onChange={event => seleccionarMunicipio(event.target.value)}>
          <option value="">Selecciona un municipio</option>
          {catalogo?.municipios.map(row => <option key={row.id} value={row.id}>{row.nombre}</option>)}
        </select>
      </div>
      <div className="za-switch ct-mode" role="group" aria-label="Nivel de cobertura">
        <button type="button" aria-pressed={modo === 'municipio'} onClick={() => setModo('municipio')}>
          Municipio completo
        </button>
        <button type="button" aria-pressed={modo === 'localidades'} onClick={() => setModo('localidades')}>
          Por localidad
        </button>
      </div>
    </section>

    {!municipio ? <p className="za-empty ct-municipal-status" role="status">
      {cargando ? 'Cargando municipios…' : 'Selecciona un municipio para consultar sus zonas y localidades.'}
    </p> : !consultaActual ? <p className="za-empty ct-municipal-status" role="status">
      Consultando la cobertura de {municipio.nombre}…
    </p> : consultaActual.error ? <p className="za-notice za-notice--error" role="alert">
      {consultaActual.error} Usa Actualizar cobertura para volver a consultar.
    </p> : modo === 'municipio' ? (
      <FormularioMunicipio key={claveConsulta} municipio={municipio} localidades={localidades}
        zonas={catalogo.zonas} zonaInicial={zonaInicial} habilitado={habilitado} guardando={guardando} preparar={setCambio}/>
    ) : <div className="za-layout ct-layout">
      <section className="za-panel" aria-labelledby="ct-lista">
        <header className="za-panel-heading">
          <span className="za-panel-icon"><Icon name="map" size={22}/></span>
          <div><h2 id="ct-lista">Localidades</h2><p>{municipio.nombre}</p></div>
        </header>
        <div className="za-directory">
          <FiltrosCobertura zonas={catalogo.zonas} filtros={filtros} actualizar={actualizarFiltro}/>
          <ListadoLocalidades visibles={visibles} total={filtradas.length} localidadId={localidadId}
            elegir={setLocalidadId} pagina={paginaActual} paginas={paginas} cambiarPagina={setPagina}/>
        </div>
      </section>
      <section id="ct-panel-detalle" className="za-panel" aria-labelledby="ct-detalle">
        <header className="za-panel-heading">
          <span className="za-panel-icon"><Icon name="pin" size={22}/></span>
          <h2 id="ct-detalle" tabIndex={-1} ref={tituloDetalle}>Gestionar localidad</h2>
        </header>
        {localidad ? (
          <DetalleLocalidad key={localidad.id + ':' + revision} userId={userId} localidad={localidad}
            zonas={catalogo.zonas} zonaInicial={zonaInicial} preparar={setCambio} guardando={guardando}/>
        ) : <div className="za-directory">
          <p className="za-empty">Selecciona una localidad para ver su zona y su historial.</p>
        </div>}
      </section>
    </div>}

    {creandoZona && <CrearZonaDialog cancelar={cancelar} guardar={guardarZona} guardando={guardando} error={errorZona}/>}
    {cambio?.alcance === 'municipio' && <ConfirmarMunicipio cambio={cambio} guardando={guardando}
      cancelar={cancelar} guardar={guardar}/>}
    {cambio?.alcance === 'localidad' && <ConfirmarCambio cambio={cambio} guardando={guardando}
      cancelar={cancelar} guardar={() => guardar()}/>}
  </main>;
}

function FiltrosCobertura({ zonas, filtros, actualizar }) {
  return <div className="za-filters ct-filters ct-local-filters" role="group" aria-label="Filtros de localidades">
    <div className="za-field">
      <label htmlFor="ct-busqueda">Buscar localidad por nombre o clave</label>
      <div className="za-search">
        <Icon name="search" size={17}/>
        <input id="ct-busqueda" className="za-control" type="search" value={filtros.busqueda}
          onChange={event => actualizar('busqueda', event.target.value)}/>
      </div>
    </div>
    <div className="za-field">
      <label htmlFor="ct-zona">Zona</label>
      <select id="ct-zona" className="za-control" value={filtros.zonaId}
        onChange={event => actualizar('zonaId', event.target.value)}>
        <option value="">Todas las zonas</option>
        <option value={SIN_ZONA}>Sin zona</option>
        {zonas.map(row => <option key={row.id} value={row.id}>
          {row.nombre}{!row.activo && ' (inactiva)'}
        </option>)}
      </select>
    </div>
  </div>;
}

function ListadoLocalidades({ visibles, total, localidadId, elegir, pagina, paginas, cambiarPagina }) {
  return <>
    <p className="za-result-count ct-count">{total} {total === 1 ? 'localidad' : 'localidades'}</p>
    {visibles.length ? <ul className="ct-list">
      {visibles.map(row => <li key={row.id}>
        <button className="ct-locality" type="button" aria-pressed={localidadId === row.id}
          aria-controls="ct-panel-detalle" onClick={() => elegir(row.id)}>
          <span>
            <strong>{row.nombre}</strong>
            <span className="ct-place-meta">{row.municipio.nombre} · {row.clave_localidad}</span>
            {(!row.activo || !row.municipio.activo) && <span className="ct-place-meta">
              {!row.activo ? 'Localidad inactiva' : 'Municipio inactivo'}
            </span>}
          </span>
          <span className={row.zona?.activo ? 'za-status za-status--active' : 'za-status'}>
            {nombreZona(row.zona)}{row.zona && !row.zona.activo && ' (inactiva)'}
          </span>
        </button>
      </li>)}
    </ul> : <p className="za-empty">No hay localidades que coincidan con los filtros.</p>}
    <Paginacion pagina={pagina} paginas={paginas} cambiar={cambiarPagina} etiqueta="Páginas de localidades"/>
  </>;
}

function DetalleLocalidad({ userId, localidad, zonas, zonaInicial, preparar, guardando }) {
  const zonaActualId = localidad.zona?.id ?? null;
  const [modo, setModo] = useState(zonaActualId ? 'trasladar' : 'asignar');
  const [destinoId, setDestinoId] = useState(zonaInicial);
  const [motivo, setMotivo] = useState('');
  const destinos = zonasDestino(zonas, zonaActualId);
  const destino = destinos.find(zona => zona.id === destinoId);
  const longitud = Array.from(motivo.trim()).length;
  const permitido = longitud >= 10 && longitud <= 1000 && (modo === 'retirar' || destino);

  function enviar(event) {
    event.preventDefault();
    if (!permitido || guardando) return;
    preparar({
      alcance: 'localidad', localidad: localidad.nombre, municipio: localidad.municipio.nombre,
      desde: localidad.zona, hacia: modo === 'retirar' ? null : destino,
      valores: { localidadId: localidad.id, zonaActualId, zonaId: modo === 'retirar' ? null : destino.id, accion: modo, motivo: motivo.trim() },
    });
  }

  return <div>
    <form className="za-form" onSubmit={enviar}>
      <div className="ct-current">
        <h3>{localidad.nombre}</h3>
        <p>{localidad.municipio.nombre} · Clave {localidad.clave_localidad}</p>
        <p>Zona actual <strong>{nombreZona(localidad.zona)}{localidad.zona && !localidad.zona.activo && ' (inactiva)'}</strong></p>
        {(!localidad.activo || !localidad.municipio.activo) && (
          <p>El registro básico requiere localidad y municipio activos.</p>
        )}
      </div>
      {zonaActualId && <div className="za-switch ct-actions" role="group" aria-label="Cambio de cobertura">
        <button type="button" aria-pressed={modo === 'trasladar'}
          disabled={guardando} onClick={() => setModo('trasladar')}>Trasladar</button>
        <button type="button" aria-pressed={modo === 'retirar'}
          disabled={guardando} onClick={() => setModo('retirar')}>Retirar</button>
      </div>}
      {modo !== 'retirar' && (
        <div className="za-field">
          <label htmlFor="ct-destino">Zona de destino</label>
          <select id="ct-destino" className="za-control" required value={destino?.id ?? ''}
            disabled={guardando || !destinos.length} onChange={event => setDestinoId(event.target.value)}>
            <option value="">Selecciona una zona</option>
            {destinos.map(zona => <option key={zona.id} value={zona.id}>
              {zona.nombre} · {zona.codigo}
            </option>)}
          </select>
          {!destinos.length && <p className="za-form-message">No hay zonas activas disponibles como destino.</p>}
        </div>
      )}
      <div className="za-field">
        <label htmlFor="ct-motivo">Motivo del cambio</label>
        <textarea id="ct-motivo" className="za-control" required value={motivo} maxLength={1000}
          aria-describedby="ct-motivo-limite" disabled={guardando} onChange={event => setMotivo(event.target.value)}/>
        <p id="ct-motivo-limite" className="ct-hint">De 10 a 1000 caracteres. {longitud}/1000</p>
      </div>
      <button className={modo === 'retirar' ? 'za-button za-button--caution za-submit' : 'za-button za-button--primary za-submit'}
        type="submit" disabled={!permitido || guardando}>Revisar cambio</button>
    </form>
    <HistorialLocalidad userId={userId} localidadId={localidad.id} zonas={zonas}/>
  </div>;
}

function HistorialLocalidad({ userId, localidadId, zonas }) {
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    obtenerHistorialCobertura(userId, localidadId, pagina).then(datos => {
      if (activo) setHistorial(datos);
    }).catch(fallo => {
      if (activo) setError(fallo.message || 'No se pudo consultar el historial.');
    });
    return () => { activo = false; };
  }, [userId, localidadId, pagina, revision]);

  function zona(id) {
    if (!id) return 'Sin zona';
    return zonas.find(item => item.id === id)?.nombre ?? 'Zona fuera del catálogo';
  }

  const paginas = Math.max(1, Math.ceil((historial?.total ?? 0) / HISTORIAL_POR_PAGINA));
  return <section className="ct-history" aria-labelledby="ct-historial">
    <h3 id="ct-historial">Historial de cambios</h3>
    {error ? <div className="ct-history-error">
      <p role="alert">{error}</p>
      <button type="button" className="za-button za-button--soft"
        onClick={() => { setError(''); setRevision(valor => valor + 1); }}>Volver a consultar</button>
    </div> : !historial ? <p className="ct-hint" role="status">Consultando historial…</p>
      : historial.registros.length ? <ol className="ct-history-list">
        {historial.registros.map(row => <li key={row.id}>
          <div className="ct-history-heading">
            <strong>{tipoCambio[row.tipo_cambio] || 'Cambio de zona'}</strong>
            <time dateTime={row.fecha_cambio}>{fechaHistorial.format(new Date(row.fecha_cambio))}</time>
          </div>
          <p>De <strong>{zona(row.zona_anterior_id)}</strong> a <strong>{zona(row.zona_nueva_id)}</strong>.</p>
          <p className="ct-reason">{row.motivo || 'Motivo no registrado.'}</p>
        </li>)}
      </ol> : <p className="ct-hint">Esta localidad todavía no tiene cambios registrados.</p>}
    <Paginacion pagina={pagina} paginas={paginas} etiqueta="Páginas del historial"
      cambiar={valor => { setHistorial(null); setError(''); setPagina(valor); }}/>
  </section>;
}

function Paginacion({ pagina, paginas, cambiar, etiqueta }) {
  if (paginas <= 1) return null;
  return <nav className="za-pagination" aria-label={etiqueta}>
    <button className="za-button za-button--soft" type="button" disabled={pagina === 1}
      onClick={() => cambiar(pagina - 1)}>Anterior</button>
    <span>{pagina} de {paginas}</span>
    <button className="za-button za-button--soft" type="button" disabled={pagina === paginas}
      onClick={() => cambiar(pagina + 1)}>Siguiente</button>
  </nav>;
}

function ConfirmarCambio({ cambio, guardando, cancelar, guardar }) {
  return <DialogoCobertura tituloId="ct-confirmar" cancelar={cancelar}>
    <h2 id="ct-confirmar">{acciones[cambio.valores.accion]}</h2>
    <p><strong>{cambio.localidad}</strong> · {cambio.municipio}</p>
    <dl className="ct-review">
      <div><dt>Zona actual</dt><dd>{nombreZona(cambio.desde)}</dd></div>
      <div><dt>Zona resultante</dt><dd>{nombreZona(cambio.hacia)}</dd></div>
    </dl>
    <p className="ct-reason">{cambio.valores.motivo}</p>
    <p className="ct-hint">El cambio se reflejará en la cobertura de las personas asignadas a esas zonas.</p>
    <div className="za-dialog-actions">
      <button className="za-button za-button--soft" type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
      <button className={cambio.valores.accion === 'retirar' ? 'za-button za-button--hero' : 'za-button za-button--primary'}
        type="button" disabled={guardando} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Confirmar cambio'}
      </button>
    </div>
  </DialogoCobertura>;
}
