import mongoose from 'mongoose';

const accountIDSchema = new mongoose.Schema({
  'Main account': Number, // Corresponds to 'mainAccount' in other collections
  'Main Account Name': String, // Corresponds to 'mainAccountName'
  'Spend Type': String
});

// The third argument 'accountids' specifies the exact collection name in MongoDB
const AccountID = mongoose.model('AccountID', accountIDSchema);

export default AccountID;
