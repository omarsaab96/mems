import { findActiveCoupleForUser, requireUserContext, unauthorizedResponse } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import {
  serializeAlbum,
  serializeAlbumChangeRequest,
  serializeCouple,
  serializeMedia,
  serializeMemory,
  serializeTimelineItem,
  serializeUser,
  serializeVoteSession,
} from "@/lib/api-serializers";
import { AlbumChangeRequestModel, AlbumModel, MediaModel, MemoryModel, TimelineItemModel, UserModel, VoteSessionModel } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDb();
    const context = await requireUserContext();
    const [user, couple] = await Promise.all([
      UserModel.findById(context.userId).lean(),
      findActiveCoupleForUser(context.userId),
    ]);
    if (!user) return unauthorizedResponse();

    if (!couple) {
      return Response.json({
        currentUserId: String(user._id),
        couple: null,
        users: [serializeUser(user)],
        media: [],
        voteSessions: [],
        albums: [],
        albumChangeRequests: [],
        memories: [],
        timeline: [],
      });
    }

    const coupleId = couple._id;

    const [users, media, voteSessions, albums, albumChangeRequests, memories, timeline] = await Promise.all([
      UserModel.find().sort({ createdAt: 1 }).lean(),
      MediaModel.find({ coupleId }).sort({ createdAt: -1 }).lean(),
      VoteSessionModel.find({ coupleId }).sort({ createdAt: -1 }).lean(),
      AlbumModel.find({ coupleId }).sort({ createdAt: -1 }).lean(),
      AlbumChangeRequestModel.find({ coupleId }).sort({ createdAt: -1 }).lean(),
      MemoryModel.find({ coupleId }).sort({ date: -1 }).lean(),
      TimelineItemModel.find({ coupleId }).sort({ date: -1 }).lean(),
    ]);

    return Response.json({
      currentUserId: String(user._id),
        couple: serializeCouple(couple.toObject()),
      users: users.map(serializeUser),
      media: media.map(serializeMedia),
      voteSessions: voteSessions.map(serializeVoteSession),
      albums: albums.map(serializeAlbum),
      albumChangeRequests: albumChangeRequests.map(serializeAlbumChangeRequest),
      memories: memories.map(serializeMemory),
      timeline: timeline.map(serializeTimelineItem),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load workspace" },
      { status: 500 },
    );
  }
}
