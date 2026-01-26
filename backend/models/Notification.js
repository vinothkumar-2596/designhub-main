import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "system" },
    link: { type: String, default: "" },
    taskId: { type: String, default: "" },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    eventId: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, eventId: 1 }, { unique: true, sparse: true });

NotificationSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export default mongoose.model("Notification", NotificationSchema);
