const mongoose = require('mongoose');
const slugify = require('slugify');

// Define the Product Schema
const productSchema = new mongoose.Schema({
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
  price: {
    type: Number,
    required: true,
  },
  offerAmount: {
    type: Number,
    required: false,
    default: 0,  // The amount of discount or offer
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: true,
  },
  brand: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: true,  // You can use "S", "M", "L", etc.
  },
  quality: {
    type: String,
    required: true,  // "High", "Medium", "Low"
  },
  stock: {
    type: Number,
    required: true,
    default: 0,  // Default stock value is 0 if not provided
  },
  image: {
    type: String,  // URL or path to the uploaded image
    required: false,
  }
}, { timestamps: true });


productSchema.methods.isInStock = function() {
  return this.stock > 0;
};

// Create the Product model
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
