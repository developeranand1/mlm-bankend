const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const morgan = require('morgan');
const connectDB = require('./config/db'); // MongoDB connection
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/categoryRoutes'); 
const subCategoryRoutes = require('./routes/subCategoryRoutes'); 
const productRoutes = require('./routes/productRoutes');



dotenv.config();  // Load environment variables

// Initialize Express
const app = express();
connectDB();  // Connect to MongoDB

app.use(cors());

// Middleware
app.use(cors());
app.use(express.json());  // Parse incoming JSON requests
app.use(morgan("tiny"));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes); 
app.use('/api/subcategories', subCategoryRoutes);
app.use('/api/products', productRoutes);

// Export the app to be used in server.js
module.exports = app;
