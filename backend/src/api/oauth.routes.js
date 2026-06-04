const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const { PLATFORMS } = require('../integrations/registry');
const { verificarToken } = require('../auth/middleware');
const metaClient = require('../integrations/meta.client');
const { cifrar } = require('../collector/tokens');
const { logger } = require('../utils/logger');
const SocialAccount = require('../models/SocialAccount');
const OAuthState = require('../models/OAuthState');

const router = express.Router();

// GET /auth/:platform/iniciar
router.get('/:platform/iniciar', verificarToken, async (req, res) => {
  const { platform } = req.params;
  const plataforma = PLATFORMS[platform];
  if (!plataforma) return res.status(400).json({ mensaje: `Plataforma desconocida: ${platform}` });
  if (plataforma.method !== 'oauth') return res.status(400).json({ mensaje: `${plataforma.label} usa método manual` });

  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let codeVerifier = null;
  const paramObj = { response_type: 'code', state };

  if (platform === 'x') {
    codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    paramObj.client_id    = process.env.X_CLIENT_ID;
    paramObj.redirect_uri = process.env.X_REDIRECT_URI;
    paramObj.scope        = plataforma.scopes.join(' ');
    paramObj.code_challenge        = codeChallenge;
    paramObj.code_challenge_method = 'S256';
  } else {
    paramObj.client_id    = process.env.META_APP_ID;
    paramObj.redirect_uri = process.env.META_REDIRECT_URI;
    paramObj.scope        = plataforma.scopes.join(',');
    paramObj.auth_type    = 'rerequest';
  }

  await OAuthState.create({ state, platform, user_id: req.usuario.id, expires_at: expiresAt, code_verifier: codeVerifier });

  const url = `${plataforma.authUrl}?${new URLSearchParams(paramObj).toString()}`;
  logger.info(`OAuth ${platform} iniciado — usuario ${req.usuario.id}`);
  res.json({ url });
});

// GET /auth/meta/callback
router.get('/meta/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${config.frontendUrl}/cuentas?error=acceso_denegado`);
  if (!code || !state) return res.redirect(`${config.frontendUrl}/cuentas?error=parametros_invalidos`);

  const oauthState = await OAuthState.findOne({ state, expires_at: { $gt: new Date() } });
  if (!oauthState || !['facebook', 'instagram'].includes(oauthState.platform)) {
    logger.warn('OAuth Meta: state inválido o vencido');
    return res.redirect(`${config.frontendUrl}/cuentas?error=state_invalido`);
  }
  await OAuthState.deleteOne({ state });

  try {
    const [{ data: meData }, { data: permsData }] = await Promise.all([
      axios.get('https://graph.facebook.com/v19.0/me', { params: { access_token: '', fields: 'id,name' } }).catch(() => ({ data: {} })),
      axios.get('https://graph.facebook.com/v19.0/me/permissions', { params: { access_token: '' } }).catch(() => ({ data: { data: [] } })),
    ]);

    const { data: tokenCortoData } = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: process.env.META_REDIRECT_URI, code },
    });
    const tokenLargoData = await metaClient.obtenerTokenLargaDuracion(tokenCortoData.access_token);
    const tokenLargo = tokenLargoData.access_token;
    const tokenExpiresAt = new Date(Date.now() + tokenLargoData.expires_in * 1000);

    const [{ data: meInfo }, { data: perms }] = await Promise.all([
      axios.get('https://graph.facebook.com/v19.0/me', { params: { access_token: tokenLargo, fields: 'id,name' } }),
      axios.get('https://graph.facebook.com/v19.0/me/permissions', { params: { access_token: tokenLargo } }),
    ]);
    logger.info(`Token válido para: ${meInfo.name} (${meInfo.id})`);
    logger.info('Permisos:', perms.data?.map(p => `${p.permission}:${p.status}`).join(', '));

    const { data: rawCuentas } = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: { access_token: tokenLargo, fields: 'id,name,access_token' },
    });
    logger.info('Raw /me/accounts:', JSON.stringify(rawCuentas));
    const paginas = rawCuentas.data || [];

    if (paginas.length === 0) {
      const permsOtorgados = perms.data?.filter(p => p.status === 'granted').map(p => p.permission).join(',');
      return res.redirect(`${config.frontendUrl}/cuentas?error=sin_paginas&perms=${encodeURIComponent(permsOtorgados)}`);
    }

    let conectadas = 0;
    for (const pagina of paginas) {
      await upsertCuenta({ platform: 'facebook', external_id: pagina.id, handle: pagina.name, display_name: pagina.name,
        access_token: cifrar(pagina.access_token), refresh_token: cifrar(tokenLargo),
        token_expires_at: tokenExpiresAt, connected_by: oauthState.user_id });
      conectadas++;

      try {
        const { data: pageDetalle } = await axios.get(`https://graph.facebook.com/v19.0/${pagina.id}`,
          { params: { access_token: pagina.access_token, fields: 'instagram_business_account' } });
        if (pageDetalle.instagram_business_account) {
          const igId = pageDetalle.instagram_business_account.id;
          const igInfo = await metaClient.obtenerMetricasInstagram(igId, pagina.access_token);
          await upsertCuenta({ platform: 'instagram', external_id: igId,
            handle: igInfo.username || igId, display_name: igInfo.name || igInfo.username,
            access_token: cifrar(pagina.access_token), refresh_token: cifrar(tokenLargo),
            token_expires_at: tokenExpiresAt, connected_by: oauthState.user_id });
          conectadas++;
        }
      } catch (igErr) { logger.warn(`Instagram para página ${pagina.id}: ${igErr.message}`); }
    }

    logger.info(`OAuth Meta OK — ${conectadas} cuenta(s) para usuario ${oauthState.user_id}`);
    res.redirect(`${config.frontendUrl}/cuentas?conectado=${conectadas}`);
  } catch (err) {
    logger.error('Error en callback OAuth Meta:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/cuentas?error=error_interno`);
  }
});

