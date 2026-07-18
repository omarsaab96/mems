import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeVoteSession } from "@/lib/api-serializers";
import { VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const body = (await request.json()) as { mediaIds?: string[] };
    const mediaIds = Array.from(new Set(body.mediaIds ?? [])).filter(Boolean);
    await VoteSessionModel.updateMany({ coupleId }, { $pull: { mediaIds: { $in: mediaIds } } });
    const folders = await VoteSessionModel.find({ coupleId }).sort({ createdAt: -1 }).lean();
    return Response.json({ folders: folders.map(serializeVoteSession) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to remove media from folders" },
      { status: 500 },
    );
  }
}
