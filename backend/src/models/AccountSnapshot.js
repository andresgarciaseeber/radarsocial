const { Schema, model } = require('mongoose');

const accountSnapshotSchema = new Schema({
  social_account_id: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  snapshot_date:     { type: String, required: true },   // 'YYYY-MM-DD'
  followers:         { type: Number, default: 0 },
  following:         { type: Number, default: 0 },
  posts_count:       { type: Number, default: 0 },
  reach:             { type: Number, default: 0 },
  impressions:       { type: Number, default: 0 },
  engagement_rate:   { type: Number, default: 0 },
  captured_at:       { type: Date, default: Date.now },
});

accountSnapshotSchema.index({ social_account_id: 1, snapshot_date: 1 }, { unique: true });

module.exports = model('AccountSnapshot', accountSnapshotSchema);
