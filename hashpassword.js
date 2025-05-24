const bcrypt = require('bcrypt');

const password = 'Bintech56'; // change to whatever you want
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) throw err;
  console.log('Hashed password:', hash);
});
