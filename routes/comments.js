const router = require("express").Router();
const Comment = require("../models/comment");
const User = require("../models/user");
const Post = require("../models/post");

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

// delete a comment
router.delete("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate("userId")
      .populate("postId");
    const userDeletingTheComment = await User.findById(req.body.userId);
    if (
      comment.userId._id.toString() === req.body.userId.toString() ||
      userDeletingTheComment.isAdmin === true
    ) {
      // find and delete from the post's comments array
      try {
        let post = await Post.findById(comment.postId);
        let newComments = await post.comments.filter(
          (commentIteration) =>
            commentIteration.toString() !== comment._id.toString()
        );
        post.comments = [...newComments];
        post = await post.save();
      } catch (err) {
        return res.status(500).json(err);
      }
      // find and delete from the user's comments array
      try {
        let user = await User.findById(comment.userId);
        let newComments = await user.comments.filter(
          (commentIteration) =>
            commentIteration.toString() !== comment._id.toString()
        );
        user.comments = [...newComments];
        user = await user.save();
      } catch (err) {
        return res.status(500).json(err);
      }
      await comment.deleteOne();
      res.status(200).json("the post has been deleted");
    } else {
      res.status(403).json("you can delete only your post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
