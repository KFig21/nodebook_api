const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Comment = new mongoose.Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    body: { type: String, max: 500 },
    likes: { type: Array, default: [] },
    edited: { type: Boolean, default: false },
    editedtimestamp: { type: Date, default: Date.now },
    notifications: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", Comment);
