const { Schema, model } = require('mongoose');

const socialAccountSchema = new Schema({
  platform:          { type: String, enum: ['facebook', 'instagram', 'x', 'tiktok'], required: true },
  external_id:       { type: String, required: true },
  handle:            String,
  display_name:      String,
  access_token:      String,   // cifrado
  refresh_token:     String,   // cifrado
  token_expires_at:  Date,
  connection_status: { type: String, enum: ['pendiente', 'conectada', 'token_vencido', 'error', 'desconectada'], default: 'pendiente' },
  connection_method: { type: String, enum: ['oauth', 'manual', 'publica'], default: 'oauth' },
  connected_by:      { type: Schema.Types.ObjectId, ref: 'User' },
  connected_at:      Date,
  last_error:        String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

socialAccountSchema.index({ platform: 1, external_id: 1 }, { unique: true });

module.exports = model('SocialAccount', socialAccountSchema);
