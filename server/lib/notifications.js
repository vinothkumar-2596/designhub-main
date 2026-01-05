import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const normalizeWhatsAppNumber = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
};

const formatTemplateDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
};

const formatTemplateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  const minutePart = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${hours12}${minutePart}${period}`;
};

const buildTemplateVariables = (dateSource) => ({
  "1": formatTemplateDate(dateSource),
  "2": formatTemplateTime(dateSource),
});

const parseTemplateVariables = (dateSource) => {
  const raw = process.env.TWILIO_WHATSAPP_TEMPLATE_VARIABLES;
  if (!raw) {
    return buildTemplateVariables(dateSource);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return buildTemplateVariables(dateSource);
    }
    const dateValue = formatTemplateDate(dateSource);
    const timeValue = formatTemplateTime(dateSource);
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => {
        if (typeof value !== "string") return [key, value];
        return [
          key,
          value.replace(/\{\{date\}\}/gi, dateValue).replace(/\{\{time\}\}/gi, timeValue),
        ];
      })
    );
  } catch {
    return buildTemplateVariables(dateSource);
  }
};

const getTemplateVariables = (dateSource) => {
  const raw = process.env.TWILIO_WHATSAPP_TEMPLATE_VARIABLES_RAW;
  if (raw) {
    return raw;
  }
  return parseTemplateVariables(dateSource);
};

const buildTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    return null;
  }
  const channel = (process.env.TWILIO_CHANNEL || "sms").toLowerCase();
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
  return { accountSid, authToken, from, channel, templateSid };
};

const sendTwilioMessage = async ({
  to,
  body,
  templateVariables,
  forceNoTemplate = false
}) => {
  if (!to) {
    console.warn("Twilio: missing recipient phone number.");
    return false;
  }
  const config = buildTwilioConfig();
  if (!config) {
    console.warn("Twilio not configured; skipping message.");
    return false;
  }
  const debugEnabled = process.env.TWILIO_DEBUG === "true";
  const isWhatsApp = config.channel === "whatsapp";
  const channelLabel = isWhatsApp ? "WhatsApp" : "SMS";
  const fromNumber = isWhatsApp ? normalizeWhatsAppNumber(config.from) : config.from;
  const toNumber = isWhatsApp ? normalizeWhatsAppNumber(to) : to;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const payload = new URLSearchParams({
    From: fromNumber,
    To: toNumber
  });
  const useTemplate = isWhatsApp && config.templateSid && !forceNoTemplate;
  let contentVariablesValue = null;
  if (useTemplate) {
    payload.set("ContentSid", config.templateSid);
    if (templateVariables) {
      if (typeof templateVariables === "string") {
        contentVariablesValue = templateVariables;
      } else if (typeof templateVariables === "object") {
        const keys = Object.keys(templateVariables);
        if (keys.length > 0) {
          contentVariablesValue = JSON.stringify(templateVariables);
        }
      }
      if (contentVariablesValue) {
        payload.set("ContentVariables", contentVariablesValue);
      }
    }
  } else {
    payload.set("Body", body);
  }
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error(`Twilio ${channelLabel} failed:`, response.status, responseText);
      if (useTemplate && responseText?.includes?.("21656") && body) {
        console.warn("Twilio template rejected; retrying as free-form WhatsApp.");
        return sendTwilioMessage({ to, body, templateVariables: null, forceNoTemplate: true });
      }
      return false;
    }
    if (debugEnabled) {
      let parsed = null;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = null;
      }
      if (useTemplate && contentVariablesValue) {
        console.log(`Twilio ${channelLabel} template variables:`, contentVariablesValue);
      }
      if (parsed) {
        console.log(`Twilio ${channelLabel} sent:`, {
          sid: parsed.sid,
          status: parsed.status,
          to: parsed.to,
          from: parsed.from,
        });
      } else {
        console.log(`Twilio ${channelLabel} sent:`, responseText);
      }
    }
    return true;
  } catch (error) {
    console.error(`Twilio ${channelLabel} failed:`, error?.message || error);
    return false;
  }
};

const clampText = (value, max) => {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
};

export const sendTaskCreatedSms = async ({ to, taskTitle, taskUrl, deadline, requesterName, taskId }) => {
  const title = taskTitle || "your request";
  const safeTitle = clampText(title, 80);
  const detail = deadline
    ? `Deadline ${new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
    : "";
  const nameLine = requesterName ? `Hi ${requesterName}, ` : "";
  const urlLine = taskUrl ? ` View: ${taskUrl}` : taskId ? ` Task ID: ${taskId}` : "";
  const body = clampText(`${nameLine}DesignDesk request created: ${safeTitle}. ${detail}${urlLine}`, 320);
  const templateVariables = getTemplateVariables(deadline || new Date());
  return sendTwilioMessage({ to, body, templateVariables });
};

