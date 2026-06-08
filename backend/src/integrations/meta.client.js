require('dotenv').config();
const axios = require('axios');
const { logger } = require('../utils/logger');

const GRAPH_BASE = 'https://graph.facebook.com/v25.0';

function appId() { return process.env.META_APP_ID; }
function appSecret() { return process.env.META_APP_SECRET; }

// Intercambia token de corta duración (del OAuth) por uno de ~60 días
async function obtenerTokenLargaDuracion(tokenCorto) {
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: appId(),
      client_secret: appSecret(),
      fb_exchange_token: tokenCorto,
    },
  });
  return data; // { access_token, token_type, expires_in }
}

// Páginas de Facebook que administra el usuario + cuenta de Instagram vinculada a cada una
async function obtenerCuentasVinculadas(userToken) {
  const { data } = await axios.get(`${GRAPH_BASE}/me/accounts`, {
    params: {
      access_token: userToken,
      fields: 'id,name,access_token,instagram_business_account',
    },
  });
  return data.data || [];
}

// Métricas de una cuenta de Instagram Business
async function obtenerMetricasInstagram(igUserId, pageToken) {
  const { data } = await axios.get(`${GRAPH_BASE}/${igUserId}`, {
    params: {
      access_token: pageToken,
      fields: 'id,username,name,followers_count,follows_count,media_count',
    },
  });
  return data;
}

// Métricas de una Página de Facebook
async function obtenerMetricasFacebook(pageId, pageToken) {
  const { data } = await axios.get(`${GRAPH_BASE}/${pageId}`, {
    params: {
      access_token: pageToken,
      fields: 'id,name,fan_count,followers_count',
    },
  });
  return data;
}

// Publicaciones recientes de Instagram con engagement
async function obtenerPublicacionesInstagram(igUserId, pageToken, limite = 20) {
  const { data } = await axios.get(`${GRAPH_BASE}/${igUserId}/media`, {
    params: {
      access_token: pageToken,
      fields: 'id,media_type,caption,permalink,timestamp,like_count,comments_count',
      limit: limite,
    },
  });
  return data.data || [];
}

// Publicaciones de una Página de Facebook
async function obtenerPublicacionesFacebook(pageId, pageToken, limite = 20) {
  const { data } = await axios.get(`${GRAPH_BASE}/${pageId}/posts`, {
    params: {
      access_token: pageToken,
      fields: 'id,message,story,created_time,permalink_url,reactions.summary(true),comments.summary(true),shares',
      limit: limite,
    },
  });
  return data.data || [];
}

// Comentarios de una publicación
async function obtenerComentarios(postId, accessToken, limite = 50) {
  const { data } = await axios.get(`${GRAPH_BASE}/${postId}/comments`, {
    params: {
      access_token: accessToken,
      fields: 'id,from,message,timestamp',
      limit: limite,
    },
  });
  return data.data || [];
}

// Refresca un token de larga duración antes de que venza (~7 días antes)
async function refrescarToken(tokenLargo) {
  return obtenerTokenLargaDuracion(tokenLargo);
}

// Verifica que APP_ID y APP_SECRET estén bien configurados (no requiere user token)
async function verificarCredenciales() {
  const { data } = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id: appId(),
      client_secret: appSecret(),
      grant_type: 'client_credentials',
    },
  });
  return data;
}

module.exports = {
  obtenerTokenLargaDuracion,
  obtenerCuentasVinculadas,
  obtenerMetricasInstagram,
  obtenerMetricasFacebook,
  obtenerPublicacionesInstagram,
  obtenerPublicacionesFacebook,
  obtenerComentarios,
  refrescarToken,
  verificarCredenciales,
};
