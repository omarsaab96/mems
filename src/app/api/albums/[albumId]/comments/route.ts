import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeAlbum } from "@/lib/api-serializers";
import { AlbumModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { albumId } = await params;
    const body = (await request.json()) as { mediaId?: string; body?: string };
    const commentBody = body.body?.trim();

    if (!body.mediaId || !commentBody) {
      return Response.json({ error: "Comment body is required" }, { status: 400 });
    }

    const album = await AlbumModel.findOneAndUpdate(
      { _id: albumId, coupleId, mediaIds: body.mediaId },
      {
        $push: {
          comments: {
            mediaId: body.mediaId,
            userId,
            body: commentBody,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!album) return Response.json({ error: "Album media not found" }, { status: 404 });

    return Response.json({ album: serializeAlbum(album.toObject()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to add comment" },
      { status: 500 },
    );
  }
}
