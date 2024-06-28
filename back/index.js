const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For hashing passwords

// Initialize Express
const app = express();

// Allow specific origins
app.use(
  cors({
    origin: 'http://localhost:3001', // The front-end origin
  })
);

// Middleware for parsing JSON bodies
app.use(bodyParser.json()); // or app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb+srv://emulator4acc:yHEU95Fqqff9UGyE@cluster0.dmpnefu.mongodb.net/mydatabase', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the schema
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: { type: String, required: true }, // Ensure required fields
  password: { type: String, required: true },
  terms: { type: Boolean, required: true }, // Specify data type for terms
});

// Create a model from the schema
const User = mongoose.model('User', userSchema); // Name the model appropriately

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
    // res.status(201).json({user});
     res.status(200).json({ message: 'Login successful!' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Define the getUserById route
app.post('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    res.status(200).json(user);

    // const userId = req.params.id;
    // const { email, password, terms } = req.body;
    // // Hash the password before updating
    // const hashedPassword = await bcrypt.hash(password, 10);
    // // Find the user by ID and update the fields
    // const updatedUser = await User.findByIdAndUpdate(
    //   userId,
    //   { email, password: hashedPassword, terms },
    //   { new: true }
    // );
    // if (!updatedUser) {
    //   return res.status(404).json({ message: 'User not found' });
    // }
    // res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Start the Express server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

app.get('/', (req, res) => {
  res.send('Hi from the backend!');
});
