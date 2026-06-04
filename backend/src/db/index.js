const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

async function conectar() {
  // Si ya está conectado, no hace nada
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no configurado — agregá la variable de entorno en Vercel');
  }

  await mongoose.connect(uri, { bufferCommands: false });
  const logUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@');
  logger.info(`MongoDB conectado: ${logUri}`);
}

async function testConnection() {
  await conectar();
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`MongoDB no conectado (estado: ${mongoose.connection.readyState})`);
  }
}

module.exports = { conectar, testConnection };
