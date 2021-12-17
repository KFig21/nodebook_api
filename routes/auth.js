const router = require("express").Router();
const User = require("../models/user");
const bcrypt = require("bcrypt");

// Register
router.post("/register", async (req, res, next) => {
  try {
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
    // hash password for db
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    // create new user
    const newUser = await new User({
      email: req.body.email,
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      password: hashedPassword,
    });
    // save user and return response
    try {
      const user = await newUser.save();
      res.status(200).json(user);
    } catch (err) {
      res.status(500).json(err);
    }
  } catch (err) {
    return next(err);
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    // check if user used email or username to login
    const email = await User.findOne({ email: req.body.usermail }).collation({
      locale: "en",
      strength: 2,
    });
    const username = await User.findOne({
      username: req.body.usermail,
    }).collation({ locale: "en", strength: 2 });
    let user = "";
    // set the user variable to either the email or username found
    if (email) {
      user = email;
    }
    if (username) {
      user = username;
    }
    // send error if no valid user is found
    !user && res.status(404).json("user not found");
    // check password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    // send error if password is incorrect
    !validPassword && res.status(400).json("wrong password");
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