export const sendFinalFilesSms = async ({
  to,
  taskTitle,
  files = [],
  designerName,
  taskUrl,
  deadline,
  taskId
}) => {
  const title = taskTitle || "your task";
  const safeTitle = clampText(title, 70);
  const firstLink = Array.isArray(files) && files[0]?.url ? files[0].url : "";
  const deadlineText = deadline
    ? ` Deadline ${new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
    : "";
  const designerText = designerName ? ` by ${designerName}` : "";
  const fileText = firstLink ? ` File: ${firstLink}` : "";
  const urlLine = taskUrl ? ` View: ${taskUrl}` : taskId ? ` Task ID: ${taskId}` : "";
  const body = clampText(
    `DesignDesk: Final files uploaded${designerText} for "${safeTitle}".${deadlineText}${fileText}${urlLine}`,
    480
  );
  const templateVariables = getTemplateVariables(deadline || new Date());
  return sendTwilioMessage({ to, body, templateVariables });
};

const buildMailer = () => {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_PASS;
  if (!user || !pass) {
    return null;
  }
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === "true";
  if (allowSelfSigned) {
    console.warn("SMTP_ALLOW_SELF_SIGNED enabled; TLS certificate validation is relaxed.");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    tls: { rejectUnauthorized: !allowSelfSigned },
  });
};

export const sendFinalFilesEmail = async ({
  to,
  taskTitle,
  files,
  designerName,
  taskUrl,
  submittedAt,
  taskDetails,
}) => {
  const transporter = buildMailer();
  if (!transporter) {
    console.warn("SMTP not configured; skipping final files email.");
    return false;
  }

  const humanize = (value) => {
    if (!value) return "";
    return String(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const brandName = process.env.BRAND_NAME || "DesignDesk";
  const fromAddress = process.env.GMAIL_SMTP_FROM || process.env.GMAIL_SMTP_USER;
  const from = fromAddress
    ? fromAddress.includes("<")
      ? fromAddress
      : `"${brandName}" <${fromAddress}>`
    : undefined;
  const safeTitle = taskTitle || "your task";
  const displayDesigner = designerName || "A designer";
  const fileItems = Array.isArray(files) ? files : [];
  const brandColor = process.env.BRAND_PRIMARY_HEX || "#34429D";
  const brandSoft = process.env.BRAND_PRIMARY_SOFT || "#EEF1FF";
  const baseUrl = process.env.FRONTEND_URL || "";
  const logoUrl =
    process.env.BRAND_LOGO_URL ||
    (baseUrl ? `${baseUrl.replace(/\/$/, "")}/favicon.png` : "");
  const localLogoPath = path.resolve(__dirname, "../../public/favicon.png");
  const hasLocalLogo = fs.existsSync(localLogoPath);
  const logoCid = "design-desk-logo";
  const requesterLabel = taskDetails?.requesterName
    ? `${taskDetails.requesterName}${taskDetails.requesterEmail ? ` (${taskDetails.requesterEmail})` : ""}${
        taskDetails.requesterDepartment ? ` - ${taskDetails.requesterDepartment}` : ""
      }`
    : taskDetails?.requesterEmail || "";
  const detailItems = [
    { label: "Task", value: safeTitle },
    { label: "Task ID", value: taskDetails?.id },
    { label: "Status", value: humanize(taskDetails?.status) },
    { label: "Category", value: humanize(taskDetails?.category) },
    { label: "Designer", value: displayDesigner },
    { label: "Submitted", value: formatDateTime(submittedAt) },
    { label: "Deadline", value: formatDate(taskDetails?.deadline) },
    { label: "Requester", value: requesterLabel },
  ].filter((item) => item.value);
  const lines = [
    `${displayDesigner} uploaded final files for "${safeTitle}".`,
    "",
    "Files:",
    ...(fileItems.length > 0
      ? fileItems.map((file) => `- ${file.name}${file.url ? ` (${file.url})` : ""}`)
      : ["- (no file names provided)"]),
  ];
  if (detailItems.length > 0) {
    lines.push("", "Details:", ...detailItems.map((item) => `${item.label}: ${item.value}`));
  }
  if (taskUrl) {
    lines.push("", `View task: ${taskUrl}`);
  }

  const fileRows =
    fileItems.length > 0
      ? fileItems
          .map((file) => {
            const link = file.url
              ? `<a href="${file.url}" style="color:${brandColor};text-decoration:none;">Download</a>`
              : `<span style="color:#6b7280;">Link pending</span>`;
            return `
              <tr>
                <td style="padding:12px 0;border-top:1px solid #e6e9f2;">
                  <div style="font-size:14px;color:#111827;font-weight:600;">${file.name}</div>
                </td>
                <td style="padding:12px 0;border-top:1px solid #e6e9f2;text-align:right;">
                  ${link}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td style="padding:12px 0;border-top:1px solid #e6e9f2;color:#6b7280;">
              No files listed in this update.
            </td>
          </tr>
        `;

  const taskCta = taskUrl
    ? `
        <a href="${taskUrl}" style="display:inline-block;padding:12px 20px;background:${brandColor};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">
          View Task
        </a>
      `
    : "";

  const logoMark = hasLocalLogo
    ? `<img src="cid:${logoCid}" width="40" height="40" alt="${brandName}" style="display:block;border-radius:10px;background:${brandSoft};" />`
    : logoUrl
      ? `<img src="${logoUrl}" width="40" height="40" alt="${brandName}" style="display:block;border-radius:10px;background:${brandSoft};" />`
      : "";

  const viewInBrowser = taskUrl
    ? `<a href="${taskUrl}" style="color:${brandColor};text-decoration:none;">View this email in your browser</a>`
    : "";

  const detailRows =
    detailItems.length > 0
      ? detailItems
          .map((item, index) => {
            const border = index === 0 ? "" : "border-top:1px solid #e6e9f2;";
            return `
              <tr>
                <td style="padding:8px 0;${border}color:#667085;font-size:12px;width:38%;vertical-align:top;">
                  ${item.label}
                </td>
                <td style="padding:8px 0;${border}color:#111827;font-size:13px;font-weight:600;">
                  ${item.value}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td style="padding:8px 0;color:#667085;font-size:12px;">
              No task details available.
            </td>
          </tr>
        `;

  const html = `
    <div style="background:#f5f7fb;padding:24px 16px;font-family:Helvetica, Arial, sans-serif;color:#101828;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;">
        ${
          viewInBrowser
            ? `
              <tr>
                <td style="text-align:center;padding-bottom:18px;">
                  <div style="font-size:12px;color:#667085;background:#ffffff;border:1px solid #e6e9f2;border-radius:999px;padding:8px 16px;display:inline-block;">
                    ${viewInBrowser}
                  </div>
                </td>
              </tr>
            `
            : ""
        }
        <tr>
          <td style="text-align:center;padding-bottom:18px;">
            ${logoMark}
            <div style="margin-top:10px;font-weight:700;font-size:18px;color:${brandColor};letter-spacing:0.5px;">
              ${brandName}
            </div>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:20px;border:1px solid #e6e9f2;">
              <tr>
                <td style="padding:32px 32px 16px;text-align:center;">
                  <div style="font-size:26px;font-weight:700;color:#111827;line-height:1.2;">
                    Final files uploaded.
                  </div>
                  <div style="margin-top:6px;font-size:16px;font-weight:600;color:${brandColor};">
                    ${safeTitle}
                  </div>
                  <p style="margin:12px auto 0;max-width:460px;font-size:15px;color:#475467;line-height:1.5;">
                    ${displayDesigner} uploaded final files for <strong>${safeTitle}</strong>.
                    Download them below or open the task to review details.
                  </p>
                  <div style="margin-top:20px;">
                    ${taskCta}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <div style="background:#ffffff;border:1px solid #e6e9f2;border-radius:16px;padding:18px;text-align:left;">
                    <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${brandColor};font-weight:700;">
                      Task details
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px;">
                      ${detailRows}
                    </table>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 24px;">
                  <div style="background:${brandSoft};border-radius:16px;padding:20px;text-align:left;">
                    <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${brandColor};font-weight:700;">
                      Files delivered
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
                      ${fileRows}
                    </table>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 28px;">
                  <div style="background:#ffffff;border:1px solid #e6e9f2;border-radius:16px;padding:18px;text-align:left;">
                    <div style="font-size:14px;font-weight:600;color:#111827;">Need anything else?</div>
                    <div style="font-size:13px;color:#667085;margin-top:6px;">
                      Reply to this email and the design team will help.
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 32px;border-top:1px solid #e6e9f2;text-align:center;font-size:12px;color:#98a2b3;">
                  This message was sent by ${brandName}.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `DesignDesk: Final files uploaded for ${safeTitle}`,
      text: lines.join("\n"),
      html,
      attachments: hasLocalLogo
        ? [
            {
              filename: "logo.png",
              path: localLogoPath,
              cid: logoCid,
            },
          ]
        : [],
    });
    console.log("Final files email sent:", info?.response || info?.messageId || "ok");
    return true;
  } catch (error) {
    console.error("Final files email failed:", error?.message || error);
    if (error?.response) {
      console.error("SMTP response:", error.response);
    }
    return false;
  }
};
