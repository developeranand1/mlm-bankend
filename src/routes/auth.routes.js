const express = require('express');
const router = express.Router();
const { registerUser, loginUser,adminLogin,registerAdmin } = require('../controllers/auth.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/admin-login",adminLogin)
router.post("/register-admin",registerAdmin)

module.exports = router;
