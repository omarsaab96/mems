import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const mediaStorageRoot = process.env.MEDIA_STORAGE_DIR
  ? path.resolve(process.env.MEDIA_STORAGE_DIR)
  : path.join(process.cwd(), "storage", "media");

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const mimeByExtension: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function safeStorageKeySegment(value: string) {
  const segment = value.replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!segment || segment === "." || segment === "..") return "";
  return segment;
}

function extensionFor(file: File) {
  const fromName = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return extensionByMime[file.type] ?? (fromName || ".bin");
}

function resolveStoragePath(storageKey: string, options: { legacyDotless?: boolean } = {}) {
  const normalizedKey = storageKey
    .split("/")
    .map((segment) => options.legacyDotless ? safeSegment(segment) : safeStorageKeySegment(segment))
    .filter(Boolean)
    .join(path.sep);
  const resolvedPath = path.resolve(mediaStorageRoot, normalizedKey);

  if (!resolvedPath.startsWith(mediaStorageRoot + path.sep)) {
    throw new Error("Invalid media storage key");
  }

  return resolvedPath;
}

async function readExistingFile(storageKey: string) {
  const filePath = resolveStoragePath(storageKey);

  try {
    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return { buffer, filePath, fileStat };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    const legacyFilePath = resolveStoragePath(storageKey, { legacyDotless: true });
    const [buffer, fileStat] = await Promise.all([readFile(legacyFilePath), stat(legacyFilePath)]);
    return { buffer, filePath: legacyFilePath, fileStat };
  }
}

export async function saveUploadedMediaFile(file: File, coupleId: string) {
  const coupleSegment = safeSegment(coupleId);
  const fileBaseName = `${Date.now()}-${randomBytes(10).toString("hex")}`;
  const fileName = `${fileBaseName}${extensionFor(file)}`;
  const storageKey = `${coupleSegment}/${fileName}`;
  const filePath = resolveStoragePath(storageKey);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  const thumbnail = await createThumbnail({
    buffer,
    coupleSegment,
    fileBaseName,
    filePath,
    mediaType: file.type.startsWith("video") ? "video" : "photo",
  });

  return {
    storageKey,
    thumbnailStorageKey: thumbnail?.storageKey,
    thumbnailUrl: thumbnail?.url,
    url: `/api/media/files/${storageKey}`,
  };
}

async function createThumbnail({
  buffer,
  coupleSegment,
  fileBaseName,
  filePath,
  mediaType,
}: {
  buffer: Buffer;
  coupleSegment: string;
  fileBaseName: string;
  filePath: string;
  mediaType: "photo" | "video";
}) {
  const thumbnailStorageKey = `${coupleSegment}/thumbnails/${fileBaseName}.jpg`;
  const thumbnailPath = resolveStoragePath(thumbnailStorageKey);

  try {
    await mkdir(path.dirname(thumbnailPath), { recursive: true });

    if (mediaType === "photo") {
      await sharp(buffer)
        .rotate()
        .resize(420, 420, { fit: "cover", withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(thumbnailPath);
    } else {
      await execFileAsync("ffmpeg", [
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-vf",
        "scale=420:-2",
        "-q:v",
        "4",
        thumbnailPath,
      ]);
    }

    return {
      storageKey: thumbnailStorageKey,
      url: `/api/media/files/${thumbnailStorageKey}`,
    };
  } catch {
    await rm(thumbnailPath, { force: true }).catch(() => {});
    return null;
  }
}

export async function readStoredMediaFile(storageKey: string) {
  const { buffer, filePath, fileStat } = await readExistingFile(storageKey);
  const contentType = mimeByExtension[path.extname(storageKey).toLowerCase()] ??
    mimeByExtension[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream";

  return {
    buffer,
    contentLength: fileStat.size,
    contentType,
  };
}

export async function deleteStoredMediaFile(storageKey: unknown) {
  if (typeof storageKey !== "string" || !storageKey.trim()) return;

  try {
    await Promise.all([
      rm(resolveStoragePath(storageKey), { force: true }),
      rm(resolveStoragePath(storageKey, { legacyDotless: true }), { force: true }),
    ]);
  } catch {
    // A missing file should not block deletion of the database record.
  }
}
