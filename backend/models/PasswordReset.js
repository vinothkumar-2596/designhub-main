import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false }
  },
  { timestamps: true }
);

PasswordResetSchema.index({ email: 1, createdAt: -1 });

export default mongoose.model("PasswordReset", PasswordResetSchema);
