import { google, type drive_v3 } from "googleapis";
import fs from "node:fs";
import path from "node:path";

// Cache the client (and the parsed service-account key it reads from disk)
// across calls. GoogleAuth refreshes access tokens internally, so a single
// client is safe to reuse — and it avoids re-reading + re-parsing the key file
// on every list/download during a sync.
let cachedDrive: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_PATH is not set");

  const resolved = path.resolve(process.cwd(), keyPath);
  const key = JSON.parse(fs.readFileSync(resolved, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

export type DriveFile = {
  id: string;
  name: string;
  size: number;
  modifiedTime: string;
};

export async function listCsvFiles(): Promise<DriveFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");

  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '.csv' and trashed = false`,
    fields: "files(id, name, size, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 200,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    size: Number(f.size ?? 0),
    modifiedTime: f.modifiedTime ?? "",
  }));
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
