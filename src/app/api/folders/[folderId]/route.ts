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
    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim();
    if (!title) {
      return Response.json({ error: "Folder name is required" }, { status: 400 });
    }

    const folder = await VoteSessionModel.findOneAndUpdate(
      { _id: folderId, coupleId },
      { $set: { title } },
      { new: true },
    );
    if (!folder) return Response.json({ error: "Folder not found" }, { status: 404 });

    return Response.json({ folder: serializeVoteSession(folder.toObject()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to rename folder" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const { folderId } = await params;
    await VoteSessionModel.deleteOne({ _id: folderId, coupleId });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete folder" },
      { status: 500 },
    );
  }
}
