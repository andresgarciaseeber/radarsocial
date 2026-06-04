const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { verificarToken } = require('./middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });

  try {
    const usuario = await User.findOne({ email });
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash)))
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, role: usuario.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    logger.info(`Login: ${email} (${usuario.role})`);
    res.json({ token, usuario: { id: usuario._id, email: usuario.email, role: usuario.role } });
  } catch (err) {
    logger.error('Error en login:', err.message);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.get('/me', verificarToken, (req, res) => {
  res.json({ usuario: req.usuario });
});

module.exports = router;
