const router = require("express").Router();
const Comment = require("../models/comment");
const User = require("../models/user");
const Post = require("../models/post");
const Notification = require("../models/notification");
const Like = require("../models/like");
const { body, validationResult } = require("express-validator");

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
    const post = await Post.findById(comment.postId);
    // likerIds
    if (!comment.likerIds.includes(req.body.userId)) {
      await comment.updateOne({ $push: { likerIds: req.body.userId } });
    } else {
      await comment.updateOne({ $pull: { likerIds: req.body.userId } });
    }
    // like objects
    const checkExists = await Like.find({
      userId: req.body.userId,
      postId: comment.postId,
      commentId: comment._id,
      type: "commentLike",
    });
    if (checkExists.length > 0) {
      const likeToRemove = await Like.findById(checkExists[0]._id);
      await comment.updateOne({ $pull: { likes: likeToRemove._id } });
      await post.updateOne({ $pull: { likes: likeToRemove._id } });
      await likeToRemove.deleteOne();
      res.status(200).json("The comment has been disliked");
    } else {
      const like = new Like({
        userId: req.body.userId,
        postId: comment.postId,
        commentId: comment._id,
        type: "commentLike",
      });
      await comment.updateOne({ $push: { likes: like } });
      await post.updateOne({ $push: { likes: like } });
      like = await like.save();
      res.status(200).json("The comment has been liked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// update a comment
router.put("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    const user = await User.findById(req.body.userId);
    if (
      comment.userId.toString() === req.body.userId.toString() ||
      user.isAdmin
    ) {
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
      .populate("likes")
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

      // find and delete all likes from the likes collection
      const removeFromLikesCollection = async () => {
        if (comment.likes) {
          comment.likes.forEach(async (commentLike) => {
            let like = await Like.findById(commentLike._id);
            like.deleteOne();
          });
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
        .then(() => removeFromLikesCollection())
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

// get likers of a comment
router.get("/:commentId/likers/:skip/:userId", async (req, res) => {
  const comment = await Comment.findById(req.params.commentId).populate(
    "likes"
  );
  const user = await User.findById(req.params.userId);
  const skip = await parseInt(req.params.skip);
  try {
    let likers = [];
    let likerPipeline = [];
    let followers = [];
    let followings = [];
    let likersList = [];
    const followingsCheck = await Promise.all(user.followings);
    const followersCheck = await Promise.all(user.followers);

    const getLikers = async () => {
      await Promise.all(
        comment.likes.map(async (likeId) => {
          let user = await User.findById(likeId.userId);
          return likers.push({ _id: user._id });
        })
      );
    };

    const getFollowers = async () => {
      await Promise.all(
        user.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return followers.push({ _id: follower._id });
        })
      );
    };

    const getFollowings = async () => {
      await Promise.all(
        user.followings.map(async (followingId) => {
          let following = await User.findById(followingId);
          return followings.push({ _id: following._id });
        })
      );
    };

    const buildPipeline = async () => {
      let pipeline;
      if (likers.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await likers,
            },
          },
          { $sort: { username: 1 } },
          { $skip: skip },
          { $limit: 10 },
        ];
        likerPipeline = await User.aggregate(pipeline);
      } else {
        likerPipeline = [];
      }
    };

    const buildlikersList = async () => {
      likerPipeline.map((liker) => {
        const { _id, username, avatar, firstname, lastname } = liker;
        const followingStatus = followingsCheck.includes(liker._id.toString());
        const followerStatus = followersCheck.includes(liker._id.toString());
        likersList.push({
          _id,
          username,
          avatar,
          firstname,
          lastname,
          followingStatus,
          followerStatus,
        });
      });
      res.status(200).json(likersList);
    };

    getLikers()
      .then(() => getFollowers())
      .then(() => getFollowings())
      .then(() => buildPipeline())
      .then(() => buildlikersList());
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
