import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { normalizar } from '../../features/adminUsers/adminUsersModel.mjs';
import { servicioEquipos } from '../../features/territory/territoryService';
import { accionesEquipo } from '../../features/territory/workTeamActions.mjs';
import { DialogoCobertura } from '../AdminCoverage/AdminCoverageMunicipal';
import '../AdminAssignments/AdminAssignmentsPage.css';
import './WorkTeamsPage.css';

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es-MX');
const nombrePersona = persona => [persona?.nombre, persona?.apellidos].filter(Boolean).join(' ') || 'Nombre no disponible';
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'America/Mexico_City' });

export default function WorkTeamsPage({ user, sessionReady, onLogout }) {
  const rol = Number(user?.roleId);
  return <div className="za-page km-with-nav eq-page">
    <OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="za-wrap" role="status">Comprobando sesión…</main>
      : user?.id && [1, 3].includes(rol) ? <Equipos key={user.id + '-' + rol} userId={user.id} rol={rol}/>
        : <main className="za-wrap za-panel za-restricted"><h1>Equipos de trabajo</h1>
          <p>Acceso reservado a Administración y Coordinación de campo.</p>
          <a className="za-button za-button--primary" href={user ? '#explorar' : '#login'}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a>
        </main>}
  </div>;
}

function Equipos({ userId, rol }) {
  const admin = rol === 1;
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(null);
  const [grupoId, setGrupoId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activos');
  const [miembros, setMiembros] = useState(null);
  const [seleccion, setSeleccion] = useState('');
  const [dialogo, setDialogo] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const datos = await servicioEquipos().directorio(userId);
        if (datos.rol !== rol) throw new Error('Cambió el rol de la sesión. Vuelve a entrar a tu cuenta.');
        if (vigente) setLectura({ version, datos });
      } catch (error) {
        if (vigente) setLectura({ version, error: error.message });
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [userId, rol, version]);

  const actual = lectura?.version === version ? lectura : null;
  const directorio = actual?.datos;
  const porZona = new Map(directorio?.zonas.map(z => [z.id, z]));
  const porPersona = new Map(directorio?.trabajadores.map(p => [p.id, p]));
  const porCoord = new Map(directorio?.coordinadores.map(p => [p.id, p]));
  const grupos = (directorio?.grupos ?? []).filter(g => (estado === 'todos' || g.activo === (estado === 'activos'))
    && normalizar([g.nombre, porZona.get(g.zona_id)?.nombre].join(' ')).includes(normalizar(buscar))).sort(porNombre);
  const grupo = grupos.find(g => g.id === grupoId) ?? grupos[0];
  const id = grupo?.id;
  const clave = id + '/' + version;

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    async function cargar() {
      try {
        const filas = await servicioEquipos().integrantes(userId, id);
        if (vigente) setMiembros({ clave, filas });
      } catch (error) {
        if (vigente) setMiembros({ clave, error: error.message });
      }
    }
    void cargar();
    return () => { vigente = false; };
  }, [userId, id, clave]);

  const detalle = miembros?.clave === clave ? miembros : null;
  const presentes = new Set(detalle?.filas?.map(p => p.usuario_id));
  const opciones = (directorio?.trabajadores ?? []).filter(p => p.activo && !presentes.has(p.id))
    .sort((a,b) => nombrePersona(a).localeCompare(nombrePersona(b), 'es-MX'));
  const elegido = opciones.find(p => p.id === seleccion);
  const zona = porZona.get(grupo?.zona_id);
  const disponible = !guardando && grupo?.activo && zona?.activo;
  const recargar = () => setVersion(v => v + 1);

  function abrir(titulo, texto, ejecutar) { setDialogo({ titulo, texto, ejecutar }); }
  function cerrar() { if (!bloqueo.current) setDialogo(null); }
  async function confirmar(ejecutar, mensaje, seleccionarCreado = false) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setGuardando(true);
    setAviso(null);
    try {
      const resultado = await ejecutar();
      if (!montado.current) return;
      if (seleccionarCreado) { setGrupoId(resultado); setEstado('activos'); setBuscar(''); }
      setSeleccion('');
      setDialogo(null);
      setAviso({ texto: mensaje });
      recargar();
    } catch (error) {
      if (!montado.current) return;
      const texto = error.message || 'El cambio no se pudo confirmar.';
      if (error.uncertain || error.code === 'ACCESS_DENIED') {
        setDialogo(null); setAviso({ texto, error: true }); recargar();
      } else setDialogo(anterior => anterior && ({ ...anterior, error: texto }));
    } finally {
      bloqueo.current = false;
      if (montado.current) setGuardando(false);
    }
  }
  function accionMiembro(persona, agregar) {
    const nombre = nombrePersona(persona);
    abrir(agregar ? 'Agregar integrante' : 'Retirar integrante',
      (agregar ? 'Agregar a ' : 'Retirar a ') + nombre + (agregar ? ' al equipo ' : ' del equipo ') + grupo.nombre + '.',
      () => servicioEquipos().cambiarMiembro(userId, id, persona.id, agregar));
  }
  function accionZona(persona) {
    abrir(persona.enZona ? 'Retirar cobertura' : 'Asignar cobertura',
      nombrePersona(persona) + (persona.enZona ? ' dejará de cubrir ' : ' cubrirá ') + zona.nombre
        + '. El cambio territorial se aplica a esta persona en toda esa zona.',
      () => servicioEquipos().asignarPersonal(userId, id, grupo.zona_id, persona.usuario_id, !persona.enZona));
  }

  return <main className="za-wrap eq-wrap">
    <header className="za-hero eq-hero">
      <nav className="za-nav" aria-label="Territorio">
        <a href={admin ? '#administracion/cobertura' : '#campo/asignaciones-tecnicas'}>{admin ? 'Zonas y cobertura' : 'Visitas técnicas'}</a>
        <a href={admin ? '#administracion/asignaciones' : '#campo/solicitudes'}>{admin ? 'Asignaciones' : 'Solicitudes básicas'}</a>
        <a href="#territorio/equipos" aria-current="page">Equipos</a>
      </nav>
      <div className="za-hero-body"><div><h1>{admin ? 'Equipos de trabajo' : 'Mis equipos'}</h1>
        <p>{admin ? 'Organiza el personal de campo por zona y coordinador.' : 'Consulta tus integrantes y asígnales cobertura en la zona del equipo.'}</p></div>
        <div className="eq-actions"><button className="za-button za-button--soft" disabled={!actual || guardando} onClick={recargar}>Actualizar</button>
          {admin && <button className="za-button eq-prominent" disabled={!directorio || guardando || !accionesEquipo.crear}
            onClick={() => setDialogo({ formulario: true })}>Crear equipo</button>}</div>
      </div>
    </header>
    {aviso && <p role={aviso.error ? 'alert' : 'status'} className={'za-notice' + (aviso.error ? ' za-notice--error' : '')}>{aviso.texto}</p>}
    {!actual && <p role="status" className="za-empty">Consultando equipos…</p>}
    {actual?.error && <p role="alert" className="za-notice za-notice--error">{actual.error}</p>}
    {directorio && <>
      {admin && !accionesEquipo.crear && <p className="za-notice">La creación de equipos requiere confirmar la acción de Supabase indicada en la guía.</p>}
      <div className="eq-grid"><section className="za-panel eq-panel">
        <h2>Directorio</h2>
        <label>Buscar equipo o zona<input type="search" className="za-control" value={buscar} disabled={guardando}
          onChange={e => { setBuscar(e.target.value); setSeleccion(''); }}/></label>
        <label>Estado<select className="za-control" value={estado} disabled={guardando} onChange={e => { setEstado(e.target.value); setSeleccion(''); }}>
          <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
        </select></label>
        <p className="eq-muted">{grupos.length} {grupos.length === 1 ? 'equipo' : 'equipos'}</p>
        <ul className="eq-groups">{grupos.map(g => <li key={g.id}>
          <button className="eq-choice" aria-pressed={id === g.id} disabled={guardando}
            onClick={() => { setGrupoId(g.id); setSeleccion(''); }}>
            <strong>{g.nombre}</strong><small>{porZona.get(g.zona_id)?.nombre || 'Zona sin nombre disponible'}</small>
          </button></li>)}</ul>
        {!grupos.length && <p className="za-empty">Sin equipos para esta selección.</p>}
      </section>
      {grupo && <section className="za-panel eq-panel">
        <div className="eq-between"><div><h2>{grupo.nombre}</h2><span className="eq-label">{grupo.activo ? 'Equipo activo' : 'Equipo inactivo'}</span></div>
          {admin && <button className="za-button za-button--soft" disabled={guardando || !accionesEquipo.editar}
            onClick={() => setDialogo({ formulario: true, original: grupo })}>Editar equipo</button>}</div>
        <p><strong>Zona</strong> · {zona?.nombre || 'Nombre no disponible'}</p>
        {admin && <p><strong>Coordinador</strong> · {grupo.coordinador_id ? nombrePersona(porCoord.get(grupo.coordinador_id)) : 'Pendiente de asignar'}</p>}
        {grupo.descripcion && <p>{grupo.descripcion}</p>}
        <h3>Integrantes</h3>
        {!detalle && <p role="status">Cargando integrantes…</p>}
        {detalle?.error && <p role="alert" className="za-notice za-notice--error">{detalle.error}</p>}
        {detalle?.filas && <>
          {admin && <div className="eq-inline">
            <label>Trabajador disponible<select className="za-control" disabled={!disponible || !opciones.length}
              value={elegido?.id ?? ''} onChange={e => setSeleccion(e.target.value)}>
              <option value="">Selecciona un trabajador</option>{opciones.map(p => <option value={p.id} key={p.id}>{nombrePersona(p)}</option>)}
            </select></label>
            <button className="za-button za-button--primary" disabled={!disponible || !elegido} onClick={() => accionMiembro(elegido, true)}>Agregar</button>
          </div>}
          <ul className="eq-people">{detalle.filas.map(p => {
            const persona = admin ? porPersona.get(p.usuario_id) : p;
            return <li key={p.usuario_id}><div><strong>{nombrePersona(persona)}</strong>
              {!admin && <small>{p.enZona ? 'Con cobertura en esta zona' : 'Pendiente de cobertura'}</small>}</div>
              {admin ? <button className="za-button za-button--soft" disabled={!grupo.activo || guardando}
                onClick={() => accionMiembro({ ...persona, id: p.usuario_id }, false)}>Retirar</button>
                : <button className="za-button za-button--soft" disabled={!disponible}
                  onClick={() => accionZona(p)}>{p.enZona ? 'Retirar de la zona' : 'Asignar a la zona'}</button>}</li>;
          })}</ul>
          {!detalle.filas.length && <p className="za-empty">Este equipo todavía no tiene integrantes vigentes.</p>}
          {!admin && <button className="za-button za-button--primary" disabled={!disponible || !detalle.filas.some(p => !p.enZona)}
            onClick={() => abrir('Sincronizar cobertura', 'Asignar a los integrantes de ' + grupo.nombre + ' la zona ' + zona.nombre + '.',
              () => servicioEquipos().sincronizarZona(userId, id, grupo.zona_id))}>Sincronizar equipo con su zona</button>}
        </>}
        <Historial key={clave} userId={userId} id={id}/>
      </section>}
      </div></>}
    {dialogo?.formulario && directorio && <FormularioEquipo original={dialogo.original} directorio={directorio}
      cancelar={cerrar} guardando={guardando} error={dialogo.error} guardar={valores => confirmar(
        () => servicioEquipos().guardarGrupo(userId, dialogo.original, valores),
        dialogo.original ? 'Equipo actualizado.' : 'Equipo creado.', !dialogo.original)}/>}
    {dialogo?.ejecutar && <DialogoCobertura tituloId="eq-confirmar" cancelar={cerrar}>
      <h2 id="eq-confirmar">{dialogo.titulo}</h2><p>{dialogo.texto}</p>
      {dialogo.error && <p role="alert" className="za-notice za-notice--error">{dialogo.error}</p>}
      <div className="za-dialog-actions">
        <button className="za-button za-button--soft" disabled={guardando} onClick={cerrar}>Cancelar</button>
        <button className="za-button za-button--primary" disabled={guardando} onClick={() => confirmar(dialogo.ejecutar, 'Cambio guardado por Supabase.')}>{guardando ? 'Guardando…' : 'Confirmar'}</button>
      </div></DialogoCobertura>}
  </main>;
}

