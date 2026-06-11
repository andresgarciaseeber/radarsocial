const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { conectar } = require('../db');
const { ejecutarCiclo } = require('../collector/collector');
const { logger } = require('../utils/logger');

const router = express.Router();

// Acepta llamadas de:
// 1. Vercel Cron Jobs: Authorization: Bearer <CRON_SECRET>
// 2. Usuario admin autenticado vía JWT (botón en frontend)
// 3. Llamada manual con COLLECTOR_SECRET: Authorization: Bearer <COLLECTOR_SECRET>
function autorizarColector(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ mensaje: 'Autorización requerida' });

  // ① Verificar contra secretos de cron/collector
  const secretos = [
    process.env.CRON_SECRET,
    process.env.COLLECTOR_SECRET,
  ].filter(Boolean);

  if (secretos.includes(token)) return next();

  // ② Verificar JWT de usuario admin
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload?.role === 'admin') return next();
  } catch { /* token inválido — continúa al 401 */ }

  res.status(403).json({ mensaje: 'No autorizado' });
}

// GET /api/collect  — usado por Vercel Cron Jobs (envían GET con Authorization: Bearer CRON_SECRET)
// POST /api/collect — trigger manual desde frontend o curl
router.all('/', autorizarColector, async (req, res) => {
  logger.info('Recolector: inicio manual/cron vía API');
  try {
    await conectar();
    await ejecutarCiclo();
    logger.info('Recolector: ciclo completado vía API');
    res.json({ ok: true, mensaje: 'Ciclo de recolección completado' });
  } catch (err) {
    logger.error('Recolector API: error en ciclo:', err.message);
    res.status(500).json({ ok: false, mensaje: err.message });
  }
});

module.exports = router;
