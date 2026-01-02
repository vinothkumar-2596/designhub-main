import nodemailer from "nodemailer";

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

  const from = process.env.GMAIL_SMTP_FROM || process.env.GMAIL_SMTP_USER;
  const safeTitle = taskTitle || "your task";
  const displayDesigner = designerName || "A designer";
  const fileItems = Array.isArray(files) ? files : [];
  const brandColor = process.env.BRAND_PRIMARY_HEX || "#34429D";
  const brandSoft = process.env.BRAND_PRIMARY_SOFT || "#EEF1FF";
  const baseUrl = process.env.FRONTEND_URL || "";
  const logoUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/favicon.png` : "";
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

  const logoMark = logoUrl
    ? `<img src="${logoUrl}" width="40" height="40" alt="DesignDesk" style="display:block;border-radius:10px;background:${brandSoft};" />`
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
              DesignDesk
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
                  This message was sent by DesignDesk.
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
