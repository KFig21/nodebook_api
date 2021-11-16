const User = require("../models/User");

const passport = require("passport"),
  FacebookStrategy = require("passport-facebook").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/auth/facebook/callback",
      proxy: true,
      profileFields: ["id", "displayName", "email", "picture.type(large)"],
    },
    async function (accessToken, refreshToken, profile, done) {
      const { name, picture } = profile._json;
      const userData = {
        username: name,
        picture_url: picture.data.url,
        facebookId: profile.id,
      };
      try {
        let user = await User.findOne({ facebookId: profile.id });
        console.log(user);
        if (!user) {
          user = await User.create(userData);
        }
        done(null, user);
      } catch (err) {
        done(err, user);
      }
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      proxy: true,
    },
    async function (accessToken, refreshToken, profile, done) {
      const { displayName, photos } = profile;
      const userData = {
        username: displayName,
        picture_url: photos[0].value,
        googleId: profile.id,
      };
      try {
        let user = await User.findOne({ googleId: profile.id });
        console.log(user);
        if (!user) {
          user = await User.create(userData);
        }
        done(null, user);
      } catch (err) {
        done(err, user);
      }
    }
  )
);

passport.serializeUser(function (user, cb) {
  cb(null, user._id);
});

passport.deserializeUser(async function (id, cb) {
  User.findById(id, (err, user) => {
    if (err) {
      cb(null, false, { error: err });
    } else {
      cb(null, user);
    }
  });
});

module.exports = passport;
