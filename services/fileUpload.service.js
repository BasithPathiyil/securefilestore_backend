const AppError = require("../middlewares/AppError");
const User = require("../models/user.model");
const UserFile = require("../models/userFile.model");
const { upload } = require("../utils/multerFileUpload");

const fs = require("fs");

//funcion to generate 6 digit number
const generateUniqueCode = async () => {
  const min = 100000;
  const max = 999999;

  let code;

  do {
    code = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (await isCodeDup(code));

  return code;
};

const isCodeDup = async (code) => {
  const isDuplicate = await UserFile.findOne({ secretKey: code }).exec();
  return !!isDuplicate;
};

const removeFromDirectory = async (filePath) => {
  return await fs.unlinkSync(filePath);
};

const fileUpload = (req, res) => {
  return new Promise((resolve, reject) => {
    const singleUpload = upload.single("file");

    singleUpload(req, res, async function (err) {
      // function for incase if any error occurs
      const deleteFile = (error) => {
        if (req.file) {
          // Delete the uploaded file
          fs.unlinkSync(req.file.path);
        }
        reject(error);
      };

      if (err) {
        deleteFile(new AppError(400, err.message));
      } else {
        try {
          let data = {
            userId: req.user._id,
            secretKey: await generateUniqueCode(),
            fileName: req.body.filename
              ? req.body.filename + "." + req.file.filename.split(".")[1]
              : req.file.filename,
            fileUrl: `public/uploads/${req.file.filename}`,
            filePath: req.file.path,
          };
          const createdData = await UserFile.create(data);
          resolve(createdData);
        } catch (error) {
          deleteFile(error);
        }
      }
    });
  });
};

const removeFileDoc = async (objectId) => {
  const deletedDoc = await UserFile.findByIdAndDelete(objectId);
  await removeFromDirectory(deletedDoc.filePath);
  return deletedDoc;
};

const getAllFilesByUserId = async (userId, options) => {
  const { page, rowsPerPage } = options;
  const allFiles = await UserFile.find({ userId })
    .skip(page ? (page - 1) * rowsPerPage : 0)
    .limit(rowsPerPage ? rowsPerPage : 100);
  return allFiles;
};

const getFile = async (fileId, secretKey) => {
  const fileDoc = await UserFile.findById(fileId).select("+secretKey");
  if (!fileDoc) {
    throw new AppError(400, "File not found in database");
  }
  if (secretKey !== fileDoc.secretKey) {
    throw new AppError(400, "Incorrect secret code");
  }
  let filePath = fileDoc.filePath;
  if (!fs.existsSync(filePath)) {
    throw new AppError(400, "File not found in storage");
  }

  return { filePath, fileName: fileDoc.fileName };
};
module.exports = {
  fileUpload,
  removeFileDoc,
  getAllFilesByUserId,
  getFile,
};
