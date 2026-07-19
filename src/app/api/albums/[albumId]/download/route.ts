import { ZipArchive } from "archiver";
import { createReadStream } from "fs";
import path from "path";
import { PassThrough, Readable } from "stream";
import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { getStoredMediaFilePath, readStoredMediaFile } from "@/lib/media-storage";
import { AlbumModel, MediaModel } from "@/lib/models";

export const runtime = "nodejs";

type MediaRecord = {
  _id: unknown;
  title?: string;
  type?: string;
  storageKey?: string;
  url?: string;
};

function safeDownloadName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "download";
}

function contentDisposition(value: string) {
  const safeName = safeDownloadName(value);
  return `attachment; filename="${safeName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function mediaFileName(media: MediaRecord, index: number) {
  const title = safeDownloadName(String(media.title ?? `media-${index + 1}`));
  const storageExtension = media.storageKey ? path.extname(media.storageKey) : "";
  const titleExtension = path.extname(title);
  const extension = titleExtension || storageExtension || (media.type === "video" ? ".mp4" : ".jpg");

  return titleExtension ? title : `${title}${extension}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const { albumId } = await params;
    const url = new URL(request.url);
    const requestedMediaIds = url.searchParams
      .get("mediaIds")
      ?.split(",")
      .map((mediaId) => mediaId.trim())
      .filter(Boolean);

    const album = await AlbumModel.findOne({ _id: albumId, coupleId }).lean();
    if (!album) return Response.json({ error: "Album not found" }, { status: 404 });

    const albumMediaIds = Array.isArray(album.mediaIds)
      ? album.mediaIds.map((mediaId: unknown) => String(mediaId))
      : [];
    const allowedMediaIds: string[] = requestedMediaIds?.length
      ? requestedMediaIds.filter((mediaId) => albumMediaIds.includes(mediaId))
      : albumMediaIds;

    if (!allowedMediaIds.length) {
      return Response.json({ error: "No album media selected" }, { status: 400 });
    }

    const mediaItems = (await MediaModel.find({
      _id: { $in: allowedMediaIds },
      coupleId,
      storageKey: { $exists: true, $ne: "" },
    }).lean()) as MediaRecord[];
    const mediaById = new Map(mediaItems.map((media) => [String(media._id), media]));
    const orderedMedia = allowedMediaIds.flatMap((mediaId) => {
      const media = mediaById.get(mediaId);
      return media ? [media] : [];
    });

    if (!orderedMedia.length) {
      return Response.json({ error: "Selected media files were not found" }, { status: 404 });
    }

    if (orderedMedia.length === 1) {
      const media = orderedMedia[0];
      if (!media.storageKey) {
        return Response.json({ error: "Selected media file is not downloadable" }, { status: 404 });
      }

      const file = await readStoredMediaFile(media.storageKey);
      return new Response(new Uint8Array(file.buffer), {
        headers: {
          "Content-Disposition": contentDisposition(mediaFileName(media, 0)),
          "Content-Length": String(file.contentLength),
          "Content-Type": file.contentType,
        },
      });
    }

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const stream = new PassThrough();

    archive.on("warning", (error) => {
      if (error.code !== "ENOENT") throw error;
    });
    archive.pipe(stream);

    void Promise.all(
      orderedMedia
        .filter((media) => Boolean(media.storageKey))
        .map(async (media, index) => {
          const filePath = await getStoredMediaFilePath(String(media.storageKey));
          return { filePath, index, media };
        }),
    ).then((files) => {
      const usedZipNames = new Set<string>();
      files.forEach(({ filePath, media, index }) => {
        let fileName = mediaFileName(media, index);
        if (usedZipNames.has(fileName)) {
          const extension = path.extname(fileName);
          const baseName = fileName.slice(0, fileName.length - extension.length);
          fileName = `${baseName}-${index + 1}${extension}`;
        }
        usedZipNames.add(fileName);
        archive.append(createReadStream(filePath), { name: fileName });
      });
      void archive.finalize();
    }).catch((error) => archive.destroy(error));

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Disposition": contentDisposition(`${String(album.title ?? "album")}.zip`),
        "Content-Type": "application/zip",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to download album" },
      { status: 500 },
    );
  }
}
