const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new mongoose.Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    recipient: { type: Schema.Types.ObjectId, ref: "User" },
    postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },
    commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    type: { type: String },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
