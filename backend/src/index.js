require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const config  = require('./config');
const { conectar, testConnection } = require('./db');
const { logger }           = require('./utils/logger');
const { iniciarRecolector } = require('./collector/collector');
const { PLATFORMS }        = require('./integrations/registry');

const authRoutes     = require('./auth/auth.routes');
const accountsRoutes = require('./api/accounts.routes');
const oauthRoutes    = require('./api/oauth.routes');
const metricsRoutes  = require('./api/metrics.routes');
const postsRoutes    = require('./api/posts.routes');
const commentsRoutes = require('./api/comments.routes');

const app = express();

// CORS: acepta localhost en dev + cualquier subdominio .vercel.app + FRONTEND_URL configurado
app.use(cors({
  origin: (origin, callback) => {
    const permitidos = [
      config.frontendUrl,
      'http://localhost:5173',
      'http://localhost:3000',
    ].filter(Boolean);
    const ok = !origin
      || permitidos.some(o => origin.startsWith(o))
      || origin.endsWith('.vercel.app');
    callback(null, ok);
  },
  credentials: true,
}));
app.use(express.json());

// Middleware de conexión: garantiza MongoDB antes de cada request
// Necesario en Vercel (serverless) donde no hay proceso persistente
app.use(async (req, res, next) => {
  try {
    await conectar();
    next();
  } catch (err) {
    logger.error('Error de conexión MongoDB:', err.message);
    res.status(500).json({ status: 'error', mensaje: 'Sin conexión a la base de datos' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', db: 'conectada', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', mensaje: err.message });
  }
});

// Plataformas (público)
app.get('/api/plataformas', (req, res) => {
  const publico = Object.fromEntries(
    Object.entries(PLATFORMS).map(([k, v]) => [k, { label: v.label, method: v.method, requires: v.requires }])
  );
  res.json(publico);
});

// Rutas REST
app.use('/api/auth',        authRoutes);
app.use('/api/cuentas',     accountsRoutes);
app.use('/auth',            oauthRoutes);
app.use('/api/metricas',    metricsRoutes);
app.use('/api/posts',       postsRoutes);
app.use('/api/comentarios', commentsRoutes);

// ── Ejecución local (fuera de Vercel) ─────────────────────────────────────
if (!process.env.VERCEL) {
  conectar()
    .then(() => {
      app.listen(config.port, () => {
        logger.info(`Servidor escuchando en http://localhost:${config.port}`);
        iniciarRecolector();
      });
    })
    .catch(err => {
      logger.error('Error al conectar MongoDB:', err.message);
      process.exit(1);
    });
}

// ── Export para Vercel (serverless handler) ───────────────────────────────
module.exports = app;
