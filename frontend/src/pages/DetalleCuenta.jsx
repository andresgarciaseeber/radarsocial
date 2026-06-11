import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Layout from '../components/Layout';
import { obtenerResumen, obtenerHistorial } from '../api/metricas';
import { obtenerPosts } from '../api/posts';
import { obtenerComentarios } from '../api/comentarios';
import { obtenerAnalytics } from '../api/analytics';
import AnalisisTab from './AnalisisTab';

const PLAT_COLOR = {
  facebook: '#1877F2', instagram: '#E1306C',
  x: '#000000', tiktok: '#010101',
};
const TIPO_ICONO = { foto: '🖼', video: '🎥', reel: '📱', texto: '📝' };

function Stat({ label, valor, grande = false }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: grande ? '2rem' : '1.6rem', fontWeight: 700, color: 'var(--color-primario)', lineHeight: 1 }}>
        {valor != null ? Number(valor).toLocaleString('es-AR') : '—'}
      </div>
      <div style={{ fontSize: '0.73rem', color: 'var(--color-texto-secundario)', marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default function DetalleCuenta() {
  const { id }       = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();

  const [cuenta,         setCuenta]         = useState(location.state?.cuenta ?? null);
  const [historial,      setHistorial]      = useState([]);
  const [postsData,      setPostsData]      = useState({ posts: [], total: 0, paginas: 0 });
  const [pagina,         setPagina]         = useState(1);
  const [tab,            setTab]            = useState('metricas'); // 'metricas' | 'posts' | 'analisis'
  const [postExpandido,  setPostExpandido]  = useState(null);
  const [comentarios,    setComentarios]    = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [cargandoComent, setCargandoComent] = useState(false);
  const [analytics,      setAnalytics]      = useState(null);
  const [cargandoAnal,   setCargandoAnal]   = useState(false);
  const analyticsYaCargados                 = React.useRef(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const [hist, resumen] = await Promise.all([
          obtenerHistorial(id, { limite: 30 }),
          !location.state?.cuenta ? obtenerResumen() : Promise.resolve(null),
        ]);
        if (!activo) return;
        setHistorial(hist);
        if (resumen) {
          const c = resumen.find(c => String(c._id || c.id) === String(id));
          if (c) setCuenta(c);
        }
      } finally {
        if (activo) setCargando(false);
      }
    }
    cargar();
    return () => { activo = false; };
  }, [id]);

  useEffect(() => {
    obtenerPosts({ cuentaId: id, pagina, limite: 20 }).then(setPostsData);
  }, [id, pagina]);

  async function cargarAnalytics() {
    if (analyticsYaCargados.current) return;
    setCargandoAnal(true);
    try {
      const data = await obtenerAnalytics(id);
      setAnalytics(data);
      analyticsYaCargados.current = true;
    } finally {
      setCargandoAnal(false);
    }
  }

  function handleTabChange(key) {
    setTab(key);
    if (key === 'analisis') cargarAnalytics();
  }

  function handleSentimientoActualizado() {
    analyticsYaCargados.current = false;
    cargarAnalytics();
  }

  async function toggleComentarios(postId) {
    if (postExpandido === postId) { setPostExpandido(null); return; }
    setPostExpandido(postId);
    setCargandoComent(true);
    try {
      const data = await obtenerComentarios(postId);
      setComentarios(data.comentarios);
    } finally {
      setCargandoComent(false);
    }
  }

  const platColor = PLAT_COLOR[cuenta?.platform] ?? '#6B7280';

  const histFormateado = historial.map(h => ({
    ...h,
    fecha: new Date(h.snapshot_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
  }));

  if (cargando) return <Layout><p style={{ color: 'var(--color-texto-secundario)' }}>Cargando...</p></Layout>;
  if (!cuenta)  return <Layout><p style={{ color: 'var(--color-acento)' }}>Cuenta no encontrada.</p></Layout>;

  return (
    <Layout>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-texto-secundario)', fontSize: '0.82rem', fontFamily: 'var(--fuente-base)', padding: 0, marginBottom: 10 }}
        >
          ← Dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: platColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          }}>
            {cuenta.platform.slice(0, 2)}
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{cuenta.display_name || cuenta.handle}</span>
            <span style={{ color: 'var(--color-texto-secundario)', marginLeft: 8, fontSize: '0.85rem' }}>@{cuenta.handle}</span>
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
            background: platColor + '15', color: platColor,
          }}>
            {cuenta.platform === 'x' ? 'X / Twitter' : cuenta.platform}
          </span>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '2px solid #F0F0F0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[['metricas', 'Métricas'], ['posts', `Posts (${postsData.total})`], ['analisis', 'Análisis']].map(([key, label]) => (
          <button key={key} onClick={() => handleTabChange(key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: '0.88rem', fontWeight: 600,
            fontFamily: 'var(--fuente-base)', whiteSpace: 'nowrap',
            color: tab === key ? 'var(--color-primario)' : 'var(--color-texto-secundario)',
            borderBottom: tab === key ? '2px solid var(--color-primario)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Métricas ──────────────────────────── */}
      {tab === 'metricas' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
            <Stat label="Seguidores"    valor={cuenta.followers}  grande />
            <Stat label="Siguiendo"     valor={cuenta.following} />
            <Stat label="Publicaciones" valor={cuenta.posts_count} />
            {cuenta.engagement_rate > 0 && (
              <div style={{ background: '#fff', borderRadius: 8, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primario)', lineHeight: 1 }}>
                  {Number(cuenta.engagement_rate).toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--color-texto-secundario)', marginTop: 5 }}>Engagement</div>
              </div>
            )}
          </div>

          {histFormateado.length > 1 ? (
            <div style={{ background: '#fff', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: 16 }}>
                Evolución — últimos 30 días
              </h3>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={histFormateado} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9E9E9E' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9E9E9E' }} width={60}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9E9E9E' }} width={40}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip
                    formatter={(v, name) => [
                      name === 'Engagement' ? `${Number(v).toFixed(2)}%` : Number(v).toLocaleString('es-AR'),
                      name,
                    ]}
                    labelStyle={{ fontWeight: 600, fontSize: '0.82rem' }}
                    contentStyle={{ fontSize: '0.8rem', borderRadius: 6, border: '1px solid #E0E0E0' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem' }} />
                  <Line yAxisId="left"  type="monotone" dataKey="followers"      stroke={platColor}  strokeWidth={2} dot={false} name="Seguidores" />
                  <Line yAxisId="right" type="monotone" dataKey="engagement_rate" stroke="#E0A106" strokeWidth={1.5} dot={false} name="Engagement" strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: 'var(--color-texto-secundario)', fontSize: '0.85rem' }}>
              No hay historial suficiente para graficar. El recolector necesita al menos 2 snapshots.
            </div>
          )}
        </>
      )}

      {/* ── Tab: Análisis ──────────────────────────── */}
      {tab === 'analisis' && (
        cargandoAnal
          ? <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.85rem' }}>Calculando métricas...</p>
          : <AnalisisTab
              data={analytics}
              cuentaId={id}
              platColor={platColor}
              onSentimientoActualizado={handleSentimientoActualizado}
            />
      )}

      {/* ── Tab: Posts ─────────────────────────────── */}
      {tab === 'posts' && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {postsData.posts.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--color-texto-secundario)', fontSize: '0.85rem' }}>
              Sin publicaciones. Ejecutá el recolector para traer datos.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#FAFAFA' }}>
                  <tr>
                    {['Tipo', 'Contenido', '❤️', '💬', '🔁', 'Fecha', ''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '10px 12px',
                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-texto-secundario)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: '1px solid #F0F0F0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {postsData.posts.map(post => (
                    <React.Fragment key={post._id || post.id}>
                      <tr style={{ borderTop: '1px solid #F5F5F5' }} >
                        <td style={td}><span style={{ fontSize: '1.1rem' }}>{TIPO_ICONO[post.type] ?? '📄'}</span></td>
                        <td style={{ ...td, maxWidth: 320 }}>
                          <div style={{
                            fontSize: '0.82rem', color: 'var(--color-texto)',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4,
                          }}>
                            {post.content_preview || <em style={{ color: '#BDBDBD' }}>Sin texto</em>}
                          </div>
                          {post.url && (
                            <a href={post.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: '0.72rem', color: 'var(--color-primario)', display: 'block', marginTop: 2 }}>
                              Ver publicación ↗
                            </a>
                          )}
                        </td>
                        <td style={{ ...td, fontWeight: 600, fontSize: '0.85rem' }}>{fmtNum(post.likes)}</td>
                        <td style={{ ...td, fontWeight: 600, fontSize: '0.85rem' }}>{fmtNum(post.comments_count)}</td>
                        <td style={{ ...td, fontWeight: 600, fontSize: '0.85rem' }}>{fmtNum(post.shares)}</td>
                        <td style={{ ...td, fontSize: '0.76rem', color: 'var(--color-texto-secundario)', whiteSpace: 'nowrap' }}>
                          {post.published_at ? new Date(post.published_at).toLocaleDateString('es-AR') : '—'}
                        </td>
                        <td style={td}>
                          {post.comments_count > 0 && (
                            <button onClick={() => toggleComentarios(post._id || post.id)} style={btnComent}>
                              {postExpandido === (post._id || post.id) ? 'Cerrar' : 'Comentarios'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {postExpandido === (post._id || post.id) && (
                        <tr>
                          <td colSpan={7} style={{ background: '#FAFAFA', padding: '8px 12px 14px 40px' }}>
                            {cargandoComent ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-texto-secundario)' }}>Cargando...</span>
                            ) : comentarios.length === 0 ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-texto-secundario)' }}>Sin comentarios.</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {comentarios.map(c => (
                                  <div key={c._id || c.id}>
                                    <span style={{ fontWeight: 600, fontSize: '0.81rem', color: 'var(--color-primario)' }}>
                                      {c.author_handle ?? 'Anónimo'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#BDBDBD', marginLeft: 8 }}>
                                      {c.published_at ? new Date(c.published_at).toLocaleDateString('es-AR') : ''}
                                    </span>
                                    <p style={{ fontSize: '0.81rem', color: 'var(--color-texto)', marginTop: 2 }}>{c.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {postsData.paginas > 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '14px 12px', borderTop: '1px solid #F0F0F0' }}>
                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={btnPag}>← Anterior</button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-texto-secundario)' }}>
                    {pagina} / {postsData.paginas}
                  </span>
                  <button onClick={() => setPagina(p => Math.min(postsData.paginas, p + 1))} disabled={pagina === postsData.paginas} style={btnPag}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Layout>
  );
}

const fmtNum = v => (v != null ? Number(v).toLocaleString('es-AR') : '—');
const td = { padding: '11px 12px', verticalAlign: 'middle' };
const btnComent = { background: 'none', border: '1px solid #E0E0E0', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--fuente-base)', color: 'var(--color-texto-secundario)', whiteSpace: 'nowrap' };
const btnPag = { padding: '5px 14px', border: '1px solid #E0E0E0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--fuente-base)', color: 'var(--color-texto)' };
