const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PostSchema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    body: { type: String, max: 500 },
    img: { type: String },
    imgId: { type: Schema.Types.ObjectId, ref: "Image" },
    likerIds: { type: Array, default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "Like" }],
    edited: { type: Boolean, default: false },
    editedtimestamp: { type: Date, default: Date.now },
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    notifications: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
