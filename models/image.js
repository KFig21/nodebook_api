const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ImageSchema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    postId: { type: Schema.Types.ObjectId, ref: "Post" },
    body: { type: String, max: 500 },
    img: { type: String },
    likerIds: { type: Array, default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "Like" }],
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Image", ImageSchema);
