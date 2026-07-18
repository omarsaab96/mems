import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeVoteSession } from "@/lib/api-serializers";
import { VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();

    const body = (await request.json()) as { mediaId?: string; body?: string };
    const commentBody = body.body?.trim();
    if (!body.mediaId || !commentBody) {
      return Response.json({ error: "Comment body is required" }, { status: 400 });
    }

    await VoteSessionModel.updateOne(
      { coupleId, mediaIds: body.mediaId },
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
    );

    const folders = await VoteSessionModel.find({ coupleId }).sort({ createdAt: -1 }).lean();
    return Response.json({ folders: folders.map(serializeVoteSession) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to add comment" },
      { status: 500 },
    );
  }
}
