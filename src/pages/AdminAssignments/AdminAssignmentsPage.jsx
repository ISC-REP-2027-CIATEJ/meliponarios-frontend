import { useEffect, useMemo, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import {
  asignarZona, finalizarAsignacion, obtenerAsignaciones,
} from '../../features/territory/territoryService';
import Icon from '../Explore/Icon';
import { ADMIN_COVERAGE_ROUTE } from '../../features/territory/territoryCoverageModel.mjs';
import {
  agruparAsignaciones, cuentasDisponibles, filtrarPersonas, nombreCuenta,
} from './adminAssignmentsModel.mjs';
import './AdminAssignmentsPage.css';

const catalogoVacio = { usuarios: [], zonas: [], asignaciones: [] };
const estados = [
  { id: 'vigentes', nombre: 'Vigentes' },
  { id: 'historial', nombre: 'Historial' },
  { id: 'todas', nombre: 'Todas' },
];
const porPagina = 12;
const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City',
});
const nombreRol = id => Number(id) === 3 ? 'Coordinador de campo'
  : Number(id) === 4 ? 'Trabajador de campo' : 'Otro rol';
const permiteAsignar = zona => Boolean(zona?.activo && zona.localidades.length);
const fechaValida = valor => valor && Number.isFinite(Date.parse(valor));

function Fecha({ valor, alternativa }) {
  return fechaValida(valor)
    ? <time dateTime={valor}>{formatoFecha.format(new Date(valor))}</time>
    : alternativa;
}

export default function AdminAssignmentsPage({ user, sessionReady, onLogout }) {
  return <div className="za-page km-with-nav">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? (
      <main className="za-wrap"><p role="status">Comprobando sesión…</p></main>
    ) : Number(user?.roleId) !== 1 ? (
      <main className="za-wrap">
        <section className="za-panel za-restricted">
          <h1>Asignaciones de zonas</h1>
          <p>El acceso está reservado al administrador general.</p>
          <a className="za-button za-button--primary" href={user ? '#explorar' : '#login'}>
            {user ? 'Volver a Explorar' : 'Iniciar sesión'}
          </a>
        </section>
      </main>
    ) : <Workspace key={user.id} userId={user.id}/>}
  </div>;
}

