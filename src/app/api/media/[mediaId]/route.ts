import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { deleteStoredMediaFile } from "@/lib/media-storage";
import { AlbumModel, MediaModel, VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { mediaId } = await params;
    const media = await MediaModel.findOne({ _id: mediaId, coupleId, uploadedByUserId: userId });
    if (!media) return Response.json({ error: "Media not found" }, { status: 404 });
    const mediaRecord = media.toObject() as Record<string, unknown>;

    await Promise.all([
      MediaModel.findByIdAndDelete(mediaId),
      VoteSessionModel.updateMany({ coupleId }, { $pull: { mediaIds: mediaId, votes: { mediaId }, comments: { mediaId } } }),
      AlbumModel.updateMany({ coupleId }, { $pull: { mediaIds: mediaId } }),
    ]);
    await deleteStoredMediaFile(mediaRecord.storageKey);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete media" },
      { status: 500 },
    );
  }
}
