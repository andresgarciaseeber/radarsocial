import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { obtenerResumen } from '../api/metricas';

const PLAT_COLOR = {
  facebook: '#1877F2', instagram: '#E1306C',
  x: '#000000', tiktok: '#010101',
};
const PLAT_LABEL = {
  facebook: 'Facebook', instagram: 'Instagram', x: 'X / Twitter', tiktok: 'TikTok',
};
const ESTADO = {
  conectada:     { color: '#2E7D32', label: 'Conectada' },
  pendiente:     { color: '#E0A106', label: 'Pendiente' },
  token_vencido: { color: '#D62828', label: 'Token vencido' },
  error:         { color: '#D62828', label: 'Error' },
  desconectada:  { color: '#6B7280', label: 'Desconectada' },
};

function Crecimiento({ pct }) {
  if (pct == null) return <span style={{ fontSize: '0.75rem', color: '#9E9E9E' }}>sin datos previos</span>;
  const sube = pct >= 0;
  return (
    <span style={{
      fontSize: '0.77rem', fontWeight: 700,
      color: sube ? '#2E7D32' : '#D62828',
      background: sube ? '#E8F5E9' : '#FFEBEE',
      padding: '2px 7px', borderRadius: 4,
    }}>
      {sube ? '↑' : '↓'} {Math.abs(pct)}% vs 7 días
    </span>
  );
}

export default function Dashboard() {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    obtenerResumen()
      .then(setCuentas)
      .finally(() => setCargando(false));
  }, []);

  const conectadas      = cuentas.filter(c => c.connection_status === 'conectada');
  const conProblemas    = cuentas.filter(c => ['token_vencido', 'error'].includes(c.connection_status));
  const totalSeguidores = conectadas.reduce((s, c) => s + (c.followers ?? 0), 0);
  const engagementProm  = conectadas.length
    ? (conectadas.reduce((s, c) => s + (c.engagement_rate ?? 0), 0) / conectadas.length).toFixed(2)
    : '—';

  return (
    <Layout>
      {/* ── Encabezado ─────────────────────────────── */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontWeight: 700, color: 'var(--color-texto)', fontSize: '1.25rem' }}>
            Radar Social La Rioja
          </h2>
          <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.83rem', marginTop: 3 }}>
            Panel de monitoreo — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link to="/cuentas" style={{ fontSize: '0.82rem', color: 'var(--color-primario)', fontWeight: 600, textDecoration: 'none' }}>
          + Agregar cuenta
        </Link>
      </div>

      {/* ── Totales globales ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Cuentas activas',   valor: conectadas.length,                          alerta: false },
          { label: 'Total seguidores',  valor: totalSeguidores.toLocaleString('es-AR'),    alerta: false },
          { label: 'Engagement prom.',  valor: `${engagementProm}%`,                       alerta: false },
          { label: 'Requieren atención',valor: conProblemas.length, alerta: conProblemas.length > 0 },
        ].map(({ label, valor, alerta }) => (
          <div key={label} style={{
            background: '#fff', borderRadius: 8, padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            borderLeft: `3px solid ${alerta ? 'var(--color-acento)' : 'var(--color-primario)'}`,
          }}>
            <div style={{ fontSize: '1.55rem', fontWeight: 700, color: alerta ? 'var(--color-acento)' : 'var(--color-texto)', lineHeight: 1 }}>
              {valor}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-texto-secundario)', marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Cards de cuentas ───────────────────────── */}
      {cargando ? (
        <p style={{ color: 'var(--color-texto-secundario)' }}>Cargando...</p>
      ) : cuentas.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 12 }}>No hay cuentas monitoreadas todavía.</p>
          <Link to="/cuentas" style={{ color: 'var(--color-primario)', fontWeight: 600 }}>Agregar primera cuenta →</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
          {cuentas.map(cuenta => {
            const id     = cuenta._id || cuenta.id;
            const color  = PLAT_COLOR[cuenta.platform] ?? '#6B7280';
            const estado = ESTADO[cuenta.connection_status] ?? ESTADO.desconectada;
            const sinDatos = cuenta.followers == null;

            return (
              <div key={id} style={{
                background: '#fff', borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Barra de plataforma */}
                <div style={{ height: 4, background: color }} />

                <div style={{ padding: '16px 18px 12px', flex: 1 }}>
                  {/* Header: plataforma + estado */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      fontSize: '0.71rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color, background: color + '15',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      {PLAT_LABEL[cuenta.platform] ?? cuenta.platform}
                    </span>
                    <span style={{
                      fontSize: '0.71rem', fontWeight: 600,
                      color: estado.color, background: estado.color + '15',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      {estado.label}
                    </span>
                  </div>

                  {/* Nombre */}
                  <div style={{ fontWeight: 700, fontSize: '0.97rem', marginBottom: 2 }}>
                    {cuenta.display_name || cuenta.handle}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-texto-secundario)', marginBottom: 16 }}>
                    @{cuenta.handle}
                  </div>

                  {/* Métricas */}
                  {sinDatos ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-texto-secundario)', marginBottom: 14 }}>
                      Sin métricas — ejecutá el recolector.
                    </p>
                  ) : (
                    <>
                      {/* Seguidores + crecimiento */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primario)', lineHeight: 1 }}>
                            {Number(cuenta.followers).toLocaleString('es-AR')}
                          </span>
                          <Crecimiento pct={cuenta.crecimiento_7d} />
                        </div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--color-texto-secundario)', marginTop: 3 }}>Seguidores</div>
                      </div>

                      {/* Fila de métricas secundarias */}
                      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                        {cuenta.posts_count != null && (
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)' }}>
                              {Number(cuenta.posts_count).toLocaleString('es-AR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-texto-secundario)' }}>Posts</div>
                          </div>
                        )}
                        {cuenta.engagement_rate != null && cuenta.engagement_rate > 0 && (
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)' }}>
                              {Number(cuenta.engagement_rate).toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-texto-secundario)' }}>Engagement</div>
                          </div>
                        )}
                        {cuenta.following != null && cuenta.following > 0 && (
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)' }}>
                              {Number(cuenta.following).toLocaleString('es-AR')}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-texto-secundario)' }}>Siguiendo</div>
                          </div>
                        )}
                      </div>

                      {cuenta.snapshot_date && (
                        <div style={{ fontSize: '0.69rem', color: '#BDBDBD', marginBottom: 4 }}>
                          Actualizado: {new Date(cuenta.snapshot_date + 'T00:00:00').toLocaleDateString('es-AR')}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #F5F5F5', padding: '9px 18px' }}>
                  <button
                    onClick={() => navigate(`/cuenta/${id}`, { state: { cuenta } })}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-primario)', fontWeight: 600,
                      fontSize: '0.8rem', fontFamily: 'var(--fuente-base)', padding: 0,
                    }}
                  >
                    Ver publicaciones →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
