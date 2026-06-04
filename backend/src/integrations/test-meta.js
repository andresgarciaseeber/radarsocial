require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { verificarCredenciales } = require('./meta.client');
const { logger } = require('../utils/logger');

async function main() {
  logger.info(`APP_ID configurado: ${process.env.META_APP_ID}`);
  logger.info('Verificando credenciales contra Graph API...');

  try {
    const result = await verificarCredenciales();
    logger.info('Credenciales válidas.');
    logger.info(`Token type: ${result.token_type}`);
    logger.info('Próximo paso: flujo OAuth para obtener user token y probar obtenerCuentasVinculadas().');
  } catch (err) {
    const detalle = err.response?.data?.error || err.message;
    logger.error('Error al verificar credenciales:', JSON.stringify(detalle));
  }
}

main();
