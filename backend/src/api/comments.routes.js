const express = require('express');
const Comment = require('../models/Comment');
const { verificarToken } = require('../auth/middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  const { postId, pagina = '1', limite = '50' } = req.query;
  if (!postId) return res.status(400).json({ mensaje: 'postId es requerido' });

  const lim    = Math.min(parseInt(limite) || 50, 200);
  const offset = (Math.max(parseInt(pagina) || 1, 1) - 1) * lim;

  try {
    const [total, comentarios] = await Promise.all([
      Comment.countDocuments({ post_id: postId }),
      Comment.find({ post_id: postId })
        .sort({ published_at: -1 })
        .skip(offset)
        .limit(lim)
        .lean(),
    ]);
    res.json({ comentarios, total, pagina: parseInt(pagina), paginas: Math.ceil(total / lim) });
  } catch (err) {
    logger.error('Error en comentarios:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
