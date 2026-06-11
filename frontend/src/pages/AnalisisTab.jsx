import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { analizarSentimiento } from '../api/analytics';

const TIPO_ICONO = { foto: '🖼', video: '🎥', reel: '📱', texto: '📝' };
const SENTIMIENTO_COLOR = { positivo: '#4CAF50', neutro: '#9E9E9E', negativo: '#F44336' };
const TIPO_COLOR = ['var(--color-primario)', '#E0A106', '#6366F1', '#EC4899'];

export default function AnalisisTab({ data, cuentaId, platColor, onSentimientoActualizado }) {
  const [analizando, setAnalizando] = useState(false);
  const [error, setError]           = useState(null);

  if (!data || data.sin_datos) {
    return (
      <div style={card}>
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.85rem' }}>
          Sin publicaciones suficientes para generar análisis. Ejecutá el recolector para traer datos.
        </p>
      </div>
    );
  }

  const {
    mejor_hora, mejor_dia, recomendacion,
    top_posts, por_tipo, viralidad, consistencia, sentimiento, total_posts,
  } = data;

  const mejorHoraActiva   = mejor_hora.filter(h => h.publicaciones > 0);
  const maxEngHora        = Math.max(...mejor_hora.map(h => h.engagement_promedio), 1);
  const maxEngDia         = Math.max(...mejor_dia.map(d => d.engagement_promedio), 1);
  const maxTopEng         = top_posts[0]?.engagement_total || 1;

  async function disparararAnalisis() {
    setAnalizando(true);
    setError(null);
    try {
      const result = await analizarSentimiento(cuentaId);
      onSentimientoActualizado(result.procesados);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al analizar sentimiento.');
    } finally {
      setAnalizando(false);
    }
  }

  const totalSentimiento = sentimiento.positivo + sentimiento.neutro + sentimiento.negativo;
  const pieData = totalSentimiento > 0
    ? [
        { name: 'Positivo', value: sentimiento.positivo, color: SENTIMIENTO_COLOR.positivo },
        { name: 'Neutro',   value: sentimiento.neutro,   color: SENTIMIENTO_COLOR.neutro },
        { name: 'Negativo', value: sentimiento.negativo, color: SENTIMIENTO_COLOR.negativo },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Recomendación principal ───────────────────── */}
      {recomendacion.hora != null && (
        <div style={{ ...card, background: platColor + '12', borderLeft: `4px solid ${platColor}`, padding: '14px 20px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: platColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recomendación
          </span>
          <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-texto)' }}>
            Publicá los <strong>{recomendacion.dia_nombre}</strong> a las <strong>{String(recomendacion.hora).padStart(2, '0')}:00 h</strong>
            {' '}— es cuando tus posts obtienen más interacciones en promedio.
          </p>
        </div>
      )}

      {/* ── Métricas rápidas ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        <MiniStat label="Publicaciones" valor={total_posts} />
        <MiniStat label="Índice de viralidad" valor={`${viralidad}%`} sub="posts compartidos vs reacciones" />
        <MiniStat label="Posts / semana" valor={consistencia.posts_por_semana} />
        <MiniStat
          label="Consistencia"
          valor={`${consistencia.score}/100`}
          sub={consistencia.score >= 70 ? '✓ Regular' : consistencia.score >= 40 ? '~ Irregular' : '↓ Esporádico'}
          subColor={consistencia.score >= 70 ? '#4CAF50' : consistencia.score >= 40 ? '#E0A106' : '#F44336'}
        />
      </div>

      {/* ── Mejor hora ───────────────────────────────── */}
      <div style={card}>
        <SectionTitle>Mejor hora para publicar</SectionTitle>
        {mejorHoraActiva.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mejor_hora} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9E9E9E' }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: '#9E9E9E' }} />
              <Tooltip
                formatter={v => [v, 'Eng. promedio']}
                contentStyle={{ fontSize: '0.78rem', borderRadius: 6, border: '1px solid #E0E0E0' }}
              />
              <Bar dataKey="engagement_promedio" radius={[3, 3, 0, 0]}>
                {mejor_hora.map((h) => (
                  <Cell
                    key={h.hora}
                    fill={h.engagement_promedio === maxEngHora && h.publicaciones > 0
                      ? platColor : platColor + '55'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Mejor día ────────────────────────────────── */}
      <div style={card}>
        <SectionTitle>Mejor día de la semana</SectionTitle>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={mejor_dia} layout="vertical" margin={{ top: 0, right: 30, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#9E9E9E' }} />
            <YAxis type="category" dataKey="dia_nombre" tick={{ fontSize: 11, fill: '#616161' }} width={28} />
            <Tooltip
              formatter={v => [v, 'Eng. promedio']}
              contentStyle={{ fontSize: '0.78rem', borderRadius: 6, border: '1px solid #E0E0E0' }}
            />
            <Bar dataKey="engagement_promedio" radius={[0, 3, 3, 0]}>
              {mejor_dia.map((d) => (
                <Cell
                  key={d.dia}
                  fill={d.engagement_promedio === maxEngDia && d.publicaciones > 0
                    ? '#E0A106' : '#E0A10655'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Rendimiento por tipo ─────────────────────── */}
      {por_tipo.length > 1 && (
        <div style={card}>
          <SectionTitle>Rendimiento por tipo de contenido</SectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={por_tipo} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#616161' }} />
              <YAxis tick={{ fontSize: 9, fill: '#9E9E9E' }} />
              <Tooltip
                formatter={(v, _, props) => [`${v} (${props.payload.publicaciones} posts)`, 'Eng. promedio']}
                contentStyle={{ fontSize: '0.78rem', borderRadius: 6, border: '1px solid #E0E0E0' }}
              />
              <Bar dataKey="engagement_promedio" radius={[4, 4, 0, 0]}>
                {por_tipo.map((t, i) => (
                  <Cell key={t.tipo} fill={TIPO_COLOR[i % TIPO_COLOR.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top 5 posts ──────────────────────────────── */}
      {top_posts.length > 0 && (
        <div style={card}>
          <SectionTitle>Top {top_posts.length} posts por engagement</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top_posts.map((p, i) => (
              <div key={String(p._id)} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>
                  {TIPO_ICONO[p.type] ?? '📄'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-texto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.content_preview || <em style={{ color: '#BDBDBD' }}>Sin texto</em>}
                  </div>
                  <div style={{ marginTop: 4, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round(p.engagement_total / maxTopEng * 100)}%`,
                      background: i === 0 ? platColor : platColor + '80',
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80, fontSize: '0.78rem', color: 'var(--color-texto-secundario)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-texto)', fontSize: '0.85rem' }}>
                    {Number(p.engagement_total).toLocaleString('es-AR')}
                  </div>
                  <div>❤{fmtN(p.likes)} 💬{fmtN(p.comments_count)} 🔁{fmtN(p.shares)}</div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--color-primario)', fontSize: '0.7rem' }}>
                      Ver ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Análisis de sentimiento ──────────────────── */}
      <div style={card}>
        <SectionTitle>Análisis de sentimiento en comentarios</SectionTitle>

        {totalSentimiento === 0 && sentimiento.sin_analizar === 0 && (
          <Empty msg="No hay comentarios capturados aún." />
        )}

        {totalSentimiento === 0 && sentimiento.sin_analizar > 0 && (
          <div>
            <p style={{ fontSize: '0.83rem', color: 'var(--color-texto-secundario)', marginBottom: 12 }}>
              Hay <strong>{sentimiento.sin_analizar}</strong> comentario(s) sin analizar.
            </p>
            {sentimiento.disponible ? (
              <button onClick={disparararAnalisis} disabled={analizando} style={btnPrimario}>
                {analizando ? 'Analizando...' : `Analizar con IA (${sentimiento.sin_analizar} comentarios)`}
              </button>
            ) : (
              <p style={{ fontSize: '0.8rem', color: '#9E9E9E' }}>
                Configurá <code>ANTHROPIC_API_KEY</code> en el servidor para habilitar el análisis de sentimiento.
              </p>
            )}
            {error && <p style={{ color: '#F44336', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>}
          </div>
        )}

        {totalSentimiento > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [`${v} (${Math.round(v / totalSentimiento * 100)}%)`, name]}
                    contentStyle={{ fontSize: '0.78rem', borderRadius: 6 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'positivo', label: 'Positivos', emoji: '😊' },
                { key: 'neutro',   label: 'Neutros',   emoji: '😐' },
                { key: 'negativo', label: 'Negativos',  emoji: '😠' },
              ].map(({ key, label, emoji }) => {
                const val = sentimiento[key];
                const pct = totalSentimiento > 0 ? Math.round(val / totalSentimiento * 100) : 0;
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                      <span>{emoji} {label}</span>
                      <span style={{ fontWeight: 700, color: SENTIMIENTO_COLOR[key] }}>{pct}% ({fmtN(val)})</span>
                    </div>
                    <div style={{ height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: SENTIMIENTO_COLOR[key], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
              {sentimiento.sin_analizar > 0 && (
                <p style={{ fontSize: '0.75rem', color: '#9E9E9E', marginTop: 4 }}>
                  {sentimiento.sin_analizar} comentario(s) pendientes de análisis.{' '}
                  {sentimiento.disponible && (
                    <button onClick={disparararAnalisis} disabled={analizando}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primario)', fontSize: '0.75rem', padding: 0, fontFamily: 'var(--fuente-base)' }}>
                      {analizando ? 'Analizando...' : 'Analizar ahora'}
                    </button>
                  )}
                </p>
              )}
              {error && <p style={{ color: '#F44336', fontSize: '0.78rem' }}>{error}</p>}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: 14 }}>
      {children}
    </h3>
  );
}

function MiniStat({ label, valor, sub, subColor }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primario)', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--color-texto-secundario)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', marginTop: 2, color: subColor || 'var(--color-texto-secundario)' }}>{sub}</div>}
    </div>
  );
}

function Empty({ msg = 'Sin datos suficientes.' }) {
  return <p style={{ fontSize: '0.82rem', color: 'var(--color-texto-secundario)' }}>{msg}</p>;
}

const fmtN = v => (v != null ? Number(v).toLocaleString('es-AR') : '—');
const card = { background: '#fff', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const btnPrimario = {
  background: 'var(--color-primario)', color: '#fff', border: 'none',
  borderRadius: 6, padding: '8px 18px', fontSize: '0.83rem',
  fontFamily: 'var(--fuente-base)', cursor: 'pointer', fontWeight: 600,
};
