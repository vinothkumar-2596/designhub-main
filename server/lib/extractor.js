import mammoth from "mammoth";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
export const extractText = async (buffer, mimeType) => {
    try {
        if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const result = await mammoth.extractRawText({ buffer });
            return result.value.trim();
        } else if (mimeType === "application/pdf") {
            try {
                const pdf = require("pdf-parse");
                const data = await pdf(buffer);
                return data.text.trim();
            } catch (pdfError) {
                console.error("PDF Parsing failed (module unavailable or error):", pdfError);
                return "";
            }
        } else if (mimeType.startsWith("text/")) {
            return buffer.toString("utf-8").trim();
        }
        // For images or others, we don't extract text yet
        return "";
    } catch (error) {
        console.error("Content extraction failed:", error);
        return "";
    }
};
