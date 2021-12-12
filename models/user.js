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

// UserSchema.pre("save", async function (next) {
//   console.log("test-model");
//   const hash = await bcrypt.hash(this.password, 10);

//   this.password = hash;
//   next();
// });

// UserSchema.methods.isValidPassword = async function (password) {
//   const user = this;
//   const compare = await bcrypt.compare(password, user.password);
//   return compare;
// };

module.exports = mongoose.model("User", UserSchema);
