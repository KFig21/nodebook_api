const router = require("express").Router();
const Post = require("../models/post");
const User = require("../models/user");
const Comment = require("../models/comment");

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
    if (post.userId === req.body.userId) {
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
    const post = await Post.findById(req.params.id);
    if (post.userId.toString() === req.body.userId) {
      // find and delete from the user posts array
      try {
        let user = await User.findById(req.body.userId);
        let newPosts = await user.posts.filter(
          (postIteration) => postIteration.toString() !== post._id.toString()
        );
        user.posts = [...newPosts];
        user = await user.save();
      } catch (err) {
        return res.status(500).json(err);
      }
      await post.deleteOne();
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
router.get("/timeline/:userId", async (req, res) => {
  try {
    const currentUser = await User.findById(req.params.userId);
    const userPosts = await Post.find({ userId: currentUser._id });
    const friendPosts = await Promise.all(
      currentUser.followings.map((friendId) => {
        return Post.find({ userId: friendId });
      })
    );
    res.status(200).json(userPosts.concat(...friendPosts));
  } catch (err) {
    res.status(500).json(err);
  }
});

// get profile posts
router.get("/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    const posts = await Post.find({ userId: user._id });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json(err);
  }
});

// COMMENTS
// COMMENTS
// COMMENTS

// comment on a post
router.post("/:id/comment", async (req, res) => {
  const post = await Post.findById(req.params.id);
  const newComment = new Comment(req.body);
  try {
    const savedComment = await newComment.save();
    try {
      // find and update the user comments
      let user = await User.findById(req.body.userId);
      user.comments = [...user.comments, savedComment._id];
      user = await user.save();
      // find and update the post's comments
      post.comments = [...post.comments, savedComment._id];
      user = await post.save();
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
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
