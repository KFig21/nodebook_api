const router = require("express").Router();
const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { body, validationResult } = require("express-validator");

// Register
router.post(
  "/register",
  // Validate and sanitise fields.
  body("email").isLength(1).withMessage("Minimum length 1 characters").escape(),
  body("username")
    .isLength(1)
    .withMessage("Minimum length 1 characters")
    .escape(),
  body("firstname")
    .isLength(1)
    .withMessage("Minimum length 1 characters")
    .escape(),
  body("lastname")
    .isLength(1)
    .withMessage("Minimum length 1 characters")
    .escape(),
  body("password").isLength(6).withMessage("Minimum length 6 characters"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      return next("Password confirmation does not match password");
    }
    // Indicates the success of this synchronous custom validator
    return true;
  }),
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    if (errors.isEmpty()) {
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
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(req.body.password, salt);
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
    } else {
      res.status(500);
    }
  }
);

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
    const validPassword = await bcryptjs.compare(
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
