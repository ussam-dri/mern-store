const express = require('express');
const multer = require("multer");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords
const jwt = require('jsonwebtoken');
const PrivateKey = "zdzedzeo_u_oiJ89Y9Y98 UIHGY]]]0@@%!";
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket } = require('mongodb');
require("dotenv").config();
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000', // The front-end origin
}));

// Middleware to parse JSON bodies
app.use(express.json());

const url = process.env.MONGODB_URL || "mongodb+srv://emulator4acc:yHEU95Fqqff9UGyE@cluster0.dmpnefu.mongodb.net/mydatabase";
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

let gfsBucket;
mongoose.connection.on('connected', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'photos'
  });
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

const storage = new GridFsStorage({
  url,
  file: (req, file) => {
    const isImage = file.mimetype === "image/jpeg" || file.mimetype === "image/png";
    return {
      bucketName: isImage ? "photos" : "default",
      filename: `${Date.now()}_${file.originalname}`,
    };
  },
});
const upload = multer({ storage });

// Define the schema
const Schema = mongoose.Schema;
const productSchema = new Schema({
  tag: String,
  title: String,
  price: Number,
  description: String,
  rating: Number,
  mainImage: {
    id: String,
    filename: String,
    contentType: String
  },
  images: [{ // Use an array to store multiple images
    id: String,
    filename: String,
    contentType: String
  }]
});

const Product = mongoose.model('Product', productSchema);

app.post("/addProduct", upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'productImages', maxCount: 5 }]), async (req, res) => {
  const { tag, title, price, description, rating } = req.body;
  const mainImage = req.files.mainImage ? req.files.mainImage[0] : null;
  const productImages = req.files.productImages || [];

  if (!mainImage) {
    return res.status(400).send({ message: "Main image is required" });
  }

  const mainImageData = {
    id: mainImage.id,
    filename: mainImage.filename,
    contentType: mainImage.mimetype
  };

  const images = productImages.map(file => ({
    id: file.id,
    filename: file.filename,
    contentType: file.mimetype
  }));

  const product = new Product({
    tag,
    title,
    price,
    description,
    rating,
    mainImage: mainImageData,
    images: images // Assign array of images
  });

  try {
    await product.save();
    res.send({
      message: "Product uploaded successfully",
      product: {
        id: product._id,
        tag: product.tag,
        title: product.title,
        price: product.price,
        description: product.description,
        rating: product.rating,
        mainImage: product.mainImage,
        images: product.images
      }
    });
  } catch (error) {
    res.status(500).send({ message: "Error uploading product", error });
  }
});

// Get a product by ID
app.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    res.send(product);
  } catch (error) {
    res.status(500).send({ message: "Error retrieving product", error });
  }
});

// Get all products
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.send(products);
  } catch (error) {
    res.status(500).send({ message: "Error retrieving products", error });
  }
});

// Serve files from GridFS
app.get("/download/:filename", (req, res) => {
  try {
    const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);

    res.set('Content-Type', 'image/jpeg');
    downloadStream.pipe(res);

    downloadStream.on('error', function() {
      res.status(404).send({ error: "Image not found" });
    });
  } catch (error) {
    res.status(500).send({
      message: "Something went wrong",
      error,
    });
  }
});

const server = app.listen(process.env.PORT || 8005, function () {
  const port = server.address().port;
  console.log("App started at port:", port);
});

const userSchema = new Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  terms: { type: Boolean, required: true },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  cartItems: [{ type: Schema.Types.ObjectId, ref: 'Product' }]
});

// Create a model from the schema
const User = mongoose.model('User', userSchema);

// Define the registration route
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, terms } = req.body;

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new document with the request body data
    const newUser = new User({ email, password: hashedPassword, terms });

    // Save the new user to the database
    await newUser.save();

    res.status(201).json({ message: 'Registration successful!' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Define the login route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    var token = jwt.sign({ email: user.email, password: user.password }, PrivateKey, { expiresIn: '3h' });
    res.status(200).json({ message: 'Login successful!', tokens: token, email: user.email ,id:user.id});
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Get favorite products of a user
app.get('/api/user/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const user =    await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await user.populate('favorites');
    res.status(200).json(user.favorites);
  } catch (error) {
    console.error('Error retrieving user favorites:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Define the getUserById route
app.post('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate('favorites').populate('cartItems');
    res.status(200).json(user);
  } catch (error) {
    console.error('Error retrieving user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add a product to favorites
app.post('/api/user/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.favorites.includes(productId)) {
      user.favorites.push(productId);
      await user.save();
    }

    res.status(200).json({ message: 'Product added to favorites' });
  } catch (error) {
    console.error('Error adding product to favorites:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add a product to cart
app.post('/api/user/:id/cart', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.cartItems.includes(productId)) {
      user.cartItems.push(productId);
      await user.save();
    }

    res.status(200).json({ message: 'Product added to cart' });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get cart items for a user
app.get('/api/user/:id/cart', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate('cartItems');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ cartItems: user.cartItems });
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get products by brand
app.get('/api/products/getByBrand/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await Product.find({ tag: id });

    res.status(200).json({ products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Delete a product from cart
app.delete('/api/user/:id/cart/:productId', async (req, res) => {
  try {
    const { id, productId } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const productIndex = user.cartItems.indexOf(productId);
    if (productIndex > -1) {
      user.cartItems.splice(productIndex, 1);
      await user.save();
    }

    res.status(200).json({ message: 'Product removed from cart', cartItems: user.cartItems });
  } catch (error) {
    console.error('Error removing product from cart:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/', async (req, res) => {
  res.status(202).json({ message: 'THIS IS BACKEND beep!' });

})