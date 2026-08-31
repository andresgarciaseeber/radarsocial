const { Schema, model } = require('mongoose');

const followerSnapshotSchema = new Schema({
  analysis_run_id:      { type: Schema.Types.ObjectId, ref: 'AnalysisRun', required: true },
  social_account_id:    { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },  // denormalizado
  follower_external_id: { type: String, required: true },   // id numérico de X

  username:      String,
  display_name:  String,
  follower_count:   { type: Number, default: 0 },
  following_count:  { type: Number, default: 0 },
  post_count:       { type: Number, default: 0 },   // tweet_count — proxy de actividad
  account_created_at: Date,
  verified:           { type: Boolean, default: false },
  profile_image_url:  String,
  is_default_avatar:  { type: Boolean, default: false },
  fetched_at:         { type: Date, default: Date.now },
});

followerSnapshotSchema.index({ analysis_run_id: 1, follower_external_id: 1 }, { unique: true });
followerSnapshotSchema.index({ analysis_run_id: 1, account_created_at: 1 });   // agrupación mensual
followerSnapshotSchema.index({ analysis_run_id: 1, follower_count: -1 });      // top 10

module.exports = model('FollowerSnapshot', followerSnapshotSchema);
