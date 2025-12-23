const SubCategory = require('../models/SubCategory');  // Import the SubCategory model
const Category = require('../models/Category');  // Import the Category model
const slugify = require('slugify'); 
const mongoose = require("mongoose");


exports.getSubCategories = async (req, res) => {
  try {
    const subcategories = await SubCategory.find().populate('category', 'name description slug'); // Populate the category details for each subcategory

    res.status(200).json({
      message: 'Subcategories fetched successfully!',
      subcategories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
};


exports.addSubCategory = async (req, res) => {
  try {
    const { name, description, categoryId } = req.body;

    // Find the category by its ID
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    // Generate the slug based on the name
    const slug = slugify(name, {
      lower: true,  // Convert to lowercase
      replacement: '-',  // Replace spaces with hyphens
      remove: /[*+~.()'"!:@]/g,  // Remove unwanted characters
    });

    // Create a new Subcategory document
    const newSubCategory = new SubCategory({
      name,
      description,
      category: categoryId,
      slug  // Include the generated slug
    });

    // Save the Subcategory to MongoDB
    await newSubCategory.save();

    // Return success response with the created Subcategory
    res.status(201).json({
      message: 'Subcategory added successfully!',
      subCategory: newSubCategory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add subcategory' });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;  // Extract subcategory ID from the request parameters

    // Find and delete the subcategory by its ID
    const deletedSubCategory = await SubCategory.findByIdAndDelete(id);

    // Check if the subcategory exists
    if (!deletedSubCategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    // Return success response
    res.status(200).json({
      message: 'Subcategory deleted successfully!',
      subCategory: deletedSubCategory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
};

exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({ message: "categoryId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // debug (temporary)
    // console.log("Fetching subcategories for categoryId:", categoryId);

    const subCategories = await SubCategory.find({
      category: new mongoose.Types.ObjectId(categoryId),
    })
      .populate("category", "name")
      .lean();

    return res.status(200).json({
      message: "Subcategories fetched successfully",
      count: subCategories.length,
      subcategories: subCategories,
    });
  } catch (error) {
    console.error("Get Subcategories Error:", error);
    return res.status(500).json({
      message: "Failed to fetch subcategories",
      error: error.message,
    });
  }
};