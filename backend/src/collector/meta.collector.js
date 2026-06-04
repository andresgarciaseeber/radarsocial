const metaClient = require('../integrations/meta.client');
const { descifrar } = require('./tokens');
const { logger } = require('../utils/logger');
const AccountSnapshot = require('../models/AccountSnapshot');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

async function colectarMeta(cuenta) {
  const pageToken = descifrar(cuenta.access_token);
  if (!pageToken) throw new Error('Token descifrado vacío');

  if (cuenta.platform === 'instagram') await colectarInstagram(cuenta, pageToken);
  else if (cuenta.platform === 'facebook') await colectarFacebook(cuenta, pageToken);
}

async function colectarInstagram(cuenta, pageToken) {
  const m = await metaClient.obtenerMetricasInstagram(cuenta.external_id, pageToken);
  await guardarSnapshot(cuenta._id, { followers: m.followers_count ?? 0, following: m.follows_count ?? 0, posts_count: m.media_count ?? 0 });

  const posts = await metaClient.obtenerPublicacionesInstagram(cuenta.external_id, pageToken, 20);
  for (const post of posts) {
    const postDoc = await upsertPost(cuenta._id, {
      external_post_id: post.id, type: mapTipoIG(post.media_type),
      content_preview: post.caption?.slice(0, 500) ?? null, url: post.permalink,
      published_at: post.timestamp, likes: post.like_count ?? 0,
      comments_count: post.comments_count ?? 0, shares: 0,
    });
    if (post.comments_count > 0 && postDoc) await colectarComentarios(post.id, postDoc._id, pageToken);
  }
}

async function colectarFacebook(cuenta, pageToken) {
  const m = await metaClient.obtenerMetricasFacebook(cuenta.external_id, pageToken);
  await guardarSnapshot(cuenta._id, { followers: m.followers_count ?? m.fan_count ?? 0, following: 0, posts_count: 0 });

  const posts = await metaClient.obtenerPublicacionesFacebook(cuenta.external_id, pageToken, 20);
  for (const post of posts) {
    await upsertPost(cuenta._id, {
      external_post_id: post.id, type: 'texto',
      content_preview: (post.message || post.story)?.slice(0, 500) ?? null,
      url: post.permalink_url, published_at: post.created_time,
      likes: post.reactions?.summary?.total_count ?? 0,
      comments_count: post.comments?.summary?.total_count ?? 0,
      shares: post.shares?.count ?? 0,
    });
  }
}

async function colectarComentarios(externalPostId, postInternoId, accessToken) {
  try {
    const comentarios = await metaClient.obtenerComentarios(externalPostId, accessToken, 50);
    for (const c of comentarios) {
      await Comment.findOneAndUpdate(
        { post_id: postInternoId, external_comment_id: c.id },
        { author_handle: c.from?.name ?? null, content: c.message, published_at: c.timestamp },
        { upsert: true }
      );
    }
  } catch (err) {
    logger.warn(`Comentarios post ${externalPostId}: ${err.message}`);
  }
}

async function guardarSnapshot(cuentaId, datos) {
  const hoy = new Date().toISOString().slice(0, 10);
  await AccountSnapshot.findOneAndUpdate(
    { social_account_id: cuentaId, snapshot_date: hoy },
    { ...datos, reach: 0, impressions: 0, engagement_rate: 0, captured_at: new Date() },
    { upsert: true }
  );
}

async function upsertPost(cuentaId, datos) {
  return Post.findOneAndUpdate(
    { social_account_id: cuentaId, external_post_id: datos.external_post_id },
    { ...datos, social_account_id: cuentaId, last_updated_at: new Date() },
    { upsert: true, new: true }
  );
}

function mapTipoIG(mediaType) {
  return ({ IMAGE: 'foto', VIDEO: 'video', CAROUSEL_ALBUM: 'foto', REEL: 'reel' })[mediaType] ?? 'foto';
}

module.exports = { colectarMeta };
