import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeVoteSession } from "@/lib/api-serializers";
import { VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();

    const body = (await request.json()) as { title?: string };
    const folder = await VoteSessionModel.create({
      coupleId,
      title: body.title?.trim() || "Folder",
      status: "open",
      mediaIds: [],
      invitedUserIds: [],
    });

    return Response.json({ folder: serializeVoteSession(folder.toObject()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create folder" },
      { status: 500 },
    );
  }
}
