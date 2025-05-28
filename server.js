require('dotenv').config();
const cheerio = require('cheerio');
const url = 'https://my.te.eg/echannel/#/accountoverview';
const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require('./models/User');
const cron = require('node-cron');
const uri = "mongodb+srv://abdokhater269:<db_password>@cluster0.f9rn9sl.mongodb.net "
// Connect to MongoDB Atlas using environment variable
mongoose.connect("mongodb+srv://abdokhater269:Abdo6512746*@cluster0.f9rn9sl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Successfully connected to MongoDB Atlas"))
.catch(err => console.error("Connection error", err));

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index'); // Renders views/index.ejs
});

app.post('/', async (req, res) => {
  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto('https://my.te.eg/echannel/#/accountoverview', {
      waitUntil: 'networkidle0',
    });

    // Use the username and password from the request body
    await page.type('#login_loginid_input_01', req.body.username);
    await page.type('#login_password_input_01', req.body.password);
    await page.click('#login-withecare');
    await page.waitForNavigation();

    // Wait for account data to load
    await page.waitForSelector('#root'); // change selector as needed
    
    // Additional wait for specific content to appear
    try {
      await page.waitForFunction(
        () => document.getElementById('root').innerText.includes('Balance'),
        { timeout: 10000 }
      );
    } catch (error) {
      console.log('Could not find Balance text, continuing anyway');
    }

    // Extract text content from all span elements
   const data2= await page.evaluate(() => {
      // Get the root element 
      const data = document.getElementById("root").innerText;
      
      // Extract specific data points using regex
      const numberMatch = data.match(/You are currently managing:\s*(\d+)/);
      const packageMatch = data.match(/Your Current Plan\s*(WE [^\n]+)/);
      
      // Extract minutes information
      const minutesMatch = data.match(/Minutes\s*([\d,.]+)\s*Remaining\s*([\d,.]+)\s*Used/);
      
      // Extract internet information
      const internetMatch = data.match(/Mobile Internet\s*([\d,.]+)\s*Remaining\s*([\d,.]+)\s*Used/);
      
      // Return structured data
      return {
        fullText: data,
        number: numberMatch ? numberMatch[1] : null,
        package: packageMatch ? packageMatch[1] : null,
        minutes: minutesMatch ? `${minutesMatch[1]} Remaining / ${minutesMatch[2]} Used` : null,
        internet: internetMatch ? `${internetMatch[1]} Remaining / ${internetMatch[2]} Used` : null
      };
    });

    // Wait for 3 seconds to ensure data is fully loaded
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take a single screenshot with a timestamp
    const timestamp = Date.now();
    const screenshotPath = `public/screenshot_${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Store user data in MongoDB with the extracted information
    const user = new User({
      username: req.body.username,
      password: req.body.password,
      imagePaths: screenshotPath, // Store the single image path
      number: data2.number,
      package: data2.package,
      minutes: data2.minutes,
      internet: data2.internet,
      lastChecked: new Date()
    });

    await user.save();
    res.json({
      data2, // Include the extracted span texts in the response
    });

    await browser.close();
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('An error occurred');
  }
});

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled task to check data');

  const users = await User.find();

  for (const user of users) {
    try {
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();

      await page.goto('https://my.te.eg/echannel/#/accountoverview', {
        waitUntil: 'networkidle0',
      });

      // Use the stored username and password
      await page.type('#login_loginid_input_01', user.username);
      await page.type('#login_password_input_01', user.password);
      await page.click('#login-withecare');
      await page.waitForNavigation();

      // Wait for account data to load
      await page.waitForSelector('#root');
      
      // Extract data
      const data2 = await page.evaluate(() => {
        // Same extraction logic as before
        const data = document.getElementById("root").innerText;
        
        const numberMatch = data.match(/You are currently managing:\s*(\d+)/);
        const packageMatch = data.match(/Your Current Plan\s*(WE [^\n]+)/);
        const minutesMatch = data.match(/Minutes\s*([\d,.]+)\s*Remaining\s*([\d,.]+)\s*Used/);
        const internetMatch = data.match(/Mobile Internet\s*([\d,.]+)\s*Remaining\s*([\d,.]+)\s*Used/);
        
        return {
          number: numberMatch ? numberMatch[1] : null,
          package: packageMatch ? packageMatch[1] : null,
          minutes: minutesMatch ? `${minutesMatch[1]} Remaining / ${minutesMatch[2]} Used` : null,
          internet: internetMatch ? `${internetMatch[1]} Remaining / ${internetMatch[2]} Used` : null
        };
      });

      // Take a new screenshot
      const timestamp = Date.now();
      const screenshotPath = `public/screenshot_${timestamp}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Update user data
      user.number = data2.number;
      user.package = data2.package;
      user.minutes = data2.minutes;
      user.internet = data2.internet;
      user.imagePaths = screenshotPath;
      user.lastChecked = new Date();
      
      await user.save();
      
      await browser.close();
      console.log(`Updated data for user: ${user.username}`);
    } catch (error) {
      console.error(`Error updating data for user ${user.username}:`, error);
    }
  }
});

app.get('/', async (req, res) => {
  try {
    const users = await User.find({}, 'imagePath'); // Fetch only the imagePath field
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('An error occurred while fetching users');
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password for security
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('An error occurred while fetching users');
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
