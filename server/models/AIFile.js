import mongoose from "mongoose";

const AIFileSchema = new mongoose.Schema(
    {
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number },
        driveId: { type: String, required: true },
        driveUrl: { type: String },
        extractedContent: { type: String, default: "" },
        uploadedBy: { type: String, default: "Guest" },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: true }
);

AIFileSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
    }
});

export default mongoose.model("AIFile", AIFileSchema);
