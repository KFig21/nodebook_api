// // img storage
// const multer = require("multer");
// const GridFsStorage = require("multer-gridfs-storage");
// const crypto = require("crypto");

// // img storage. will change late (firebase, aws...)
// const storage = new GridFsStorage({
//   url: mongoDB,
//   file: (req, file) => {
//     return new Promise((resolve, reject) => {
//       crypto.randomBytes(16, (err, buf) => {
//         if (err) {
//           return reject(err);
//         }
//         const filename = buf.toString("hex") + path.extname(file.originalname);
//         const fileInfo = {
//           filename: filename,
//           bucketName: "uploads",
//         };
//         resolve(fileInfo);
//       });
//     });
//   },
// });

// module.exports = multer({ storage });
