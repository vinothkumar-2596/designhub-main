import mongoose from "mongoose";

const TaskFileSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    type: { type: String, enum: ["input", "output"], default: "input" },
    uploadedAt: { type: Date },
    uploadedBy: { type: String, default: "" },
    size: { type: Number },
    thumbnailUrl: { type: String, default: "" }
  },
  { _id: false }
);

const TaskCommentSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userRole: { type: String, default: "" },
    content: { type: String, required: true, trim: true },
    parentId: { type: String, default: "" },
    mentions: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    receiverRoles: { type: [String], default: [] },
    seenBy: {
      type: [
        {
          role: { type: String, default: "" },
          seenAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { _id: true }
);

const DesignVersionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, default: "" },
    version: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" }
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
      enum: ["poster", "social_media", "banner", "brochure", "others", "campaign_or_others", "social_media_creative", "website_assets", "ui_ux", "led_backdrop", "flyer"],
      required: true
    },
    urgency: { type: String, enum: ["low", "intermediate", "normal", "urgent"], default: "normal" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "under_review", "completed", "clarification", "clarification_required"],
      default: "pending"
    },
    isEmergency: { type: Boolean, default: false },
    emergencyApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    emergencyApprovedBy: { type: String, default: "" },
    emergencyApprovedAt: { type: Date },
    emergencyRequestedAt: { type: Date },
    scheduleTaskId: { type: String, default: "" },
    requesterId: { type: String, default: "" },
    requesterName: { type: String, default: "" },
    requesterEmail: { type: String, default: "" },
    requesterPhone: { type: String, default: "" },
    secondaryPhones: { type: [String], default: [] },
    requesterDepartment: { type: String, default: "" },
    assignedToId: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    isModification: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    approvedBy: { type: String, default: "" },
    approvalDate: { type: Date },
    changeCount: { type: Number, default: 0 },
    deadline: { type: Date },
    proposedDeadline: { type: Date },
    deadlineApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    deadlineApprovedBy: { type: String, default: "" },
    deadlineApprovedAt: { type: Date },
    changeHistory: { type: [ChangeHistorySchema], default: [] },
    reminderSent: { type: Boolean, default: false },
    files: { type: [TaskFileSchema], default: [] },
    designVersions: { type: [DesignVersionSchema], default: [] },
    activeDesignVersionId: { type: String, default: "" },
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

