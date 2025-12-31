import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { Readable } from "stream";

const resolveKeyFile = () => {
  const keyFile = process.env.GOOGLE_DRIVE_KEYFILE;
  if (!keyFile) {
    return null;
  }
  if (path.isAbsolute(keyFile)) {
    return fs.existsSync(keyFile) ? keyFile : null;
  }
  const candidates = [
    path.resolve(process.cwd(), keyFile),
    path.resolve(process.cwd(), "..", keyFile),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const getServiceAccountClient = () => {
  const keyFile = resolveKeyFile();
  if (!keyFile) {
    throw new Error("GOOGLE_DRIVE_KEYFILE is not configured.");
  }
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
};

const resolveTokenPath = () => {
  const tokenPath = process.env.GOOGLE_DRIVE_TOKEN_PATH || "server/credentials/drive-token.json";
  return path.isAbsolute(tokenPath) ? tokenPath : path.resolve(process.cwd(), "..", tokenPath);
};

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI must be set for OAuth.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const getDriveClient = () => {
  const useOAuth = process.env.GOOGLE_DRIVE_OAUTH === "true";
  if (!useOAuth) {
    const auth = getServiceAccountClient();
    return google.drive({ version: "v3", auth });
  }
  const oauth = getOAuthClient();
  const tokenPath = resolveTokenPath();
  if (!fs.existsSync(tokenPath)) {
    throw new Error("Drive OAuth not connected. Authorize at /api/drive/auth-url.");
  }
  const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
  oauth.setCredentials(token);
  return google.drive({ version: "v3", auth: oauth });
};

export const getDriveAuthUrl = () => {
  const oauth = getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
};

export const saveDriveToken = async (code) => {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  const tokenPath = resolveTokenPath();
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  return tokens;
};

export const uploadToDrive = async ({ buffer, filename, mimeType, folderId, makePublic }) => {
  const drive = getDriveClient();
  const useDateFolders = process.env.DRIVE_DATE_FOLDERS !== "false";
  let targetFolder = folderId || undefined;

  if (useDateFolders && folderId) {
    const dateLabel = new Date().toISOString().slice(0, 10);
    const existing = await drive.files.list({
      q: [
        "mimeType = 'application/vnd.google-apps.folder'",
        `name = '${dateLabel}'`,
        `'${folderId}' in parents`,
        "trashed = false",
      ].join(" and "),
      fields: "files(id,name)",
      spaces: "drive",
      pageSize: 1,
    });
    const match = existing.data.files?.[0];
    if (match?.id) {
      targetFolder = match.id;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: dateLabel,
          mimeType: "application/vnd.google-apps.folder",
          parents: [folderId],
        },
        fields: "id",
      });
      targetFolder = created.data.id || folderId;
    }
  }

  const stream = Readable.from(buffer);
  const createResponse = await drive.files.create({
    requestBody: {
      name: filename,
      parents: targetFolder ? [targetFolder] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,name,webViewLink,webContentLink",
  });

  const file = createResponse.data;
  if (makePublic && file?.id) {
    await drive.permissions.create({
      fileId: file.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
  }

  return file;
};
