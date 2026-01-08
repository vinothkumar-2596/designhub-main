import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    taskTitle: { type: String, default: "" },
    action: { type: String, enum: ["created", "updated", "commented", "assigned"], required: true },
    userId: { type: String, default: "" },
    userName: { type: String, default: "" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivitySchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

export default mongoose.model("Activity", ActivitySchema);
