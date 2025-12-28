const express = require("express");
const {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  checkProductStock,
  searchProducts,
  getProductsByCategory,
  getProductsBySubcategory,
  getProductBySlug,
  buyProduct
} = require("../controllers/productController");

const router = express.Router();


router.post("/products/:productId/buy", buyProduct);

// Add a new product
router.post("/add-product", addProduct);

// Get all products
router.get("/", getAllProducts);

// Get a single product by ID
router.get("/:id", getProductById);

router.get("/product-by-slug/:slug", getProductBySlug);

// Update product by ID
router.put("/:id", updateProduct);

// Delete product by ID
router.delete("/:id", deleteProduct);

// Check stock of a specific product
router.get("/:id/stock", checkProductStock);

// Search for products
router.get("/search", searchProducts);

// Get products by category ID
router.get("/category/:categoryId", getProductsByCategory);

// Get products by subcategory ID
router.get("/subcategory/:subcategoryId", getProductsBySubcategory);

module.exports = router;
