import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeVoteSession } from "@/lib/api-serializers";
import { VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const { folderId } = await params;
    const body = (await request.json()) as { mediaIds?: string[] };
    const mediaIds = Array.from(new Set(body.mediaIds ?? [])).filter(Boolean);

    const target = await VoteSessionModel.findOne({ _id: folderId, coupleId });
    if (!target) return Response.json({ error: "Folder not found" }, { status: 404 });

    const targetMediaIds: string[] = Array.isArray(target.mediaIds)
      ? target.mediaIds.map((mediaId: unknown) => String(mediaId))
      : [];
    const isSameFolderDrop = mediaIds.every((mediaId) => targetMediaIds.includes(mediaId));

    if (!isSameFolderDrop) {
      await VoteSessionModel.updateMany({ coupleId }, { $pull: { mediaIds: { $in: mediaIds } } });
      target.mediaIds = [...mediaIds, ...targetMediaIds.filter((id) => !mediaIds.includes(id))];
      await target.save();
    }

    const folders = await VoteSessionModel.find({ coupleId }).sort({ createdAt: -1 }).lean();
    return Response.json({ folders: folders.map(serializeVoteSession) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to move media" },
      { status: 500 },
    );
  }
}
