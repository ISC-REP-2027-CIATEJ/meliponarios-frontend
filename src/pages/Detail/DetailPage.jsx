import { ClientAccountLinks } from '../../components/ClientNavigation';
import { useEffect, useRef, useState } from "react";
import { meliponarios } from "../../data/meliponarios";
import {
  detalleMeliponarios,
  abejasDetalle,
  productosDetalle,
} from "../../data/detalleMeliponarios";
import { ubicacionesDemo } from "../../data/ubicacionesDemo";
import Icon from "../Explore/Icon";
import DetailIcon from "./DetailIcon";
import LocationMap from "./LocationMap";
import useSpeciesAudio from "./useSpeciesAudio";
import {
  imagenDetalle,
  imagenSitio,
  enlacesContacto,
  enlaceRuta,
} from "./detailHelpers";
import "./DetailPage.css";

const boton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-solid border-[#d4ddcd] px-4 py-3 text-sm font-semibold transition-colors";
const claro = `${boton} bg-white text-[#163e2c] enabled:hover:bg-[#edf1e7]`;
const verde = `${boton} bg-[#123f2d] text-white enabled:hover:bg-[#23583e]`;
const titulo = "flex items-center gap-2 text-xl font-bold tracking-tight";
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

export default function DetailPage({
  id,
  onBack,
  onExplore,
  onMap,
  onLogin,
  user,
  sessionReady = true,
  onLogout,
}) {
  const sitio = meliponarios.find((m) => m.id === id && m.estado === "Activo");
  const detalle = sitio ? detalleMeliponarios[id] : null;
  const [foto, setFoto] = useState(0);
  const [categoria, setCategoria] = useState("Todos");
  const [modal, setModal] = useState(null);
  const [compartido, setCompartido] = useState("");
  const ventana = useRef(null);
  const cabecera = useRef(null);
  const sonido = useSpeciesAudio();
  const compartirSolicitud = useRef(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    cabecera.current?.focus({ preventScroll: true });
    return () => {
      compartirSolicitud.current++;
    };
  }, []);
  if (!sitio || !detalle)
    return (
      <div className="detail-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
        <CabeceraDetalle
          onExplore={onExplore}
          onMap={onMap}
          onLogin={onLogin}
          user={user}
          sessionReady={sessionReady}
          onLogout={onLogout}
        />
        <main className="mx-auto max-w-xl px-5 py-16">
          <h1 className="text-3xl">No encontramos ese meliponario</h1>
          <p className="my-5">
            La dirección no corresponde a un registro disponible.
          </p>
          <button className={verde} onClick={onExplore}>
            Volver a Explorar
          </button>
        </main>
      </div>
    );

  const productos = detalle.productos.map((key) => ({
    id: key,
    ...productosDetalle[key],
  }));
  const categorias = ["Todos", ...new Set(productos.map((p) => p.categoria))];
  const visibles = productos.filter(
    (p) => categoria === "Todos" || p.categoria === categoria,
  );
  const contactos = enlacesContacto(detalle.responsable);
  const ruta = enlaceRuta(detalle.venta);
  const punto = ruta ? detalle.venta.coordenadas : ubicacionesDemo[id];
  function abrir(valor) {
    sonido.detener();
    setModal(valor);
    ventana.current.showModal();
  }
  function cerrar() {
    sonido.detener();
    ventana.current.close();
  }
  function moverFoto(paso) {
    setFoto(
      (actual) =>
        (actual + paso + detalle.galeria.length) % detalle.galeria.length,
    );
  }
  async function compartir() {
    const solicitud = ++compartirSolicitud.current;
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (solicitud === compartirSolicitud.current)
        setCompartido("Enlace copiado.");
    } catch {
      if (solicitud === compartirSolicitud.current) {
        setCompartido(
          "Copia la dirección desde la barra de tu navegador para compartir esta ficha.",
        );
      }
    }
  }
  function botonAudio(nombre, especie) {
    const reproduciendo = sonido.activo === nombre;
    const cargando = sonido.cargando === nombre;
    return (
      <button
        type="button"
        className={`${claro} shrink-0 disabled:cursor-default disabled:opacity-70`}
        disabled={!especie.audio}
        aria-label={
          !especie.audio
            ? `Audio pendiente de ${nombre}`
            : `${reproduciendo || cargando ? "Detener" : "Escuchar"} ${nombre}`
        }
        aria-pressed={reproduciendo}
        onClick={() => sonido.reproducir(nombre, especie.audio)}
      >
        <DetailIcon name={reproduciendo ? "stop" : "sound"} />
        <span>
          {!especie.audio
            ? "Audio pendiente"
            : cargando
              ? "Cargando…"
              : reproduciendo
                ? "Detener"
                : "Escuchar"}
        </span>
      </button>
    );
  }

  return (
    <div className="detail-page min-h-screen bg-[#f8f7f1] text-[#163e2c]">
      <CabeceraDetalle
        onExplore={onExplore}
        onMap={onMap}
        onLogin={onLogin}
        user={user}
        sessionReady={sessionReady}
        onLogout={onLogout}
      />
      <main className="mx-auto max-w-7xl px-5 pb-12 pt-5 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-sm font-semibold text-[#34523a] hover:bg-[#edf1e7]"
            onClick={onBack}
          >
            ← Volver
          </button>
          <span className="rounded-full bg-[#fff0bf] px-3 py-2 text-xs text-[#745211]">
            Datos e imágenes de demostración
          </span>
        </div>
        <section aria-label="Galería del meliponario" className="relative">
          <button
            className="block w-full overflow-hidden rounded-3xl border-0 bg-[#e0e7d8] p-0"
            onClick={() => abrir({ tipo: "galeria" })}
            aria-label="Ampliar fotografía principal"
          >
            <img
              src={imagenSitio(detalle.galeria[foto])}
              alt={`Vista ilustrativa ${foto + 1} de ${sitio.nombre}`}
              className="block aspect-[16/10] max-h-[450px] w-full object-cover sm:aspect-[16/6]"
            />
          </button>
          <div className="absolute bottom-4 left-4 flex gap-2">
            <button
              className="grid min-h-11 min-w-11 place-items-center rounded-full border-0 bg-white text-xl text-[#163e2c] shadow"
              onClick={() => moverFoto(-1)}
              aria-label="Fotografía anterior"
            >
              ←
            </button>
            <button
              className="grid min-h-11 min-w-11 place-items-center rounded-full border-0 bg-white text-xl text-[#163e2c] shadow"
              onClick={() => moverFoto(1)}
              aria-label="Fotografía siguiente"
            >
              →
            </button>
          </div>
          <button
            className="absolute bottom-4 right-4 flex min-h-11 items-center gap-2 rounded-xl border-0 bg-white px-3 py-2 text-sm text-[#163e2c] shadow"
            onClick={() => abrir({ tipo: "galeria" })}
          >
            <DetailIcon name="expand" size={18} />
            <span>
              {foto + 1} / {detalle.galeria.length}
            </span>
          </button>
        </section>
        <div className="mt-3 flex gap-2" aria-label="Elegir fotografía">
          {detalle.galeria.map((img, i) => (
            <button
              key={img}
              onClick={() => setFoto(i)}
              aria-label={`Ver fotografía ${i + 1}`}
              aria-pressed={foto === i}
              className={`overflow-hidden rounded-xl border-2 border-solid bg-white p-1 ${foto === i ? "border-[#164c35]" : "border-transparent"}`}
            >
              <img
                src={imagenSitio(img)}
                alt=""
                className="block h-14 w-20 rounded-lg object-cover"
              />
            </button>
          ))}
        </div>
        <div className="mb-7 mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              ref={cabecera}
              tabIndex={-1}
              className="text-3xl font-extrabold tracking-tight sm:text-4xl"
            >
              {sitio.nombre}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-base text-[#65715f]">
              <Icon name="pin" size={18} />
              {sitio.municipio}, Yucatán
            </p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Tipos de abejas registradas">
              {detalle.abejas.map((abeja) => (
                <span key={abeja.especie} className="flex items-center gap-2 rounded-full bg-[#e8eddf] px-3 py-2 text-xs">
                  <Icon name="bee" size={16} />
                  {abeja.especie}
                </span>
              ))}
            </div>
          </div>
          <div>
            <button className={claro} onClick={compartir}>
              <DetailIcon name="share" />
              Copiar enlace
            </button>
            <p
              className="mt-2 max-w-xs text-xs leading-relaxed text-[#65715f]"
              role="status"
            >
              {compartido}
            </p>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-6">
            <section className={panel} aria-labelledby="sobre">
              <h2 id="sobre" className={titulo}>
                Sobre este meliponario
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#5b6957]">
                {detalle.descripcion}
              </p>
            </section>
            <section className={panel} aria-labelledby="abejas-titulo">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="abejas-titulo" className={titulo}>
                  <Icon name="bee" />
                  Abejas registradas
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#65715f]">
                Pulsa una fotografía para ampliarla y conocer más sobre cada tipo de abeja. Las
                grabaciones se incorporarán cuando las proporcione el centro.
              </p>
              <div className="mt-5 grid gap-4">
                {detalle.abejas.map((c) => {
                  const abeja = abejasDetalle[c.especie];
                  return (
                    <article
                      key={c.especie}
                      className="rounded-2xl border border-solid border-[#e2e7db] bg-[#fafbf7] p-3 sm:p-4"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          className="shrink-0 overflow-hidden rounded-xl border-0 bg-[#edf1e7] p-0"
                          onClick={() =>
                            abrir({ tipo: "abeja", registro: c })
                          }
                          aria-label={`Ver información de ${c.especie}`}
                        >
                          <img
                            src={imagenDetalle(abeja.imagen)}
                            alt={`Ilustración de abeja para ${c.especie}; identificación pendiente de validar`}
                            className="block h-20 w-20 object-cover"
                          />
                        </button>
                        <button
                          className="min-h-11 min-w-0 border-0 bg-transparent p-0 text-left text-[#163e2c]"
                          onClick={() =>
                            abrir({ tipo: "abeja", registro: c })
                          }
                        >
                          <span className="block text-base font-bold italic">
                            {c.especie}
                          </span>
                          <span className="mt-1 block text-sm text-[#65715f]">
                            {abeja.nombreComun}
                          </span>
                          <span className="mt-2 block text-xs text-[#916e22]">
                            Imagen ilustrativa · ampliar ↗
                          </span>
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {botonAudio(c.especie, abeja)}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p role="status" className="mt-3 text-sm text-[#9a3d24]">
                {sonido.error}
              </p>
            </section>
          </div>
          <aside className="grid gap-4 lg:sticky lg:top-5" aria-label="Responsable">
            <button
              className={`${panel} w-full text-left text-[#163e2c] hover:bg-[#f2f5ec]`}
              onClick={() => abrir({ tipo: "responsable" })}
            >
              <span className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#e4ebd9] text-lg font-bold">
                  {detalle.responsable.iniciales}
                </span>
                <span>
                  <span className="block text-xs text-[#65715f]">
                    Responsable
                  </span>
                  <span className="mt-1 block font-bold">
                    {detalle.responsable.nombre}
                  </span>
                </span>
              </span>
              <span className="mt-4 flex items-center justify-between text-sm font-semibold">
                Conocer al responsable <Icon name="arrow" size={18} />
              </span>
            </button>
          </aside>
        </div>
        <section className={`${panel} mt-6`} aria-labelledby="productos-titulo">
          <h2 id="productos-titulo" className={titulo}>
            <Icon name="bag" />
            Productos disponibles
          </h2>
          <p className="mt-3 text-sm text-[#65715f]">
            Conoce lo que el responsable publica y consulta directamente su
            disponibilidad.
          </p>
          {productos.length ? (
            <>
              <div
                className="mt-4 flex flex-wrap gap-2"
                aria-label="Categorías de productos"
              >
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    className={categoria === cat ? verde : claro}
                    aria-pressed={categoria === cat}
                    onClick={() => setCategoria(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibles.map((p) => (
                  <button
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-solid border-[#e1e6d9] bg-[#fcfcf8] p-0 text-left text-[#163e2c] transition-shadow hover:shadow-md"
                    onClick={() => abrir({ tipo: "producto", producto: p })}
                    aria-label={`Ver producto: ${p.nombre}`}
                  >
                    <img
                      src={imagenDetalle(p.imagen)}
                      alt={`Imagen ilustrativa de ${p.nombre}`}
                      className="block aspect-[4/3] w-full object-cover"
                    />
                    <span className="block p-4">
                      <span className="text-xs text-[#7a672f]">
                        {p.categoria}
                      </span>
                      <span className="mt-1 block text-lg font-bold">
                        {p.nombre}
                      </span>
                      <span className="mt-1 block text-sm text-[#65715f]">
                        {p.presentacion}
                      </span>
                      <span
                        className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${p.disponible ? "bg-[#fff0bf] text-[#765310]" : "bg-[#edf1e7] text-[#53634e]"}`}
                      >
                        <Icon name="bag" size={14} />
                        {p.disponible
                          ? "Disponible · ejemplo"
                          : "Consultar disponibilidad"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl bg-[#edf1e7] p-5 text-sm text-[#65715f]">
              Este meliponario todavía no publica productos.
            </div>
          )}
        </section>
        <section className={`${panel} mt-6`} aria-labelledby="venta-titulo">
          <h2 id="venta-titulo" className={titulo}>
            <DetailIcon name="home" />
            Punto de venta
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <div className="relative">
                <LocationMap coordenadas={punto} nombre={sitio.nombre} />
                <button
                  className="absolute inset-x-0 top-0 bottom-6 z-10 rounded-t-2xl border-0 bg-transparent"
                  onClick={() => abrir({ tipo: "ubicacion" })}
                  aria-label="Ampliar mapa del punto de venta"
                >
                  <span className="sr-only">Ampliar mapa</span>
                </button>
              </div>
              <button
                className={`${claro} mt-3 w-full`}
                onClick={() => abrir({ tipo: "ubicacion" })}
              >
                <Icon name="pin" />
                Ampliar ubicación
              </button>
            </div>
            <div className="flex flex-col items-start justify-center">
              <h3 className="text-lg font-bold">{detalle.venta.nombre}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#65715f]">
                {detalle.venta.direccion ||
                  `${sitio.municipio}, Yucatán. La dirección exacta todavía no está publicada.`}
              </p>
              <p className="mt-2 text-sm text-[#65715f]">
                {detalle.venta.horario ||
                  "Horario por confirmar con el responsable."}
              </p>
              {!ruta && (
                <p
                  id="ubicacion-aviso"
                  className="mt-4 rounded-xl bg-[#fff3d2] p-3 text-sm leading-relaxed text-[#765310]"
                >
                  El mapa muestra un punto de demostración. Cómo llegar se
                  habilitará al confirmar la ubicación exacta.
                </p>
              )}
              <div className="mt-5 flex w-full flex-wrap gap-3">
                {ruta ? (
                  <a
                    className={`${claro} no-underline`}
                    href={ruta}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <DetailIcon name="route" />
                    Cómo llegar
                  </a>
                ) : (
                  <button
                    className={`${claro} disabled:cursor-default disabled:opacity-60`}
                    disabled
                    aria-describedby="ubicacion-aviso"
                  >
                    <DetailIcon name="route" />
                    Cómo llegar
                  </button>
                )}
                <button
                  className={verde}
                  onClick={() => abrir({ tipo: "responsable" })}
                >
                  <DetailIcon name="phone" />
                  Contactar productor
                </button>
              </div>
            </div>
          </div>
        </section>
        <p className="mt-8 text-center text-xs leading-relaxed text-[#65715f]">
          KaabMap · Conocer, conservar y conectar.
          <br />
          Datos e imágenes de demostración; la información real se incorporará con el centro.
        </p>
      </main>
      <dialog
        ref={ventana}
        className="m-auto w-[calc(100%-24px)] max-w-3xl rounded-3xl border border-solid border-[#d7dfcf] bg-[#faf9f5] p-5 text-[#163e2c] sm:p-7"
        aria-labelledby="modal-titulo"
        onClose={() => {
          sonido.detener();
          setModal(null);
        }}
        onKeyDown={(e) => {
          if (modal?.tipo === "galeria" && e.key === "ArrowRight") {
            e.preventDefault();
            moverFoto(1);
          }
          if (modal?.tipo === "galeria" && e.key === "ArrowLeft") {
            e.preventDefault();
            moverFoto(-1);
          }
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-titulo" className="text-xl font-bold">
            {modal?.tipo === "responsable"
              ? "Conoce al responsable"
              : modal?.tipo === "abeja"
                ? modal.registro.especie
                : modal?.tipo === "producto"
                  ? modal.producto.nombre
                  : modal?.tipo === "ubicacion"
                    ? "Ubicación del meliponario"
                    : "Galería del meliponario"}
          </h2>
          <button
            className={`${claro} shrink-0`}
            onClick={cerrar}
            aria-label="Cerrar ventana"
          >
            <Icon name="close" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
        {modal?.tipo === "galeria" && (
          <>
            <img
              src={imagenSitio(detalle.galeria[foto])}
              alt={`Fotografía ilustrativa ampliada ${foto + 1} de ${sitio.nombre}`}
              className="block max-h-[65svh] w-full rounded-2xl object-contain"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <button className={claro} onClick={() => moverFoto(-1)}>
                ← Anterior
              </button>
              <span className="text-sm" aria-live="polite">
                {foto + 1} de {detalle.galeria.length}
              </span>
              <button className={claro} onClick={() => moverFoto(1)}>
                Siguiente →
              </button>
            </div>
          </>
        )}
        {modal?.tipo === "responsable" && (
          <>
            <div className="flex items-center gap-4">
              <span className="grid size-20 shrink-0 place-items-center rounded-full bg-[#e4ebd9] text-2xl font-bold">
                {detalle.responsable.iniciales}
              </span>
              <div>
                <h3 className="text-xl font-bold">
                  {detalle.responsable.nombre}
                </h3>
                <p className="mt-2 text-sm text-[#65715f]">
                  {detalle.responsable.rol}
                </p>
              </div>
            </div>
            <p className="mt-5 leading-relaxed text-[#5b6957]">
              {detalle.responsable.descripcion}
            </p>
            {contactos.length ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {contactos.map((c) => (
                  <a
                    key={c.nombre}
                    className={`${verde} no-underline`}
                    href={c.url}
                    target={c.url.startsWith("https:") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                  >
                    {c.nombre}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-[#edf1e7] p-4 text-sm leading-relaxed">
                Contacto pendiente de publicar. Aquí aparecerán el teléfono,
                correo o WhatsApp que autorice el responsable.
              </p>
            )}
          </>
        )}
        {modal?.tipo === "abeja" && (
          <>
            <img
              src={imagenDetalle(
                abejasDetalle[modal.registro.especie].imagen,
              )}
              alt={`Imagen ilustrativa ampliada para ${modal.registro.especie}`}
              className="block max-h-[45svh] w-full rounded-2xl object-contain"
            />
            <p className="mt-4 font-semibold">
              {abejasDetalle[modal.registro.especie].nombreComun}
            </p>
            <p className="mt-3 leading-relaxed text-[#5b6957]">
              {abejasDetalle[modal.registro.especie].descripcion}
            </p>
            <p className="mt-3 rounded-xl bg-[#fff3d2] p-3 text-sm leading-relaxed text-[#765310]">
              {abejasDetalle[modal.registro.especie].nota}
            </p>
            {botonAudio(
              modal.registro.especie,
              abejasDetalle[modal.registro.especie],
            )}
            <p className="mt-3 text-sm text-[#9a3d24]" role="status">
              {sonido.error}
            </p>
          </>
        )}
        {modal?.tipo === "producto" && (
          <>
            <img
              src={imagenDetalle(modal.producto.imagen)}
              alt={`Vista ampliada ilustrativa de ${modal.producto.nombre}`}
              className="block max-h-[50svh] w-full rounded-2xl object-contain"
            />
            <p className="mt-4 text-sm font-semibold">
              {modal.producto.categoria} · {modal.producto.presentacion}
            </p>
            <p className="mt-3 leading-relaxed text-[#5b6957]">
              {modal.producto.descripcion}
            </p>
            <p className="mt-3 text-sm text-[#765310]">
              {modal.producto.disponible
                ? "Disponibilidad de ejemplo: confirmar con el responsable."
                : "Disponibilidad por confirmar."}
            </p>
            <button
              className={`${verde} mt-5`}
              onClick={() => abrir({ tipo: "responsable" })}
            >
              Consultar al responsable
            </button>
          </>
        )}
        {modal?.tipo === "ubicacion" && (
          <>
            <p className="mb-4 text-sm leading-relaxed text-[#65715f]">
              {ruta
                ? detalle.venta.direccion
                : `Punto aproximado de demostración en ${sitio.municipio}. No es la ubicación real del meliponario.`}
            </p>
            <LocationMap
              key={`ampliado-${id}`}
              coordenadas={punto}
              nombre={sitio.nombre}
              ampliado
            />
            {ruta && (
              <a
                href={ruta}
                className={`${verde} mt-4 no-underline`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Cómo llegar <DetailIcon name="route" />
              </a>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
