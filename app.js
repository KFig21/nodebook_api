require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const createError = require("http-errors");
const cors = require("cors");
// img storage
// const methodOverride = require("method-override");

// import routes
const userRouter = require("./routes/users");
const authRouter = require("./routes/auth");
const postRouter = require("./routes/posts");
const commentRouter = require("./routes/comments");

//Set up mongoose connection
const mongoDB = process.env.DB_CONNECTION_STRING;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

//middleware
app.use(express.json());
app.use(helmet());
app.use(morgan("common"));
// app.use(methodOverride("_method"));
// app.use(express.static(path.join(__dirname, "public"))); // may not need, idk

// cors middleware
const corsOptions = {
  origin: "*",
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions)); // Use this after the variable declaration

// user routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/posts", postRouter);
app.use("/api/comments", commentRouter);

// view engine setup - ignore
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// socket.io for notifications
// const Notification = require("./models/notification");
// const http = require("http");
// const server = http.createServer(app);
// const PORT = 8080;
// server.listen(PORT, () => {
//   console.log(`server listening on port ${PORT}`);
// });
// const socketIo = require("socket.io");
// const io = socketIo(server, {
//   cors: {
//     origin: "*",
//   },
// });

// const users = {};
// io.on("connection", (socket) => {
//   console.log("User connected");

//   socket.on("username", (username) => {
//     users[username] = socket.id;
//   });

//   socket.on("notification", async (notification) => {
//     if (notification.sender === notification.recipient) return;

//     console.log("test");

//     const newNotification = await Notification.findOneAndUpdate(
//       notification,
//       { $setOnInsert: notification },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     ).populate("sender", [
//       "firstName",
//       "lastname",
//       "username",
//       "profilePicture",
//     ]);

//     console.log("newNotification", newNotification);

//     const recipientID = notification.recipient;
//     const userSocket = users[recipientID];

//     userSocket &&
//       socket.broadcast
//         .to(userSocket)
//         .emit("recieveNotification", newNotification);
//   });

//   socket.on("message", (message, recipientID) => {
//     const userSocket = users[recipientID];

//     userSocket &&
//       socket.broadcast.to(userSocket).emit("recieveMessage", message);
//   });

//   socket.on("typing", (recipientID) => {
//     const userSocket = users[recipientID];

//     userSocket && socket.broadcast.to(userSocket).emit("typing");
//   });

//   io.on("disconnect", (socket) => {
//     for (const socketID in users) {
//       if (users[socketID] === socket.id) delete users[socketID];
//     }
//   });
// });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
