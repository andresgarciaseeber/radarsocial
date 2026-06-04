import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listarCuentas } from '../api/cuentas';

const PLAT_COLOR = {
  facebook: '#1877F2', instagram: '#E1306C',
  x: '#000000', tiktok: '#010101',
};

const ESTADO_DOT = {
  conectada:     '#2E7D32',
  pendiente:     '#E0A106',
  token_vencido: '#D62828',
  error:         '#D62828',
  desconectada:  '#9E9E9E',
};

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [cuentas, setCuentas] = useState([]);

  useEffect(() => {
    listarCuentas().then(data => setCuentas(data)).catch(() => {});
  }, [location.pathname]); // refresca al navegar

  function handleLogout() { logout(); navigate('/login'); }

  const esActivo = (to) =>
    location.pathname === to ||
    (to === '/dashboard' && location.pathname.startsWith('/cuenta/'));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        width: 224, flexShrink: 0,
        background: 'var(--color-primario)',
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.01em' }}>
            Radar Social
          </div>
          <div style={{ fontSize: '0.68rem', opacity: 0.5, marginTop: 2 }}>La Rioja</div>
        </div>

        {/* Nav principal */}
        <nav style={{ paddingTop: 6 }}>
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/cuentas',   label: 'Cuentas' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{
              display: 'block', padding: '9px 18px',
              color: '#fff', textDecoration: 'none', fontSize: '0.87rem',
              background: esActivo(to) ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: esActivo(to) ? '3px solid #fff' : '3px solid transparent',
            }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Cuentas monitoreadas (mini-nav) */}
        {cuentas.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '10px 18px 4px', fontSize: '0.62rem', fontWeight: 700, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Monitoreadas
            </div>
            {cuentas.map(c => {
              const id    = c._id || c.id;
              const activ = location.pathname === `/cuenta/${id}`;
              return (
                <Link key={id} to={`/cuenta/${id}`} state={{ cuenta: c }} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 18px', textDecoration: 'none',
                  background: activ ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: activ ? '3px solid rgba(255,255,255,0.6)' : '3px solid transparent',
                }}>
                  {/* Dot de plataforma */}
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: PLAT_COLOR[c.platform] ?? '#6B7280',
                  }} />
                  {/* Dot de estado */}
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: ESTADO_DOT[c.connection_status] ?? '#9E9E9E',
                    marginLeft: -4,
                  }} />
                  <span style={{
                    fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    @{c.handle}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Usuario */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.73rem', opacity: 0.55, marginBottom: 6, wordBreak: 'break-all' }}>
            {usuario?.email}
          </div>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: 4,
            cursor: 'pointer', fontSize: '0.76rem', fontFamily: 'var(--fuente-base)',
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ─────────────────────────── */}
      <main style={{ flex: 1, background: 'var(--color-fondo)', minHeight: '100vh', padding: '28px 32px' }}>
        {children}
      </main>
    </div>
  );
}
