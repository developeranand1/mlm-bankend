const User = require("../models/User");
const Kyc = require("../models/Kyc");
const cloudinary = require("../config/cloudinary");

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'User' })
      .select('-password')
      .populate('kyc');

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};


exports.getKycUsers=async(req, res)=>{
try {
    const kycs = await Kyc.find().populate('userId'); 
    res.json({ kycs });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}


exports.updateKYC = async (req, res) => {
  const userIdFromParams = req.params.userId; // Extracting userId from URL params

  // Check if the request body is empty
  if (!req.body) {
    return res.status(400).json({ msg: 'Request body is missing' });
  }

  const {
    aadharNumber,
    panNumber,
    passbookImage,
    accountHolderName,
    bankAccountNumber,
    ifscCode,
    kycStatus,
  } = req.body;

  try {
    // Check if the user exists
    let user = await User.findById(userIdFromParams);
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Find the existing KYC record for the user
    let kyc = await Kyc.findOne({ userId: user._id });

    // If no KYC record exists, create a new one
    if (!kyc) {
      kyc = new Kyc({
        userId: user._id,
        aadharNumber: aadharNumber || '',
        panNumber: panNumber || '',
        status: kycStatus || 'Pending', // Default status is 'Pending'
        accountHolderName: accountHolderName || '',
        bankAccountNumber: bankAccountNumber || '',
        ifscCode: ifscCode || '',
        // Initialize other fields as necessary
      });
    }

    // Upload Aadhar image to Cloudinary if provided
    if (req.files && req.files.aadharImage) {
      const aadharUploadResult = await cloudinary.uploader.upload(req.files.aadharImage[0].path, {
        folder: 'mlm/kyc',
      });
      kyc.aadharImage = aadharUploadResult.secure_url; // Save the image URL in KYC schema
    }

    // Upload PAN image to Cloudinary if provided
    if (req.files && req.files.panImage) {
      const panUploadResult = await cloudinary.uploader.upload(req.files.panImage[0].path, {
        folder: 'mlm/kyc',
      });
      kyc.panImage = panUploadResult.secure_url; // Save the image URL in KYC schema
    }

    // Upload Passbook image to Cloudinary if provided
    if (req.files && req.files.passbookImage) {
      const passbookUploadResult = await cloudinary.uploader.upload(req.files.passbookImage[0].path, {
        folder: 'mlm/kyc',
      });
      kyc.passbookImage = passbookUploadResult.secure_url; // Save the passbook image URL
    }

    // Update the KYC fields if provided
    if (aadharNumber) kyc.aadharNumber = aadharNumber;
    if (panNumber) kyc.panNumber = panNumber;
    if (accountHolderName) kyc.accountHolderName = accountHolderName;
    if (bankAccountNumber) kyc.bankAccountNumber = bankAccountNumber;
    if (ifscCode) kyc.ifscCode = ifscCode;
    if (kycStatus) kyc.status = kycStatus;

    // Save the updated KYC data
    await kyc.save();

    // Update user details like accountHolderName, bankAccountNumber, ifscCode, etc.
    user.accountHolderName = accountHolderName || user.accountHolderName;
    user.bankAccountNumber = bankAccountNumber || user.bankAccountNumber;
    user.ifscCode = ifscCode || user.ifscCode;
    
    // Save the updated user data
    await user.save();

    // Send response with updated KYC and user data
    res.json({ msg: 'KYC and user details updated successfully', kyc, user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};
