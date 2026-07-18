import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { readStoredMediaFile } from "@/lib/media-storage";
import { MediaModel } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const { key } = await params;
    const storageKey = key.join("/");

    const media = await MediaModel.findOne({ coupleId, storageKey }).select("_id").lean();
    if (!media) return Response.json({ error: "Media not found" }, { status: 404 });

    const file = await readStoredMediaFile(storageKey);

    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(file.contentLength),
        "Content-Type": file.contentType,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load media" },
      { status: 404 },
    );
  }
}
