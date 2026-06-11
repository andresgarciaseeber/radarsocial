const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AccountSnapshot = require('../models/AccountSnapshot');
const { verificarToken } = require('../auth/middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// GET /api/analytics/:cuentaId
router.get('/:cuentaId', verificarToken, async (req, res) => {
  const { cuentaId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(cuentaId)) {
    return res.status(400).json({ mensaje: 'ID inválido' });
  }

  try {
    const objectId = new mongoose.Types.ObjectId(cuentaId);
    const posts = await Post.find({ social_account_id: objectId }).lean();

    if (!posts.length) {
      return res.json({ sin_datos: true });
    }

    const snapshot = await AccountSnapshot
      .findOne({ social_account_id: objectId })
      .sort({ snapshot_date: -1 })
      .lean();
    const followers = snapshot?.followers || 1;

    // Engagement por post
    const postsEng = posts.map(p => ({
      ...p,
      engagement_total: (p.likes || 0) + (p.comments_count || 0) + (p.shares || 0),
    }));

    // 1. Mejor hora (0–23)
    const horas = Array.from({ length: 24 }, (_, i) => ({ hora: i, total: 0, count: 0 }));
    postsEng.forEach(p => {
      if (!p.published_at) return;
      const h = new Date(p.published_at).getHours();
      horas[h].total += p.engagement_total;
      horas[h].count++;
    });
    const mejor_hora = horas.map(h => ({
      hora: h.hora,
      label: `${String(h.hora).padStart(2, '0')}h`,
      engagement_promedio: h.count ? parseFloat((h.total / h.count).toFixed(1)) : 0,
      publicaciones: h.count,
    }));

    // 2. Mejor día de semana (0=Dom)
    const dias = Array.from({ length: 7 }, (_, i) => ({ dia: i, total: 0, count: 0 }));
    postsEng.forEach(p => {
      if (!p.published_at) return;
      const d = new Date(p.published_at).getDay();
      dias[d].total += p.engagement_total;
      dias[d].count++;
    });
    const mejor_dia = dias.map(d => ({
      dia: d.dia,
      dia_nombre: DIAS[d.dia],
      engagement_promedio: d.count ? parseFloat((d.total / d.count).toFixed(1)) : 0,
      publicaciones: d.count,
    }));

    // Recomendación: hora y día con más engagement promedio (con al menos 1 post)
    const mejorHoraRec = mejor_hora
      .filter(h => h.publicaciones > 0)
      .sort((a, b) => b.engagement_promedio - a.engagement_promedio)[0] || null;
    const mejorDiaRec = mejor_dia
      .filter(d => d.publicaciones > 0)
      .sort((a, b) => b.engagement_promedio - a.engagement_promedio)[0] || null;

    // 3. Top 5 posts
    const top_posts = [...postsEng]
      .sort((a, b) => b.engagement_total - a.engagement_total)
      .slice(0, 5)
      .map(p => ({
        _id: p._id,
        type: p.type,
        content_preview: p.content_preview,
        url: p.url,
        likes: p.likes,
        comments_count: p.comments_count,
        shares: p.shares,
        views: p.views,
        engagement_total: p.engagement_total,
        engagement_rate: followers > 1
          ? parseFloat((p.engagement_total / followers * 100).toFixed(2))
          : 0,
        published_at: p.published_at,
      }));

    // 4. Rendimiento por tipo de contenido
    const tiposMap = {};
    postsEng.forEach(p => {
      const t = p.type || 'texto';
      if (!tiposMap[t]) tiposMap[t] = { total: 0, count: 0 };
      tiposMap[t].total += p.engagement_total;
      tiposMap[t].count++;
    });
    const por_tipo = Object.entries(tiposMap)
      .map(([tipo, v]) => ({
        tipo,
        label: { foto: 'Foto', video: 'Video', reel: 'Reel', texto: 'Texto' }[tipo] || tipo,
        engagement_promedio: parseFloat((v.total / v.count).toFixed(1)),
        publicaciones: v.count,
      }))
      .sort((a, b) => b.engagement_promedio - a.engagement_promedio);

    // 5. Índice de viralidad
    const totalShares = postsEng.reduce((s, p) => s + (p.shares || 0), 0);
    const totalInteracciones = postsEng.reduce((s, p) => s + p.engagement_total, 0);
    const viralidad = totalInteracciones > 0
      ? parseFloat((totalShares / totalInteracciones * 100).toFixed(1))
      : 0;

    // 6. Consistencia
    const consistencia = calcularConsistencia(postsEng);

    // 7. Sentimiento (agrega comentarios ya analizados)
    const postIds = posts.map(p => p._id);
    const [totalComentarios, porSentimiento] = await Promise.all([
      Comment.countDocuments({ post_id: { $in: postIds } }),
      Comment.aggregate([
        { $match: { post_id: { $in: postIds }, sentiment: { $ne: null } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
    ]);

    const sentimientoMap = { positivo: 0, neutro: 0, negativo: 0 };
    porSentimiento.forEach(s => { if (s._id in sentimientoMap) sentimientoMap[s._id] = s.count; });
    const totalAnalizados = sentimientoMap.positivo + sentimientoMap.neutro + sentimientoMap.negativo;

    res.json({
      mejor_hora,
      mejor_dia,
      recomendacion: {
        hora: mejorHoraRec?.hora ?? null,
        dia_nombre: mejorDiaRec?.dia_nombre ?? null,
      },
      top_posts,
      por_tipo,
      viralidad,
      consistencia,
      sentimiento: {
        ...sentimientoMap,
        total: totalAnalizados,
        sin_analizar: totalComentarios - totalAnalizados,
        disponible: !!process.env.ANTHROPIC_API_KEY,
      },
      total_posts: posts.length,
    });
  } catch (err) {
    logger.error('Error en analytics/:cuentaId:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// POST /api/analytics/:cuentaId/analizar-sentimiento
router.post('/:cuentaId/analizar-sentimiento', verificarToken, async (req, res) => {
  const { cuentaId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(cuentaId)) {
    return res.status(400).json({ mensaje: 'ID inválido' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ mensaje: 'ANTHROPIC_API_KEY no configurada en el servidor.' });
  }

  try {
    const { analizarSentimientoComentarios } = require('../integrations/sentiment');
    const objectId = new mongoose.Types.ObjectId(cuentaId);
    const postIds = await Post.find({ social_account_id: objectId }).select('_id').lean();
    const procesados = await analizarSentimientoComentarios(postIds.map(p => p._id));
    res.json({ procesados });
  } catch (err) {
    logger.error('Error en analizar-sentimiento:', err.message);
    res.status(500).json({ mensaje: 'Error al procesar sentimiento: ' + err.message });
  }
});

function calcularConsistencia(posts) {
  const ordenados = posts
    .filter(p => p.published_at)
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

  if (ordenados.length < 2) return { posts_por_semana: ordenados.length, score: 0 };

  const ms = (new Date(ordenados.at(-1).published_at) - new Date(ordenados[0].published_at));
  const semanas = Math.max(1, ms / (7 * 86_400_000));
  const posts_por_semana = parseFloat((ordenados.length / semanas).toFixed(1));

  const intervalos = [];
  for (let i = 1; i < ordenados.length; i++) {
    intervalos.push(
      (new Date(ordenados[i].published_at) - new Date(ordenados[i - 1].published_at)) / 86_400_000
    );
  }
  const avg = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
  const stddev = Math.sqrt(
    intervalos.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / intervalos.length
  );
  const cv = avg > 0 ? stddev / avg : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - cv * 50)));

  return { posts_por_semana, score };
}

module.exports = router;
