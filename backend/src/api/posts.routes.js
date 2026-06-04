const express = require('express');
const Post = require('../models/Post');
const SocialAccount = require('../models/SocialAccount');
const { verificarToken } = require('../auth/middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  const { cuentaId, pagina = '1', limite = '20', desde, hasta } = req.query;
  const lim    = Math.min(parseInt(limite) || 20, 100);
  const offset = (Math.max(parseInt(pagina) || 1, 1) - 1) * lim;
  const filtro = {};

  if (cuentaId)  filtro.social_account_id = cuentaId;
  if (desde || hasta) {
    filtro.published_at = {};
    if (desde) filtro.published_at.$gte = new Date(desde);
    if (hasta) filtro.published_at.$lte = new Date(hasta + 'T23:59:59');
  }

  try {
    const [total, posts] = await Promise.all([
      Post.countDocuments(filtro),
      Post.find(filtro)
        .sort({ published_at: -1 })
        .skip(offset)
        .limit(lim)
        .populate('social_account_id', 'platform handle display_name')
        .lean(),
    ]);

    res.json({ posts, total, pagina: parseInt(pagina), paginas: Math.ceil(total / lim) });
  } catch (err) {
    logger.error('Error en posts:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
