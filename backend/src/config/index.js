require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'radar_social',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'cambiar_esto_en_produccion',
    expiresIn: '7d',
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  collectorCron: process.env.COLLECTOR_CRON || '0 */6 * * *',
};
