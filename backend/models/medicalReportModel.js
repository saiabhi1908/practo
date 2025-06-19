import mongoose from "mongoose";

const medicalReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  reportName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const medicalReportModel = mongoose.models.medicalReport || mongoose.model("medicalReport", medicalReportSchema);
export default medicalReportModel;