function FormularioEquipo({ original, directorio, cancelar, guardar, guardando, error }) {
  const [datos, setDatos] = useState({ nombre: original?.nombre ?? '', descripcion: original?.descripcion ?? '',
    zonaId: original?.zona_id ?? '', coordinadorId: original?.coordinador_id ?? '' });
  const [resumen, setResumen] = useState(false);
  const cambiar = (campo, valor) => setDatos(anterior => ({ ...anterior, [campo]: valor }));
  const zonas = directorio.zonas.filter(z => z.activo || z.id === original?.zona_id).sort(porNombre);
  const responsables = directorio.coordinadores.filter(p => p.activo || p.id === original?.coordinador_id)
    .sort((a,b) => nombrePersona(a).localeCompare(nombrePersona(b), 'es-MX'));
  return <DialogoCobertura tituloId="eq-form-titulo" cancelar={cancelar}>
    <h2 id="eq-form-titulo">{original ? 'Editar equipo' : 'Crear equipo'}</h2>
    <form className="eq-form" onSubmit={e => { e.preventDefault(); if (!guardando) { if (resumen) guardar(datos); else setResumen(true); } }}>
      {resumen ? <p><strong>{datos.nombre}</strong> · {zonas.find(z => z.id === datos.zonaId)?.nombre}<br/>
        Coordinador responsable · {nombrePersona(responsables.find(p => p.id === datos.coordinadorId))}</p> : <>
        <label>Nombre del equipo<input required className="za-control" value={datos.nombre} onChange={e => cambiar('nombre',e.target.value)}/></label>
        <label>Descripción (opcional)<textarea className="za-control" value={datos.descripcion} onChange={e => cambiar('descripcion',e.target.value)}/></label>
        <label>Zona<select required className="za-control" value={datos.zonaId} onChange={e => cambiar('zonaId',e.target.value)}>
          <option value="">Selecciona una zona</option>{zonas.map(z => <option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select></label>
        <label>Coordinador responsable<select required className="za-control" value={datos.coordinadorId} onChange={e => cambiar('coordinadorId',e.target.value)}>
          <option value="">Selecciona un coordinador</option>{responsables.map(p => <option key={p.id} value={p.id}>{nombrePersona(p)}</option>)}</select></label>
      </>}
      {error && <p role="alert" className="za-notice za-notice--error">{error}</p>}
      <div className="za-dialog-actions"><button type="button" className="za-button za-button--soft" disabled={guardando} onClick={cancelar}>Cancelar</button>
        {resumen && <button type="button" className="za-button za-button--soft" disabled={guardando} onClick={() => setResumen(false)}>Volver</button>}
        <button className="za-button za-button--primary" disabled={guardando || !datos.nombre.trim() || !datos.zonaId || !datos.coordinadorId}>
          {guardando ? 'Guardando…' : resumen ? 'Confirmar' : 'Revisar'}</button></div>
    </form></DialogoCobertura>;
}

function Historial({ userId, id }) {
  const [abierto, setAbierto] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    async function cargar() {
      try {
        const datos = await servicioEquipos().historial(userId, id, pagina);
        if (vigente) setRespuesta({ pagina, datos });
      } catch (error) { if (vigente) setRespuesta({ pagina, error: error.message }); }
    }
    void cargar();
    return () => { vigente = false; };
  }, [abierto, pagina, id, userId]);
  const actual = respuesta?.pagina === pagina ? respuesta : null;
  return <section className="eq-history"><button className="za-button za-button--soft" aria-expanded={abierto}
    onClick={() => setAbierto(v => !v)}>{abierto ? 'Ocultar historial' : 'Ver historial del equipo'}</button>
    {abierto && <>{!actual && <p role="status">Cargando historial…</p>}
      {actual?.error && <p role="alert">{actual.error}</p>}
      {actual?.datos && <>{!actual.datos.filas.length && <p>Sin movimientos en esta página.</p>}
        <ul className="eq-people">{actual.datos.filas.map(f => <li key={f.evento_id}><div>
          <strong>{f.tipo_evento.replaceAll('_',' ')}</strong><small>{[f.actor_nombre, f.trabajador_nombre].filter(Boolean).join(' · ')}</small></div>
          <time dateTime={f.fecha_evento}>{fecha.format(new Date(f.fecha_evento))}</time></li>)}</ul>
        <div className="eq-actions"><button className="za-button za-button--soft" disabled={!pagina} onClick={() => setPagina(v => v - 1)}>Anterior</button>
          <span>Página {pagina + 1}</span><button className="za-button za-button--soft" disabled={!actual.datos.siguiente} onClick={() => setPagina(v => v + 1)}>Siguiente</button></div>
      </>}
    </>}</section>;
}
