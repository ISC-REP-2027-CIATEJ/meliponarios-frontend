import { useEffect, useRef, useState } from "react";
import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/Register/RegisterPage";
import ExplorePage from "./pages/Explore/ExplorePage";
import MapPage from "./pages/Map/MapPage";
import DetailPage from "./pages/Detail/DetailPage";
import { filtrosIniciales } from "./data/filtros";
import { getSession, logout } from "./services/authService";

function paginaActual() {
  const pagina = window.location.hash.slice(1);
  return ["explorar", "mapa", "register", "login"].includes(pagina) ||
    pagina.startsWith("meliponario/")
    ? pagina
    : "explorar";
}
export default function App() {
  const [page, setPage] = useState(paginaActual);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const origen = useRef("explorar");

  useEffect(() => {
    const actualizar = () => setPage(paginaActual());
    window.addEventListener("hashchange", actualizar);
    return () => window.removeEventListener("hashchange", actualizar);
  }, []);

  useEffect(() => {
    let active = true;

    getSession()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setSessionReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user && (page === "login" || page === "register")) {
      window.location.hash = "explorar";
    }
  }, [page, user]);

  const ir = (pagina) => {
    window.location.hash = pagina;
  };

  function completarLogin(usuario) {
    setUser(usuario);
    ir("explorar");
  }

  async function cerrarSesion() {
    await logout();
    setUser(null);
  }

  function abrirDetalle(id, desde) {
    origen.current = desde;
    ir(`meliponario/${encodeURIComponent(id)}`);
  }
  if (page.startsWith("meliponario/"))
    return (
      <DetailPage
        key={page}
        id={page.slice("meliponario/".length)}
        onBack={() => ir(origen.current)}
        onExplore={() => ir("explorar")}
        onMap={() => ir("mapa")}
        onLogin={() => ir("login")}
      />
    );
  if (page === "mapa")
    return (
      <MapPage
        filtros={filtros}
        onFiltrosChange={setFiltros}
        onExplore={() => ir("explorar")}
        onLogin={() => ir("login")}
        onOpenDetail={(id) => abrirDetalle(id, "mapa")}
      />
    );
  if (page === "explorar")
    return (
      <ExplorePage
        filtrosBusqueda={filtros}
        onFiltrosChange={setFiltros}
        user={user}
        sessionReady={sessionReady}
        onLogout={cerrarSesion}
        onLogin={() => ir("login")}
        onOpenMap={() => ir("mapa")}
        onOpenDetail={(id) => abrirDetalle(id, "explorar")}
      />
    );
  return page === "register" ? (
    <RegisterPage onLogin={() => ir("login")} />
  ) : (
    <LoginPage
      onRegister={() => ir("register")}
      onExplore={() => ir("explorar")}
      onLoginSuccess={completarLogin}
      sessionReady={sessionReady}
    />
  );
}
