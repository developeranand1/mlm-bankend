const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const connectDB = require('./config/db'); // MongoDB connection
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');



dotenv.config();  // Load environment variables

// Initialize Express
const app = express();
connectDB();  // Connect to MongoDB

app.use(cors());

// Middleware
app.use(cors());
app.use(express.json());  // Parse incoming JSON requests

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Export the app to be used in server.js
module.exports = app;
