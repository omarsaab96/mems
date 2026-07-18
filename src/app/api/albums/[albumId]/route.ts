import { connectDb } from "@/lib/db";
import { requireAuthContext, unauthorizedResponse } from "@/lib/auth";
import { serializeAlbum } from "@/lib/api-serializers";
import { AlbumModel, CoupleModel } from "@/lib/models";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { albumId } = await params;
    const body = (await request.json()) as { action?: string };

    if (body.action !== "cancelDelete") {
      return Response.json({ error: "Unsupported album action" }, { status: 400 });
    }

    const album = await AlbumModel.findOne({ _id: albumId, coupleId });
    if (!album) return Response.json({ error: "Album not found" }, { status: 404 });

    album.deleteApprovalUserIds = (Array.isArray(album.deleteApprovalUserIds)
      ? (album.deleteApprovalUserIds as unknown[])
      : []
    ).filter((approvalUserId) => String(approvalUserId) !== String(userId));
    await album.save();

    return Response.json({ album: serializeAlbum(album.toObject()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update album" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    await connectDb();
    const { userId, coupleId } = await requireAuthContext();
    const { albumId } = await params;

    const [album, couple] = await Promise.all([
      AlbumModel.findOne({ _id: albumId, coupleId }),
      CoupleModel.findOne({ _id: coupleId }).lean(),
    ]);
    if (!album) {
      return Response.json({ error: "Album not found" }, { status: 404 });
    }

    const currentUserId = String(userId);
    const partnerIds = Array.isArray(couple?.partnerIds)
      ? (couple.partnerIds as unknown[]).map((partnerId) => String(partnerId)).filter(Boolean)
      : [];
    if (!partnerIds.includes(currentUserId)) {
      return Response.json({ error: "Only partners can approve album deletion" }, { status: 403 });
    }
    if (partnerIds.length < 2) {
      return Response.json(
        { error: "Both partners must be connected before deleting an album" },
        { status: 409 },
      );
    }

    const approvals = new Set(
      (Array.isArray(album.deleteApprovalUserIds)
        ? (album.deleteApprovalUserIds as unknown[])
        : []
      ).map((id) => String(id)),
    );
    approvals.add(currentUserId);

    const hasBothApprovals = partnerIds.every((partnerId) => approvals.has(partnerId));
    if (hasBothApprovals) {
      await AlbumModel.deleteOne({ _id: albumId, coupleId });
      return Response.json({ ok: true, deleted: true });
    }

    album.deleteApprovalUserIds = Array.from(approvals);
    await album.save();

    return Response.json({
      ok: true,
      deleted: false,
      album: serializeAlbum(album.toObject()),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete album" },
      { status: 500 },
    );
  }
}
