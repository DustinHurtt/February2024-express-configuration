# Initial configurations for server and client setup
## Check globally installed packages from CLI:
You should have globally installed:
- nodemon
- express-generator
```
npm list -g
```
## Start an express generator* app for the backend from CLI:
```
express --no-view --git <project-name>
npm i bcryptjs cors dotenv jsonwebtoken mongoose
```
*Remember: Express generator requires global instalation.
### Configuration for the server within the express app
#### DOTENV file configuration steps
1. Create dotenv file. Remember: semicolons will break the code here.
1. Declare ```PORT = 4000``` in .env file
1. Declare ```REACT_APP_URI = 'http://localhost:5173'``` in .env file
1. Declare ```MONGODB_URI = 'mongodb+srv://luisitongo:<password>@cluster0.kp8pt2w.mongodb.net/express-configuration?retryWrites=true&w=majority&appName=Cluster0'``` in .env file
1. Declare ```SECRET = SECRETWORD``` in .env file
#### package.json file configuration steps
1. Add ```"dev": "nodemon ./bin/www" ``` in package.jason file, under scripts.
1. The installed packages will appear automatically under dependencies.
#### BIN file configuration steps
1. Add ```require('dotenv').config()``` in www.js file under bin folder.
1. Delete ```|| '3000'``` in www.js file line 15 under bin folder
1. Add the following code instead of the 28th line server.listen(port); in www.js file under bin folder:
```
server.listen(port, (err) => {
  if (err) console.log("Error in server setup", err)
  console.log("Server listening on Port", port);
});
```
#### APP.JS file configuration steps
1. Declare the following requirements in app.js
```
var cors = require('cors')
var mongoose = require('mongoose')
```
2. Comment out or delete the following in app.js
```
//var indexRouter = require('./routes/index');
//app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));
// app.use(
//     cors()
//   );
//app.use('/', indexRouter);
```
3. Add the following code block:
```
app.set('trust proxy', 1); //VITAL FOR DEPLOYMENT
app.enable('trust proxy'); //VITAL FOR DEPLOYMENT
// The code below allows cross origin resource sharing from sever to react app.
app.use(
    cors({
      origin: [process.env.REACT_APP_URI]  // <== URL of our future React app
    })
  );
```
4. Add the mongoose connection configuration:
```
mongoose
.connect(process.env.MONGODB_URI)
  .then((x) => console.log(`Connected to Mongo! Database name: "${x.connections[0].name}"`))
  .catch((err) => console.error("Error connecting to mongo", err));
```
5. Require the routes for Users ``` var authRouter = require('./routes/auth') ```.
6. Instruct Express-Generator app to allow route ```app.use('/auth', authRouter)```.
#### User model setup
1. Create models folder.
2. Create Users.js file in the model
3. Add the following code:
```
const { model, Schema } = require("mongoose");
const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = model("User", userSchema);
```
#### Authentification routes setup
1. Create auth.js file under Routes folder.
2. Add the following code in that file:
```
var express = require("express");
var router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose')
const saltRounds = 10;
const User = require("../models/User");
const isAuthenticated = require('../middleware/isAuthenticated')
router.post("/signup", (req, res, next) => {
  const { email, password, name } = req.body;
  // Check if the email or password or name is provided as an empty string
  if (!email || !password || !name) {
    res.status(400).json({ message: "Provide email, password and name" });
    return;
  }
  // Use regex to validate the email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: "Provide a valid email address." });
    return;
  }
  // Use regex to validate the password format
  // const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
  // if (!passwordRegex.test(password)) {
  //   res.status(400).json({ message: 'Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.' });
  //   return;
  // }
  // Check the users collection if a user with the same email already exists
  User.findOne({ email })
    .then((foundUser) => {
      // If the user with the same email already exists, send an error response
      if (foundUser) {
        res.status(400).json({ message: "User already exists." });
        return;
      }
      // If the email is unique, proceed to hash the password
      const salt = bcrypt.genSaltSync(saltRounds);
      const hashedPassword = bcrypt.hashSync(password, salt);
      // Create a new user in the database
      // We return a pending promise, which allows us to chain another `then`
      User.create({ email, password: hashedPassword, name })
        .then((createdUser) => {
          // Deconstruct the newly created user object to omit the password
          // We should never expose passwords publicly
          const { email, name, _id } = createdUser;
          // Create a new object that doesn't expose the password
          const user = { email, name, _id };
          // Send a json response containing the user object
          res.status(201).json({ user });
        })
        .catch((err) => {
            if (err instanceof mongoose.Error.ValidationError) {
                console.log("This is the error", err)
                res.status(501).json({message: "Provide all fields", err})
            } else if (err.code === 11000) {
                console.log("Duplicate value", err)
                res.status(502).json({message: "Invalid name, password, email.", err})
            } else {
                console.log("Error =>", err)
                res.status(503).json({message: "Error encountered", err})
            }
        });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    });
});
router.post('/login', (req, res, next) => {
    const { email, password } = req.body;
    // Check if email or password are provided as empty string
    if (!email  || !password ) {
      res.status(400).json({ message: "Provide both email and password." });
      return;
    }
    // Check the users collection if a user with the same email exists
    User.findOne({ email })
      .then((foundUser) => {
        if (!foundUser) {
          // If the user is not found, send an error response
          res.status(401).json({ message: "User or password is incorrect." })
          return;
        }
        // Compare the provided password with the one saved in the database
        const passwordCorrect = bcrypt.compareSync(password, foundUser.password);
        if (passwordCorrect) {
          // Deconstruct the user object to omit the password
          const { _id, email, name } = foundUser;
          // Create an object that will be set as the token payload
          const payload = { _id, email, name };
          // Create and sign the token
          const authToken = jwt.sign(
            payload,
            process.env.SECRET,
            { algorithm: 'HS256', expiresIn: "1h" }
          );
          // Send the token as the response
          res.status(200).json({ authToken });
        }
        else {
          res.status(401).json({ message: "Unable to authenticate the user" });
        }
      })
      .catch(err => res.status(500).json({ message: "Internal Server Error" }));
  });
router.get('/verify', isAuthenticated, (req, res, next) => {
    res.status(201).json(req.user)
})
module.exports = router;
```
#### isAuthentificated middleware setup
1. Create middleware folder.
2. Create isAuthenticated.js file
3. Add this code in the file:
```
const jwt = require("jsonwebtoken");
const isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token || token === "null") {
    return res.status(400).json({ message: "Token not found" });
  }
  try {
    const tokenInfo = jwt.verify(token, process.env.SECRET);
    req.user = tokenInfo;
    next();
  } catch (error) {
    console.log(error.message, "Error.message")
    return res.status(401).json(error);
  }
};
module.exports = isAuthenticated;
```
## To start a REACT app for the front end from the CLI:
```
npm create vite@latest client -- --template react
```
### Steps inside the REACT app
1. Extend Prettier in eslntrc file under extends. Add ``` 'prettier' ```
1. Turn off the typescript configuration. Under rules add ``` 'react/prop-types': 'off' ```
1. Clear styling in App.css and Index.css
1. Clear app.js of template code
1. Erase public folder
1. Create under the SRC folder the following folders: components, services, pages
1. Create a .env file