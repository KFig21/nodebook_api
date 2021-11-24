const router = require("express").Router();
const Comment = require("../models/comment");

// get a comment
router.get("/:id", async (req, res) => {
  try {
    const post = await Comment.findById(req.params.id).populate("likes");
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json(err);
  }
});

// like / dislike a comment on a post
router.put("/:id/like", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment.likes.includes(req.body.userId)) {
      await comment.updateOne({ $push: { likes: req.body.userId } });
      res.status(200).json("The comment has been liked");
    } else {
      await comment.updateOne({ $pull: { likes: req.body.userId } });
      res.status(200).json("The comment has been disliked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
