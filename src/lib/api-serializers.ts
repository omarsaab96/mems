import type { Types } from "mongoose";
import type {
  Album,
  AlbumChangeRequest,
  AlbumChangeRequestStatus,
  AlbumChangeRequestType,
  AlbumChangeVote,
  AlbumChangeVoteValue,
  Couple,
  Media,
  MediaComment,
  MediaVote,
  Memory,
  TimelineItem,
  User,
  UserRole,
  VoteSession,
  VoteValue,
} from "@/lib/entities";

type DocumentRecord = {
  _id: Types.ObjectId;
  [key: string]: unknown;
};

function id(value: unknown) {
  return String(value ?? "");
}

function date(value: unknown) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function serializeUser(doc: DocumentRecord): User {
  return {
    id: id(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    avatarUrl: String(doc.avatarUrl ?? ""),
    role: (doc.role === "guest" ? "guest" : "partner") as UserRole,
  };
}

export function serializeCouple(doc: DocumentRecord): Couple {
  const partnerIds = Array.isArray(doc.partnerIds) ? doc.partnerIds.map(id) : [];
  return {
    id: id(doc._id),
    partnerIds: [partnerIds[0] ?? "", partnerIds[1] ?? ""],
    displayName: String(doc.displayName ?? "Mems"),
    createdAt: date(doc.createdAt),
  };
}

export function serializeMemory(doc: DocumentRecord): Memory {
  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    title: String(doc.title ?? ""),
    description: String(doc.description ?? ""),
    date: date(doc.date),
    location: String(doc.location ?? ""),
    coverMediaId: id(doc.coverMediaId),
  };
}

export function serializeMedia(doc: DocumentRecord): Media {
  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    uploadedByUserId: id(doc.uploadedByUserId),
    type: doc.type === "video" ? "video" : "photo",
    title: String(doc.title ?? ""),
    url: String(doc.url ?? ""),
    thumbnailUrl: doc.thumbnailUrl ? String(doc.thumbnailUrl) : undefined,
    capturedAt: date(doc.capturedAt),
    location: String(doc.location ?? ""),
    memoryId: doc.memoryId ? id(doc.memoryId) : undefined,
    status: doc.status === "uploaded" ||
      doc.status === "kept" ||
      doc.status === "deleted" ||
      doc.status === "albumed"
      ? doc.status
      : "in_review",
  };
}

export function serializeVoteSession(doc: DocumentRecord): VoteSession {
  const votes = Array.isArray(doc.votes) ? doc.votes : [];
  const comments = Array.isArray(doc.comments) ? doc.comments : [];

  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    title: String(doc.title ?? ""),
    status: doc.status === "open" || doc.status === "closed" ? doc.status : "draft",
    mediaIds: Array.isArray(doc.mediaIds) ? doc.mediaIds.map(id) : [],
    invitedUserIds: Array.isArray(doc.invitedUserIds) ? doc.invitedUserIds.map(id) : [],
    votes: votes.map((vote): MediaVote => {
      const record = vote as Record<string, unknown>;
      return {
        mediaId: id(record.mediaId),
        voterUserId: id(record.voterUserId),
        value: (record.value === "delete" ? "delete" : "keep") as VoteValue,
      };
    }),
    comments: comments.map((comment): MediaComment => {
      const record = comment as Record<string, unknown>;
      return {
        id: id(record._id),
        mediaId: id(record.mediaId),
        userId: id(record.userId),
        body: String(record.body ?? ""),
        createdAt: date(record.createdAt),
      };
    }),
  };
}

export function serializeAlbum(doc: DocumentRecord): Album {
  const comments = Array.isArray(doc.comments) ? doc.comments : [];

  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    title: String(doc.title ?? ""),
    description: String(doc.description ?? ""),
    coverMediaId: id(doc.coverMediaId),
    mediaIds: Array.isArray(doc.mediaIds) ? doc.mediaIds.map(id) : [],
    sourceVoteSessionId: doc.sourceVoteSessionId ? id(doc.sourceVoteSessionId) : undefined,
    deleteApprovalUserIds: Array.isArray(doc.deleteApprovalUserIds)
      ? doc.deleteApprovalUserIds.map(id)
      : [],
    comments: comments.map((comment): MediaComment => {
      const record = comment as Record<string, unknown>;
      return {
        id: id(record._id),
        mediaId: id(record.mediaId),
        userId: id(record.userId),
        body: String(record.body ?? ""),
        createdAt: date(record.createdAt),
      };
    }),
  };
}

export function serializeAlbumChangeRequest(doc: DocumentRecord): AlbumChangeRequest {
  const votes = Array.isArray(doc.votes) ? doc.votes : [];

  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    albumId: id(doc.albumId),
    type: (doc.type === "remove" ? "remove" : "add") as AlbumChangeRequestType,
    mediaIds: Array.isArray(doc.mediaIds) ? doc.mediaIds.map(id) : [],
    proposedByUserId: id(doc.proposedByUserId),
    discardMediaOnReject: Boolean(doc.discardMediaOnReject),
    status: (
      doc.status === "approved" ||
      doc.status === "rejected" ||
      doc.status === "cancelled"
        ? doc.status
        : "pending"
    ) as AlbumChangeRequestStatus,
    votes: votes.map((vote): AlbumChangeVote => {
      const record = vote as Record<string, unknown>;
      return {
        voterUserId: id(record.voterUserId),
        value: (record.value === "reject" ? "reject" : "approve") as AlbumChangeVoteValue,
      };
    }),
    createdAt: date(doc.createdAt),
    resolvedAt: date(doc.resolvedAt),
  };
}

export function serializeTimelineItem(doc: DocumentRecord): TimelineItem {
  return {
    id: id(doc._id),
    coupleId: id(doc.coupleId),
    type: doc.type === "photo" ||
      doc.type === "video" ||
      doc.type === "memory" ||
      doc.type === "album"
      ? doc.type
      : "text",
    title: String(doc.title ?? ""),
    body: String(doc.body ?? ""),
    date: date(doc.date),
    mediaIds: Array.isArray(doc.mediaIds) ? doc.mediaIds.map(id) : undefined,
    memoryId: doc.memoryId ? id(doc.memoryId) : undefined,
    albumId: doc.albumId ? id(doc.albumId) : undefined,
  };
}
