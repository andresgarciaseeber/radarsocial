import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  listarCuentas, eliminarCuenta, obtenerPlataformas,
  iniciarOAuth, buscarCuentaX, agregarCuentaPublica, ejecutarRecolector,
} from '../api/cuentas';
import { buscarHashtag } from '../api/hashtags';

const ESTADO = {
  conectada:     { bg: '#E8F5E9', color: '#2E7D32', label: 'Conectada' },
  pendiente:     { bg: '#FFF8E1', color: '#E0A106', label: 'Pendiente' },
  token_vencido: { bg: '#FFEBEE', color: '#D62828', label: 'Token vencido' },
  error:         { bg: '#FFEBEE', color: '#D62828', label: 'Error' },
  desconectada:  { bg: '#F3F4F6', color: '#6B7280', label: 'Desconectada' },
};

const METODO = {
  publica: { bg: '#E3F2FD', color: '#1565C0', label: 'Pública' },
  oauth:   { bg: '#F3E5F5', color: '#6A1B9A', label: 'OAuth' },
  manual:  { bg: '#FFF3E0', color: '#E65100', label: 'Manual' },
};

const PLAT_COLOR = {
  facebook: '#1877F2', instagram: '#E1306C',
  x: '#000000', tiktok: '#010101',
};

function mensajeError(code, params) {
  return {
    acceso_denegado: 'El acceso fue denegado.',
    state_invalido:  'La sesión venció. Intentá de nuevo.',
    error_interno:   'Error interno. Revisá los logs del servidor.',
  }[code] ?? `Error: ${code}`;
}

