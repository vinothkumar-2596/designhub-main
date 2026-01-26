import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function requiredPassword() {
        return this.authProvider === "local";
      },
    },
    name: { type: String, default: "" },
    role: {
      type: String,
      enum: ["staff", "treasurer", "designer", "other", "admin"],
      default: "other"
    },
    isActive: { type: Boolean, default: true },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: { type: String },
    avatar: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetExpiresAt: { type: Date },
    notificationPreferences: {
      emailNotifications: { type: Boolean, default: true },
      whatsappNotifications: { type: Boolean, default: false },
      deadlineReminders: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

UserSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
    delete ret.isActive;
    return ret;
  }
});

export default mongoose.model("User", UserSchema);
