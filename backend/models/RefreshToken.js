import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdByIp: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    replacedByTokenHash: { type: String, default: "" },
    revokedAt: { type: Date },
    revokedReason: { type: String, default: "" }
  },
  { timestamps: true }
);

RefreshTokenSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.tokenHash;
    return ret;
  }
});

export default mongoose.model("RefreshToken", RefreshTokenSchema);