export default function Cuentas() {
  const [cuentas, setCuentas]           = useState([]);
  const [plataformas, setPlataformas]   = useState({});
  const [cargando, setCargando]         = useState(true);
  const [aviso, setAviso]               = useState(null);
  const [sinPaginas, setSinPaginas]     = useState(false);
  const [recolectando, setRecolectando] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado del buscador de X
  const [busqueda, setBusqueda]       = useState('');
  const [buscando, setBuscando]       = useState(false);
  const [preview, setPreview]         = useState(null);
  const [errorBusqueda, setErrorBusq] = useState('');
  const [agregando, setAgregando]     = useState(false);

  // Estado del buscador de hashtags
  const [hashtag, setHashtag]                 = useState('');
  const [buscandoHashtag, setBuscandoHashtag] = useState(false);
  const [resultadosHashtag, setResultados]    = useState(null);
  const [errorHashtag, setErrorHashtag]       = useState('');
  const [filaExpandida, setFilaExpandida]     = useState(null);

  useEffect(() => {
    const conectado = searchParams.get('conectado');
    const error     = searchParams.get('error');
    if (conectado) setAviso({ ok: true,  texto: `${conectado} cuenta(s) conectadas correctamente.` });
    if (error === 'sin_paginas') { setSinPaginas(true); }
    else if (error) setAviso({ ok: false, texto: mensajeError(error, searchParams) });
    if (conectado || error) setSearchParams({}, { replace: true });
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [c, p] = await Promise.all([listarCuentas(), obtenerPlataformas()]);
      setCuentas(c);
      setPlataformas(p);
    } catch {
      setAviso({ ok: false, texto: 'Error al cargar los datos. ¿El backend está corriendo?' });
    } finally {
      setCargando(false);
    }
  }

  async function handleBuscarX(e) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setPreview(null);
    setErrorBusq('');
    setBuscando(true);
    try {
      const usuario = await buscarCuentaX(busqueda.trim());
      setPreview(usuario);
    } catch (err) {
      setErrorBusq(err.response?.data?.mensaje || 'No se pudo encontrar ese usuario.');
    } finally {
      setBuscando(false);
    }
  }

  async function handleAgregarX() {
    if (!preview) return;
    setAgregando(true);
    try {
      await agregarCuentaPublica({
        platform:          'x',
        external_id:       preview.id,
        username:          preview.username,
        display_name:      preview.name,
        description:       preview.description,
        profile_image_url: preview.profile_image_url,
        public_metrics:    preview.public_metrics,
      });
      setAviso({ ok: true, texto: `@${preview.username} agregada al monitoreo.` });
      setPreview(null);
      setBusqueda('');
      cargarDatos();
    } catch (err) {
      setAviso({ ok: false, texto: err.response?.data?.mensaje || 'Error al agregar la cuenta.' });
    } finally {
      setAgregando(false);
    }
  }

  async function handleConectar(platform) {
    try {
      window.location.href = await iniciarOAuth(platform);
    } catch {
      setAviso({ ok: false, texto: 'No se pudo iniciar la conexión. Verificá tu sesión.' });
    }
  }

  async function handleRecolectar() {
    setRecolectando(true);
    setAviso(null);
    try {
      const res = await ejecutarRecolector();
      setAviso({ ok: true, texto: res.mensaje || 'Recolección completada.' });
      cargarDatos();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.mensaje
        || (status === 403 ? 'Sin permisos — necesitás rol admin.' : null)
        || (status === 401 ? 'Sesión vencida, volvé a iniciar sesión.' : null)
        || (status === 504 ? 'Timeout en Vercel — demasiadas cuentas o API lenta.' : null)
        || `Error ${status || 'de red'} al ejecutar el recolector.`;
      setAviso({ ok: false, texto: msg });
    } finally {
      setRecolectando(false);
    }
  }

  async function handleBuscarHashtag(e) {
    e.preventDefault();
    const q = hashtag.replace(/^#+/, '').trim();
    if (!q) return;
    setResultados(null);
    setErrorHashtag('');
    setBuscandoHashtag(true);
    try {
      const data = await buscarHashtag(q);
      setResultados(data);
    } catch (err) {
      setErrorHashtag(err.response?.data?.mensaje || 'Error al buscar el hashtag.');
    } finally {
      setBuscandoHashtag(false);
    }
  }

  async function handleEliminar(id, handle) {
    if (!confirm(`¿Eliminar @${handle} del monitoreo?`)) return;
    try {
      await eliminarCuenta(id);
      setCuentas(prev => prev.filter(c => c._id !== id && c.id !== id));
      setAviso({ ok: true, texto: `@${handle} eliminada del monitoreo.` });
    } catch {
      setAviso({ ok: false, texto: 'Error al eliminar la cuenta.' });
    }
  }

  const m = preview?.public_metrics ?? {};

  return (
    <Layout>
      <h2 style={{ fontWeight: 700, color: 'var(--color-texto)', marginBottom: 24 }}>Cuentas</h2>

      {aviso && (
        <div style={{
          padding: '12px 16px', borderRadius: 6, marginBottom: 24, fontSize: '0.88rem',
          background: aviso.ok ? '#E8F5E9' : '#FFEBEE',
          color: aviso.ok ? '#2E7D32' : '#D62828',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {aviso.texto}
          <span style={{ cursor: 'pointer', marginLeft: 16, fontWeight: 700 }} onClick={() => setAviso(null)}>✕</span>
        </div>
      )}

      {/* ── Aviso sin_paginas ────────────────────────────────── */}
      {sinPaginas && (
        <div style={{
          padding: '18px 20px', borderRadius: 8, marginBottom: 24,
          background: '#FFF8E1', border: '1px solid #F9A825',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong style={{ color: '#E65100', fontSize: '0.9rem' }}>
              Facebook no encontró páginas asociadas a tu cuenta
            </strong>
            <span style={{ cursor: 'pointer', color: '#999', marginLeft: 16, lineHeight: 1 }} onClick={() => setSinPaginas(false)}>✕</span>
          </div>
          <p style={{ fontSize: '0.83rem', color: '#5D4037', margin: '10px 0 12px' }}>
            Los permisos se otorgaron correctamente, pero no se seleccionó ninguna página durante el proceso.
            Facebook muestra un paso con checkboxes donde debés elegir explícitamente cuáles páginas darle acceso a la app.
          </p>
          <ol style={{ fontSize: '0.82rem', color: '#5D4037', margin: '0 0 14px 16px', lineHeight: 1.8 }}>
            <li>Hacé clic en <strong>Reconectar Facebook</strong> debajo.</li>
            <li>En la ventana de Facebook, en el paso <em>"¿Qué páginas querés usar con esta app?"</em>, <strong>tildá tu página</strong>.</li>
            <li>Continuá hasta el final y autorizá.</li>
          </ol>
          <button onClick={() => { setSinPaginas(false); handleConectar('facebook'); }} style={btnPrimario}>
            Reconectar Facebook
          </button>
        </div>
      )}

      {/* ── Buscador de X ────────────────────────────────────── */}
      <div style={card}>
        <h3 style={secTitle}>Monitorear cuenta de X (Twitter)</h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--color-texto-secundario)', marginBottom: 16 }}>
          Ingresá cualquier @usuario público de X — no necesita autorizar tu app.
        </p>

        <form onSubmit={handleBuscarX} style={{ display: 'flex', gap: 10, maxWidth: 480 }}>
          <input
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPreview(null); setErrorBusq(''); }}
            placeholder="@usuario o usuario"
            style={{
              flex: 1, padding: '9px 14px', border: '1px solid #D1D5DB',
              borderRadius: 6, fontSize: '0.9rem', fontFamily: 'var(--fuente-base)',
            }}
          />
          <button type="submit" disabled={buscando || !busqueda.trim()} style={btnPrimario}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {errorBusqueda && (
          <p style={{ color: 'var(--color-acento)', fontSize: '0.83rem', marginTop: 10 }}>{errorBusqueda}</p>
        )}

        {/* Preview del usuario encontrado */}
        {preview && (
          <div style={{
            marginTop: 16, padding: 16, border: '1px solid #E5E7EB',
            borderRadius: 8, display: 'flex', gap: 16, alignItems: 'flex-start',
            background: '#FAFAFA', maxWidth: 480,
          }}>
            {preview.profile_image_url && (
              <img
                src={preview.profile_image_url.replace('_normal', '_bigger')}
                alt={preview.name}
                style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{preview.name}</div>
              <div style={{ color: 'var(--color-texto-secundario)', fontSize: '0.82rem', marginBottom: 6 }}>
                @{preview.username}
              </div>
              {preview.description && (
                <p style={{ fontSize: '0.81rem', color: 'var(--color-texto)', marginBottom: 8, lineHeight: 1.4 }}>
                  {preview.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--color-texto-secundario)', marginBottom: 12 }}>
                {m.followers_count != null && (
                  <span><strong style={{ color: 'var(--color-texto)' }}>{Number(m.followers_count).toLocaleString('es-AR')}</strong> seguidores</span>
                )}
                {m.tweet_count != null && (
                  <span><strong style={{ color: 'var(--color-texto)' }}>{Number(m.tweet_count).toLocaleString('es-AR')}</strong> tweets</span>
                )}
              </div>
              <button onClick={handleAgregarX} disabled={agregando} style={btnPrimario}>
                {agregando ? 'Agregando...' : `Agregar @${preview.username} al monitoreo`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Buscador de Hashtags ─────────────────────────────── */}
      <div style={card}>
        <h3 style={secTitle}>Buscador de Hashtags en X</h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--color-texto-secundario)', marginBottom: 16 }}>
          Analiza los últimos 20 tweets con ese hashtag (últimos 7 días) y muestra el top 10 de usuarios más activos.
        </p>

        <form onSubmit={handleBuscarHashtag} style={{ display: 'flex', gap: 10, maxWidth: 480 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-texto-secundario)', fontSize: '0.95rem', pointerEvents: 'none',
            }}>#</span>
            <input
              value={hashtag}
              onChange={e => { setHashtag(e.target.value); setResultados(null); setErrorHashtag(''); setFilaExpandida(null); }}
              placeholder="hashtag"
              style={{
                width: '100%', padding: '9px 14px 9px 26px',
                border: '1px solid #D1D5DB', borderRadius: 6,
                fontSize: '0.9rem', fontFamily: 'var(--fuente-base)',
              }}
            />
          </div>
          <button type="submit" disabled={buscandoHashtag || !hashtag.replace(/^#+/, '').trim()} style={btnPrimario}>
            {buscandoHashtag ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {errorHashtag && (
          <p style={{ color: 'var(--color-acento)', fontSize: '0.83rem', marginTop: 12 }}>{errorHashtag}</p>
        )}

        {buscandoHashtag && (
          <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.83rem', marginTop: 16 }}>Consultando la API de X...</p>
        )}

        {resultadosHashtag && !buscandoHashtag && (
          resultadosHashtag.resultados.length === 0 ? (
            <p style={{ color: 'var(--color-texto-secundario)', fontSize: '0.85rem', marginTop: 16 }}>
              No se encontraron tweets con <strong>#{hashtag.replace(/^#+/, '')}</strong> en los últimos 7 días.
            </p>
          ) : (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-texto-secundario)', marginBottom: 10 }}>
                {resultadosHashtag.total_tweets} tweet(s) analizados · Top 10 usuarios
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Usuario', 'Tweets', 'Followers', 'Likes', ''].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosHashtag.resultados.map((r, i) => {
                      const abierto = filaExpandida === r.author_id;
                      return (
                        <>
                          <tr
                            key={r.author_id}
                            style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer' }}
                            onClick={() => setFilaExpandida(abierto ? null : r.author_id)}
                          >
                            <td style={td}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.display_name}</div>
                              <div style={{ color: 'var(--color-texto-secundario)', fontSize: '0.78rem' }}>@{r.username}</div>
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', minWidth: 28, padding: '2px 8px',
                                borderRadius: 12, fontWeight: 700, fontSize: '0.85rem',
                                background: i === 0 ? 'var(--color-primario)' : '#F3F4F6',
                                color: i === 0 ? '#fff' : 'var(--color-texto)',
                              }}>
                                {r.tweets}
                              </span>
                            </td>
                            <td style={{ ...td, color: 'var(--color-texto-secundario)', fontSize: '0.82rem' }}>
                              {r.followers != null ? Number(r.followers).toLocaleString('es-AR') : '—'}
                            </td>
                            <td style={{ ...td, color: 'var(--color-texto-secundario)', fontSize: '0.82rem' }}>
                              {Number(r.likes).toLocaleString('es-AR')}
                            </td>
                            <td style={{ ...td, textAlign: 'right', color: 'var(--color-texto-secundario)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {abierto ? '▲ Ocultar' : '▼ Ver tweets'}
                            </td>
                          </tr>

                          {abierto && (
                            <tr key={`${r.author_id}-tweets`} style={{ background: '#F8F9FB' }}>
                              <td colSpan={5} style={{ padding: '10px 14px 14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {r.lista.map(t => (
                                    <div key={t.id} style={{
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                      gap: 12, padding: '8px 12px', background: '#fff',
                                      borderRadius: 6, border: '1px solid #E5E7EB', fontSize: '0.83rem',
                                    }}>
                                      <span style={{ color: 'var(--color-texto)', lineHeight: 1.5, flex: 1 }}>
                                        {t.text}
                                      </span>
                                      <a
                                        href={`https://x.com/${r.username}/status/${t.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                          flexShrink: 0, fontSize: '0.75rem', fontWeight: 600,
                                          color: 'var(--color-primario)', textDecoration: 'none',
                                          padding: '3px 8px', border: '1px solid var(--color-primario)',
                                          borderRadius: 4, whiteSpace: 'nowrap',
                                        }}
                                      >
                                        Ver en X ↗
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Cuentas monitoreadas ──────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ ...secTitle, marginBottom: 0 }}>Cuentas monitoreadas</h3>
          {cuentas.length > 0 && (
            <button
              onClick={handleRecolectar}
              disabled={recolectando}
              title="Trae datos nuevos de todas las cuentas ahora"
              style={{ ...btnPrimario, fontSize: '0.78rem', padding: '5px 12px', opacity: recolectando ? 0.7 : 1 }}
            >
              {recolectando ? 'Recolectando...' : '↻ Recolectar ahora'}
            </button>
          )}
        </div>
        {cargando ? (
          <p style={{ color: 'var(--color-texto-secundario)' }}>Cargando...</p>
        ) : cuentas.length === 0 ? (
          <p style={{ color: 'var(--color-texto-secundario)' }}>
            No hay cuentas todavía. Buscá un usuario de X arriba o conectá una cuenta de Facebook/Instagram.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Plataforma', 'Cuenta', 'Acceso', 'Estado', 'Desde', ''].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentas.map(cuenta => {
                  const id     = cuenta._id || cuenta.id;
                  const estado = ESTADO[cuenta.connection_status] ?? ESTADO.desconectada;
                  const metodo = METODO[cuenta.connection_method] ?? METODO.oauth;
                  const color  = PLAT_COLOR[cuenta.platform] ?? '#6B7280';
                  const vencida = ['token_vencido', 'error'].includes(cuenta.connection_status);
                  return (
                    <tr key={id} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            background: color, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                          }}>
                            {cuenta.platform.slice(0, 2)}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-texto-secundario)' }}>
                            {cuenta.platform}
                          </span>
                        </div>
                      </td>
                      <td style={td}>
                        <span style={{ fontWeight: 600 }}>{cuenta.display_name || cuenta.handle}</span>
                        {cuenta.handle && (
                          <span style={{ color: 'var(--color-texto-secundario)', fontSize: '0.8rem', marginLeft: 6 }}>
                            @{cuenta.handle}
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                          background: metodo.bg, color: metodo.color,
                        }}>
                          {metodo.label}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: '0.77rem', fontWeight: 600,
                          background: estado.bg, color: estado.color,
                        }}>
                          {estado.label}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--color-texto-secundario)', fontSize: '0.8rem' }}>
                        {cuenta.connected_at ? new Date(cuenta.connected_at).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {vencida && cuenta.connection_method === 'oauth' && (
                          <button onClick={() => handleConectar(cuenta.platform)} style={btnAmbar}>
                            Reconectar
                          </button>
                        )}
                        <button onClick={() => handleEliminar(id, cuenta.handle)} style={btnRojo}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Conectar cuentas propias (OAuth) ─────────────────── */}
      <div style={card}>
        <h3 style={secTitle}>Conectar cuenta propia vía OAuth</h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--color-texto-secundario)', marginBottom: 16 }}>
          Para cuentas de Facebook e Instagram necesitás ser admin de la página.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(plataformas)
            .filter(([key]) => ['facebook', 'instagram', 'x'].includes(key))
            .map(([key, plat]) => (
              <div key={key} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: PLAT_COLOR[key] ?? '#6B7280', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                  }}>
                    {key.slice(0, 2)}
                  </span>
                  <strong style={{ fontSize: '0.88rem' }}>{plat.label}</strong>
                </div>
                {plat.requires?.length > 0 && (
                  <ul style={{ fontSize: '0.75rem', color: 'var(--color-texto-secundario)', marginBottom: 10, paddingLeft: 14, lineHeight: 1.5 }}>
                    {plat.requires.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                <button onClick={() => handleConectar(key)} style={btnPrimario}>
                  Conectar {plat.label}
                </button>
              </div>
            ))}
        </div>
      </div>
    </Layout>
  );
}

const card      = { background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 };
const secTitle  = { fontSize: '1rem', fontWeight: 700, color: 'var(--color-texto)', marginBottom: 12 };
const th        = { textAlign: 'left', padding: '8px 10px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td        = { padding: '11px 10px', verticalAlign: 'middle' };
const btnPrimario = { padding: '7px 14px', background: 'var(--color-primario)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, fontFamily: 'var(--fuente-base)' };
const btnAmbar  = { padding: '4px 10px', background: '#FFF8E1', color: '#E0A106', border: '1px solid #E0A106', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--fuente-base)', marginRight: 6 };
const btnRojo   = { padding: '4px 10px', background: '#FFEBEE', color: '#D62828', border: '1px solid #D62828', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--fuente-base)' };
