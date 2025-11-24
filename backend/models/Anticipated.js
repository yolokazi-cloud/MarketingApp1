import mongoose from 'mongoose';

const anticipatedSchema = new mongoose.Schema({
  "Account name": String,
  "MainAccount": Number,
  "CostCenter": Number
}, {
  strict: false // Allow any other fields (like 'Mar-25', 'Apr-25', etc.) to be saved
});

const Anticipated = mongoose.model('Anticipated', anticipatedSchema);

export default Anticipated;