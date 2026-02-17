import mongoose from "mongoose";

const normalizeValue = (value) => (value ? String(value).trim().toLowerCase() : "");

const parseEmailList = (rawValue) => {
  const source = String(rawValue || "").trim();
  if (!source) return [];
  return Array.from(
    new Set(
      source
        .split(/[\s,;]+/g)
        .map((entry) => normalizeValue(entry))
        .filter(Boolean)
    )
  );
};

const getConfiguredMainDesignerEmails = () => {
  const fromSingle = parseEmailList(process.env.MAIN_DESIGNER_EMAIL || "");
  const fromList = parseEmailList(process.env.MAIN_DESIGNER_EMAILS || "");
  return Array.from(new Set([...fromSingle, ...fromList]));
};

export const hasMainDesignerConfig = () => getConfiguredMainDesignerEmails().length > 0;

const getUserIdString = (user) => {
  if (!user) return "";
  const rawId = user.id || user._id;
  if (!rawId) return "";
  if (typeof rawId === "string") return rawId;
  if (mongoose.Types.ObjectId.isValid(String(rawId))) {
    return String(rawId);
  }
  return rawId?.toString?.() || "";
};

export const getDesignerScope = (user) => {
  const role = normalizeValue(user?.role);
  if (role !== "designer") return "";
  const configuredMainEmails = getConfiguredMainDesignerEmails();
  if (!hasMainDesignerConfig()) {
    // Backward compatibility: preserve legacy behavior when no main designer is configured.
    return "main";
  }
  const email = normalizeValue(user?.email);
  return email && configuredMainEmails.includes(email) ? "main" : "junior";
};

export const isMainDesignerUser = (user) => getDesignerScope(user) === "main";

export const buildDesignerPortalId = (user) => {
  const scope = getDesignerScope(user);
  if (!scope) return "";
  const userId = getUserIdString(user);
  if (!userId) return "";
  const suffix = userId.slice(-6).toUpperCase();
  const prefix = scope === "main" ? "MD" : "JD";
  return `${prefix}-${suffix}`;
};

export const normalizeDesignerScope = (value) => {
  const scope = normalizeValue(value);
  if (scope === "main" || scope === "junior") return scope;
  return "";
};
