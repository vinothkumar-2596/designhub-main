import bcrypt from "bcryptjs";
import User from "../models/User.js";

const truthy = new Set(["1", "true", "yes", "on"]);

const asBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return truthy.has(String(value).trim().toLowerCase());
};

const normalizeRole = (value) => {
  const role = String(value || "").trim().toLowerCase();
  const allowed = new Set(["staff", "treasurer", "designer", "other", "admin"]);
  return allowed.has(role) ? role : "designer";
};

const buildDemoUsers = () => {
  const envEmail = String(process.env.DEMO_USER_EMAIL || "").trim().toLowerCase();
  const envPassword = String(process.env.DEMO_USER_PASSWORD || "").trim();
  const envRole = normalizeRole(process.env.DEMO_USER_ROLE || "designer");
  const envName = String(process.env.DEMO_USER_NAME || "").trim() || "Demo User";

  const users = [];
  if (envEmail && envPassword) {
    users.push({
      email: envEmail,
      password: envPassword,
      role: envRole,
      name: envName,
    });
  }

  const designerEmail = String(
    process.env.DESIGNER_DEMO_EMAIL || "designer.portal@designhub.com"
  )
    .trim()
    .toLowerCase();
  const designerPassword = String(
    process.env.DESIGNER_DEMO_PASSWORD || "Designer#Q9v4!"
  ).trim();
  const designerName = String(process.env.DESIGNER_DEMO_NAME || "Designer").trim();

  if (
    designerEmail &&
    designerPassword &&
    !users.some((entry) => entry.email === designerEmail)
  ) {
    users.push({
      email: designerEmail,
      password: designerPassword,
      role: "designer",
      name: designerName,
    });
  }

  const treasurerEmail = String(
    process.env.TREASURER_DEMO_EMAIL || "treasurer.portal@designhub.com"
  )
    .trim()
    .toLowerCase();
  const treasurerPassword = String(
    process.env.TREASURER_DEMO_PASSWORD || "Treasurer#R7m2!"
  ).trim();
  const treasurerName = String(process.env.TREASURER_DEMO_NAME || "Treasurer").trim();

  if (
    treasurerEmail &&
    treasurerPassword &&
    !users.some((entry) => entry.email === treasurerEmail)
  ) {
    users.push({
      email: treasurerEmail,
      password: treasurerPassword,
      role: "treasurer",
      name: treasurerName,
    });
  }

  return users;
};

const shouldSeedDemoUsers = () => {
  const enabled = asBool(
    process.env.SEED_DEMO_USERS,
    process.env.NODE_ENV !== "production"
  );
  return enabled;
};

const shouldOverwriteDemoPasswords = () => {
  return asBool(
    process.env.SEED_DEMO_USERS_OVERWRITE_PASSWORDS,
    process.env.NODE_ENV !== "production"
  );
};

export const bootstrapDemoUsers = async () => {
  if (!shouldSeedDemoUsers()) return;

  const demoUsers = buildDemoUsers();
  if (demoUsers.length === 0) return;

  const overwritePasswords = shouldOverwriteDemoPasswords();

  for (const entry of demoUsers) {
    const existing = await User.findOne({ email: entry.email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(entry.password, 10);
      await User.create({
        email: entry.email,
        password: passwordHash,
        role: entry.role,
        name: entry.name,
        authProvider: "local",
        isActive: true,
      });
      console.log(`[bootstrap] Created demo user: ${entry.email}`);
      continue;
    }

    const updates = {};
    let changed = false;

    if (!existing.password || overwritePasswords) {
      updates.password = await bcrypt.hash(entry.password, 10);
      changed = true;
    }
    if (!existing.name) {
      updates.name = entry.name;
      changed = true;
    }
    if (existing.role !== entry.role) {
      updates.role = entry.role;
      changed = true;
    }
    if (existing.isActive === false) {
      updates.isActive = true;
      changed = true;
    }
    if (existing.authProvider !== "local") {
      updates.authProvider = "local";
      changed = true;
    }

    if (changed) {
      await User.updateOne({ _id: existing._id }, { $set: updates });
      console.log(`[bootstrap] Updated demo user: ${entry.email}`);
    }
  }
};
