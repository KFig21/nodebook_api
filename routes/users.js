const User = require("../models/user");
const router = require("express").Router();
const bcrypt = require("bcrypt");
// img
// img
// img
const multer = require("multer");
const upload = multer({
  limits: {
    fileSize: 1000000,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|png|JPG|PNG|JPEG|jpeg)$/))
      return cb(new Error("This is not a correct format of the file"));
    cb(undefined, true);
  },
});

// update user avatar
router.put(
  "/avatar",
  upload.single("file"),
  async (req, res) => {
    const avatar = await req.file.buffer;
    try {
      // find and update the user
      let user = await User.findById(req.body.userId);
      user.profilePicture = avatar;
      user = await user.save();
    } catch (err) {
      return res.status(500).json(err);
    }
    res.status(200).json(avatar);
  },
  (err, req, res, next) => res.status(404).send({ error: err.message })
);

// update user cover photo
router.put(
  "/cover",
  upload.single("file"),
  async (req, res) => {
    const cover = await req.file.buffer;
    try {
      // find and update the user
      let user = await User.findById(req.body.userId);
      user.coverPicture = cover;
      user = await user.save();
    } catch (err) {
      return res.status(500).json(err);
    }
    res.status(200).json(cover);
  },
  (err, req, res, next) => res.status(404).send({ error: err.message })
);

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
    const userCurrentState = await User.findById(req.body.userId);
    // CHECK IF USERNAME AND EMAIL EXIST
    // check if username is  already in use
    const isUsernameInDB = await User.find({ username: req.body.username });
    if (
      isUsernameInDB.length > 0 &&
      req.body.username !== userCurrentState.username
    ) {
      console.log("Username already in use");
      return res.status(500).send({ msg: "Username already in use" });
    }
    // check if email is  already in use
    const isEmailInDB = await User.find({ email: req.body.email });
    if (isEmailInDB.length > 0 && req.body.email !== userCurrentState.email) {
      console.log("email already in use");
      return res.status(500).json({ msg: "email already in use" });
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
      ? await User.findById(userId).populate("notifications")
      : await User.findOne({ username: username });
    // const { password, updatedAt, ...other } = user._doc;
    const pipeline = [{ $match: { _id: user._id } }];
    const profile = await User.aggregate(pipeline);
    res.status(200).json(...profile);
  } catch (err) {
    res.status(500).json(err);
  }
});

// get user notifications
router.get("/notifications", async (req, res) => {
  const userId = req.query.userId;
  const username = req.query.username;
  try {
    const user = userId
      ? await User.findById(userId).populate("notifications")
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

// get followers
router.get("/:id/followers/:skip", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const skip = await parseInt(req.params.skip);

    let followers = [];
    let followerPipeline = [];
    let followings = [];
    let followersList = [];
    const followingsCheck = await Promise.all(user.followings);

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
      if (followers.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await followers,
            },
          },
          { $sort: { username: 1 } },
          { $skip: skip },
          { $limit: 10 },
        ];
        followerPipeline = await User.aggregate(pipeline);
      } else {
        followerPipeline = [];
      }
    };

    const buildFollowersList = async () => {
      followerPipeline.map((follower) => {
        const { _id, username, profilePicture, firstname, lastname } = follower;
        const followingStatus = followingsCheck.includes(
          follower._id.toString()
        );
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
    };

    getFollowers()
      .then(() => getFollowings())
      .then(() => buildPipeline())
      .then(() => buildFollowersList());
  } catch (err) {
    res.status(500).json(err);
  }
});

// get following
router.get("/:id/following/:skip", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const skip = await parseInt(req.params.skip);

    let followers = [];
    let followingPipeline = [];
    let followings = [];
    let followingList = [];
    const followersCheck = await Promise.all(user.followers);

    const getFollowings = async () => {
      await Promise.all(
        user.followings.map(async (followingId) => {
          let following = await User.findById(followingId);
          return followings.push({ _id: following._id });
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

    const buildPipeline = async () => {
      let pipeline;
      if (followings.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await followings,
            },
          },
          { $sort: { username: 1 } },
          { $skip: skip },
          { $limit: 10 },
        ];
        followingPipeline = await User.aggregate(pipeline);
      } else {
        followingPipeline = [];
      }
    };

    const buildFollowersList = async () => {
      followingPipeline.map((userYouFollow) => {
        const { _id, username, profilePicture, firstname, lastname } =
          userYouFollow;
        const followingStatus = true;
        const followerStatus = followersCheck.includes(
          userYouFollow._id.toString()
        );
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
    };

    getFollowings()
      .then(() => getFollowers())
      .then(() => buildPipeline())
      .then(() => buildFollowersList());
  } catch (err) {
    res.status(500).json(err);
  }
});

// check followers between users when visiting another users profile
router.get("/:id/followers-profile/:user/:skip", async (req, res) => {
  try {
    const profileUser = await User.findById(req.params.id);
    const loggedInUser = await User.findById(req.params.user);
    const skip = await parseInt(req.params.skip);

    let profileUserFollowers = [];
    let profileUserFollowings = [];
    let loggedInUserFollowers = [];
    let loggedInUserFollowings = [];
    let followerPipeline = [];
    const followings = await Promise.all(loggedInUser.followings);
    const followers = await Promise.all(loggedInUser.followers);

    let followersList = [];

    const getProfileUserFollowers = async () => {
      await Promise.all(
        profileUser.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return profileUserFollowers.push({ _id: follower._id });
        })
      );
    };

    const getProfileUserFollowings = async () => {
      await Promise.all(
        profileUser.followings.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return profileUserFollowings.push({ _id: follower._id });
        })
      );
    };

    const getLoggedInUserFollowers = async () => {
      await Promise.all(
        loggedInUser.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return loggedInUserFollowers.push({ _id: follower._id });
        })
      );
    };

    const getLoggedInUserFollowings = async () => {
      await Promise.all(
        loggedInUser.followings.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return loggedInUserFollowings.push({ _id: follower._id });
        })
      );
    };

    const buildPipeline = async () => {
      let pipeline;
      if (profileUserFollowers.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await profileUserFollowers,
            },
          },
          { $sort: { username: 1 } },
          { $skip: skip },
          { $limit: 10 },
        ];
        followerPipeline = await User.aggregate(pipeline);
      } else {
        followerPipeline = [];
      }
    };

    const buildFollowersList = async () => {
      followerPipeline.map((follower) => {
        const { _id, username, profilePicture, firstname, lastname } = follower;
        const followingStatus = followings.includes(follower._id.toString());
        const followerStatus = followers.includes(follower._id.toString());
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
    };

    getProfileUserFollowers()
      .then(() => getProfileUserFollowings())
      .then(() => getLoggedInUserFollowers())
      .then(() => getLoggedInUserFollowings())
      .then(() => buildPipeline())
      .then(() => buildFollowersList());
  } catch (err) {
    res.status(500).json(err);
  }
});

