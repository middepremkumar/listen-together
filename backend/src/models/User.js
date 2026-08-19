const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    picture: { type: String, default: '' },
    givenName: { type: String, default: '' },
    familyName: { type: String, default: '' },
    lastLogin: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
