import { useEffect, useRef, useState } from 'react';
import { OwnerHeader } from '../../components/ClientNavigation';
import { isAdminUser, normalizar } from '../../features/adminUsers/adminUsersModel.mjs';
import { crearCatalogo } from '../../features/adminProducts/catalogApi.mjs';
import { almacenProductos } from '../../features/adminProducts/catalogStorage.mjs';
import { comprobarConfiguracion, supabase } from '../../lib/supabase';
import { DialogoCobertura } from '../AdminCoverage/AdminCoverageMunicipal';
import '../AdminAssignments/AdminAssignmentsPage.css';
import './AdminProductsPage.css';

const catalogo = crearCatalogo(supabase, almacenProductos);
const boton = 'km-button';
const primario = 'km-button km-button--primary';

function Foto({ ruta, archivo, nombre }) {
  const [resultado, mostrar] = useState(null);
  useEffect(() => {
    let vigente = true;
    let url;
    if (archivo || (ruta && almacenProductos.bucket)) {
      Promise.resolve(archivo || catalogo.foto(ruta)).then(blob => {
        if (vigente) {
          url = URL.createObjectURL(blob);
          mostrar({ archivo, ruta, url });
        }
      }).catch(() => { if (vigente) mostrar({ archivo, ruta, error: true }); });
    }
    return () => { vigente = false; if (url) URL.revokeObjectURL(url); };
  }, [archivo, ruta]);
  const actual = resultado?.ruta === ruta && resultado?.archivo === archivo ? resultado : null;
  return <div className="cp-foto">{actual?.url
    ? <img src={actual.url} alt={nombre || 'Fotografía del producto'} onError={() => mostrar({ archivo, ruta, error: true })}/>
    : <span>{actual?.error ? 'Imagen no disponible' : !archivo && !almacenProductos.bucket ? 'Almacén sin configurar' : ruta || archivo ? 'Cargando fotografía…' : 'Selecciona una fotografía'}</span>}</div>;
}

function Editor({ producto, ocupado, error, bloqueado, cerrar, guardar }) {
  const [nombre, setNombre] = useState(producto?.nombre || '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '');
  const [archivo, setArchivo] = useState(null);
  const puedeGuardar = nombre.trim() && (archivo || producto?.imagen_storage);
  return <DialogoCobertura tituloId="cp-editor-titulo" cancelar={cerrar}>
    <form className="cp-form" onSubmit={e => { e.preventDefault(); if (puedeGuardar) guardar({ nombre, descripcion, archivo }); }}>
      <h2 id="cp-editor-titulo">{producto ? 'Editar producto' : 'Crear producto'}</h2>
      <fieldset disabled={ocupado || bloqueado}><label>Nombre del producto<input autoFocus required value={nombre} onChange={e => setNombre(e.target.value)}/></label>
        <label>Descripción <small>(opcional)</small><textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)}/></label>
        <label>{producto ? 'Reemplazar fotografía (opcional)' : 'Fotografía del producto'}
          <input type="file" required={!producto} accept="image/jpeg,image/png,image/webp"
            onChange={e => setArchivo(e.target.files?.[0] || null)}/>
        </label>
        {producto && <small>Si guardas sin elegir una imagen, se conserva la fotografía actual.</small>}
        <Foto ruta={producto?.imagen_storage} archivo={archivo} nombre={nombre}/>
      </fieldset>
      {error && <p role="alert" className="cp-error">{error}</p>}
      <div className="cp-acciones"><button type="button" className={boton} disabled={ocupado} onClick={cerrar}>Cerrar</button>
        <button className={primario} disabled={ocupado || bloqueado || !puedeGuardar}>{ocupado ? 'Guardando…' : 'Guardar producto'}</button></div>
    </form></DialogoCobertura>;
}

