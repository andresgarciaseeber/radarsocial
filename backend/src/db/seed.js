require('dotenv').config();
const bcrypt = require('bcryptjs');
const { conectar } = require('./index');
const User = require('../models/User');
const { logger } = require('../utils/logger');

const ADMIN_EMAIL    = 'admin@radarsocial.com';
const ADMIN_PASSWORD = 'admin123';

async function seed() {
  await conectar();

  const existente = await User.findOne({ email: ADMIN_EMAIL });
  if (existente) {
    logger.info(`Usuario admin ya existe (${ADMIN_EMAIL}). Seed saltado.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({ email: ADMIN_EMAIL, password_hash: hash, role: 'admin' });

  logger.info(`Usuario admin creado:`);
  logger.info(`  Email:      ${ADMIN_EMAIL}`);
  logger.info(`  Contraseña: ${ADMIN_PASSWORD}  ← cambiar en producción`);
  process.exit(0);
}

seed().catch(err => {
  logger.error('Error en seed:', err.message);
  process.exit(1);
});
