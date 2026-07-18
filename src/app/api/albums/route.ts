import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeAlbum } from "@/lib/api-serializers";
import { AlbumModel, CoupleModel, MediaModel, VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

type AlbumMediaDecision = {
  mediaId: unknown;
  decision: "keep" | "delete" | "conflict";
};

export async function POST(request: Request) {
  try {
    await connectDb();
    const { coupleId } = await requireAuthContext();
    const body = (await request.json()) as { folderId?: string };
    if (!body.folderId) return Response.json({ error: "Folder is required" }, { status: 400 });

    const folder = await VoteSessionModel.findOne({ _id: body.folderId, coupleId }).lean();
    if (!folder) return Response.json({ error: "Folder not found" }, { status: 404 });

    const couple = await CoupleModel.findOne({ _id: coupleId }).lean();
    const partnerIds = Array.isArray(couple?.partnerIds)
      ? (couple.partnerIds as unknown[]).map((partnerId) => String(partnerId)).filter(Boolean)
      : [];
    if (partnerIds.length < 2) {
      return Response.json(
        { error: "Both partners must be connected before creating an album" },
        { status: 409 },
      );
    }

    const partnerVotes = new Map<string, Map<string, "keep" | "delete">>();
    const votes = Array.isArray(folder.votes) ? folder.votes : [];
    votes.forEach((vote: Record<string, unknown>) => {
      const mediaId = String(vote.mediaId ?? "");
      const voterUserId = String(vote.voterUserId ?? "");
      if (!partnerIds.includes(voterUserId)) return;

      const votesByUser = partnerVotes.get(mediaId) ?? new Map<string, "keep" | "delete">();
      votesByUser.set(voterUserId, vote.value === "delete" ? "delete" : "keep");
      partnerVotes.set(mediaId, votesByUser);
    });

    const mediaIds = Array.isArray(folder.mediaIds) ? folder.mediaIds : [];
    const decisions: AlbumMediaDecision[] = mediaIds.map((mediaId: unknown) => {
      const id = String(mediaId);
      const votesByUser = partnerVotes.get(id);
      const requiredVotes = partnerIds.map((partnerId) => votesByUser?.get(partnerId));

      if (requiredVotes.some((value) => !value)) return { mediaId, decision: "conflict" };
      if (requiredVotes.every((value) => value === "keep")) return { mediaId, decision: "keep" };
      if (requiredVotes.every((value) => value === "delete")) return { mediaId, decision: "delete" };
      return { mediaId, decision: "conflict" };
    });
    const conflicts = decisions.filter((item) => item.decision === "conflict");
    if (conflicts.length) {
      return Response.json(
        {
          error: "Resolve all conflicts before creating an album",
          conflicts: conflicts.map((item) => String(item.mediaId)),
        },
        { status: 409 },
      );
    }

    const keepers = decisions
      .filter((item) => item.decision === "keep")
      .map((item) => item.mediaId);
    const keeperIds = new Set(keepers.map((mediaId) => String(mediaId)));
    const deletedMediaIds = decisions
      .filter((item) => item.decision === "delete")
      .map((item) => item.mediaId);
    const comments = Array.isArray(folder.comments) ? folder.comments : [];
    const albumComments = comments
      .filter((comment: Record<string, unknown>) => keeperIds.has(String(comment.mediaId ?? "")))
      .map((comment: Record<string, unknown>) => ({
        mediaId: comment.mediaId,
        userId: comment.userId,
        body: String(comment.body ?? ""),
        createdAt: comment.createdAt ?? new Date(),
      }));

    const album = await AlbumModel.create({
      coupleId,
      title: `${folder.title}`,
      description: "Created from folder votes.",
      coverMediaId: keepers[0],
      mediaIds: keepers,
      sourceVoteSessionId: folder._id,
      comments: albumComments,
    });

    await Promise.all([
      VoteSessionModel.deleteOne({ _id: folder._id, coupleId }),
      MediaModel.updateMany({ _id: { $in: keepers }, coupleId }, { $set: { status: "albumed" } }),
      deletedMediaIds.length
        ? MediaModel.deleteMany({ _id: { $in: deletedMediaIds }, coupleId })
        : Promise.resolve(),
    ]);

    return Response.json({
      album: serializeAlbum(album.toObject()),
      folderId: String(folder._id),
      deletedMediaIds: deletedMediaIds.map((mediaId) => String(mediaId)),
      albumedMediaIds: keepers.map((mediaId) => String(mediaId)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create album" },
      { status: 500 },
    );
  }
}
