const router = require("express").Router();
const Comment = require("../models/comment");
const User = require("../models/user");
const Post = require("../models/post");
const Notification = require("../models/notification");

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

// update a post
router.put("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (comment.userId.toString() === req.body.userId.toString()) {
      await comment.updateOne({ $set: req.body });
      res.status(200).json("the comment has been updated");
    } else {
      res.status(403).json("you can update only your comment");
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
      .populate("postId")
      .populate("notifications");
    const userDeletingTheComment = await User.findById(req.body.userId);
    if (
      comment.userId._id.toString() === req.body.userId.toString() ||
      userDeletingTheComment.isAdmin === true
    ) {
      // find and delete all outstanding notifications attached to the comment
      const removeNotifications = async () => {
        let notifications = await comment.notifications;

        for (let notificationToDelete of notifications) {
          let notification = await Notification.findById(
            notificationToDelete._id
          )
            .populate("_id")
            .populate("postId")
            .populate("recipient");
          // delete from post's notifications array
          let post = await Post.findById(notification.postId);
          let newPostNotifications = await post.notifications.filter(
            (notificationIteration) =>
              notificationIteration.toString() !== notification._id.toString()
          );
          post.notifications = [...newPostNotifications];
          post = await post.save();

          // delete from user's notifications array
          let user = await User.findById(notification.recipient);
          let newUserNotifications = await user.notifications.filter(
            (notificationIteration) =>
              notificationIteration.toString() !== notification._id.toString()
          );
          user.notifications = [...newUserNotifications];
          user = await user.save();

          // delete from notifications collection
          await notification.deleteOne();
        }
      };
      // find and delete from the post's comments array
      const removeCommentFromPostComments = async () => {
        let post = await Post.findById(comment.postId);
        let newComments = await post.comments.filter(
          (commentIteration) =>
            commentIteration.toString() !== comment._id.toString()
        );
        post.comments = [...newComments];
        post = await post.save();
      };

      // find and delete from the user's comments array
      const removeCommentFromCommenter = async () => {
        let user = await User.findById(comment.userId);
        let newComments = await user.comments.filter(
          (commentIteration) =>
            commentIteration.toString() !== comment._id.toString()
        );
        user.comments = [...newComments];
        user = await user.save();
      };

      const removeComment = async () => {
        await comment.deleteOne();
      };

      // remove everything sequentially
      removeNotifications()
        .then(() => removeCommentFromPostComments())
        .then(() => removeCommentFromCommenter())
        .then(() => removeComment());

      res.status(200).json("the post has been deleted");
    } else {
      res.status(403).json("you can delete only your post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
