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