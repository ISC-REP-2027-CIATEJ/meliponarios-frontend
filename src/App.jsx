import { useEffect, useState } from 'react';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ExplorePage from './pages/Explore/ExplorePage';

// Navegación sencilla; permite abrir y recargar #explorar directamente.
function paginaActual() {
  const pagina = window.location.hash.slice(1);
  return ['explorar', 'register', 'login'].includes(pagina) ? pagina : 'explorar';
}
export default function App() {
  const [page, setPage] = useState(paginaActual);
  useEffect(() => {
    const actualizar = () => setPage(paginaActual());
    window.addEventListener('hashchange', actualizar);
    return () => window.removeEventListener('hashchange', actualizar);
  }, []);
  const ir = pagina => { window.location.hash = pagina; };
  if (page === 'explorar') return <ExplorePage onLogin={() => ir('login')}/>;
  return page === 'register' ? <RegisterPage onLogin={() => ir('login')}/> : <LoginPage onRegister={() => ir('register')} onExplore={() => ir('explorar')}/>;
}
