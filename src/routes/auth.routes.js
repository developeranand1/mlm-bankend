const express = require('express');
const router = express.Router();
const { registerUser, loginUser,adminLogin } = require('../controllers/auth.controller');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/admin-login",adminLogin)

module.exports = router;