// check followings between users when visiting another users profile
router.get("/:id/following-profile/:user/:skip", async (req, res) => {
  try {
    const profileUser = await User.findById(req.params.id);
    const loggedInUser = await User.findById(req.params.user);
    const skip = await parseInt(req.params.skip);

    let profileUserFollowers = [];
    let profileUserFollowings = [];
    let loggedInUserFollowers = [];
    let loggedInUserFollowings = [];
    let followerPipeline = [];
    const followings = await Promise.all(loggedInUser.followings);
    const followers = await Promise.all(loggedInUser.followers);

    let followersList = [];

    const getProfileUserFollowers = async () => {
      await Promise.all(
        profileUser.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return profileUserFollowers.push({ _id: follower._id });
        })
      );
    };

    const getProfileUserFollowings = async () => {
      await Promise.all(
        profileUser.followings.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return profileUserFollowings.push({ _id: follower._id });
        })
      );
    };

    const getLoggedInUserFollowers = async () => {
      await Promise.all(
        loggedInUser.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return loggedInUserFollowers.push({ _id: follower._id });
        })
      );
    };

    const getLoggedInUserFollowings = async () => {
      await Promise.all(
        loggedInUser.followings.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return loggedInUserFollowings.push({ _id: follower._id });
        })
      );
    };

    const buildPipeline = async () => {
      let pipeline;
      if (profileUserFollowings.length > 0) {
        pipeline = [
          {
            $match: {
              $or: await profileUserFollowings,
            },
          },
          { $sort: { username: 1 } },
          { $skip: skip },
          { $limit: 10 },
        ];
        followerPipeline = await User.aggregate(pipeline);
      } else {
        followerPipeline = [];
      }
    };

    const buildFollowersList = async () => {
      followerPipeline.map((follower) => {
        const { _id, username, profilePicture, firstname, lastname } = follower;
        const followingStatus = followings.includes(follower._id.toString());
        const followerStatus = followers.includes(follower._id.toString());
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
    };

    getProfileUserFollowers()
      .then(() => getProfileUserFollowings())
      .then(() => getLoggedInUserFollowers())
      .then(() => getLoggedInUserFollowings())
      .then(() => buildPipeline())
      .then(() => buildFollowersList());
  } catch (err) {
    res.status(500).json(err);
  }
});

// explore users you don't follow
router.get("/explore/:id/:skip", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const skip = await parseInt(req.params.skip);
    // include the users id so they dont show up in the explore list
    let userFollowings = [user._id];
    let userFollowers = [];
    let exploreList = [];
    let exploreUsers = [];
    const followersCheck = await Promise.all(user.followers);

    const getFollowers = async () => {
      await Promise.all(
        user.followers.map(async (followerId) => {
          let follower = await User.findById(followerId);
          return userFollowers.push(follower._id);
        })
      );
    };

    const getFollowings = async () => {
      await Promise.all(
        user.followings.map(async (followingId) => {
          let following = await User.findById(followingId);
          return userFollowings.push(following._id);
        })
      );
    };

    const buildPipeline = async () => {
      const pipeline = [
        {
          $match: {
            _id: {
              $nin: userFollowings,
            },
          },
        },
        { $sort: { username: 1 } },
        { $skip: skip },
        { $limit: 10 },
      ];

      exploreUsers = await User.aggregate(pipeline);
    };

    const buildExploreList = async () => {
      exploreUsers.map((exploreUser) => {
        const { _id, username, profilePicture, firstname, lastname } =
          exploreUser;
        const followingStatus = false;
        const followerStatus = followersCheck.includes(
          exploreUser._id.toString()
        );
        exploreList.push({
          _id,
          username,
          profilePicture,
          firstname,
          lastname,
          followingStatus,
          followerStatus,
        });
      });
      res.status(200).json(exploreList);
    };

    getFollowers()
      .then(() => getFollowings())
      .then(() => buildPipeline())
      .then(() => buildExploreList());
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
