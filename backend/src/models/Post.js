const { Schema, model } = require('mongoose');

const postSchema = new Schema({
  social_account_id: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  external_post_id:  { type: String, required: true },
  type:              { type: String, enum: ['foto', 'video', 'reel', 'texto'], default: 'foto' },
  content_preview:   String,
  url:               String,
  published_at:      Date,
  likes:             { type: Number, default: 0 },
  comments_count:    { type: Number, default: 0 },
  shares:            { type: Number, default: 0 },
  views:             { type: Number, default: 0 },
  last_updated_at:   { type: Date, default: Date.now },
});

postSchema.index({ social_account_id: 1, external_post_id: 1 }, { unique: true });
postSchema.index({ published_at: -1 });

module.exports = model('Post', postSchema);
