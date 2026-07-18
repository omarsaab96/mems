import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeVoteSession } from "@/lib/api-serializers";
import { VoteSessionModel } from "@/lib/models";
import type { VoteValue } from "@/lib/entities";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();

    const body = (await request.json()) as { mediaId?: string; value?: VoteValue };
    if (!body.mediaId || (body.value !== "keep" && body.value !== "delete")) {
      return Response.json({ error: "Invalid vote" }, { status: 400 });
    }

    await VoteSessionModel.updateMany(
      { coupleId, "votes.mediaId": body.mediaId, "votes.voterUserId": userId },
      { $pull: { votes: { mediaId: body.mediaId, voterUserId: userId } } },
    );
    await VoteSessionModel.updateOne(
      { coupleId, mediaIds: body.mediaId },
      { $push: { votes: { mediaId: body.mediaId, voterUserId: userId, value: body.value } } },
    );

    const folders = await VoteSessionModel.find({ coupleId }).sort({ createdAt: -1 }).lean();
    return Response.json({ folders: folders.map(serializeVoteSession) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save vote" },
      { status: 500 },
    );
  }
}
