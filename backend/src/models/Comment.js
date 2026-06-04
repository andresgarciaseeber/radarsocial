const { Schema, model } = require('mongoose');

const commentSchema = new Schema({
  post_id:             { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  external_comment_id: { type: String, required: true },
  author_handle:       String,
  content:             String,
  sentiment:           String,
  published_at:        Date,
  captured_at:         { type: Date, default: Date.now },
});

commentSchema.index({ post_id: 1, external_comment_id: 1 }, { unique: true });

module.exports = model('Comment', commentSchema);
