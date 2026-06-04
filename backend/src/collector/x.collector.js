const xClient = require('../integrations/x.client');
const { descifrar } = require('./tokens');
const { logger } = require('../utils/logger');
const AccountSnapshot = require('../models/AccountSnapshot');
const Post = require('../models/Post');

async function colectarX(cuenta) {
  // Cuentas públicas usan Bearer Token; cuentas OAuth usan su propio token
  const esPublica = cuenta.connection_method === 'publica';

  let usuario, tweets;
  if (esPublica) {
    usuario = await xClient.obtenerUsuarioPublico(cuenta.external_id);
    tweets  = await xClient.obtenerTweetsPublicos(cuenta.external_id, 20);
  } else {
    const userToken = descifrar(cuenta.access_token);
    if (!userToken) throw new Error('Token descifrado vacío');
    usuario = await xClient.obtenerUsuario(userToken);
    tweets  = await xClient.obtenerTweets(usuario.id, userToken, 20);
  }

  const m = usuario.public_metrics ?? {};
  await AccountSnapshot.findOneAndUpdate(
    { social_account_id: cuenta._id, snapshot_date: new Date().toISOString().slice(0, 10) },
    {
      followers:       m.followers_count  ?? 0,
      following:       m.following_count  ?? 0,
      posts_count:     m.tweet_count      ?? 0,
      reach:           0,
      impressions:     0,
      engagement_rate: 0,
      captured_at:     new Date(),
    },
    { upsert: true }
  );

  for (const tweet of tweets) {
    const pm = tweet.public_metrics ?? {};
    await Post.findOneAndUpdate(
      { social_account_id: cuenta._id, external_post_id: tweet.id },
      {
        social_account_id: cuenta._id,
        external_post_id:  tweet.id,
        type:              'texto',
        content_preview:   tweet.text?.slice(0, 500) ?? null,
        url:               `https://x.com/${cuenta.handle}/status/${tweet.id}`,
        published_at:      tweet.created_at,
        likes:             pm.like_count      ?? 0,
        comments_count:    pm.reply_count     ?? 0,
        shares:            pm.retweet_count   ?? 0,
        views:             pm.impression_count ?? 0,
        last_updated_at:   new Date(),
      },
      { upsert: true }
    );
  }
}

module.exports = { colectarX };
