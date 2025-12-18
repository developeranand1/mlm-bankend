const mongoose = require("mongoose");
const slugify = require("slugify");

const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  slug: {
    type: String,
    unique: true,
    required: false,
    lowercase: true,
  },
});


const SubCategory = mongoose.model("SubCategory", subCategorySchema);
module.exports = SubCategory;
