const User = require("../models/user");
const router = require("express").Router();
const bcrypt = require("bcrypt");
// img upload
// var upload = require("../utils/multUpload");

// update user
router.put("/:id", async (req, res) => {
  // check if the correct user or if user is an admin
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    if (req.body.password) {
      try {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      } catch (err) {
        return res.status(500).json(err);
      }
    }

    // CHECK IF USERNAME AND EMAIL EXIST
    // check if username is  already in use
    const isUserInDB = await User.find({ username: req.body.username });
    if (isUserInDB.length > 0) {
      return res.status(500).json("Username already in use");
    }
    // check if email is  already in use
    const isEmailInDB = await User.find({ email: req.body.email });
    if (isEmailInDB.length > 0) {
      return res.status(500).json("email already in use");
    }
    try {
      // find and update the user
      const user = await User.findByIdAndUpdate(req.params.id, {
        $set: req.body,
      });
      console.log("user", user);
      res.status(200).json("Account has been updated");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can update only your account!");
  }
});

// delete user
router.delete("/:id", async (req, res) => {
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).json("Account has been deleted");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can delete only your account!");
  }
});

// get user
router.get("/", async (req, res) => {
  const userId = req.query.userId;
  const username = req.query.username;
  try {
    const user = userId
      ? await User.findById(userId)
      : await User.findOne({ username: username });
    const { password, updatedAt, ...other } = user._doc;
    res.status(200).json(other);
  } catch (err) {
    res.status(500).json(err);
  }
});

// follow user
router.put("/:id/follow", async (req, res) => {
  if (req.body.userId !== req.params.id) {
    try {
      const user = await User.findById(req.params.id);
      const currentUser = await User.findById(req.body.userId);
      if (!user.followers.includes(req.body.userId)) {
        await user.updateOne({ $push: { followers: req.body.userId } });
        await currentUser.updateOne({ $push: { followings: req.params.id } });
        res.status(200).json("user has been followed");
      } else {
        res.status(403).json("you already follow this user");
      }
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("you cannot follow yourself");
  }
});

// unfollow user
router.put("/:id/unfollow", async (req, res) => {
  if (req.body.userId !== req.params.id) {
    try {
      const user = await User.findById(req.params.id);
      const currentUser = await User.findById(req.body.userId);
      if (user.followers.includes(req.body.userId)) {
        await user.updateOne({ $pull: { followers: req.body.userId } });
        await currentUser.updateOne({ $pull: { followings: req.params.id } });
        res.status(200).json("user has been unfollowed");
      } else {
        res.status(403).json("you dont follow this user");
      }
    } catch (err) {
      res.status(500).json(err);
    }
  } else {
    res.status(403).json("you cant unfollow yourself");
  }
});

//get followers
router.get("/:id/followers", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const followers = await Promise.all(
      user.followers.map((followerId) => {
        return User.findById(followerId);
      })
    );
    const followings = await Promise.all(user.followings);
    let followersList = [];
    followers.map((follower) => {
      const { _id, username, profilePicture, firstname, lastname } = follower;
      const followingStatus = followings.includes(follower._id.toString());
      const followerStatus = true;
      followersList.push({
        _id,
        username,
        profilePicture,
        firstname,
        lastname,
        followingStatus,
        followerStatus,
      });
    });
    res.status(200).json(followersList);
  } catch (err) {
    res.status(500).json(err);
  }
});

//get following
router.get("/:id/following", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const following = await Promise.all(
      user.followings.map((followingId) => {
        return User.findById(followingId);
      })
    );
    const followers = await Promise.all(user.followers);
    let followingList = [];
    following.map((userYouFollow) => {
      const { _id, username, profilePicture, firstname, lastname } =
        userYouFollow;
      const followingStatus = true;
      const followerStatus = followers.includes(userYouFollow._id.toString());
      followingList.push({
        _id,
        username,
        profilePicture,
        firstname,
        lastname,
        followingStatus,
        followerStatus,
      });
    });
    res.status(200).json(followingList);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
