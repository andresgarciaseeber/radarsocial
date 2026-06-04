const express = require('express');
const SocialAccount = require('../models/SocialAccount');
const AccountSnapshot = require('../models/AccountSnapshot');
const { verificarToken } = require('../auth/middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

// GET /api/metricas/resumen — último snapshot de cada cuenta
router.get('/resumen', verificarToken, async (req, res) => {
  try {
    const cuentas = await SocialAccount.find()
      .select('-access_token -refresh_token')
      .lean();

    const fecha7d = new Date();
    fecha7d.setDate(fecha7d.getDate() - 7);
    const str7d = fecha7d.toISOString().slice(0, 10);

    const resultado = await Promise.all(cuentas.map(async cuenta => {
      const [snapshot, snap7d] = await Promise.all([
        AccountSnapshot.findOne({ social_account_id: cuenta._id }).sort({ snapshot_date: -1 }).lean(),
        AccountSnapshot.findOne({ social_account_id: cuenta._id, snapshot_date: { $lte: str7d } }).sort({ snapshot_date: -1 }).lean(),
      ]);

      const crecimiento_7d = (snapshot && snap7d && snap7d.followers)
        ? parseFloat(((snapshot.followers - snap7d.followers) / snap7d.followers * 100).toFixed(1))
        : null;

      return {
        ...cuenta,
        ...(snapshot ? {
          followers:       snapshot.followers,
          following:       snapshot.following,
          posts_count:     snapshot.posts_count,
          reach:           snapshot.reach,
          impressions:     snapshot.impressions,
          engagement_rate: snapshot.engagement_rate,
          snapshot_date:   snapshot.snapshot_date,
          crecimiento_7d,
        } : {}),
      };
    }));

    res.json(resultado);
  } catch (err) {
    logger.error('Error en metricas/resumen:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /api/metricas/:cuentaId — historial de snapshots
router.get('/:cuentaId', verificarToken, async (req, res) => {
  const { desde, hasta, limite = '30' } = req.query;
  const filtro = { social_account_id: req.params.cuentaId };
  if (desde) filtro.snapshot_date = { ...filtro.snapshot_date, $gte: desde };
  if (hasta) filtro.snapshot_date = { ...filtro.snapshot_date, $lte: hasta };

  try {
    const snapshots = await AccountSnapshot.find(filtro)
      .sort({ snapshot_date: 1 })
      .limit(Math.min(parseInt(limite) || 30, 365))
      .lean();
    res.json(snapshots);
  } catch (err) {
    logger.error('Error en metricas/:cuentaId:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
