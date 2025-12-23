const express = require('express');
const { addSubCategory ,getSubCategories,deleteSubCategory,getSubCategoriesByCategory} = require('../controllers/subCategoryController');  // Import the addSubCategory controller
const router = express.Router();

// Route to add Subcategory
router.post('/add-subcategory', addSubCategory);
router.get('/', getSubCategories);
router.delete('/:id', deleteSubCategory);
router.get("/by-category/:categoryId", getSubCategoriesByCategory);

module.exports = router;
