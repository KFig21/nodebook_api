const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LikeSchema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },
    commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    type: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Like", LikeSchema);
