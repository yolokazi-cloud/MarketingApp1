import mongoose from 'mongoose';

const costCenterIDSchema = new mongoose.Schema({
  costCenter: Number,
  costCenterName: String,
});

// The third argument 'costcenterids' specifies the collection name in MongoDB
const CostCenterID = mongoose.model('CostCenterID', costCenterIDSchema);

export default CostCenterID;