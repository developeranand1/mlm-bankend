const Category = require('../models/Category');  // Import the Category model
const slugify = require('slugify');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find(); // Fetch all categories from the database
    res.status(200).json({
      message: 'Categories fetched successfully!',
      categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Generate the slug from the 'name' field
    const slug = slugify(name, {
      lower: true,  // Convert to lowercase
      replacement: '-',  // Replace spaces with hyphens
      remove: /[*+~.()'"!:@]/g,  // Remove unwanted characters
    });

    // Create a new Category document with the generated slug
    const newCategory = new Category({
      name,
      description,
      slug  // Include the slug in the new category
    });

    // Save the new Category to the database
    await newCategory.save();

    // Send a success response with the newly created category
    res.status(201).json({
      message: 'Category added successfully!',
      category: newCategory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add category' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;  // Extract category ID from the request parameters

    // Find and delete the category by its ID
    const deletedCategory = await Category.findByIdAndDelete(id);

    // Check if the category exists
    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Return success response
    res.status(200).json({
      message: 'Category deleted successfully!',
      category: deletedCategory
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};