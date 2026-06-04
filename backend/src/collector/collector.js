require('dotenv').config();
const cron = require('node-cron');
const config = require('../config');
const { logger } = require('../utils/logger');
const { descifrar, cifrar } = require('./tokens');
const metaClient = require('../integrations/meta.client');
const { colectarMeta } = require('./meta.collector');
const { colectarX }    = require('./x.collector');
const SocialAccount = require('../models/SocialAccount');

const PAUSA_MS = 2000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function iniciarRecolector() {
  logger.info(`Recolector configurado con cron: ${config.collectorCron}`);
  cron.schedule(config.collectorCron, ejecutarCiclo);
}

async function ejecutarCiclo() {
  logger.info('Recolector: iniciando ciclo...');
  let cuentas;
  try {
    cuentas = await SocialAccount.find({ connection_status: 'conectada' }).lean();
  } catch (err) {
    logger.error('Recolector: error al consultar cuentas:', err.message);
    return;
  }

  logger.info(`Recolector: ${cuentas.length} cuenta(s) a procesar`);
  for (const cuenta of cuentas) {
    try { await procesarCuenta(cuenta); }
    catch (err) { logger.error(`Error en ${cuenta.platform} @${cuenta.handle}:`, err.message); }
    await sleep(PAUSA_MS);
  }
  logger.info('Recolector: ciclo completado.');
}

async function procesarCuenta(cuenta) {
  await refrescarSiNecesario(cuenta);

  if (['facebook', 'instagram'].includes(cuenta.platform)) {
    await colectarMeta(cuenta);
    logger.info(`Recolectado: ${cuenta.platform} @${cuenta.handle}`);
    return;
  }
  if (cuenta.platform === 'x') {
    await colectarX(cuenta);
    logger.info(`Recolectado: x @${cuenta.handle}`);
    return;
  }
  logger.warn(`Sin recolector para: ${cuenta.platform}`);
}

async function refrescarSiNecesario(cuenta) {
  if (!cuenta.token_expires_at) return;
  const diasRestantes = (new Date(cuenta.token_expires_at) - Date.now()) / 86_400_000;
  if (diasRestantes > 7) return;

  logger.info(`Refrescando token ${cuenta.platform} @${cuenta.handle} (${Math.round(diasRestantes)} días)`);
  try {
    const tokenActual = descifrar(cuenta.refresh_token) || descifrar(cuenta.access_token);
    const xClient = require('../integrations/x.client');
    const nuevo = cuenta.platform === 'x'
      ? await xClient.refrescarToken(tokenActual)
      : await metaClient.refrescarToken(tokenActual);

    const nuevaExpiracion = nuevo.expires_in ? new Date(Date.now() + nuevo.expires_in * 1000) : null;
    await SocialAccount.findByIdAndUpdate(cuenta._id, {
      refresh_token: cifrar(nuevo.access_token),
      token_expires_at: nuevaExpiracion,
    });
    cuenta.refresh_token = cifrar(nuevo.access_token);
    cuenta.token_expires_at = nuevaExpiracion;
    logger.info(`Token refrescado OK: ${cuenta.platform} @${cuenta.handle}`);
  } catch (err) {
    logger.error(`Error al refrescar token ${cuenta.platform} @${cuenta.handle}:`, err.message);
    await SocialAccount.findByIdAndUpdate(cuenta._id, {
      connection_status: 'token_vencido', last_error: err.message?.slice(0, 500),
    });
    throw err;
  }
}

module.exports = { iniciarRecolector, ejecutarCiclo };
