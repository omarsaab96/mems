import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { deleteStoredMediaFile } from "@/lib/media-storage";
import { serializeAlbum, serializeAlbumChangeRequest, serializeMedia } from "@/lib/api-serializers";
import { AlbumChangeRequestModel, AlbumModel, CoupleModel, MediaModel } from "@/lib/models";

export const runtime = "nodejs";

type ChangeVoteBody = {
  action?: "approve" | "reject" | "cancel";
};

type SerializableAlbumDocument = {
  coverMediaId?: unknown;
  mediaIds: unknown[];
  save: () => Promise<unknown>;
  toObject: () => { _id: Types.ObjectId; [key: string]: unknown };
};

type SerializableMediaDocument = {
  _id: Types.ObjectId;
  [key: string]: unknown;
};

type StoredMediaDocument = {
  storageKey?: unknown;
  thumbnailStorageKey?: unknown;
};

async function partnerIdsFor(coupleId: unknown, userId: unknown) {
  const couple = await CoupleModel.findOne({ _id: coupleId }).lean();
  const partnerIds = Array.isArray(couple?.partnerIds)
    ? (couple.partnerIds as unknown[]).map((partnerId) => String(partnerId)).filter(Boolean)
    : [];

  if (!partnerIds.includes(String(userId))) {
    throw new Error("Only partners can vote on album changes");
  }
  if (partnerIds.length < 2) {
    throw new Error("Both partners must be connected before changing an album");
  }

  return partnerIds;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string; requestId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { albumId, requestId } = await params;
    const body = (await request.json()) as ChangeVoteBody;
    const action = body.action;

    if (action !== "approve" && action !== "reject" && action !== "cancel") {
      return Response.json({ error: "Action is required" }, { status: 400 });
    }

    const [changeRequest, partnerIds] = await Promise.all([
      AlbumChangeRequestModel.findOne({ _id: requestId, albumId, coupleId }),
      partnerIdsFor(coupleId, userId),
    ]);
    if (!changeRequest) return Response.json({ error: "Album change request not found" }, { status: 404 });
    if (changeRequest.status !== "pending") {
      return Response.json({ error: "Album change request is already resolved" }, { status: 409 });
    }

    const currentUserId = String(userId);
    if (action === "cancel") {
      if (String(changeRequest.proposedByUserId) !== currentUserId) {
        return Response.json({ error: "Only the proposer can cancel this request" }, { status: 403 });
      }
      changeRequest.status = "cancelled";
      changeRequest.resolvedAt = new Date();
      await changeRequest.save();
      return Response.json({
        changeRequest: serializeAlbumChangeRequest(changeRequest.toObject()),
      });
    }

    const votes = Array.isArray(changeRequest.votes) ? changeRequest.votes : [];
    changeRequest.votes = [
      ...votes.filter((vote: Record<string, unknown>) => String(vote.voterUserId) !== currentUserId),
      { voterUserId: userId, value: action },
    ];

    let album: SerializableAlbumDocument | null = null;
    let media: SerializableMediaDocument[] = [];
    let deletedMediaIds: string[] = [];
    if (action === "reject") {
      changeRequest.status = "rejected";
      changeRequest.resolvedAt = new Date();
      if (changeRequest.type === "add" && changeRequest.discardMediaOnReject) {
        const mediaToDelete = (await MediaModel.find({
          _id: { $in: changeRequest.mediaIds },
          coupleId,
        })
          .select("storageKey thumbnailStorageKey")
          .lean()) as StoredMediaDocument[];
        await MediaModel.deleteMany({ _id: { $in: changeRequest.mediaIds }, coupleId });
        deletedMediaIds = changeRequest.mediaIds.map((mediaId: unknown) => String(mediaId));
        await Promise.all(
          mediaToDelete.flatMap((item) => [
            deleteStoredMediaFile(item.storageKey),
            deleteStoredMediaFile(item.thumbnailStorageKey),
          ]),
        );
      }
    } else {
      const approvals = new Set(
        changeRequest.votes
          .filter((vote: Record<string, unknown>) => vote.value === "approve")
          .map((vote: Record<string, unknown>) => String(vote.voterUserId)),
      );
      const hasBothApprovals = partnerIds.every((partnerId) => approvals.has(partnerId));

      if (hasBothApprovals) {
        changeRequest.status = "approved";
        changeRequest.resolvedAt = new Date();

        if (changeRequest.type === "add") {
          album = (await AlbumModel.findOneAndUpdate(
            { _id: albumId, coupleId },
            { $addToSet: { mediaIds: { $each: changeRequest.mediaIds } } },
            { new: true },
          )) as SerializableAlbumDocument | null;
          await MediaModel.updateMany(
            { _id: { $in: changeRequest.mediaIds }, coupleId },
            { $set: { status: "albumed" } },
          );
        } else {
          album = (await AlbumModel.findOneAndUpdate(
            { _id: albumId, coupleId },
            { $pull: { mediaIds: { $in: changeRequest.mediaIds } } },
            { new: true },
          )) as SerializableAlbumDocument | null;
          await MediaModel.updateMany(
            { _id: { $in: changeRequest.mediaIds }, coupleId },
            { $set: { status: "kept" } },
          );

          if (album) {
            const coverMediaId = album.coverMediaId;
            const removedCover = changeRequest.mediaIds.some(
              (mediaId: unknown) => String(mediaId) === String(coverMediaId),
            );
            if (removedCover) {
              album.coverMediaId = album.mediaIds[0];
              await album.save();
            }
          }
        }

        media = (await MediaModel.find({ _id: { $in: changeRequest.mediaIds }, coupleId }).lean()) as SerializableMediaDocument[];
      }
    }

    await changeRequest.save();

    return Response.json({
      album: album ? serializeAlbum(album.toObject()) : undefined,
      media: media.map(serializeMedia),
      deletedMediaIds,
      changeRequest: serializeAlbumChangeRequest(changeRequest.toObject()),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    const message = error instanceof Error ? error.message : "Failed to update album change";
    const status = message.startsWith("Only partners") ? 403 : message.startsWith("Both partners") ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
