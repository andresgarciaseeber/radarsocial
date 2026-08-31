const { Schema, model } = require('mongoose');

const analysisRunSchema = new Schema({
  social_account_id:  { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  triggered_by:       { type: Schema.Types.ObjectId, ref: 'User' },
  status:             { type: String, enum: ['en_progreso', 'completado', 'error', 'cancelado'], default: 'en_progreso' },

  budget_usd:            { type: Number, required: true },
  spent_usd:             { type: Number, default: 0 },
  cost_per_profile_usd:  { type: Number, required: true },   // snapshot de config al crear la corrida
  bot_price_usd:         { type: Number, required: true },   // snapshot de config al crear la corrida

  pagination_token:          String,   // next_token de X para reanudar; null cuando no queda nada pendiente
  followers_fetched:         { type: Number, default: 0 },
  total_followers_reported:  { type: Number, default: 0 },   // public_metrics.followers_count, capturado una vez al iniciar
  coverage_pct:              { type: Number, default: 0 },
  extrapolation_factor:      { type: Number, default: 1 },   // total_followers_reported / followers_fetched

  vacias_count:               { type: Number, default: 0 },
  sospechosas_count:          { type: Number, default: 0 },
  estimated_flagged_total:    { type: Number, default: 0 },  // sospechosas_count * extrapolation_factor
  estimated_cost_flagged_usd: { type: Number, default: 0 },  // estimated_flagged_total * bot_price_usd

  started_at:   { type: Date, default: Date.now },
  finished_at:  Date,
  last_error:   String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

analysisRunSchema.index({ social_account_id: 1, created_at: -1 });

// Evita dos corridas "en_progreso" simultáneas para la misma cuenta a nivel de base
analysisRunSchema.index(
  { social_account_id: 1 },
  { unique: true, partialFilterExpression: { status: 'en_progreso' } }
);

module.exports = model('AnalysisRun', analysisRunSchema);
