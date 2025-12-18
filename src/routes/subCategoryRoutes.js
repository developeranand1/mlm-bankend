const express = require('express');
const { addSubCategory ,getSubCategories,deleteSubCategory} = require('../controllers/subCategoryController');  // Import the addSubCategory controller
const router = express.Router();

// Route to add Subcategory
router.post('/add-subcategory', addSubCategory);
router.get('/', getSubCategories);
router.delete('/:id', deleteSubCategory);

module.exports = router;
