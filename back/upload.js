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
const crypto = require('crypto');

const app = express();

app.use(cors({
  origin: '*', // The front-end origin
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
//////////////////////////// --------------- MAILING SYSTEM ---------------///
const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'mern-store.zelobrix.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'support@mern-store.zelobrix.com',
    pass: 'o,dQsk^iXNb!',
  },
  tls: {
    rejectUnauthorized: false
  }
});
// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error verifying transporter:', error);
  } else {
    console.log('Nodemailer is ready to send emails');
  }
});

const storage = new GridFsStorage({
  url,
  file: (req, file) => {
    const isImage = file.mimetype === "image/jpeg" || file.mimetype === "image/png"||file.mimetype === "image/webp"||file.mimetype === "image/avif" | file.mimetype === "image/jpg";
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
  sellerID: String,
  gender: String,
  rating: String,
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
  const { tag, title, price, description, rating,gender,sellerID } = req.body;
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
    sellerID,
    gender,
    mainImage: mainImageData,
    images: images // Assign array of images
  });

console.log(sellerID)
  const seller = await SellerAccount.findById(sellerID);
  seller.products.push(product)||seller.products ;
  const updatedSeller = await seller.save();


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
        gender:product.gender,
        seller:product.sellerID,
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

// --------------------------  images getting -----------------------//
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
// --------------------------- end of images handling ------------------------//
const server = app.listen(process.env.PORT || 8005, function () {
  const port = server.address().port;
  console.log("App started at port:", port);
});
// ------------------- user -------------------- //
const userSchema = new Schema({
  FullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  ShippingAdress: { type: String, required: false },
  dob: { type: Date, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  cartItems: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date }
});


// Create a model from the schema
const User = mongoose.model('User', userSchema);

// Define the registration route
app.post('/api/register', async (req, res) => {
  try {
    const { FullName, email, phoneNumber, dob, password } = req.body;
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new document with the request body data
    const newUser = new User({ 
      FullName,
      email,
      phoneNumber,
      dob,
      password: hashedPassword,
      role: 'client',
      ShippingAdress:'',
    });

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
    res.status(200).json({ message: 'Login successful!', tokens: token, email: user.email ,id:user.id,FullName:user.FullName,phoneNumber:user.phoneNumber,role:'client'});
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
// remove item form favorites 
app.delete('/api/user/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const index = user.favorites.indexOf(productId);
    if (index > -1) {
      user.favorites.splice(index, 1); // Remove the product from favorites
      await user.save();
    }

    res.status(200).json({ message: 'Product removed from favorites' });
  } catch (error) {
    console.error('Error removing product from favorites:', error);
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
//// get by gender
app.get('/api/products/getByGender/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await Product.find({ gender: id });

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


//THIS IS SELLER PARTS------------------------------------------------------------------
const sellerAccountSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  photo: {
    id: String,
    filename: String,
    contentType: String
  },
  role: {
    type: String,
    enum: ['seller'],
    default: 'seller'
  },
  products: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  employed: { type: Date, default: Date.now },
  password: {
    type: String,
    required: true
  }
});

const SellerAccount = mongoose.model('SellerAccount', sellerAccountSchema);
app.post('/create-seller', upload.single('photo'), async (req, res) => {
  try {
    const { name, dob, email, phoneNumber, password } = req.body;

    const photo = req.file ? {
      id: req.file.id,
      filename: req.file.filename,
      contentType: req.file.mimetype
    } : null;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newSeller = new SellerAccount({
      name,
      dob,
      email,
      phoneNumber,
      password:hashedPassword, // Include password in the object
      photo,
      employed: new Date()
    });

    const savedSeller = await newSeller.save();
    res.status(201).json(savedSeller);
  } catch (error) {
    console.error('Error creating seller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// ----------------------------------------------------------------------//
app.get('/get-all-sellers', async (req, res) => {
  try {
    const sellers = await SellerAccount.find();
    res.status(200).json(sellers);
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
//--------------------------------------//
app.get('/get-seller/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await SellerAccount.findById(id);
    
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    res.status(200).json(seller);
  } catch (error) {
    console.error('Error fetching seller by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// ------------------------      -----------------------------------------------//
app.put('/update-seller', upload.single('photo'), async (req, res) => {
  try {
    
    const { id,name, dob, email, phoneNumber,password } = req.body;
    const photo = req.file ? {
      id: req.file.id, // Adjust as needed
      filename: req.file.filename,
      contentType: req.file.mimetype
    } : null;

    // Find the existing seller
    const seller = await SellerAccount.findById(id);
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Update only the fields that are provided
    seller.name = name || seller.name;
    seller.dob = dob || seller.dob;
    seller.email = email || seller.email;
    seller.password =  seller.password;

    seller.phoneNumber = phoneNumber || seller.phoneNumber;
    if (photo) {
      seller.photo = photo;
    }

    const updatedSeller = await seller.save();

    res.status(200).json(updatedSeller);
  } catch (error) {
    console.error('Error updating seller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// -----------------   --------------------------------------//
app.delete('/delete-seller/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the seller
    const deletedSeller = await SellerAccount.findByIdAndDelete(id);

    if (!deletedSeller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    res.status(200).json({ message: 'Seller deleted successfully', deletedSeller });
  } catch (error) {
    console.error('Error deleting seller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// THIS IS MANAGER PART ------------------------------------------- ----------------------------------------//
const managerAccountSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  photo: {
    id: String,
    filename: String,
    contentType: String,// Assuming storing photo URL as a string
  },
  role: {
    type: String,
    enum: ['manager'],
    default: 'manager'
  },
  phoneNumber: {
    type: String, // Add phone number field
    required: true
  },
  employed: { type: Date, default: Date.now } ,
  password: {
    type: String,
    required: true
  }

});

const ManagerAccount = mongoose.model('ManagerAccount', managerAccountSchema);
// ------------------------   ---------------------------------//
app.post('/create-manager', upload.single('photo'),async (req, res) => {
  try {
    const { name, dob, email,phoneNumber,password } = req.body;
    const photo = req.file ? {
      id: req.file.id, // Adjust as needed
      filename: req.file.filename,
      contentType: req.file.mimetype
    } : null;
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Received data:', req.body); 
    const newManager = new ManagerAccount({
      name,
      dob,
      email,
      photo,
      phoneNumber,
      password:hashedPassword,
      employed: new Date()
    });

    const savedManager = await newManager.save();
    res.status(201).json(savedManager);
  } catch (error) {
    console.error('Error creating manager:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// -------------------------------   --------------------------------//
app.get('/get-all-managers', async (req, res) => {
  try {
    const managers = await ManagerAccount.find();
    res.status(200).json(managers);
  } catch (error) {
    console.error('Error fetching managers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// -------------------------------   --------------------------------//
app.get('/get-manager/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await ManagerAccount.findById(id);
    
    if (!manager) {
      return res.status(404).json({ message: 'manager not found' });
    }

    res.status(200).json(manager);
  } catch (error) {
    console.error('Error fetching manager by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// ------------------------------ ------------------------------------//
app.put('/update-manager', upload.single('photo'), async (req, res) => {
  try {
    const { id,name, dob, email, phoneNumber } = req.body;
    const photo = req.file ? {
      id: req.file.id, // Adjust as needed
      filename: req.file.filename,
      contentType: req.file.mimetype
    } : null;

    // Find the existing manager
    const manager = await ManagerAccount.findById(id);
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found' });
    }

    // Update only the fields that are provided
    manager.name = name || manager.name;
    manager.dob = dob || manager.dob;
    manager.email = email || manager.email;
    manager.phoneNumber = phoneNumber || manager.phoneNumber;
    if (photo) {
      manager.photo = photo;
    }

    const updatedManager = await manager.save();

    res.status(200).json(updatedManager);
  } catch (error) {
    console.error('Error updating manager:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// --------------- ----------------------------------------------//
app.delete('/delete-manager/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the manager
    const deletedManager = await ManagerAccount.findByIdAndDelete(id);

    if (!deletedManager) {
      return res.status(404).json({ message: 'Manager not found' });
    }

    res.status(200).json({ message: 'Manager deleted successfully', deletedManager });
  } catch (error) {
    console.error('Error deleting manager:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// ------------------------------------ -----------------------------------//
app.post('/portail/login', async (req, res) => {
  const { email, password } = req.body;

  try {
        // Check if the user with the given email exists
      let user = await SellerAccount.findOne({ email });
      if (!user) {
        user = await ManagerAccount.findOne({ email });
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
      }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Example JWT generation (you may want to use a library like jsonwebtoken)
    const token = generateToken(user); // Implement your own token generation logic
    ///// for security change this 
    const role= user.role;
    res.status(200).json({ token ,role,name:user.name,email:user.email,phoneNumber:user.phoneNumber,id:user._id}); // Send token back to the client
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Example token generation function (replace with your own logic)
function generateToken(user) {
  // Example: Using jsonwebtoken library to generate a token
  const token = jwt.sign({ userId: user._id }, PrivateKey, { expiresIn: '3h' },{role: user.role}); // Token expires in 3 hour

  return token;
}
// --------------------- PASSWORD RESET LOGIC ------------------------------//


app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate and save reset token with expiry
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with reset link
    const resetLink = `https://mern-store.zelobrix.com/reset-password/${resetToken}`;
    console.log("sent token",resetToken)
    // Send email using Nodemailer
    const mailOptions = {
      from: `"ShoppeLux" <support@mern-store.zelobrix.com>`,
      to: email,
      subject: 'Password Reset Link',
      text: `Click on this link to reset your password: ${resetLink}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending reset email:', error);
        return res.status(500).json({ message: 'Server error' });
      }
      console.log('Reset email sent:', info.response);
      res.json({ message: 'Password reset link sent to your email' });
    });
  } catch (err) {
    console.error('Error sending reset email:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route for handling password reset
app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  console.log("recived from fronend token:"+token)
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Update user's password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password =hashedPassword ;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// --------------    -----------------------//
app.post('/change-password',async(req,res)=>{
const {Newpassword,id}=req.body;
  
   const hashedPassword = await bcrypt.hash(Newpassword, 10);
    const user= await User.findById(id);
    user.password=hashedPassword;
    await user.save();
    res.status(200).json({message :"password changed successfully"})

})

// emailing newsLetter

app.post('/api/newsletter', (req, res) => {
  const { email } = req.body

  // Define email options
  const mailOptions = {
    from: 'support@mern-store.zelobrix.com',
    to: email,
    subject: 'Newsletter Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <div style="text-align: center;">
      <img src="cid:logo" alt="Website Logo" style="max-width: 150px; margin-bottom: 20px;">
    </div>
    <h1 style="font-size: 24px; color: #333; text-align: center;">Program Notification Subscription</h1>
    <p style="font-size: 16px; color: #555;">Hello,</p>
    <p style="font-size: 16px; color: #555;">Thank you for subscribing to receive notifications about our program launch. We appreciate your interest and look forward to sharing updates with you.</p>
    <p style="font-size: 16px; color: #555;">Stay tuned for announcements regarding our program launch date, features, and how you can participate.</p>
    <p style="font-size: 16px; color: #555;">If you have any questions or require further information, please feel free to reach out to us at any time.</p>
    <p style="font-size: 16px; color: #555;">Best Regards,</p>
    <p style="font-size: 16px; color: #555;">The ShoppeLux Team</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="http://mern-store.zelobrix.com/" style="font-size: 16px; color: #007BFF; text-decoration: none;">Visit Our Website</a>
    </div>
  </div>
</div>

    `,
    attachments: [{
      filename: 'logo-bg.png',
      path: './logo-bg.png',
      cid: 'logo' // same cid value as in the html img src
    }]
  }

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error)
      return res.status(500).send('Error sending email',error)
    }
    console.log('Email sent: ' + info.response)
    res.status(200).send('Confirmation email sent')
  })
})
