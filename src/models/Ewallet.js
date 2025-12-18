const mongoose = require('mongoose');

const ewalletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [
    {
      type: {
        type: String,  
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        default: ''
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Ewallet', ewalletSchema);
