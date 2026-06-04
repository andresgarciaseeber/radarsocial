const crypto = require('crypto');

const ALGORITMO = 'aes-256-cbc';

function cifrar(texto) {
  if (!texto) return null;
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'utf8').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, key, iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function descifrar(cifrado) {
  if (!cifrado) return null;
  const [ivHex, encHex] = cifrado.split(':');
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'utf8').slice(0, 32);
  const decipher = crypto.createDecipheriv(ALGORITMO, key, Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { cifrar, descifrar };
