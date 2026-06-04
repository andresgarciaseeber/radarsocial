import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setCargando(false); return; }

    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUsuario(r.data.usuario))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCargando(false));
  }, []);

  function login(token, usuario) {
    localStorage.setItem('token', token);
    setUsuario(usuario);
  }

  function logout() {
    localStorage.removeItem('token');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
