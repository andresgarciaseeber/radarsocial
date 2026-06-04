const { Schema, model } = require('mongoose');

const oauthStateSchema = new Schema({
  state:          { type: String, required: true, unique: true },
  platform:       { type: String, enum: ['facebook', 'instagram', 'x', 'tiktok'], required: true },
  user_id:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  code_verifier:  String,   // PKCE para X
  expires_at:     { type: Date, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// TTL: MongoDB borra el documento automáticamente cuando vence
oauthStateSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = model('OAuthState', oauthStateSchema);