function Workspace({ userId }) {
  const [catalogo, setCatalogo] = useState(catalogoVacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [revision, setRevision] = useState(0);
  const [usuarioId, setUsuarioId] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [borradorId, setBorradorId] = useState(() => crypto.randomUUID());
  const [estado, setEstado] = useState('vigentes');
  const [personaId, setPersonaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(false);
  const dialogo = useRef(null);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    let activo = true;
    obtenerAsignaciones(userId).then(nuevo => {
      if (!activo) return;
      const opciones = cuentasDisponibles(nuevo);
      setUsuarioId(id => opciones.some(cuenta => cuenta.id === id) ? id : '');
      setZonaId(id => nuevo.zonas.some(zona => zona.id === id && permiteAsignar(zona)) ? id : '');
      setCatalogo(nuevo);
    }).catch(fallo => {
      if (!activo) return;
      setCatalogo(catalogoVacio);
      setError(fallo.message || 'No se pudo cargar el catálogo de asignaciones.');
    }).finally(() => {
      if (activo) setCargando(false);
    });
    return () => { activo = false; };
  }, [userId, revision]);

  useEffect(() => {
    const elemento = dialogo.current;
    if (accion && !elemento.open) elemento.showModal();
    if (!accion && elemento.open) elemento.close();
  }, [accion]);

  const disponibles = useMemo(() => cuentasDisponibles(catalogo), [catalogo]);
  const personas = useMemo(() => agruparAsignaciones(catalogo.asignaciones), [catalogo.asignaciones]);
  const seleccion = personas.some(persona => persona.id === personaId) ? personaId : '';
  const filtradas = filtrarPersonas(personas, { estado, personaId: seleccion, busqueda });
  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, paginas);
  const visibles = filtradas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);
  const usuario = disponibles.find(cuenta => cuenta.id === usuarioId);
  const zona = catalogo.zonas.find(zona => zona.id === zonaId);
  const totalZonas = catalogo.zonas.filter(permiteAsignar).length;
  const editando = !cargando && !guardando && !error;
  const puedeAsignar = editando && usuario && permiteAsignar(zona);

  function recargar() {
    setCargando(true);
    setError('');
    setRevision(numero => numero + 1);
  }

  function pedirAsignacion(event) {
    event.preventDefault();
    if (!puedeAsignar) return;
    setAccion({
      tipo: 'asignar', nombre: nombreCuenta(usuario), zona: zona.nombre,
      valores: { id: borradorId, usuarioId: usuario.id, zonaId: zona.id, observaciones },
    });
  }

  function pedirFinalizacion(persona, periodo) {
    if (!editando) return;
    setAccion({ tipo: 'finalizar', nombre: persona.nombre, zona: periodo.zona, id: periodo.id });
  }

  async function guardar() {
    if (bloqueo.current || !accion || !editando) return;
    bloqueo.current = true;
    setGuardando(true);
    setAviso('');
    try {
      if (accion.tipo === 'asignar') {
        const actual = await obtenerAsignaciones(userId);
        if (!montado.current) return;
        const { usuarioId, zonaId } = accion.valores;
        const cuentaDisponible = cuentasDisponibles(actual).some(cuenta => cuenta.id === usuarioId);
        const zonaDisponible = actual.zonas.some(zona => zona.id === zonaId && permiteAsignar(zona));
        if (!cuentaDisponible || !zonaDisponible) {
          setCatalogo(actual);
          if (!cuentaDisponible) setUsuarioId('');
          if (!zonaDisponible) setZonaId('');
          setAccion(null);
          setAviso('Cambió la disponibilidad de la cuenta o de la zona. Revisa la selección.');
          return;
        }
        await asignarZona(userId, accion.valores);
      } else {
        await finalizarAsignacion(userId, accion.id);
      }
      if (!montado.current) return;
      if (accion.tipo === 'asignar') {
        setUsuarioId('');
        setZonaId('');
        setObservaciones('');
        setBorradorId(crypto.randomUUID());
        setAviso('Zona asignada. Puedes consultar la cobertura en Asignaciones registradas.');
      } else {
        setAviso('Asignación finalizada. El período quedó en el historial de la persona.');
      }
      setAccion(null);
      recargar();
    } catch (fallo) {
      if (!montado.current) return;
      setError(fallo.message || 'No se pudo confirmar la operación.');
      setAccion(null);
      if (fallo.uncertain || fallo.code === 'ACCESS_DENIED') setCatalogo(catalogoVacio);
    } finally {
      bloqueo.current = false;
      if (montado.current) setGuardando(false);
    }
  }

  return <main className="za-wrap">
    <section className="za-hero" aria-labelledby="za-title">
      <nav className="za-nav" aria-label="Administración">
        <a href="#administracion/usuarios">Usuarios</a>
        <a href="#administracion/asignaciones" aria-current="page">Asignaciones</a>
        <a href={'#' + ADMIN_COVERAGE_ROUTE}>Cobertura territorial</a>
      </nav>
      <div className="za-hero-body">
        <div>
          <h1 id="za-title">Asignaciones de zonas</h1>
          <p>Consulta y asigna la cobertura de coordinadores y trabajadores de campo.</p>
        </div>
        <button className="za-button za-button--hero" type="button"
          disabled={cargando || guardando} onClick={() => { setAviso(''); recargar(); }}>
          {cargando ? 'Actualizando…' : 'Actualizar asignaciones'}
        </button>
      </div>
      <dl className="za-totals" aria-label="Resumen de cobertura">
        {[
          ['Personas con asignación vigente', personas.filter(persona => persona.vigentes.length).length],
          ['Personas disponibles', disponibles.length],
          ['Zonas para asignar', totalZonas],
        ].map(([nombre, total]) => <div key={nombre}>
          <dt>{nombre}</dt><dd>{cargando || error ? '—' : total}</dd>
        </div>)}
      </dl>
    </section>

    {aviso && <p className="za-notice" role="status">{aviso}</p>}
    {error && <div className="za-notice za-notice--error" role="alert">
      <p>{error}</p><p>Actualiza las asignaciones antes de intentar otra operación.</p>
    </div>}

    <div className="za-layout">
      <section className="za-panel" aria-labelledby="za-nueva">
        <header className="za-panel-heading">
          <span className="za-panel-icon"><Icon name="pin" size={22}/></span>
          <h2 id="za-nueva">Nueva asignación</h2>
        </header>
        <form className="za-form" onSubmit={pedirAsignacion}>
          <div className="za-field">
            <label htmlFor="assignment-user">Coordinador o trabajador disponible</label>
            <select id="assignment-user" className="za-control" value={usuario?.id ?? ''}
              disabled={!editando || !disponibles.length} required
              onChange={event => setUsuarioId(event.target.value)}>
              <option value="">Selecciona una persona</option>
              {disponibles.map(cuenta => <option key={cuenta.id} value={cuenta.id}>
                {nombreCuenta(cuenta)} · {nombreRol(cuenta.rol_id)}
              </option>)}
            </select>
          </div>
          <div className="za-field">
            <label htmlFor="assignment-zone">Zona</label>
            <select id="assignment-zone" className="za-control" value={zona?.id ?? ''}
              disabled={!editando || !disponibles.length} required
              onChange={event => setZonaId(event.target.value)}>
              <option value="">Selecciona una zona</option>
              {catalogo.zonas.map(opcion => <option key={opcion.id} value={opcion.id}
                disabled={!permiteAsignar(opcion)}>
                {opcion.nombre}{!opcion.activo ? ' · Inactiva' : !opcion.localidades.length ? ' · Sin localidades activas' : ''}
              </option>)}
            </select>
          </div>
          {permiteAsignar(zona) && <details className="za-coverage">
            <summary>Localidades de la zona <span className="za-muted">({zona.localidades.length})</span></summary>
            <ul>{zona.localidades.map(localidad => <li key={localidad.id}>
              {localidad.nombre} · {localidad.municipio}
            </li>)}</ul>
          </details>}
          <div className="za-field">
            <label htmlFor="assignment-notes">Observaciones <span className="za-muted">(opcional)</span></label>
            <textarea id="assignment-notes" className="za-control" maxLength={2000}
              value={observaciones} disabled={!editando || !disponibles.length}
              onChange={event => setObservaciones(event.target.value)}/>
          </div>
          <button className="za-button za-button--primary za-submit" type="submit" disabled={!puedeAsignar}>
            <Icon name="pin" size={17}/> Asignar zona
          </button>
          {!cargando && !error && !catalogo.usuarios.length && (
            <p className="za-form-message">Crea o activa una cuenta de campo desde Usuarios.</p>
          )}
          {!cargando && !error && catalogo.usuarios.length > 0 && !disponibles.length && (
            <p className="za-form-message">Todas las personas activas de campo tienen una asignación vigente.</p>
          )}
          {!cargando && !error && !totalZonas && (
            <p className="za-form-message">Se necesita una zona activa con localidades para asignar.</p>
          )}
        </form>
      </section>

      <section className="za-panel" aria-labelledby="za-lista">
        <header className="za-panel-heading">
          <span className="za-panel-icon"><Icon name="map" size={22}/></span>
          <div>
            <h2 id="za-lista">Asignaciones registradas</h2>
            <p>Para cambiar de zona, finaliza la asignación vigente y elige la nueva.</p>
          </div>
        </header>
        <div className="za-directory" aria-busy={cargando}>
          <div className="za-filters">
            <div className="za-field">
              <label htmlFor="assigned-person">Persona</label>
              <select id="assigned-person" className="za-control" value={seleccion}
                disabled={cargando || !personas.length}
                onChange={event => { setPersonaId(event.target.value); setPagina(1); }}>
                <option value="">Todas las personas</option>
                {personas.map(persona => <option key={persona.id} value={persona.id}>{persona.nombre}</option>)}
              </select>
            </div>
            <div className="za-field">
              <label htmlFor="assignment-search">Buscar persona o zona</label>
              <div className="za-search">
                <Icon name="search" size={17}/>
                <input id="assignment-search" className="za-control" type="search" value={busqueda}
                  onChange={event => { setBusqueda(event.target.value); setPagina(1); }}/>
              </div>
            </div>
          </div>
          <div className="za-list-controls">
            <div className="za-switch" role="group" aria-label="Estado de las asignaciones">
              {estados.map(opcion => <button key={opcion.id} type="button"
                aria-pressed={estado === opcion.id}
                onClick={() => { setEstado(opcion.id); setPagina(1); }}>{opcion.nombre}</button>)}
            </div>
            {!cargando && <p className="za-result-count">
              {filtradas.length} {filtradas.length === 1 ? 'persona' : 'personas'}
            </p>}
          </div>
          {cargando ? <p className="za-empty" role="status">Cargando asignaciones…</p>
            : visibles.length ? <div className="za-people">
              {visibles.map(persona => <TarjetaPersona key={persona.id} persona={persona}
                estado={estado} editando={editando} pedirFinalizacion={pedirFinalizacion}/>)}
            </div>
            : <p className="za-empty">{error ? 'Actualiza para consultar las asignaciones.'
              : 'No hay personas con asignaciones que coincidan con la búsqueda.'}</p>}
          {!cargando && paginas > 1 && <nav className="za-pagination" aria-label="Páginas de personas">
            <button className="za-button za-button--soft" type="button" disabled={paginaActual === 1}
              onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
            <span>{paginaActual} de {paginas}</span>
            <button className="za-button za-button--soft" type="button" disabled={paginaActual === paginas}
              onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
          </nav>}
        </div>
      </section>
    </div>

    <dialog className="za-dialog" ref={dialogo} aria-labelledby="za-confirm-title"
      onCancel={event => { event.preventDefault(); if (!bloqueo.current) setAccion(null); }}>
      <h2 id="za-confirm-title">{accion?.tipo === 'asignar' ? 'Confirmar asignación' : 'Finalizar asignación'}</h2>
      {accion && <p>{accion.tipo === 'asignar'
        ? <>{accion.nombre} tendrá acceso a las localidades de {accion.zona}.</>
        : <>Se retirará la cobertura que {accion.nombre} recibe por esta asignación a {accion.zona}. El período quedará en su historial.</>}</p>}
      <div className="za-dialog-actions">
        <button className="za-button za-button--soft" type="button" disabled={guardando}
          onClick={() => setAccion(null)}>Cancelar</button>
        <button className={accion?.tipo === 'finalizar' ? 'za-button za-button--hero' : 'za-button za-button--primary'}
          type="button" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : accion?.tipo === 'finalizar' ? 'Confirmar finalización' : 'Confirmar asignación'}
        </button>
      </div>
    </dialog>
  </main>;
}

