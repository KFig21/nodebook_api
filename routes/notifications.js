const router = require("express").Router();
const Notification = require("../models/notification");
const User = require("../models/user");
const Post = require("../models/post");
const Comment = require("../models/comment");

// get all notifications for a user
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const userNotifications = await Notification.find({ recipient: user._id });
    res.status(200).json(userNotifications);
  } catch (err) {
    res.status(500).json(err);
  }
});

// create a notification
router.post("/", async (req, res) => {
  const newNotification = new Notification(req.body);
  // check if a notification for this exact action already exists
  // if type === "comment" then multiple notifications can go through
  const checkExists = await Notification.find({
    sender: req.body.sender,
    recipient: req.body.recipient,
    postId: req.body.postId,
    commentId: req.body.commentId,
    type: req.body.type,
  });
  if (
    (checkExists.length > 0 && req.body.type === "postLike") ||
    (checkExists.length > 0 && req.body.type === "commentLike") ||
    (checkExists.length > 0 && req.body.type === "follow")
  ) {
    console.log("A notification for this already exists", checkExists);
  } else {
    console.log("this is a new notification", checkExists);
    try {
      // save to the notifications collection
      const savedNotification = await newNotification.save();
      try {
        // find and update the user notifications
        let user = await User.findById(req.body.recipient);
        user.notifications = [...user.notifications, savedNotification._id];
        user = await user.save();
        // find and update the posts notifications
        if (req.body.postId) {
          let post = await Post.findById(req.body.postId);
          post.notifications = [...post.notifications, savedNotification._id];
          post = await post.save();
        }
        // find and update the comments notifications
        if (req.body.commentId) {
          let comment = await Comment.findById(req.body.commentId);
          comment.notifications = [
            ...comment.notifications,
            savedNotification._id,
          ];
          comment = await comment.save();
        }
      } catch (err) {
        return res.status(500).json(err);
      }
      res.status(200).json(savedNotification);
    } catch (err) {
      res.status(500).json(err);
    }
  }
});

// delete a notification directly
router.delete("/:id", async (req, res) => {
  const notification = await Notification.findById(req.params.id)
    .populate("postId")
    .populate("recipient")
    .populate("commentId");

  try {
    // find and delete from the comment's notifications array if possible
    if (notification.commentId !== null) {
      try {
        let comment = await Comment.findById(notification.commentId);
        let newNotifications = await comment.notifications.filter(
          (notificationIteration) =>
            notificationIteration.toString() !== notification._id.toString()
        );
        comment.notifications = [...newNotifications];
        comment = await comment.save();
      } catch (err) {
        return res.status(500).json(err);
      }
    }
    // find and delete from the post's notifications array
    if (notification.postId !== null) {
      try {
        let post = await Post.findById(notification.postId);
        let newNotifications = await post.notifications.filter(
          (notificationIteration) =>
            notificationIteration.toString() !== notification._id.toString()
        );
        post.notifications = [...newNotifications];
        post = await post.save();
      } catch (err) {
        return res.status(500).json(err);
      }
    }
    // find and delete from the recipients's notifications array
    try {
      let user = await User.findById(notification.recipient._id);
      let newNotifications = await user.notifications.filter(
        (notificationIteration) =>
          notificationIteration.toString() !== notification._id.toString()
      );
      user.notifications = [...newNotifications];
      user = await user.save();
    } catch (err) {
      return res.status(500).json(err);
    }

    // delete from notifications collection
    await notification.deleteOne();
    res.status(200).json("the notifications has been deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});

// delete a like notification on toggle
router.delete("/", async (req, res) => {
  let checkExists = await Notification.find({
    sender: req.body.sender,
    recipient: req.body.recipient,
    commentId: req.body.commentId,
    postId: req.body.postId,
    type: req.body.type,
  });
  let notification;
  // delete like notification
  if (
    (checkExists.length > 0 && req.body.type === "postLike") ||
    (checkExists.length > 0 && req.body.type === "commentLike") ||
    (checkExists.length > 0 && req.body.type === "follow")
  ) {
    notification = await Notification.findById(checkExists[0]._id)
      .populate("sender")
      .populate("recipient")
      .populate("commentId");
    try {
      // find and delete from the comment's notifications array
      if (notification.commentId !== null) {
        try {
          let comment = await Comment.findById(notification.commentId);
          let newNotifications = await comment.notifications.filter(
            (notificationIteration) =>
              notificationIteration.toString() !== notification._id.toString()
          );
          comment.notifications = [...newNotifications];
          comment = await comment.save();
        } catch (err) {
          return res.status(500).json(err);
        }
      }
      // find and delete from the post's notifications array
      try {
        if (notification.postId !== null) {
          let post = await Post.findById(notification.postId);
          let newNotifications = await post.notifications.filter(
            (notificationIteration) =>
              notificationIteration.toString() !== notification._id.toString()
          );
          post.notifications = [...newNotifications];
          post = await post.save();
        }
      } catch (err) {
        return res.status(500).json(err);
      }
      // find and delete from the recipients's notifications array
      try {
        let user = await User.findById(notification.recipient._id);
        let newNotifications = await user.notifications.filter(
          (notificationIteration) =>
            notificationIteration.toString() !== notification._id.toString()
        );
        user.notifications = [...newNotifications];
        user = await user.save();
      } catch (err) {
        return res.status(500).json(err);
      }

      // delete from notifications collection
      await notification.deleteOne();
      res.status(200).json("the notifications has been deleted");
    } catch (err) {
      res.status(500).json(err);
    }
  }
});

// update a notifications seen status
router.put("/:id", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    const seenStatus = notification.seen;
    await notification.updateOne({ seen: !seenStatus });
    res.status(200).json("the notification has been updated");
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
