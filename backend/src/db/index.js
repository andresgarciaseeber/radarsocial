const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// Cache de conexión — en Vercel cada instancia serverless reutiliza la misma
let cached = global._mongooseConn ?? null;

async function conectar() {
  if (cached && mongoose.connection.readyState === 1) return cached;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/radarsocial';
  if (!cached) {
    cached = global._mongooseConn = await mongoose.connect(uri, {
      bufferCommands: false,
    });
    // Ocultar credenciales en el log
    const logUri = uri.replace(/\/\/[^@]+@/, '//<credentials>@');
    logger.info(`MongoDB conectado: ${logUri}`);
  }
  return cached;
}

async function testConnection() {
  await mongoose.connection.db.command({ ping: 1 });
}

module.exports = { conectar, testConnection };
