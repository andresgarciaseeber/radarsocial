const express = require('express');
const SocialAccount = require('../models/SocialAccount');
const { verificarToken, soloAdmin } = require('../auth/middleware');
const xClient = require('../integrations/x.client');
const { logger } = require('../utils/logger');

const router = express.Router();

// GET /api/cuentas — lista todas las cuentas (sin tokens)
router.get('/', verificarToken, async (req, res) => {
  try {
    const cuentas = await SocialAccount.find()
      .select('-access_token -refresh_token')
      .sort({ platform: 1, handle: 1 })
      .lean();
    res.json(cuentas);
  } catch (err) {
    logger.error('Error al listar cuentas:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /api/cuentas/buscar-x?username=usuario — preview de cualquier cuenta pública de X
router.get('/buscar-x', verificarToken, async (req, res) => {
  const username = (req.query.username || '').replace(/^@/, '').trim();
  if (!username) return res.status(400).json({ mensaje: 'username es requerido' });

  try {
    const usuario = await xClient.buscarUsuarioPorUsername(username);
    res.json(usuario);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ mensaje: `No se encontró @${username}` });
    if (status === 401) return res.status(500).json({ mensaje: 'Bearer Token de X inválido o vencido' });
    if (err.response?.data?.title === 'CreditsDepleted') {
      return res.status(429).json({ mensaje: 'Cuota de la API de X agotada (free tier). Intentá más tarde.' });
    }
    logger.error('Error al buscar usuario de X:', err.response?.data || err.message);
    res.status(500).json({ mensaje: 'Error al consultar la API de X' });
  }
});

// POST /api/cuentas/agregar-publica — agrega una cuenta pública de X sin OAuth
router.post('/agregar-publica', verificarToken, async (req, res) => {
  const { platform, external_id, username, display_name, description, profile_image_url, public_metrics } = req.body;

  if (platform !== 'x' || !external_id || !username) {
    return res.status(400).json({ mensaje: 'Datos incompletos' });
  }

  try {
    const cuenta = await SocialAccount.findOneAndUpdate(
      { platform, external_id },
      {
        handle:            username,
        display_name:      display_name || username,
        connection_status: 'conectada',
        connection_method: 'publica',
        connected_by:      req.usuario.id,
        connected_at:      new Date(),
        last_error:        null,
        access_token:      null,
        refresh_token:     null,
        token_expires_at:  null,
      },
      { upsert: true, new: true }
    );

    logger.info(`Cuenta pública agregada: x @${username} por usuario ${req.usuario.id}`);
    res.json({ mensaje: `@${username} agregada al monitoreo`, cuenta });
  } catch (err) {
    logger.error('Error al agregar cuenta pública:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// DELETE /api/cuentas/:id — desconecta y elimina una cuenta (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const result = await SocialAccount.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ mensaje: 'Cuenta no encontrada' });
    logger.info(`Cuenta ${req.params.id} eliminada por usuario ${req.usuario.id}`);
    res.json({ mensaje: 'Cuenta eliminada del monitoreo' });
  } catch (err) {
    logger.error('Error al eliminar cuenta:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
