import mongoose from 'mongoose';

const actualSchema = new mongoose.Schema({
  "Category":String,
  "Cost Center": Number, // Corrected field name to include space
  "Date": Date,
  "Account entry description" : String,
  "Main Account": String,
  "Main Account Name": String,
  "Amount": Number,
  "Party Name": String,
  "Document Description": String
});

const Actual = mongoose.model('Actual', actualSchema);

export default Actual;