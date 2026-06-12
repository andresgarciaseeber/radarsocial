const express = require('express');
const { verificarToken } = require('../auth/middleware');
const xClient = require('../integrations/x.client');
const { logger } = require('../utils/logger');

const router = express.Router();

// GET /api/hashtags/buscar?q=hashtag
router.get('/buscar', verificarToken, async (req, res) => {
  const q = (req.query.q || '').replace(/^#+/, '').trim();
  if (!q) return res.status(400).json({ mensaje: 'Parámetro q requerido' });

  try {
    const tweetsData = await xClient.buscarHashtag(q, 20);
    const tweets = tweetsData.data || [];

    if (tweets.length === 0) {
      return res.json({ resultados: [], total_tweets: 0 });
    }

    // Agrupar por author_id
    const porAutor = {};
    for (const tweet of tweets) {
      const a = porAutor[tweet.author_id] ?? (porAutor[tweet.author_id] = { tweets: 0, likes: 0, retweets: 0, lista: [] });
      a.tweets++;
      a.likes    += tweet.public_metrics?.like_count    ?? 0;
      a.retweets += tweet.public_metrics?.retweet_count ?? 0;
      a.lista.push({ id: tweet.id, text: tweet.text });
    }

    // Top 10 por cantidad de tweets con el hashtag
    const top10 = Object.entries(porAutor)
      .sort((a, b) => b[1].tweets - a[1].tweets)
      .slice(0, 10);

    // Resolver author_ids a perfiles
    const usuarios = await xClient.obtenerUsuariosBatch(top10.map(([id]) => id));
    const usersMap = Object.fromEntries(usuarios.map(u => [u.id, u]));

    const resultados = top10.map(([author_id, stats]) => {
      const u = usersMap[author_id] || {};
      return {
        author_id,
        username:     u.username || author_id,
        display_name: u.name     || '',
        followers:    u.public_metrics?.followers_count ?? null,
        tweets:       stats.tweets,
        likes:        stats.likes,
        retweets:     stats.retweets,
        lista:        stats.lista,
      };
    });

    res.json({ resultados, total_tweets: tweets.length });
  } catch (err) {
    const status = err.response?.status;
    logger.error('Error búsqueda hashtag:', err.response?.data ?? err.message);

    if (status === 429) return res.status(429).json({ mensaje: 'Cuota de la API de X agotada. Intentá más tarde.' });
    if (status === 401) return res.status(401).json({ mensaje: 'Bearer Token de X inválido.' });
    if (status === 403) return res.status(403).json({ mensaje: 'Tu plan de X API no incluye búsqueda de tweets recientes. Requiere acceso Basic o superior.' });

    res.status(500).json({ mensaje: 'Error al consultar la API de X' });
  }
});

module.exports = router;
