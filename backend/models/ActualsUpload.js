import mongoose from 'mongoose';

const ActualsUploadSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
  fileName: { type: String, required: true },
  data: { type: Array, required: true },
});

const ActualsUpload = mongoose.model('ActualsUpload', ActualsUploadSchema);
export default ActualsUpload;
