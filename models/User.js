const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  imagePaths: {
    type: String
  },
  number: {
    type: String
  },
  package: {
    type: String
  },
  minutes: {
    type: String
  },
  internet: {
    type: String
  },
  lastChecked: {
    type: Date,
    default: Date.now
  }
}, { collection: 'phones' }); // Specify the collection name

module.exports = mongoose.model('User', userSchema);