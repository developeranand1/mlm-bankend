const Product = require("../models/Product"); // Import the Product model
const Category = require("../models/Category"); // Import Category model
const SubCategory = require("../models/SubCategory"); // Import SubCategory model
const slugify = require("slugify"); // Import slugify to generate the slug
const cloudinary = require("../config/cloudinary"); // Import Cloudinary configuration
const upload = require("../middlewares/upload.middleware"); // Import Multer upload
const sharp = require("sharp");

// Controller to add a new Product
exports.addProduct = async (req, res) => {
  try {
    // Handle the image upload with Multer
    upload.single("image")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message }); // Handle Multer errors
      }

      const {
        name,
        description,
        price,
        categoryId,
        subcategoryId,
        brand,
        size,
        quality,
        stock,
      } = req.body;

      // Ensure stock is a positive number
      if (stock < 0) {
        return res
          .status(400)
          .json({ error: "Stock must be a positive number" });
      }

      // Check if the category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }

      // Check if the subcategory exists
      const subcategory = await SubCategory.findById(subcategoryId);
      if (!subcategory) {
        return res.status(400).json({ error: "Subcategory not found" });
      }

      // Generate slug using name and description
      const slug = slugify(name + " " + description, {
        lower: true,
        replacement: "-",
        remove: /[*+~.()'"!:@]/g,
      });

      // Check if file exists
      if (req.file) {
        // Compress the image using Sharp before uploading to Cloudinary
        const compressedImage = await sharp(req.file.path)
          .resize(800) // Resize the image to 800px width (maintain aspect ratio)
          .jpeg({ quality: 80 }) // Compress the image to 80% quality (you can adjust this value)
          .toBuffer(); // Convert it into a buffer

        // Upload the compressed image to Cloudinary
        const result = await cloudinary.uploader.upload_stream(
          {
            folder: "products/", // Save images in the 'products' folder in Cloudinary
            resource_type: "image",
          },
          async (error, result) => {
            if (error) {
              return res
                .status(500)
                .json({ error: "Failed to upload image to Cloudinary" });
            }

            // Create a new product with the uploaded image URL from Cloudinary
            const newProduct = new Product({
              name,
              description,
              slug,
              price,
              category: categoryId,
              subcategory: subcategoryId,
              brand,
              size,
              quality,
              stock,
              image: result.secure_url, // Cloudinary image URL
            });

            // Save the new product to the database
            await newProduct.save();

            // Send a success response with the created product
            res.status(201).json({
              message: "Product added successfully!",
              product: newProduct,
            });
          }
        );

        // Pipe the compressed image buffer to Cloudinary upload stream
        result.end(compressedImage);
      } else {
        return res.status(400).json({ error: "Image upload failed" });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add product" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category')  // Populating category (optional)
      .populate('subcategory'); 
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

exports.getProductBySlug = async (req, res) => {
  try {
    // Find the product by its slug
    const product = await Product.findOne({ slug: req.params.slug })
      .populate("category")  // Populating category field
      .populate("subcategory");  // Populating subcategory field

    // If product is not found
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Send the product as a response
    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};
// Controller to update a product by ID
exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedProduct)
      return res.status(404).json({ error: "Product not found" });
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
};

// Controller to delete a product by ID
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
};

// Controller to check product stock
exports.checkProductStock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({
      inStock: product.stock > 0,
      stock: product.stock,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to check stock" });
  }
};

// Controller to search for products
exports.searchProducts = async (req, res) => {
  try {
    const query = req.query.query || "";
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
      ],
    });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to search products" });
  }
};

// Controller to get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.categoryId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
};

// Controller to get products by subcategory
exports.getProductsBySubcategory = async (req, res) => {
  try {
    const products = await Product.find({
      subcategory: req.params.subcategoryId,
    });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products by subcategory" });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category") // Populating the category field
      .populate("subcategory");
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};



