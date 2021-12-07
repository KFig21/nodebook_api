const router = require("express").Router();
const Post = require("../models/post");
const User = require("../models/user");
const Comment = require("../models/comment");
const Notification = require("../models/notification");

// create a post
router.post("/", async (req, res) => {
  const newPost = new Post(req.body);
  try {
    const savedPost = await newPost.save();
    try {
      // find and update the user posts
      let user = await User.findById(req.body.userId);
      user.posts = [...user.posts, savedPost._id];
      user = await user.save();
    } catch (err) {
      return res.status(500).json(err);
    }
    res.status(200).json(savedPost);
  } catch (err) {
    res.status(500).json(err);
  }
});

// update a post
router.put("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId.toString() === req.body.userId.toString()) {
      await post.updateOne({ $set: req.body });
      res.status(200).json("the post has been updated");
    } else {
      res.status(403).json("you can update only your post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("userId")
      .populate("comments")
      .populate("notifications");
    const userDeletingThePost = await User.findById(req.body.userId);
    if (
      post.userId.toString() === req.body.userId.toString() ||
      userDeletingThePost.isAdmin === true
    ) {
      // step 1. find and delete all outstanding notifications attached to the post
      // notifications do not need to be deleted from the post or comments because they will be deleted in full
      const removeNotifications = async () => {
        let notifications = await post.notifications;

        // the for of loop allows reading in sequence
        // StackOverflow resource: https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
        for (let notificationToDelete of notifications) {
          // fetch the notification
          let notification = await Notification.findById(
            notificationToDelete._id
          )
            .populate("_id")
            .populate("recipient");
          // delete from user's notifications array
          // fetch the recipient of the notification
          let recipient = await User.findById(
            notification.recipient._id
          ).populate("notifications");
          // set the notifications array
          let recipientNotis = recipient.notifications;
          // filter out the notification
          let newUserNotifications = await recipientNotis.filter(
            (noti) => noti._id.toString() !== notification._id.toString()
          );
          // set the user notifications
          recipient.notifications = [...newUserNotifications];
          // save the user notifications
          recipient = await recipient.save();
          // delete from notifications collection
          await notification.deleteOne();
        }
      };

      // step 2. find and delete the comments from the commenting user's comment's array
      const removeCommentsFromCommentors = async () => {
        let comments = await post.comments;

        for (let commentInPost of comments) {
          // fetch the comment
          let comment = await Comment.findById(commentInPost._id).populate(
            "userId"
          );
          // fetch the commentor
          let commentingUser = await User.findById(comment.userId).populate(
            "comments"
          );
          // set the comments array
          let comments = commentingUser.comments;
          // filter out the comment
          let newComments = await comments.filter(
            (commentIteration) =>
              commentIteration._id.toString() !== comment._id.toString()
          );
          // set the new comments
          commentingUser.comments = [...newComments];
          // save the user comments
          commentingUser = await commentingUser.save();
        }
      };

      // step 3. find and delete the post from the user posts array
      const removeFromUserPosts = async () => {
        let user = await User.findById(post.userId);
        let newPosts = await user.posts.filter(
          (postIteration) => postIteration.toString() !== post._id.toString()
        );
        user.posts = [...newPosts];
        user = await user.save();
      };

      // step 4. find and delete comments from the comments collection
      const removeFromCommentsCollection = async () => {
        post.comments.forEach(async (commentInPost) => {
          let comment = await Comment.findById(commentInPost._id);
          comment.deleteOne();
        });
      };
      // step 5. finally, delete the post
      const removePost = async () => {
        await post.deleteOne();
      };

      // remove everything sequentially
      removeNotifications()
        .then(() => removeCommentsFromCommentors())
        .then(() => removeFromUserPosts())
        .then(() => removeFromCommentsCollection())
        .then(() => removePost());

      res.status(200).json("the post has been deleted");
    } else {
      res.status(403).json("you can delete only your post");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// like / dislike a post
router.put("/:id/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post.likes.includes(req.body.userId)) {
      await post.updateOne({ $push: { likes: req.body.userId } });
      res.status(200).json("The post has been liked");
    } else {
      await post.updateOne({ $pull: { likes: req.body.userId } });
      res.status(200).json("The post has been disliked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// get a post
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("comments");
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json(err);
  }
});

// get timeline posts
router.get("/timeline/:userId/:skip", async (req, res) => {
  try {
    let timelineUsers = [];
    const currentUser = await User.findById(req.params.userId);
    const skip = await parseInt(req.params.skip);
    console.log(skip);

    const getUserPosts = async () => {
      timelineUsers.push({
        userId: currentUser._id,
      });
    };

    const getFollowingsPosts = async () => {
      await Promise.all(
        currentUser.followings.map(async (user) => {
          const following = await User.findById(user);
          return timelineUsers.push({
            userId: following._id,
          });
        })
      );
    };

    const buildPipeline = async () => {
      const pipeline = [
        {
          $match: {
            $or: await timelineUsers,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: 5 },
      ];
      const timelinePosts = await Post.aggregate(pipeline);

      res.status(200).json(timelinePosts);
    };

    getUserPosts()
      .then(() => getFollowingsPosts())
      .then(() => buildPipeline());
    // const userPosts = await Post.find({ userId: currentUser._id }, undefined, {
    //   skip,
    //   limit: 1,
    // });
    // const friendPosts = await Promise.all(
    //   currentUser.followings.map((friendId) => {
    //     return Post.find({ userId: friendId });
    //   })
    // );
    // res.status(200).json(userPosts.concat(...friendPosts));
  } catch (err) {
    res.status(500).json(err);
  }
});

// get profile posts
router.get("/profile/:username/:skip", async (req, res) => {
  try {
    const skip = await parseInt(req.params.skip);
    const user = await User.findOne({ username: req.params.username });
    const pipeline = [
      { $match: { userId: user._id } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: 5 },
    ];
    const profilePosts = await Post.aggregate(pipeline);
    res.status(200).json(profilePosts);
  } catch (err) {
    res.status(500).json(err);
  }
});

// COMMENTS
// COMMENTS
// COMMENTS

// comment on a post
router.post("/:id/comment", async (req, res) => {
  let post = await Post.findById(req.params.id);
  const newComment = new Comment({
    userId: req.body.userId,
    body: req.body.body,
    postId: req.body.postId,
  });
  try {
    let savedComment = await newComment.save();
    try {
      const saveComment = async () => {
        // find and update the user comments
        let user = await User.findById(req.body.userId);
        user.comments = [...user.comments, savedComment._id];
        user = await user.save();
        // find and update the post's comments
        post.comments = [...post.comments, savedComment._id];
        post = await post.save();
      };

      const saveNotification = async () => {
        let newNotification = new Notification({
          sender: req.body.sender,
          recipient: req.body.recipient,
          postId: req.body.postId,
          commentId: savedComment._id,
          type: req.body.type,
          seen: req.body.seen,
        });
        const savedNotification = await newNotification.save();

        // find and update the user posts
        let recipient = await User.findById(req.body.recipient);
        recipient.notifications = [
          ...recipient.notifications,
          savedNotification._id,
        ];
        recipient = await recipient.save();
        // find and update the posts notifications
        post.notifications = [...post.notifications, savedNotification._id];
        post = await post.save();

        // add the 'comment notification id' to the comment's notifications
        // so it (the notification for the comment) can be deleted if the comment is deleted
        let addNotiIDtoComment = await Comment.findById(savedComment._id);
        addNotiIDtoComment.notifications = [
          ...addNotiIDtoComment.notifications,
          savedNotification._id,
        ];
        addNotiIDtoComment = await addNotiIDtoComment.save();
      };

      saveComment().then(() => saveNotification());
    } catch (err) {
      return res.status(500).json(err);
    }
    res.status(200).json(savedPost);
  } catch (err) {
    res.status(500).json(err);
  }
});

// fetch comments on a post
router.get("/:id/comments/", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("comments");
    const comments = post.comments;
    // const comments = await Promise.all(
    //   post.comments.map((comment) => {
    //     return Comment.find({ _id: comment }).populate("likes");
    //   })
    // );
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
