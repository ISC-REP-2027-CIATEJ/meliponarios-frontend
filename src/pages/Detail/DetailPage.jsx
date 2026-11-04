import { ClientAccountLinks } from '../../components/ClientNavigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '../Explore/Icon';
import LocationMap from './LocationMap';
import { usePublicFicha } from '../../features/publicMeliponarios/usePublicMeliponarios';
import PublicGallery from '../../features/publicMeliponarios/PublicGallery';
import { enlaceTelefono } from '../../features/publicMeliponarios/publicApi.mjs';
import './DetailPage.css';

const boton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-solid border-[#d4ddcd] px-4 py-3 text-sm font-semibold transition-colors";
const claro = `${boton} bg-white text-[#163e2c] enabled:hover:bg-[#edf1e7]`;
const verde = `${boton} bg-[#123f2d] text-white enabled:hover:bg-[#23583e]`;
const panel =
  "rounded-2xl border border-solid border-[#e0e5d8] bg-white p-5 sm:p-6";
const botonNavegacion =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-solid border-[#d8ded3] px-5 py-2 text-sm font-semibold text-[#163e2c] transition-colors hover:bg-[#e9eee3]";

function CuentaSesionDetalle({ user, sessionReady, onLogin, onLogout }) {
  const [abierta, setAbierta] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");
  const nombre = user?.name?.trim() || "Mi cuenta";
  const inicial = (user?.name?.trim() || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  async function cerrarSesion() {
    if (!onLogout || cerrando) return;
    setCerrando(true);
    setError("");
    try {
      await onLogout();
      setAbierta(false);
    } catch (err) {
      setError(err.message || "No se pudo cerrar la sesión.");
    } finally {
      setCerrando(false);
    }
  }

  if (!sessionReady)
    return (
      <span className="px-3 text-sm text-[#637063]" role="status">
        Comprobando sesión…
      </span>
    );

  if (!user)
    return onLogin ? (
      <button
        className={`${botonNavegacion} bg-white`}
        type="button"
        onClick={onLogin}
      >
        Iniciar sesión <Icon name="arrow" />
      </button>
    ) : null;

  return (
    <div className="relative">
      <button
        className={`${botonNavegacion} bg-white`}
        type="button"
        aria-expanded={abierta}
        aria-controls="opciones-cuenta-detalle"
        onClick={() => {
          setAbierta(!abierta);
          setError("");
        }}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8edde] text-sm font-bold">
          {inicial}
        </span>
        <span className="flex min-w-0 flex-col items-start text-left leading-tight">
          <span className="max-w-[145px] truncate">{nombre}</span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-[#80682a]">
            <Icon name="bee" size={12} />
            <span className="max-w-[145px] truncate">
              {user.roleName || "Rol no disponible"}
            </span>
          </span>
        </span>
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full bg-[#edf1e7] text-[#607250] transition-transform ${abierta ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {abierta && (
        <div
          id="opciones-cuenta-detalle"
          className="absolute right-0 top-full z-[1200] mt-2 min-w-60 rounded-2xl border border-solid border-[#dce1d4] bg-white p-4 text-left shadow-lg"
        >
          <p className="text-sm font-semibold">{nombre}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#80682a]">
            <Icon name="bee" size={14} />
            {user.roleName || "Rol no disponible"}
          </p>
          {user.email && (
            <p className="mt-3 break-all text-xs text-[#637063]">
              {user.email}
            </p>
          )}
          <ClientAccountLinks user={user}/>
      {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-[#fff0ed] p-2 text-xs text-[#842a20]"
            >
              {error}
            </p>
          )}
          <button
            className="mt-4 min-h-10 w-full rounded-lg border border-solid border-[#d8ded3] bg-white px-3 py-2 text-left text-sm hover:bg-[#edf1e7]"
            type="button"
            onClick={cerrarSesion}
            disabled={!onLogout || cerrando}
          >
            {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}

function CabeceraDetalle({
  onExplore,
  onMap,
  onLogin,
  user,
  sessionReady,
  onLogout,
}) {
  return (
    <header className="border-0 border-b border-solid border-[#e0e5d7] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="text-[#ad7f25]">
            <Icon name="bee" size={34} />
          </span>
          <div>
            <span className="text-2xl font-extrabold tracking-tight">
              KaabMap
            </span>
            <p className="pt-1 text-[10px] tracking-[0.2em]">
              MELIPONARIOS DE YUCATÁN
            </p>
          </div>
        </div>
        <nav
          aria-label="Navegación principal"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            className={botonNavegacion + " bg-white"}
            type="button"
            onClick={onExplore}
          >
            Explorar
          </button>
          <button
            className={botonNavegacion + " bg-white"}
            type="button"
            onClick={onMap}
          >
            <Icon name="map" />
            Mapa
          </button>
          <CuentaSesionDetalle
            user={user}
            sessionReady={sessionReady}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </nav>
      </div>
    </header>
  );
}

export default function DetailPage({ id, onBack, onExplore, onMap, onLogin, user, sessionReady = true, onLogout }) {
  const publicacion = usePublicFicha(id);
  const sitio = publicacion.item;
  const telefono = enlaceTelefono(sitio?.telefonoContacto);
  const [compartido, setCompartido] = useState('');
  const [mapaAmpliado, setMapaAmpliado] = useState(false);
  const cabecera = useRef(null);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); cabecera.current?.focus({ preventScroll: true }); }, [id]);
  async function compartir() {
    try { await navigator.clipboard.writeText(window.location.href); setCompartido('Enlace copiado.'); }
    catch { setCompartido('Puedes copiar la dirección desde la barra del navegador.'); }
  }
  return <div className="detail-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
    <CabeceraDetalle onExplore={onExplore} onMap={onMap} onLogin={onLogin} user={user} sessionReady={sessionReady} onLogout={onLogout}/>
    <main className="mx-auto max-w-7xl px-5 pb-14 pt-8 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><button type="button" className={claro} onClick={onBack}>Volver</button><button type="button" className={claro} disabled={publicacion.loading} onClick={publicacion.recargar}>Actualizar ficha</button></div>
      {publicacion.loading ? <section className={panel} role="status"><h1 className="text-2xl font-bold">Cargando ficha pública…</h1></section> : publicacion.error ? <section className={panel} role="alert"><h1 className="text-2xl font-bold">No pudimos cargar la ficha</h1><p className="my-4">{publicacion.error}</p><button type="button" className={verde} onClick={publicacion.recargar}>Reintentar</button></section> : !sitio ? <section className={panel}><h1 className="text-3xl font-bold">Ficha pública no disponible</h1><p className="my-5">La dirección no corresponde a un meliponario publicado.</p><button type="button" className={verde} onClick={onExplore}>Volver a Explorar</button></section> : <>
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5"><div><p className="mb-3 text-xs font-bold tracking-[0.18em] text-[#866820]">MELIPONARIO APROBADO</p><h1 ref={cabecera} tabIndex={-1} className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sitio.nombre}</h1><p className="mt-3 flex items-center gap-2 text-sm text-[#65715f]"><Icon name="pin" size={18}/>{sitio.localidad}, {sitio.municipio}, Yucatán</p></div><div><button type="button" className={claro} onClick={compartir}>Copiar enlace</button><p role="status" className="mt-2 text-xs">{compartido}</p></div></div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div className="grid min-w-0 gap-6">
            <PublicGallery key={sitio.id} id={sitio.id} nombre={sitio.nombre}/>
            <section className={panel}><h2 className="text-xl font-bold">Conoce el meliponario</h2><p className="mt-3 text-sm font-semibold text-[#65715f]">{sitio.informacionTecnicaVerificada ? 'Información técnica verificada' : 'Información básica aprobada'}</p><p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[#52634c]">{sitio.descripcion || 'Esta ficha no incluye una descripción.'}</p><div className="mt-5 flex flex-wrap gap-2">{sitio.vendeMiel && <span className="rounded-full bg-[#fff3c9] px-4 py-2 text-sm text-[#76520d]">Vende miel</span>}{sitio.recibeVisitas && <span className="rounded-full bg-[#e6f3e8] px-4 py-2 text-sm text-[#245b35]">Recibe visitas</span>}{!sitio.vendeMiel && !sitio.recibeVisitas && <span className="text-sm text-[#65715f]">Sin actividades de venta o visitas declaradas.</span>}</div></section>
            <section className={panel}><h2 className="flex items-center gap-2 text-xl font-bold"><Icon name="bee"/>Tipos de abejas</h2><p className="mt-4 text-sm leading-relaxed text-[#65715f]">Los tipos de abejas todavía no están disponibles en la ficha pública.</p></section>
            <section className={panel}><h2 className="flex items-center gap-2 text-xl font-bold"><Icon name="bag"/>Productos de la colmena</h2><p className="mt-4 text-sm leading-relaxed text-[#65715f]">El catálogo de productos de este meliponario todavía no está disponible.</p></section>
          </div>
          <aside className="grid min-w-0 gap-6">
            <section className={panel}><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Icon name="map"/>Ubicación pública</h2><p className="mb-4 text-sm leading-relaxed text-[#65715f]">{sitio.ubicacionAproximada ? 'Ubicación aproximada para proteger el punto exacto. No debe usarse para llegar al lugar.' : 'El titular autorizó mostrar esta ubicación exacta en la ficha aprobada.'}</p><LocationMap coordenadas={sitio.coordenadas} nombre={sitio.nombre} aproximada={sitio.ubicacionAproximada} ampliado={mapaAmpliado}/><button type="button" className={`${claro} mt-4 w-full`} aria-pressed={mapaAmpliado} onClick={() => setMapaAmpliado(!mapaAmpliado)}>{mapaAmpliado ? 'Reducir mapa' : 'Ampliar mapa'}</button>{!sitio.ubicacionAproximada && <a className={`${verde} mt-3 w-full no-underline`} href={`https://www.google.com/maps/dir/?api=1&destination=${sitio.coordenadas.join(',')}`} target="_blank" rel="noopener noreferrer">Consultar ruta</a>}</section>
            <section className={panel}><h2 className="text-xl font-bold">Contacto y visitas</h2><p className="mt-3 text-xs leading-relaxed text-[#65715f]">Datos que el titular autorizó publicar.</p><dl className="mt-4 grid gap-4 text-sm"><div><dt className="font-semibold">Nombre de contacto</dt><dd className="mt-1 break-words text-[#52634c]">{sitio.nombreContacto}</dd></div><div><dt className="font-semibold">Teléfono de contacto</dt><dd className="mt-1 break-words">{telefono ? <a href={telefono} className="text-[#163e2c] underline">{sitio.telefonoContacto}</a> : sitio.telefonoContacto}</dd></div></dl></section>
            <p className="px-2 text-xs leading-relaxed text-[#65715f]">La ficha muestra la información aprobada para su publicación. Las observaciones de revisión son privadas.</p>
          </aside>
        </div>
      </>}
    </main>
    <footer className="mx-auto max-w-7xl border-0 border-t border-solid border-[#e1e5d9] px-5 py-6 text-xs text-[#637063] lg:px-10">KaabMap · Conocer · Conservar · Conectar</footer>
  </div>;
}
