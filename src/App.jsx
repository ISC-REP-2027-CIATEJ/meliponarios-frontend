import { useState } from 'react';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
export default function App() {
  const [page, setPage] = useState('login');
  return page === 'register' ? <RegisterPage onLogin={() => setPage('login')} /> : <LoginPage onRegister={() => setPage('register')} />;
}
