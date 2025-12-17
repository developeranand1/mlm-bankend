// server.js
require('dotenv').config();  // Load environment variables
const app = require('./src/app'); // Import the app from src/app.js

const PORT = process.env.PORT || 5000;  // Set the port for the server

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
