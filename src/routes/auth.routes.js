const express = require('express');
const router = express.Router();
const { registerUser, deleteUserById, loginUser,adminLogin,registerAdmin ,forgotPassword,resetPassword} = require('../controllers/auth.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/admin-login",adminLogin)
router.post("/register-admin",registerAdmin)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.delete("/:userId", deleteUserById);

module.exports = router;
