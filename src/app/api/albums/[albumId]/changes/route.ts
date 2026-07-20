import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeAlbumChangeRequest } from "@/lib/api-serializers";
import { AlbumChangeRequestModel, AlbumModel, CoupleModel, MediaModel } from "@/lib/models";

export const runtime = "nodejs";

type ChangeRequestBody = {
  type?: "add" | "remove";
  mediaIds?: string[];
  discardMediaOnReject?: boolean;
};

async function requirePartnerIds(coupleId: unknown, userId: unknown) {
  const couple = await CoupleModel.findOne({ _id: coupleId }).lean();
  const partnerIds = Array.isArray(couple?.partnerIds)
    ? (couple.partnerIds as unknown[]).map((partnerId) => String(partnerId)).filter(Boolean)
    : [];

  if (!partnerIds.includes(String(userId))) {
    throw new Error("Only partners can propose album changes");
  }
  if (partnerIds.length < 2) {
    throw new Error("Both partners must be connected before changing an album");
  }

  return partnerIds;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { albumId } = await params;
    const body = (await request.json()) as ChangeRequestBody;
    const type = body.type;
    const mediaIds = Array.from(new Set(body.mediaIds ?? [])).filter(Boolean);

    if (type !== "add" && type !== "remove") {
      return Response.json({ error: "Change type is required" }, { status: 400 });
    }
    if (!mediaIds.length) {
      return Response.json({ error: "Select at least one media item" }, { status: 400 });
    }

    const [album] = await Promise.all([
      AlbumModel.findOne({ _id: albumId, coupleId }).lean(),
      requirePartnerIds(coupleId, userId),
    ]);
    if (!album) return Response.json({ error: "Album not found" }, { status: 404 });

    const albumMediaIds = new Set(
      (Array.isArray(album.mediaIds) ? album.mediaIds : []).map((mediaId: unknown) => String(mediaId)),
    );
    const invalidMediaIds =
      type === "add"
        ? mediaIds.filter((mediaId) => albumMediaIds.has(mediaId))
        : mediaIds.filter((mediaId) => !albumMediaIds.has(mediaId));
    if (invalidMediaIds.length) {
      return Response.json({ error: "Selected media does not match this album change" }, { status: 400 });
    }

    const mediaCount = await MediaModel.countDocuments({ _id: { $in: mediaIds }, coupleId });
    if (mediaCount !== mediaIds.length) {
      return Response.json({ error: "Some media was not found" }, { status: 404 });
    }

    const existingPending = await AlbumChangeRequestModel.findOne({
      albumId,
      coupleId,
      status: "pending",
      mediaIds: { $in: mediaIds },
    }).lean();
    if (existingPending) {
      return Response.json({ error: "One of these media items already has a pending album change" }, { status: 409 });
    }

    const changeRequest = await AlbumChangeRequestModel.create({
      coupleId,
      albumId,
      type,
      mediaIds,
      proposedByUserId: userId,
      discardMediaOnReject: type === "add" && Boolean(body.discardMediaOnReject),
      votes: [{ voterUserId: userId, value: "approve" }],
    });

    return Response.json({
      changeRequest: serializeAlbumChangeRequest(changeRequest.toObject()),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    const message = error instanceof Error ? error.message : "Failed to propose album change";
    const status = message.startsWith("Only partners") ? 403 : message.startsWith("Both partners") ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
