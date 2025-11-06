import mongoose from 'mongoose';

const accountIDSchema = new mongoose.Schema({
  'Main account': Number, // Corresponds to 'mainAccount' in other collections
  'Main Account Name': String, // Corresponds to 'mainAccountName'
  'Spend Type': {
    type: String,
    enum: ['people', 'program'], // Ensures the value is either 'people' or 'program'
  },
});

// The third argument 'accountids' specifies the exact collection name in MongoDB
const AccountID = mongoose.model('AccountID', accountIDSchema,"AccountID");

export default AccountID;