function TarjetaPersona({ persona, estado, editando, pedirFinalizacion }) {
  const totalVigentes = persona.vigentes.length;
  return <article className="za-person">
    <header className="za-person-header">
      <div className="za-person-name">
        <span className="za-initial" aria-hidden="true">{persona.nombre.charAt(0).toLocaleUpperCase('es-MX')}</span>
        <div><h3>{persona.nombre}</h3><p>{nombreRol(persona.rolId)}</p></div>
      </div>
      {estado !== 'historial' && <span className={totalVigentes ? 'za-status za-status--active' : 'za-status'}>
        {totalVigentes > 1 ? totalVigentes + ' asignaciones vigentes'
          : totalVigentes === 1 ? 'Asignación vigente' : 'Sin asignación vigente'}
      </span>}
    </header>
    {estado !== 'historial' && totalVigentes > 0 && <div className="za-terms">
      {persona.vigentes.map(periodo => <PeriodoZona key={periodo.id} periodo={periodo}
        editando={editando} alFinalizar={() => pedirFinalizacion(persona, periodo)}/>)}
    </div>}
    {persona.historial.length > 0 && <details className="za-history" key={estado} open={estado === 'historial'}>
      <summary>Historial de asignaciones <span className="za-muted">({persona.historial.length})</span></summary>
      <div className="za-terms">
        {persona.historial.map(periodo => <PeriodoZona key={periodo.id} periodo={periodo}/>)}
      </div>
    </details>}
  </article>;
}

function PeriodoZona({ periodo, editando, alFinalizar }) {
  return <div className={alFinalizar ? 'za-term za-term--active' : 'za-term'}>
    <div className="za-zone-name">
      <Icon name="pin" size={17}/><h4>{periodo.zona}</h4>
      {!periodo.zona_activa && <span className="za-status">Zona inactiva</span>}
    </div>
    <p>Desde <Fecha valor={periodo.fecha_inicio} alternativa="fecha por confirmar"/> · {periodo.fecha_fin
      ? <>Hasta <Fecha valor={periodo.fecha_fin} alternativa="fecha por confirmar"/></>
      : 'Sin fecha de finalización'}</p>
    {periodo.observaciones && <p className="za-observations">{periodo.observaciones}</p>}
    {alFinalizar && <button className="za-button za-button--caution" type="button" disabled={!editando}
      aria-label={'Finalizar asignación en ' + periodo.zona} onClick={alFinalizar}>Finalizar asignación</button>}
  </div>;
}
