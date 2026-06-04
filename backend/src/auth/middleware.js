// TODO: Prompt 3 — verificar JWT y rol del usuario
const jwt = require('jsonwebtoken');
const config = require('../config');

function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }
  try {
    req.usuario = jwt.verify(auth.slice(7), config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ mensaje: 'Token inválido o vencido' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario?.role !== 'admin') {
    return res.status(403).json({ mensaje: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };
