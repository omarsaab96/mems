import { execFile } from "child_process";
import { config as loadEnv } from "dotenv";
import { mkdir, rm } from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";

loadEnv();

const execFileAsync = promisify(execFile);
const mongoUri = process.env.MONGODB_URI;
const mediaStorageRoot = process.env.MEDIA_STORAGE_DIR
  ? path.resolve(process.env.MEDIA_STORAGE_DIR)
  : path.join(process.cwd(), "storage", "media");

if (!mongoUri) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

const mediaSchema = new mongoose.Schema(
  {
    type: String,
    storageKey: String,
    thumbnailUrl: String,
    thumbnailStorageKey: String,
  },
  { collection: "media" },
);

const Media = mongoose.models.Media || mongoose.model("Media", mediaSchema);

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function safeStorageKeySegment(value) {
  const segment = String(value).replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!segment || segment === "." || segment === "..") return "";
  return segment;
}

function resolveStoragePath(storageKey, { legacyDotless = false } = {}) {
  const normalizedKey = String(storageKey)
    .split("/")
    .map((segment) => legacyDotless ? safeSegment(segment) : safeStorageKeySegment(segment))
    .filter(Boolean)
    .join(path.sep);
  const resolvedPath = path.resolve(mediaStorageRoot, normalizedKey);

  if (!resolvedPath.startsWith(mediaStorageRoot + path.sep)) {
    throw new Error(`Invalid media storage key: ${storageKey}`);
  }

  return resolvedPath;
}

async function generateThumbnail(media) {
  if (!media.storageKey || media.thumbnailStorageKey) return false;

  const originalPath = resolveStoragePath(media.storageKey);
  const parsed = path.parse(media.storageKey);
  const coupleSegment = media.storageKey.split("/")[0];
  const thumbnailStorageKey = `${coupleSegment}/thumbnails/${parsed.name}.jpg`;
  const thumbnailPath = resolveStoragePath(thumbnailStorageKey);

  await mkdir(path.dirname(thumbnailPath), { recursive: true });

  try {
    if (media.type === "video") {
      await execFileAsync("ffmpeg", [
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        originalPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=420:-2",
        "-q:v",
        "4",
        thumbnailPath,
      ]);
    } else {
      await sharp(originalPath)
        .rotate()
        .resize(420, 420, { fit: "cover", withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(thumbnailPath);
    }

    media.thumbnailStorageKey = thumbnailStorageKey;
    media.thumbnailUrl = `/api/media/files/${thumbnailStorageKey}`;
    await media.save();
    return true;
  } catch (error) {
    await rm(thumbnailPath, { force: true }).catch(() => {});
    console.warn(`Skipped ${media._id}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

await mongoose.connect(mongoUri, { bufferCommands: false });

const mediaItems = await Media.find({
  storageKey: { $exists: true, $ne: "" },
  $or: [
    { thumbnailStorageKey: { $exists: false } },
    { thumbnailStorageKey: "" },
    { thumbnailUrl: { $exists: false } },
    { thumbnailUrl: "" },
  ],
});

let generated = 0;
for (const media of mediaItems) {
  if (await generateThumbnail(media)) generated += 1;
}

console.log(`Generated ${generated}/${mediaItems.length} thumbnails.`);
await mongoose.disconnect();
