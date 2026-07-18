export type UserRole = "partner" | "guest";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
};

export type Couple = {
  id: string;
  partnerIds: [string, string];
  displayName: string;
  createdAt: string;
};

export type Memory = {
  id: string;
  coupleId: string;
  title: string;
  description: string;
  date: string;
  location: string;
  coverMediaId: string;
};

export type MediaType = "photo" | "video";
export type MediaStatus = "uploaded" | "in_review" | "kept" | "deleted" | "albumed";

export type Media = {
  id: string;
  coupleId: string;
  uploadedByUserId: string;
  type: MediaType;
  title: string;
  url: string;
  capturedAt: string;
  location: string;
  memoryId?: string;
  status: MediaStatus;
};

export type UploadTask = {
  id: string;
  name: string;
  type: MediaType;
  previewUrl: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
};

export type VoteValue = "keep" | "delete";

export type MediaVote = {
  mediaId: string;
  voterUserId: string;
  value: VoteValue;
};

export type MediaComment = {
  id: string;
  mediaId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type VoteSession = {
  id: string;
  coupleId: string;
  title: string;
  status: "draft" | "open" | "closed";
  mediaIds: string[];
  invitedUserIds: string[];
  votes: MediaVote[];
  comments: MediaComment[];
};

export type Album = {
  id: string;
  coupleId: string;
  title: string;
  description: string;
  coverMediaId: string;
  mediaIds: string[];
  sourceVoteSessionId?: string;
  deleteApprovalUserIds: string[];
  comments: MediaComment[];
};

export type TimelineItemType = "text" | "photo" | "video" | "memory" | "album";

export type TimelineItem = {
  id: string;
  coupleId: string;
  type: TimelineItemType;
  title: string;
  body: string;
  date: string;
  mediaIds?: string[];
  memoryId?: string;
  albumId?: string;
};
