const router = require("express").Router();
const Comment = require("../models/comment");
const User = require("../models/user");
const Post = require("../models/post");
const Notification = require("../models/notification");
const Image = require("../models/image");

// get an image
router.get("/:id", async (req, res) => {
  try {
    let image = await Image.findById(req.params.id);
    const post = await Post.findById(image.postId)
      .populate("comments")
      .populate("likerIds");

    image.comments = post.comments;
    image.likerIds = post.likerIds;
    res.status(200).json(image);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
