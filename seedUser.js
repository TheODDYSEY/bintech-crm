const mongoose = require('mongoose');
const User = require('./models/users'); // Adjust the path if needed

mongoose.connect('mongodb://localhost:27017/bintech_crm')
  .then(async () => {
    console.log("Connected to MongoDB");

    const existing = await User.findOne({ username: "bintechadmin" });

    if (existing) {
      // If the user already exists, update the password hash
      existing.passwordHash = "$2b$10$mYY6NxUXeeSf0iB.XNoAAOtb8CikDBIFJUGShLR8Mo7lyBieK7KE.";
      await existing.save();
      console.log("User already exists — password updated");
    } else {
      // If user doesn't exist, create them
      const user = new User({
        username: "bintechadmin",
        email: "admin@bintech.co.ke",
        passwordHash: "$2b$10$mYY6NxUXeeSf0iB.XNoAAOtb8CikDBIFJUGShLR8Mo7lyBieK7KE."
      });

      await user.save();
      console.log("User created successfully");
    }

    mongoose.disconnect();
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });
