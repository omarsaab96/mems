import { connectDb } from "@/lib/db";
import type { Types } from "mongoose";
import { serializeMedia } from "@/lib/api-serializers";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { deleteStoredMediaFile, saveUploadedMediaFile } from "@/lib/media-storage";
import { MediaModel } from "@/lib/models";

export const runtime = "nodejs";

type MediaDocumentRecord = Record<string, unknown> & {
  _id: unknown;
  coupleId: unknown;
  title?: string;
  location?: string;
  capturedAt?: Date;
  toObject?: () => Record<string, unknown>;
};

type SerializableRecord = {
  _id: Types.ObjectId;
  [key: string]: unknown;
};

function toIsoDate(value: string | number) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function inferUploadMetadata(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const dateMatch = baseName.match(/(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})/);
  const capturedAt = dateMatch
    ? toIsoDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00`)
    : "";
  const location = dateMatch
    ? baseName
        .replace(dateMatch[0], " ")
        .replace(/[_\-.]+/g, " ")
        .replace(/\b(img|image|photo|video|vid|dsc|mov|mp4|jpg|jpeg|png)\b/gi, " ")
        .replace(/\d+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

  return {
    title: baseName,
    capturedAt,
    location: location || "Unknown location",
  };
}

export async function POST(request: Request) {
  const uploadedStorageKeys: string[] = [];

  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const mediaInput = await Promise.all(
      files.map(async (file) => {
        const metadata = inferUploadMetadata(file.name);
        const modifiedAt = file.lastModified ? toIsoDate(file.lastModified) : "";
        const storedFile = await saveUploadedMediaFile(file, String(coupleId));
        uploadedStorageKeys.push(storedFile.storageKey);

        return {
          coupleId,
          uploadedByUserId: userId,
          type: file.type.startsWith("video") ? "video" : "photo",
          title: metadata.title,
          url: storedFile.url,
          storageKey: storedFile.storageKey,
          thumbnailUrl: storedFile.thumbnailUrl,
          thumbnailStorageKey: storedFile.thumbnailStorageKey,
          capturedAt: metadata.capturedAt || modifiedAt || new Date().toISOString(),
          location: metadata.location,
          status: "in_review",
        };
      }),
    );

    const media = mediaInput.length ? await MediaModel.insertMany(mediaInput) : [];
    const mediaRecords = media as MediaDocumentRecord[];

    return Response.json({
      media: mediaRecords.map((item) => serializeMedia((item.toObject?.() ?? item) as SerializableRecord)),
    });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(deleteStoredMediaFile));
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to upload media" },
      { status: 500 },
    );
  }
}
