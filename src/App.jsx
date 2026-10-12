import { useEffect, useState } from 'react';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ExplorePage from './pages/Explore/ExplorePage';
import MapPage from './pages/Map/MapPage';
import { filtrosIniciales } from './data/filtros';

function paginaActual() {
  const pagina = window.location.hash.slice(1);
  return ['explorar', 'mapa', 'register', 'login'].includes(pagina) ? pagina : 'explorar';
}

export default function App() {
  const [page, setPage] = useState(paginaActual);
  // Lista y mapa comparten los filtros mientras la aplicación está abierta.
  const [filtros, setFiltros] = useState(filtrosIniciales);
  useEffect(() => {
    const actualizar = () => setPage(paginaActual());
    window.addEventListener('hashchange', actualizar);
    return () => window.removeEventListener('hashchange', actualizar);
  }, []);
  const ir = pagina => { window.location.hash = pagina; };
  if (page === 'mapa') return <MapPage filtros={filtros} onFiltrosChange={setFiltros} onExplore={() => ir('explorar')} onLogin={() => ir('login')}/>;
  if (page === 'explorar') return <ExplorePage filtrosBusqueda={filtros} onFiltrosChange={setFiltros} onLogin={() => ir('login')} onOpenMap={() => ir('mapa')}/>;
  return page === 'register' ? <RegisterPage onLogin={() => ir('login')}/> : <LoginPage onRegister={() => ir('register')} onExplore={() => ir('explorar')}/>;
}