function Catalogo({ user }) {
  const [revision, refrescar] = useState(0);
  const [lista, setLista] = useState(null);
  const [errorLista, setErrorLista] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('todos');
  const [pagina, setPagina] = useState(0);
  const [dialogo, abrir] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [bloqueado, bloquear] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let vigente = true;
    Promise.resolve().then(() => { comprobarConfiguracion(); return catalogo.listar(user.id); })
      .then(rows => { if (vigente) setLista(rows.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es-MX') || a.id.localeCompare(b.id))); })
      .catch(e => { if (vigente) setErrorLista(e.message || 'No se pudo consultar el catálogo.'); });
    return () => { vigente = false; };
  }, [user.id, revision]);

  function actualizar() { setLista(null); setErrorLista(''); refrescar(n => n+1); }
  function editar(tipo, producto = null) { setMensaje(''); setError(''); bloquear(false); abrir({ tipo, producto }); }
  function cerrar() { if (!lock.current) { abrir(null); if (bloqueado) actualizar(); } }
  async function enviar(valores) {
    if (lock.current || bloqueado) return;
    lock.current = true; setOcupado(true); setError('');
    const { tipo, producto } = dialogo;
    try {
      if (tipo === 'estado') await catalogo.cambiarEstado(user.id, producto);
      else await catalogo.guardar(user.id, producto, valores);
      setMensaje(tipo === 'estado' ? (producto.activo ? 'Producto desactivado.' : 'Producto activado.') : 'Producto guardado.');
      abrir(null); actualizar();
    } catch (e) {
      setError(e.message || 'No se pudo confirmar la operación. Actualiza el catálogo.');
      if (e.incierto || tipo === 'estado') bloquear(true);
    } finally { lock.current = false; setOcupado(false); }
  }

  const texto = normalizar(buscar);
  const filas = (lista || []).filter(p => (estado === 'todos' || p.activo === (estado === 'activos')) &&
    normalizar([p.nombre,p.descripcion].filter(Boolean).join(' ')).includes(texto));
  const paginas = Math.max(1, Math.ceil(filas.length/12));
  const actual = Math.min(pagina, paginas-1);
  return <main className="km-container km-workspace cp-page">
    <header className="km-work-banner km-page-heading"><div><h1 className="km-page-title">Catálogo de productos</h1>
      <p>Administra los productos que los propietarios podrán elegir para sus meliponarios.</p></div>
      <button className={primario} disabled={!lista} onClick={() => editar('editar')}>Crear producto</button></header>
    <section className="km-panel km-inset"><div className="cp-filtros">
      <label>Buscar producto<input type="search" value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(0); }}/></label>
      <label>Estado<select value={estado} onChange={e => { setEstado(e.target.value); setPagina(0); }}>
        <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></label>
      <button className={boton} disabled={!lista && !errorLista} onClick={actualizar}>Actualizar catálogo</button></div>
      {mensaje && <p role="status">{mensaje}</p>}{errorLista && <p role="alert" className="cp-error">{errorLista}</p>}
      {!lista && !errorLista && <p role="status">Consultando catálogo…</p>}
      {lista && <><p className="cp-total">{filas.length} {filas.length === 1 ? 'producto' : 'productos'}</p>
        {!filas.length && <p>{lista.length ? 'Sin resultados para esta búsqueda.' : 'El catálogo está vacío. Puedes crear el primer producto.'}</p>}
        <div className="cp-grid">{filas.slice(actual*12, actual*12+12).map(p => <article key={p.id} className="cp-item">
          <Foto ruta={p.imagen_storage} nombre={p.nombre}/>
          <div className="cp-info"><span className={p.activo ? 'cp-activo' : 'cp-inactivo'}>{p.activo ? 'Activo' : 'Inactivo'}</span>
          <h2>{p.nombre}</h2>{p.descripcion && <p>{p.descripcion}</p>}
          <div className="cp-acciones"><button className={boton} onClick={() => editar('editar',p)}>Editar</button>
          <button className="km-button km-button--soft" onClick={() => editar('estado',p)}>{p.activo ? 'Desactivar' : 'Activar'}</button></div></div></article>)}</div>
        {paginas > 1 && <nav className="cp-acciones" aria-label="Paginación"><button className={boton} disabled={!actual} onClick={() => setPagina(actual-1)}>Anterior</button>
          <span>{actual+1} de {paginas}</span><button className={boton} disabled={actual+1===paginas} onClick={() => setPagina(actual+1)}>Siguiente</button></nav>}</>}
    </section>
    {dialogo?.tipo === 'editar' && <Editor producto={dialogo.producto} ocupado={ocupado} bloqueado={bloqueado} error={error} cerrar={cerrar} guardar={enviar}/>}
    {dialogo?.tipo === 'estado' && <DialogoCobertura tituloId="cp-estado" cancelar={cerrar}><div className="cp-form">
      <h2 id="cp-estado">{dialogo.producto.activo ? 'Desactivar' : 'Activar'} producto</h2>
      <p>¿Confirmas el cambio de estado de <strong>{dialogo.producto.nombre}</strong> en el catálogo?</p>
      {error && <p role="alert" className="cp-error">{error}</p>}
      <div className="cp-acciones"><button className={boton} disabled={ocupado} onClick={cerrar}>Cerrar</button>
        <button className={primario} disabled={ocupado || bloqueado} onClick={() => enviar()}>{ocupado ? 'Guardando…' : 'Confirmar'}</button></div></div></DialogoCobertura>}
  </main>;
}

export default function AdminProductsPage({ user, sessionReady, onLogout }) {
  return <div className="km-with-nav"><OwnerHeader user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    {!sessionReady ? <main className="km-container p-8" role="status">Comprobando sesión…</main> : isAdminUser(user)
      ? <Catalogo key={user.id} user={user}/>
      : <main className="km-container p-8"><h1 className="km-page-title">Acceso reservado</h1>
        <p>Para administrar el catálogo necesitas una cuenta de administrador general.</p>
        <a className={boton} href={user ? '#explorar' : '#login'}>{user ? 'Volver a Explorar' : 'Iniciar sesión'}</a></main>}</div>;
}
