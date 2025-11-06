import mongoose from 'mongoose';

const anticipatedSchema = new mongoose.Schema({
  "Account name":String,
  "MainAccount":Number,
  "CostCenter": Number,
  "Mar-25": Number,
  "Apr-25": Number,
  "May-25": Number,
  "Jun-25": Number,
  "Jul-25": Number,
  "Aug-25": Number,
  "Sep-25": Number,
  "Oct-25": Number,
  "Nov-25": Number,
  "Dec-25": Number,
  "Jan-26": Number,
  "Feb-26": Number

});

const Anticipated = mongoose.model('Anticipated', anticipatedSchema);

export default Anticipated;