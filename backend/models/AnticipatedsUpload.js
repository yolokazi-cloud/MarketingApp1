import mongoose from 'mongoose';

const AnticipatedsUploadSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
  fileName: { type: String, required: true },
  data: { type: Array, required: true },
});

const AnticipatedsUpload = mongoose.model('AnticipatedsUpload', AnticipatedsUploadSchema);
export default AnticipatedsUpload;
