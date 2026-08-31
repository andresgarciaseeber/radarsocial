const express = require('express');
const mongoose = require('mongoose');
const { verificarToken, soloAdmin } = require('../auth/middleware');
const { ejecutarOReanudar } = require('../services/botAnalysis.service');
const AnalysisRun      = require('../models/AnalysisRun');
const FollowerSnapshot = require('../models/FollowerSnapshot');
const FollowerFlag     = require('../models/FollowerFlag');
const { logger } = require('../utils/logger');

const router = express.Router();

function validarId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.cuentaId)) {
    return res.status(400).json({ mensaje: 'ID inválido' });
  }
  next();
}

// POST /api/bot-analysis/cuentas/:cuentaId/ejecutar — lanza o reanuda una corrida (gasta dinero real)
router.post('/cuentas/:cuentaId/ejecutar', verificarToken, soloAdmin, validarId, async (req, res) => {
  try {
    const run = await ejecutarOReanudar(req.params.cuentaId, {
      budgetUsd: req.body?.budget_usd ? Number(req.body.budget_usd) : undefined,
      triggeredBy: req.usuario.id,
    });
    res.json({ run });
  } catch (err) {
    logger.error('Error en bot-analysis/ejecutar:', err.message);
    res.status(err.status || 500).json({ mensaje: err.message });
  }
});

// GET /api/bot-analysis/cuentas/:cuentaId/estado — lectura barata, sin llamadas a X
router.get('/cuentas/:cuentaId/estado', verificarToken, validarId, async (req, res) => {
  try {
    const objectId = new mongoose.Types.ObjectId(req.params.cuentaId);
    const run = await AnalysisRun.findOne({ social_account_id: objectId, status: 'en_progreso' }).lean()
      || await AnalysisRun.findOne({ social_account_id: objectId }).sort({ created_at: -1 }).lean();
    res.json({ run: run || null });
  } catch (err) {
    logger.error('Error en bot-analysis/estado:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /api/bot-analysis/cuentas/:cuentaId/runs — historial de corridas
router.get('/cuentas/:cuentaId/runs', verificarToken, validarId, async (req, res) => {
  try {
    const objectId = new mongoose.Types.ObjectId(req.params.cuentaId);
    const runs = await AnalysisRun.find({ social_account_id: objectId }).sort({ created_at: -1 }).lean();
    res.json({ runs });
  } catch (err) {
    logger.error('Error en bot-analysis/runs:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /api/bot-analysis/cuentas/:cuentaId/resultados?run_id= — agregados de una corrida (default: la más reciente)
router.get('/cuentas/:cuentaId/resultados', verificarToken, validarId, async (req, res) => {
  try {
    const objectId = new mongoose.Types.ObjectId(req.params.cuentaId);

    let run;
    if (req.query.run_id && mongoose.Types.ObjectId.isValid(req.query.run_id)) {
      run = await AnalysisRun.findOne({ _id: req.query.run_id, social_account_id: objectId }).lean();
    } else {
      run = await AnalysisRun.findOne({ social_account_id: objectId }).sort({ created_at: -1 }).lean();
    }
    if (!run) return res.status(404).json({ mensaje: 'No hay corridas para esta cuenta' });

    const [porMes, top10Snapshots, totalFlaggedCount] = await Promise.all([
      FollowerSnapshot.aggregate([
        { $match: { analysis_run_id: run._id, account_created_at: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$account_created_at' } }, cantidad: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      FollowerSnapshot.find({ analysis_run_id: run._id }).sort({ follower_count: -1 }).limit(10).lean(),
      FollowerFlag.countDocuments({ analysis_run_id: run._id, $or: [{ is_suspicious: true }, { is_empty: true }] }),
    ]);

    const top10Flags = await FollowerFlag.find({
      follower_snapshot_id: { $in: top10Snapshots.map(s => s._id) },
    }).lean();
    const flagPorSnapshot = new Map(top10Flags.map(f => [String(f.follower_snapshot_id), f]));
    const top10 = top10Snapshots.map(s => ({ ...s, flag: flagPorSnapshot.get(String(s._id)) || null }));

    const flaggedFlags = await FollowerFlag.find({
      analysis_run_id: run._id, $or: [{ is_suspicious: true }, { is_empty: true }],
    }).limit(200).lean();
    const flaggedSnapshots = await FollowerSnapshot.find({
      _id: { $in: flaggedFlags.map(f => f.follower_snapshot_id) },
    }).lean();
    const snapshotPorId = new Map(flaggedSnapshots.map(s => [String(s._id), s]));
    const flagged = flaggedFlags.map(f => ({ ...snapshotPorId.get(String(f.follower_snapshot_id)), flag: f }));

    res.json({
      run,
      por_mes_creacion: porMes.map(m => ({ mes: m._id, cantidad: m.cantidad })),
      top10,
      flagged: { items: flagged, total_count: totalFlaggedCount },
    });
  } catch (err) {
    logger.error('Error en bot-analysis/resultados:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
