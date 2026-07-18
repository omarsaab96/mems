import mongoose, { Schema, type Model, type models } from "mongoose";

const timestamps = { timestamps: true };

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    avatarUrl: String,
    role: { type: String, enum: ["partner", "guest"], default: "partner" },
  },
  timestamps,
);

const coupleSchema = new Schema(
  {
    partnerIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    displayName: { type: String, required: true },
  },
  timestamps,
);

const memorySchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true },
    title: { type: String, required: true },
    description: String,
    date: Date,
    location: String,
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  timestamps,
);

const mediaSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["photo", "video"], required: true },
    title: String,
    url: { type: String, required: true },
    storageKey: String,
    thumbnailUrl: String,
    capturedAt: Date,
    location: String,
    memoryId: { type: Schema.Types.ObjectId, ref: "Memory" },
    status: {
      type: String,
      enum: ["uploaded", "in_review", "kept", "deleted", "albumed"],
      default: "uploaded",
    },
  },
  timestamps,
);

const voteSessionSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ["draft", "open", "closed"], default: "draft" },
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    invitedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    votes: [
      {
        mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
        voterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        value: { type: String, enum: ["keep", "delete"], required: true },
      },
    ],
    comments: [
      {
        mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        body: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  timestamps,
);

const albumSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true },
    title: { type: String, required: true },
    description: String,
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    sourceVoteSessionId: { type: Schema.Types.ObjectId, ref: "VoteSession" },
    deleteApprovalUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        body: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  timestamps,
);

const timelineItemSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true },
    type: { type: String, enum: ["text", "photo", "video", "memory", "album"], required: true },
    title: String,
    body: String,
    date: Date,
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    memoryId: { type: Schema.Types.ObjectId, ref: "Memory" },
    albumId: { type: Schema.Types.ObjectId, ref: "Album" },
  },
  timestamps,
);

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, default: Date.now },
  },
  timestamps,
);

const partnerInviteSchema = new Schema(
  {
    inviterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    inviteeEmail: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    acceptedAt: Date,
    declinedAt: Date,
  },
  timestamps,
);

const registry = mongoose.models as typeof models & Record<string, Model<unknown>>;

function modelWithSchema(
  name: string,
  schema: Schema,
  requiredPaths: string[] = [],
) {
  const existing = registry[name];
  const isStale = existing && requiredPaths.some((path) => !existing.schema.path(path));

  if (isStale) {
    mongoose.deleteModel(name);
    delete registry[name];
  }

  return registry[name] || mongoose.model(name, schema);
}

export const UserModel = modelWithSchema("User", userSchema, ["passwordHash"]);
export const CoupleModel = modelWithSchema("Couple", coupleSchema);
export const MemoryModel = modelWithSchema("Memory", memorySchema);
export const MediaModel = modelWithSchema("Media", mediaSchema);
export const VoteSessionModel = modelWithSchema("VoteSession", voteSessionSchema);
export const AlbumModel = modelWithSchema("Album", albumSchema);
export const TimelineItemModel = modelWithSchema("TimelineItem", timelineItemSchema);
export const SessionModel = modelWithSchema("Session", sessionSchema, [
  "tokenHash",
  "expiresAt",
]);
export const PartnerInviteModel = modelWithSchema("PartnerInvite", partnerInviteSchema, [
  "inviteeEmail",
  "tokenHash",
  "status",
]);
