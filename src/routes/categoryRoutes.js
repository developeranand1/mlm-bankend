const express = require("express");
const {
  addCategory,
  getCategories,
  deleteCategory,
} = require("../controllers/categoryController"); // Import the addCategory controller
const router = express.Router();

// Route to add Category
router.post("/add-category", addCategory);
router.get("/", getCategories);
router.delete("/:id", deleteCategory);
module.exports = router;
