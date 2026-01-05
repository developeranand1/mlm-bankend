const express = require("express");
const router = express.Router();
const { updateKYC,getRootUsers  ,getUsers, getKycUsers ,getUserById,getUserTree, addUserToTree} = require("../controllers/user.controller"); // This should reference updateKYC, not uploadKYC
const authMiddleware = require("../middlewares/auth.middleware");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });


router.get("/root", getRootUsers);
router.get("/users/:userId/tree", getUserTree);

router.get('/users', getUsers);
router.get('/kycs', getKycUsers);
router.put('/updateKYC/:userId', upload.fields([
  { name: 'aadharImage', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
  { name: 'passbookImage', maxCount: 1 },
]), updateKYC);

router.get("/user/:userId", getUserById);

router.post("/:parentId/tree/add", addUserToTree);


module.exports = router;
