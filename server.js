const crypto = require('crypto');
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
  url: { type: String, required: true, minlength: 1 }
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
  if (!url) {
    return res.render('save_failed', { error: 'URL is required' });
  }
  Ngrok.findOneAndReplace({}, { url }, { upsert: true })
    .then(() => {
        console.log('Save')
      res.render('save_ngrok', { success: 'Ngrok URL saved' });
    })
    .catch(err => {
      console.error(err);
        console.log('not')
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

      // Verify the signature
      const { Authorization, 'x-mpesa-signature': signature } = req.headers;
      const signatureIsValid = verifySignature(Authorization, signature, process.env.SAFARICOM_CONSUMER_SECRET);
      if (!signatureIsValid) {
        throw new Error('Invalid signature');
      }

      // Forward the POST request to the ngrok endpoint
      const url = ngrok.url;
        console.log(url)
      axios.post(url, req.body)
        .then(response => {
          console.log(`Response from ${url}: ${response.status} ${response.statusText}`);
          res.status(response.status).send(response.data);
        })
        .catch(error => {
          console.error(`Error forwarding request to ${url}: ${error.message}`);
          res.status(500).send('Error forwarding request to kufu');
        });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error');
    });
});

function verifySignature(authorization, signature, consumerSecret) {
  const hash = crypto
    .createHmac('sha1', consumerSecret)
    .update(authorization)
    .digest('base64');

  return hash === signature;
}

// Start the server
const port = process.env.PORT || 9000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
