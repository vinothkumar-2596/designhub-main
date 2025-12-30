import mongoose from "mongoose";

const TaskFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    type: { type: String, enum: ["input", "output"], default: "input" }
  },
  { _id: false }
);

const TaskCommentSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const ChangeHistorySchema = new mongoose.Schema(
  {
    type: { type: String, default: "update" },
    field: { type: String, default: "" },
    oldValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    note: { type: String, default: "" },
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userRole: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["poster", "social_media", "banner", "brochure", "others"],
      required: true
    },
    urgency: { type: String, enum: ["normal", "urgent"], default: "normal" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "under_review", "completed", "clarification"],
      default: "pending"
    },
    requesterId: { type: String, default: "" },
    requesterName: { type: String, default: "" },
    requesterDepartment: { type: String, default: "" },
    assignedToId: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    isModification: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    changeCount: { type: Number, default: 0 },
    deadline: { type: Date },
    proposedDeadline: { type: Date },
    deadlineApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    deadlineApprovedBy: { type: String, default: "" },
    deadlineApprovedAt: { type: Date },
    changeHistory: { type: [ChangeHistorySchema], default: [] },
    files: { type: [TaskFileSchema], default: [] },
    comments: { type: [TaskCommentSchema], default: [] }
  },
  { timestamps: true }
);

TaskSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

export default mongoose.model("Task", TaskSchema);
