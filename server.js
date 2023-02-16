const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const { } = require('dotenv/config');

const app = express();
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
app.use(cors());

// Define options for the CORS middleware
const corsOptions = {
  origin: '*',
  methods: 'POST',
  allowedHeaders: 'Content-Type',
};

// Enable CORS middleware for all routes
app.use(cors(corsOptions));

app.set('view engine', 'ejs');

// Connect to MongoDB
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};
mongoose.set('strictQuery', false);
mongoose.connect(process.env.DATABASE_URL, options)
  .then(() => {
    console.log('Database connection established');
  })
  .catch((error) => console.log(error));

// Define a schema for storing the ngrok URL
const ngrokSchema = new mongoose.Schema({
  url: { type: String, required: true }
});

// Handle GET requests to the homepage
app.get('/', (req, res) => {
  res.render('index', { success: '', error: '' });
});

// Define a model for the ngrok URL schema
const Ngrok = mongoose.model('Ngrok', ngrokSchema);

// Create a new ngrok URL
app.post('/ngrok', (req, res) => {
  const url = req.body.url;
  Ngrok.findOneAndReplace({}, { url }, { upsert: true })
    .then(() => {
      res.render('save_ngrok', { success: 'Ngrok URL saved' });
    })
    .catch(err => {
      console.error(err);
      res.render('save_failed', { error: 'Error saving ngrok URL' });
    });
});

app.post('/callback', (req, res) => {
  // Get the ngrok URL from the database
  Ngrok.findOne()
    .then(ngrok => {
      if (!ngrok) {
        throw new Error('Cannot post to that url');
      }
      // Forward the POST request to the ngrok endpoint
      const url = ngrok.url;
      axios.post(url, req.body)
        .then(response => {
          console.log(`Response from ${url}: ${response.status} ${response.statusText}`);
          res.status(response.status).send(response.data);
        })
        .catch(error => {
          console.error(`Error forwarding request to ${url}: ${error.message}`);
          res.status(500).send('Error forwarding request');
        });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error getting ngrok URL');
    });
});


// Start the server
const port = process.env.Port || 9000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});