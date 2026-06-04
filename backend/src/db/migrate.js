require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');
const { logger } = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL UNIQUE,
      ejecutada_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const archivos = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const [rows] = await pool.execute('SELECT nombre FROM migrations');
  const ejecutadas = new Set(rows.map(r => r.nombre));

  let pendientes = 0;
  for (const archivo of archivos) {
    if (ejecutadas.has(archivo)) continue;
    pendientes++;
    logger.info(`Ejecutando: ${archivo}`);

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    const sentencias = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const sentencia of sentencias) {
      await pool.execute(sentencia);
    }

    await pool.execute('INSERT INTO migrations (nombre) VALUES (?)', [archivo]);
    logger.info(`Completada: ${archivo}`);
  }

  if (pendientes === 0) logger.info('Sin migraciones pendientes.');

  await pool.end();
}

migrate().catch(err => {
  logger.error('Error en migraciones:', err.message);
  process.exit(1);
});
