const router = require("express").Router();
const Post = require("../models/post");
const User = require("../models/user");
const Like = require("../models/like");
const Comment = require("../models/comment");
const Notification = require("../models/notification");
const Image = require("../models/image");
// img upload
const multer = require("multer");
const { uploadFile, deleteFile } = require("../s3");
const fs = require("fs");
const util = require("util");
const unlinkFile = util.promisify(fs.unlink);
const upload = multer({
  dest: "uploads",
  limits: {
    fileSize: 10000000,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|png|JPG|PNG|JPEG|jpeg)$/))
      return cb(new Error("This is not a correct format of the file"));
    cb(undefined, true);
  },
});

// create a post with an image
router.post(
  "/image",
  upload.single("file"),
  async (req, res) => {
    // save image and upload to AWS
    const file = req.file;
    const result = await uploadFile(file);
    // create new post
    const newPost = new Post({
      userId: req.body.userId,
      body: req.body.body,
      img: result.key,
    });
    try {
      // save post to mongodb
      const savedPost = await newPost.save();
      // create new image
      const newImage = new Image({
        userId: req.body.userId,
        postId: savedPost._id,
        body: req.body.body,
        img: result.key,
      });
      console.log("NEWIMAGE", newImage);
      // save image to mongodb
      const savedImage = await newImage.save();
      try {
        // find and update the user posts and images
        let user = await User.findById(req.body.userId);
        user.posts = [...user.posts, savedPost._id];
        user.images = [...user.images, savedImage._id];
        user = await user.save();
      } catch (err) {
        return res.status(500).json(err);
      }
      try {
        // update the post to include the image id
        let post = await Post.findById(savedPost._id);
        post.imgId = savedImage._id;
        post = await post.save();
      } catch (err) {
        return res.status(500).json(err);
      }
    } catch (err) {
      res.status(500).json(err);
    }

    await unlinkFile(file.path);
    console.log("result", result);
    res.send({ imagePath: `images/${result.Key}` });
  },
  (err, req, res, next) => {
    if (err) {
      res.status(403).json("an error occurred");
    }
  }
);

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
      .populate("likes")
      .populate("imgId")
      .populate("notifications");
    const userDeletingThePost = await User.findById(req.body.userId);
    if (
      post.userId._id.toString() === req.body.userId.toString() ||
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

      // step 5. find and delete likes from the likes collection
      const removeFromLikesCollection = async () => {
        if (post.likes) {
          post.likes.forEach(async (postLike) => {
            let like = await Like.findById(postLike._id);
            like.deleteOne();
          });
        }
      };

      // step 6. if an image, delete from the users images
      const removeFromUserImages = async () => {
        if (post.img) {
          let user = await User.findById(post.userId);
          let newImages = await user.images.filter(
            (imageIteration) =>
              imageIteration.toString() !== post.imgId._id.toString()
          );
          user.images = [...newImages];
          user = await user.save();
        }
      };

      // step 7. if an image, delete from the images collection
      const removeImgFromImages = async () => {
        if (post.img) {
          let image = await Image.findById(post.imgId._id);
          await image.deleteOne();
        }
      };

      // step 8. delete the image from AWS
      const removeImgFromBucket = async () => {
        if (post.img) {
          await deleteFile(post.img);
        }
      };

      // step 9. finally, delete the post
      const removePost = async () => {
        await post.deleteOne();
      };

      // remove everything sequentially
      removeNotifications()
        .then(() => removeCommentsFromCommentors())
        .then(() => removeFromUserPosts())
        .then(() => removeFromCommentsCollection())
        .then(() => removeFromLikesCollection())
        .then(() => removeFromUserImages())
        .then(() => removeImgFromImages())
        .then(() => removeImgFromBucket())
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
    // likerIds
    if (!post.likerIds.includes(req.body.userId)) {
      await post.updateOne({ $push: { likerIds: req.body.userId } });
    } else {
      await post.updateOne({ $pull: { likerIds: req.body.userId } });
    }

    // like objects
    const checkExists = await Like.find({
      userId: req.body.userId,
      postId: req.body.postId,
      type: "postLike",
      commentId: null,
    });
    if (checkExists.length > 0) {
      const likeToRemove = await Like.findById(checkExists[0]._id);
      await post.updateOne({ $pull: { likes: likeToRemove._id } });
      await likeToRemove.deleteOne();
      res.status(200).json("The post has been disliked");
    } else {
      const like = new Like({
        userId: req.body.userId,
        postId: req.body.postId,
        type: "postLike",
        commentId: null,
      });
      await post.updateOne({ $push: { likes: like } });
      like = await like.save();
      res.status(200).json("The post has been liked");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// get a post
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("comments")
      .populate("likes");
    console.log(post);
    const pipeline = [{ $match: { _id: post._id } }];
    const data = await Post.aggregate(pipeline);
    res.status(200).json(...data);
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

// get profile images
router.get("/profile/:username/images/:skip", async (req, res) => {
  try {
    const skip = await parseInt(req.params.skip);
    const user = await User.findOne({ username: req.params.username });
    const pipeline = [
      { $match: { userId: user._id } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: 12 },
    ];
    const profileImages = await Image.aggregate(pipeline);
    console.log(profileImages);
    res.status(200).json(profileImages);
  } catch (err) {
    res.status(500).json(err);
  }
});

// get likers of a post
router.get("/:postId/likers/:skip/:userId", async (req, res) => {
  const post = await Post.findById(req.params.postId).populate("likes");
  const user = await User.findById(req.params.userId);
  const skip = await parseInt(req.params.skip);
  try {
    let likers = [];
    let likerPipeline = [];
    let followers = [];
    let followings = [];
    let likersList = [];
    const followingsCheck = await Promise.all(user.followings);

    const getLikers = async () => {
      await Promise.all(
        post.likes.map(async (likeId) => {
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
        const followerStatus = true;
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
router.get("/:id/comments/:skip", async (req, res) => {
  try {
    const skip = await parseInt(req.params.skip);
    const post = await Post.findById(req.params.id);
    let comments = [];
    let commentsPipeline = [];

    const getPostComments = async () => {
      await Promise.all(
        post.comments.map(async (commentId) => {
          let comment = await Comment.findById(commentId);
          return comments.push({ _id: comment._id });
        })
      );
    };

    const buildPipeline = async () => {
      let pipeline;
      if (comments.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await comments,
            },
          },
          { $sort: { createdAt: 1 } },
          { $skip: skip },
          { $limit: 5 },
        ];
        commentsPipeline = await Comment.aggregate(pipeline);
        res.status(200).json(commentsPipeline);
      } else {
        commentsPipeline = [];
        res.status(200).json(commentsPipeline);
      }
    };

    getPostComments().then(() => buildPipeline());
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
