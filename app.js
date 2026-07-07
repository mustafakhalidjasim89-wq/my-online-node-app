const express = require('express');
const app = express();

// Use the port assigned by the cloud platform, or default to 3000
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Main homepage route
app.get('/', (req, res) => {
    res.send('<h1>Success! My Node.js app is officially live and online!</h1>');
});

// A sample API endpoint
app.get('/api', (req, res) => {
    res.json({ message: "Hello from the cloud!", status: "active" });
});

app.listen(PORT, () => {
    console.log(`Application running on port ${PORT}`);
});