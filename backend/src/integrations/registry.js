// Registro declarativo de plataformas. Cada clave es el valor de `platform` en `social_accounts`.
// TODO: Prompt 5 — completar scopes y URLs reales tras el Paso 0 (prueba manual de APIs).
const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    method: 'oauth',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    // Instagram Business se accede vía el page token — no se necesitan scopes de IG deprecados
    scopes: ['pages_show_list', 'pages_read_engagement'],
    requires: ['Cuenta Business o Creator vinculada a una Página de Facebook'],
  },
  facebook: {
    label: 'Facebook',
    method: 'oauth',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: ['pages_show_list', 'pages_read_engagement'],
    requires: ['Ser admin de la Página de Facebook'],
  },
  x: {
    label: 'X (Twitter)',
    method: 'oauth',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    // X OAuth 2.0 usa espacios entre scopes (no comas como Meta)
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    scopeSeparator: ' ',
    pkce: true, // X requiere PKCE obligatoriamente
    requires: ['Cuenta de X conectada al portal de desarrolladores'],
  },
  tiktok: {
    label: 'TikTok',
    method: 'oauth',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: ['user.info.basic', 'video.list'],
    requires: ['Cuenta compatible con la Display API'],
  },
};

module.exports = { PLATFORMS };
