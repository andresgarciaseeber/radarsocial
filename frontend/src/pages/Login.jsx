import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { login as apiLogin } from '../api/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const data = await apiLogin(email, password);
      login(data.token, data.usuario);
      navigate('/cuentas');
    } catch {
      setError('Credenciales inválidas. Verificá email y contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-primario)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-superficie)',
        borderRadius: 12,
        padding: '40px 36px',
        width: 360,
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
      }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primario)', marginBottom: 4 }}>
          Radar Social
        </h1>
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.88rem', marginBottom: 32 }}>
          La Rioja — Panel de administración
        </p>

        <form onSubmit={handleSubmit}>
          <label style={labelSt}>Email</label>
          <input
            type="email" value={email} required
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@radarsocial.com"
            style={inputSt}
          />

          <label style={{ ...labelSt, marginTop: 16 }}>Contraseña</label>
          <input
            type="password" value={password} required
            onChange={e => setPassword(e.target.value)}
            style={inputSt}
          />

          {error && (
            <p style={{ color: 'var(--color-acento)', fontSize: '0.83rem', marginTop: 12 }}>{error}</p>
          )}

          <button type="submit" disabled={cargando} style={{ ...btnSt, marginTop: 24 }}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelSt = {
  display: 'block', fontSize: '0.83rem', fontWeight: 600,
  color: 'var(--color-texto)', marginBottom: 6,
};
const inputSt = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #D1D5DB', borderRadius: 6,
  fontSize: '0.9rem', fontFamily: 'var(--fuente-base)',
  outline: 'none', boxSizing: 'border-box', color: 'var(--color-texto)',
};
const btnSt = {
  width: '100%', padding: '12px',
  background: 'var(--color-primario)', color: '#fff',
  border: 'none', borderRadius: 6,
  fontSize: '0.9rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--fuente-base)',
};
