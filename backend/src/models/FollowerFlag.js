const { Schema, model } = require('mongoose');

const followerFlagSchema = new Schema({
  follower_snapshot_id: { type: Schema.Types.ObjectId, ref: 'FollowerSnapshot', required: true, unique: true },
  analysis_run_id:      { type: Schema.Types.ObjectId, ref: 'AnalysisRun', required: true },     // denormalizado
  social_account_id:    { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },   // denormalizado

  is_empty:         { type: Boolean, default: false },   // "vacía"
  is_suspicious:    { type: Boolean, default: false },   // "sospechosa"
  suspicion_score:  { type: Number, default: 0 },         // 0–100
  reasons:          { type: [String], default: [] },      // ej. ['low_follower_count','default_avatar']
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

followerFlagSchema.index({ analysis_run_id: 1, is_suspicious: 1 });
followerFlagSchema.index({ analysis_run_id: 1, is_empty: 1 });

module.exports = model('FollowerFlag', followerFlagSchema);
