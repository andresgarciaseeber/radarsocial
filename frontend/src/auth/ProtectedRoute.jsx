import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, soloAdmin = false }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-fondo)' }}>
        <span style={{ color: 'var(--color-texto-secundario)' }}>Cargando...</span>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && usuario.role !== 'admin') return <Navigate to="/cuentas" replace />;

  return children;
}
