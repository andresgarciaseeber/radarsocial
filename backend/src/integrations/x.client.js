require('dotenv').config();
const axios = require('axios');
const { logger } = require('../utils/logger');

const API_BASE = 'https://api.twitter.com/2';

// El Bearer Token puede estar URL-encoded si fue copiado directo de la respuesta de la API
function bearerToken() {
  return decodeURIComponent(process.env.X_BEARER_TOKEN || '');
}
function clientId()     { return process.env.X_CLIENT_ID; }
function clientSecret() { return process.env.X_CLIENT_SECRET; }

const USER_FIELDS = 'public_metrics,username,name,description,profile_image_url,created_at,verified';

// ─── PÚBLICA (Bearer Token, cualquier cuenta pública) ───────────────────────

// Buscar usuario por @username — para el buscador del dashboard
async function buscarUsuarioPorUsername(username) {
  const { data } = await axios.get(
    `${API_BASE}/users/by/username/${username.replace(/^@/, '')}`,
    {
      headers: { Authorization: `Bearer ${bearerToken()}` },
      params:  { 'user.fields': USER_FIELDS },
    }
  );
  return data.data;   // { id, name, username, public_metrics, description, ... }
}

// Métricas de cualquier cuenta pública por ID
async function obtenerUsuarioPublico(userId) {
  const { data } = await axios.get(`${API_BASE}/users/${userId}`, {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params:  { 'user.fields': USER_FIELDS },
  });
  return data.data;
}

// Tweets de cualquier cuenta pública por ID
async function obtenerTweetsPublicos(userId, limite = 20) {
  const { data } = await axios.get(`${API_BASE}/users/${userId}/tweets`, {
    headers: { Authorization: `Bearer ${bearerToken()}` },
    params: {
      'tweet.fields': 'public_metrics,created_at,text',
      max_results:    Math.min(Math.max(limite, 5), 100),
      exclude:        'retweets,replies',
    },
  });
  return data.data || [];
}

// ─── AUTENTICADA (User Token, cuenta propia vía OAuth) ──────────────────────

// Perfil del usuario autenticado
async function obtenerUsuario(userToken) {
  const { data } = await axios.get(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${userToken}` },
    params:  { 'user.fields': USER_FIELDS },
  });
  return data.data;
}

// Tweets del usuario autenticado
async function obtenerTweets(userId, userToken, limite = 20) {
  const { data } = await axios.get(`${API_BASE}/users/${userId}/tweets`, {
    headers: { Authorization: `Bearer ${userToken}` },
    params: {
      'tweet.fields': 'public_metrics,created_at,text',
      max_results:    Math.min(Math.max(limite, 5), 100),
      exclude:        'retweets,replies',
    },
  });
  return data.data || [];
}

// Refresca el access token (scope offline.access)
async function refrescarToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId(),
  });
  const { data } = await axios.post(`${API_BASE}/oauth2/token`, params.toString(), {
    auth: { username: clientId(), password: clientSecret() },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

module.exports = {
  buscarUsuarioPorUsername,
  obtenerUsuarioPublico,
  obtenerTweetsPublicos,
  obtenerUsuario,
  obtenerTweets,
  refrescarToken,
};
