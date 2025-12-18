const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  profilePicture: {
    type: String, 
    default: ''
  },
  additionalInfo: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