// GET /auth/x/callback
router.get('/x/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${config.frontendUrl}/cuentas?error=acceso_denegado`);
  if (!code || !state) return res.redirect(`${config.frontendUrl}/cuentas?error=parametros_invalidos`);

  const oauthState = await OAuthState.findOne({ state, platform: 'x', expires_at: { $gt: new Date() } });
  if (!oauthState) return res.redirect(`${config.frontendUrl}/cuentas?error=state_invalido`);
  await OAuthState.deleteOne({ state });

  try {
    const params = new URLSearchParams({ grant_type: 'authorization_code', code,
      redirect_uri: process.env.X_REDIRECT_URI, client_id: process.env.X_CLIENT_ID,
      code_verifier: oauthState.code_verifier });
    const { data: tokens } = await axios.post('https://api.twitter.com/2/oauth2/token', params.toString(), {
      auth: { username: process.env.X_CLIENT_ID, password: process.env.X_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const xClient = require('../integrations/x.client');
    const usuario = await xClient.obtenerUsuario(tokens.access_token);
    const tokenExpiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    await upsertCuenta({ platform: 'x', external_id: usuario.id,
      handle: usuario.username, display_name: usuario.name,
      access_token: cifrar(tokens.access_token),
      refresh_token: tokens.refresh_token ? cifrar(tokens.refresh_token) : null,
      token_expires_at: tokenExpiresAt, connected_by: oauthState.user_id });

    logger.info(`OAuth X OK — @${usuario.username}`);
    res.redirect(`${config.frontendUrl}/cuentas?conectado=1`);
  } catch (err) {
    logger.error('Error en callback OAuth X:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/cuentas?error=error_interno`);
  }
});

async function upsertCuenta({ platform, external_id, handle, display_name, access_token, refresh_token, token_expires_at, connected_by }) {
  await SocialAccount.findOneAndUpdate(
    { platform, external_id },
    { handle, display_name, access_token, refresh_token, token_expires_at,
      connection_status: 'conectada', connection_method: 'oauth',
      connected_by, connected_at: new Date(), last_error: null },
    { upsert: true, new: true }
  );
}

module.exports = router;
