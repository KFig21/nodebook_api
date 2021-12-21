const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");

const UserSchema = new Schema(
  {
    email: { required: true, type: String },
    username: { required: true, type: String },
    firstname: { required: true, type: String },
    lastname: { required: true, type: String },
    password: { required: true, type: String },
    theme: { required: true, type: String, default: "default green" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    birthday: { type: String, default: "" },
    about: { type: String, default: "", max: 280 },
    avatar: { type: String },
    cover: { type: String },
    followers: { type: Array, default: [] },
    followings: { type: Array, default: [] },
    posts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
    images: [{ type: Schema.Types.ObjectId, ref: "Image" }],
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    notifications: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
