const mongoose = require('mongoose');
const slugify = require('slugify');

// Define the Category Schema
const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    unique: true,
    required: false,
    lowercase: true,
  },
});



const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

module.exports = Category;
