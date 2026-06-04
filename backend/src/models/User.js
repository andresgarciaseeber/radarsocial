const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  email:         { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  role:          { type: String, enum: ['admin', 'cliente'], default: 'cliente' },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = model('User', userSchema);
