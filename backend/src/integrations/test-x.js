require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');
const { logger } = require('../utils/logger');

async function main() {
  const clientId     = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const apiKey       = process.env.X_API_KEY;
  const apiSecret    = process.env.X_API_SECRET;
  const bearerToken  = process.env.X_BEARER_TOKEN;

  if (!clientId || !clientSecret) {
    logger.error('Faltan X_CLIENT_ID o X_CLIENT_SECRET en el .env');
    return;
  }
  logger.info(`X_CLIENT_ID: ${clientId}`);

  // Test 1: generar Bearer Token real desde API Key + API Key Secret
  // (el "Access Token" del portal es OAuth 1.0a, no el Bearer Token)
  if (apiKey && apiSecret) {
    try {
      const { data } = await axios.post(
        'https://api.twitter.com/oauth2/token',
        'grant_type=client_credentials',
        {
          auth: { username: apiKey, password: apiSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      logger.info('Bearer Token generado OK.');
      logger.info(`→ Guardá este valor como X_BEARER_TOKEN en el .env: ${data.access_token}`);
    } catch (err) {
      logger.error('Error generando Bearer Token:', err.response?.data || err.message);
    }
  }

  // Test 2: verificar Bearer Token actual (si ya existe uno válido)
  if (bearerToken && !bearerToken.includes('-')) {
    // Un Bearer Token real NO contiene guión, los OAuth 1.0a sí (ej: 12345-abcdef)
    try {
      const { data } = await axios.get('https://api.twitter.com/2/users/by/username/TwitterDev', {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      logger.info('Bearer Token actual válido:', data.data?.name);
    } catch (err) {
      logger.error('Bearer Token actual inválido:', err.response?.data || err.message);
    }
  } else if (bearerToken) {
    logger.warn('X_BEARER_TOKEN parece ser un Access Token OAuth 1.0a, no un Bearer Token.');
    logger.warn('Generalo desde el portal: App Dashboard → Keys and Tokens → Bearer Token → Regenerate');
  }

  logger.info('');
  logger.info('Para conectar una cuenta de X desde la UI:');
  logger.info('  1. Configurá el Callback URI en X Developer Portal:');
  logger.info('     App Settings → User authentication settings → Callback URI:');
  logger.info(`     http://localhost:3000/auth/x/callback`);
  logger.info('  2. Reiniciá el backend');
  logger.info('  3. Cuentas → Conectar X (Twitter)');
}

main();
