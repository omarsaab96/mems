"use client";

import { Album as AlbumIcon, Clock3, Heart, Vote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Albums } from "@/components/albums/Albums";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { AppShell } from "@/components/layout/AppShell";
import { MediaVoting } from "@/components/media/MediaVoting";
import { Memories } from "@/components/memories/Memories";
import { PartnerOnboarding } from "@/components/onboarding/PartnerOnboarding";
import { Timeline } from "@/components/timeline/Timeline";
import type { AppSection, AuthMode } from "@/lib/app-types";
import type {
  Album,
  AlbumChangeRequest,
  AlbumChangeRequestType,
  Couple,
  Media,
  Memory,
  TimelineItem,
  UploadTask,
  User,
  VoteSession,
  VoteValue,
} from "@/lib/entities";

type WorkspaceData = {
  currentUserId: string;
  couple: Couple | null;
  users: User[];
  media: Media[];
  voteSessions: VoteSession[];
  albums: Album[];
  albumChangeRequests: AlbumChangeRequest[];
  memories: Memory[];
  timeline: TimelineItem[];
};

type AuthCheck = {
  authenticated: boolean;
};

type PendingUpload = {
  id: string;
  file: File;
};

const uploadCompletionStallMs = 2500;

const emptyCouple: Couple = {
  id: "",
  partnerIds: ["", ""],
  displayName: "Mems",
  createdAt: "",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }

  return payload as T;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard");
  const [currentUserId, setCurrentUserId] = useState("");
  const [couple, setCouple] = useState<Couple>(emptyCouple);
  const [users, setUsers] = useState<User[]>([]);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [voteSessions, setVoteSessions] = useState<VoteSession[]>([]);
  const [activeVoteSessionId, setActiveVoteSessionId] = useState("");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumChangeRequests, setAlbumChangeRequests] = useState<AlbumChangeRequest[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileAvatarDraft, setProfileAvatarDraft] = useState("");
  const [profileError, setProfileError] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerInviteLink, setPartnerInviteLink] = useState("");
  const [partnerInvitedEmail, setPartnerInvitedEmail] = useState("");
  const [partnerInviteEmailSent, setPartnerInviteEmailSent] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isMediaUploadDragActive, setIsMediaUploadDragActive] = useState(false);
  const handleUploadRef = useRef<(files: FileList | File[] | null) => Promise<Media[]>>(async () => []);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [pendingApiCount, setPendingApiCount] = useState(0);
  const [workspaceError, setWorkspaceError] = useState("");

  const activeVoteSession =
    voteSessions.find((session) => session.id === activeVoteSessionId) ?? voteSessions[0];
  const voteMedia = activeVoteSession
    ? mediaItems.filter((item) => activeVoteSession.mediaIds.includes(item.id))
    : [];
  const sessionMediaIds = new Set(voteSessions.flatMap((session) => session.mediaIds));
  const latestAlbum = albums[0] ?? null;
  const albumMediaIds = new Set(albums.flatMap((album) => album.mediaIds));
  const pendingAlbumAddMediaIds = new Set(
    albumChangeRequests
      .filter((request) => request.status === "pending" && request.type === "add")
      .flatMap((request) => request.mediaIds),
  );
  const unsortedMedia = mediaItems.filter(
    (item) =>
      !sessionMediaIds.has(item.id) &&
      !albumMediaIds.has(item.id) &&
      !pendingAlbumAddMediaIds.has(item.id),
  );
  const albumMedia = latestAlbum
    ? mediaItems.filter((item) => latestAlbum.mediaIds.includes(item.id))
    : [];
  const comments = voteSessions.flatMap((session) => session.comments);
  const currentUser = users.find((user) => user.id === currentUserId) ?? null;
  const hasPartner = couple.partnerIds.filter(Boolean).length >= 2;
  const isApiPending = pendingApiCount > 0;

  const stats = useMemo(
    () => [
      { label: "Albums", value: albums.length, icon: AlbumIcon },
      { label: "Memories", value: memories.length, icon: Heart },
      { label: "Timeline", value: timeline.length, icon: Clock3 },
      {
        label: "Voting",
        value: voteSessions.reduce((total, session) => total + session.mediaIds.length, 0),
        icon: Vote,
      },
    ],
    [albums.length, memories.length, timeline.length, voteSessions],
  );

  const withApiLoader = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setPendingApiCount((count) => count + 1);
    try {
      return await operation();
    } finally {
      setPendingApiCount((count) => Math.max(0, count - 1));
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setIsLoadingWorkspace(true);
    setWorkspaceError("");

    try {
      const workspace = await withApiLoader(() =>
        requestJson<WorkspaceData>("/api/workspace", {
          cache: "no-store",
        }),
      );
      setCurrentUserId(workspace.currentUserId);
      setCouple(workspace.couple ?? emptyCouple);
      setUsers(workspace.users);
      setMediaItems(workspace.media);
      setVoteSessions(workspace.voteSessions);
      setActiveVoteSessionId((current) =>
        workspace.voteSessions.some((session) => session.id === current)
          ? current
          : workspace.voteSessions[0]?.id ?? "",
      );
      setAlbums(workspace.albums);
      setAlbumChangeRequests(workspace.albumChangeRequests);
      setMemories(workspace.memories);
      setTimeline(workspace.timeline);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        setIsAuthenticated(false);
        setWorkspaceError("");
      } else {
        setWorkspaceError(error instanceof Error ? error.message : "Failed to load workspace");
      }
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [withApiLoader]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const result = await withApiLoader(() =>
          requestJson<AuthCheck>("/api/auth/me", { cache: "no-store" }),
        );
        setIsAuthenticated(result.authenticated);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    void checkAuth();
  }, [withApiLoader]);

  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth) return;
    const timeoutId = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, isCheckingAuth, loadWorkspace]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    try {
      setWorkspaceError("");
      await withApiLoader(() =>
        requestJson<{ ok: boolean }>(
          authMode === "login" ? "/api/auth/login" : "/api/auth/register",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        ),
      );
      setIsAuthenticated(true);
      setActiveSection("dashboard");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  async function handleLogout() {
    await withApiLoader(() => requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }));
    setIsAuthenticated(false);
    setCurrentUserId("");
    setUsers([]);
    setMediaItems([]);
    setVoteSessions([]);
    setAlbums([]);
    setAlbumChangeRequests([]);
    setMemories([]);
    setTimeline([]);
    setPartnerEmail("");
    setPartnerInviteLink("");
    setPartnerInvitedEmail("");
    setPartnerInviteEmailSent(false);
    setOnboardingError("");
    setIsProfileModalOpen(false);
    setProfileNameDraft("");
    setProfileAvatarDraft("");
    setProfileError("");
    setActiveSection("dashboard");
  }

  function openProfileModal() {
    setProfileNameDraft(currentUser?.name ?? "");
    setProfileAvatarDraft(currentUser?.avatarUrl ?? "");
    setProfileError("");
    setIsProfileModalOpen(true);
  }

  async function submitProfileModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setProfileError("");
      const result = await withApiLoader(() =>
        requestJson<{ user: User }>("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileNameDraft,
            avatarUrl: profileAvatarDraft,
          }),
        }),
      );
      setUsers((items) => items.map((item) => (item.id === result.user.id ? result.user : item)));
      setIsProfileModalOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to update profile");
    }
  }

  async function handlePartnerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setOnboardingError("");
      const result = await withApiLoader(() =>
        requestJson<{
          invite: { inviteeEmail: string; inviteUrl: string };
          emailDelivery: { sent: boolean; reason?: string };
        }>("/api/partner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: partnerEmail }),
        }),
      );
      setPartnerInviteLink(result.invite.inviteUrl);
      setPartnerInvitedEmail(result.invite.inviteeEmail);
      setPartnerInviteEmailSent(result.emailDelivery.sent);
      setPartnerEmail("");
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : "Failed to set partner");
    }
  }

  function uploadFilesWithProgress(uploadItems: PendingUpload[]) {
    return new Promise<{ media: Media[] }>((resolve, reject) => {
      const formData = new FormData();
      uploadItems.forEach(({ file }) => formData.append("files", file));

      const request = new XMLHttpRequest();
      request.open("POST", "/api/media");
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.max(1, Math.round((event.loaded / event.total) * 100));
        const uploadIds = new Set(uploadItems.map((item) => item.id));
        setUploadTasks((tasks) =>
          tasks.map((task) =>
            uploadIds.has(task.id)
              ? { ...task, progress, status: progress >= 100 ? "processing" : "uploading" }
              : task,
          ),
        );
      };
      request.onload = () => {
        const payload = JSON.parse(request.responseText || "{}") as { media?: Media[]; error?: string };
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(payload.error || "Failed to upload media"));
          return;
        }
        resolve({ media: payload.media ?? [] });
      };
      request.onerror = () => reject(new Error("Failed to upload media"));
      request.send(formData);
    });
  }

  async function handleUpload(
    files: FileList | File[] | null,
    activeSectionAfterUpload: AppSection = "media",
  ): Promise<Media[]> {
    if (!files?.length) return [];
    const fileList = Array.from(files);
    const uploadItems = fileList.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`,
      file,
    }));
    const taskIds = new Set(uploadItems.map((item) => item.id));

    try {
      setWorkspaceError("");
      setUploadTasks((tasks) => [
        ...uploadItems.map(({ id, file }): UploadTask => ({
          id,
          name: file.name,
          type: file.type.startsWith("video/") ? "video" : "photo",
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: "uploading",
        })),
        ...tasks,
      ]);
      setActiveSection(activeSectionAfterUpload);

      const result = await withApiLoader(() => uploadFilesWithProgress(uploadItems));

      setUploadTasks((tasks) =>
        tasks.map((task) =>
          taskIds.has(task.id) ? { ...task, progress: 100, status: "done" } : task,
        ),
      );
      await delay(uploadCompletionStallMs);
      setUploadTasks((tasks) => {
        tasks
          .filter((task) => taskIds.has(task.id))
          .forEach((task) => URL.revokeObjectURL(task.previewUrl));
        return tasks.filter((task) => !taskIds.has(task.id));
      });
      setMediaItems((items) => [...result.media, ...items]);
      return result.media;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload media";
      setWorkspaceError(message);
      setUploadTasks((tasks) =>
        tasks.map((task) =>
          taskIds.has(task.id) ? { ...task, status: "error", error: message } : task,
        ),
      );
      return [];
    }
  }

  useEffect(() => {
    handleUploadRef.current = handleUpload;
  });

  function getMediaFiles(dataTransfer: DataTransfer) {
    return Array.from(dataTransfer.files).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
  }

  function hasFileDrag(dataTransfer: DataTransfer) {
    return Array.from(dataTransfer.types).includes("Files");
  }

  useEffect(() => {
    if (activeSection !== "media") return;

    function handleWindowDragOver(event: DragEvent) {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !hasFileDrag(dataTransfer)) return;

      event.preventDefault();
      event.stopPropagation();
      dataTransfer.dropEffect = "copy";
      setIsMediaUploadDragActive(true);
    }

    function handleWindowDragLeave(event: DragEvent) {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !hasFileDrag(dataTransfer)) return;

      const leftViewport =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight;
      if (leftViewport) {
        setIsMediaUploadDragActive(false);
      }
    }

    function handleWindowDrop(event: DragEvent) {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !hasFileDrag(dataTransfer)) return;

      event.preventDefault();
      event.stopPropagation();
      setIsMediaUploadDragActive(false);

      const files = getMediaFiles(dataTransfer);
      if (files.length) {
        void handleUploadRef.current(files);
      }
    }

    function handleWindowDragEnd() {
      setIsMediaUploadDragActive(false);
    }

    window.addEventListener("dragover", handleWindowDragOver, true);
    window.addEventListener("dragleave", handleWindowDragLeave, true);
    window.addEventListener("drop", handleWindowDrop, true);
    window.addEventListener("dragend", handleWindowDragEnd, true);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver, true);
      window.removeEventListener("dragleave", handleWindowDragLeave, true);
      window.removeEventListener("drop", handleWindowDrop, true);
      window.removeEventListener("dragend", handleWindowDragEnd, true);
      setIsMediaUploadDragActive(false);
    };
  }, [activeSection]);

  async function vote(mediaId: string, value: VoteValue) {
    const result = await withApiLoader(() =>
      requestJson<{ folders: VoteSession[] }>("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, value }),
      }),
    );
    setVoteSessions(result.folders);
  }

  async function addComment(mediaId: string) {
    const body = commentDrafts[mediaId]?.trim();
    if (!body) return;

    const result = await withApiLoader(() =>
      requestJson<{ folders: VoteSession[] }>("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, body }),
      }),
    );
    setVoteSessions(result.folders);
    setCommentDrafts((drafts) => ({ ...drafts, [mediaId]: "" }));
  }

  async function buildAlbumFromVotes(sessionId = activeVoteSessionId) {
    const result = await withApiLoader(() =>
      requestJson<{
        album: Album;
        folderId: string;
        deletedMediaIds: string[];
        albumedMediaIds: string[];
      }>("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: sessionId }),
      }),
    );
    const deletedMediaIds = new Set(result.deletedMediaIds);
    const albumedMediaIds = new Set(result.albumedMediaIds);
    const removedFolderId = result.folderId || sessionId;

    setAlbums((items) => [result.album, ...items.filter((item) => item.id !== result.album.id)]);
    setAlbumChangeRequests((requests) =>
      requests.filter((request) => request.albumId !== result.album.id),
    );
    setVoteSessions((sessions) => {
      const nextSessions = sessions.filter((session) => session.id !== removedFolderId);
      if (activeVoteSessionId === removedFolderId) {
        setActiveVoteSessionId(nextSessions[0]?.id ?? "");
      }
      return nextSessions;
    });
    setMediaItems((items) =>
      items
        .filter((item) => !deletedMediaIds.has(item.id))
        .map((item) => (albumedMediaIds.has(item.id) ? { ...item, status: "albumed" } : item)),
    );
    setActiveSection("albums");
  }

  async function deleteAlbum(albumId: string) {
    const result = await withApiLoader(() =>
      requestJson<{ ok: boolean; deleted: boolean; album?: Album }>(
        `/api/albums/${albumId}`,
        { method: "DELETE" },
      ),
    );
    if (result.deleted) {
      setAlbums((items) => items.filter((item) => item.id !== albumId));
      setAlbumChangeRequests((requests) => requests.filter((request) => request.albumId !== albumId));
      return;
    }
    if (result.album) {
      setAlbums((items) => items.map((item) => (item.id === result.album?.id ? result.album : item)));
    }
  }

  async function cancelAlbumDeletion(albumId: string) {
    const result = await withApiLoader(() =>
      requestJson<{ album: Album }>(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelDelete" }),
      }),
    );
    setAlbums((items) => items.map((item) => (item.id === result.album.id ? result.album : item)));
  }

  async function addAlbumComment(albumId: string, mediaId: string, body: string) {
    const result = await withApiLoader(() =>
      requestJson<{ album: Album }>(`/api/albums/${albumId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, body }),
      }),
    );
    setAlbums((items) => items.map((item) => (item.id === result.album.id ? result.album : item)));
  }

  async function updateAlbum(albumId: string, values: { title: string; description: string }) {
    const result = await withApiLoader(() =>
      requestJson<{ album: Album }>(`/api/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    );
    setAlbums((items) => items.map((item) => (item.id === result.album.id ? result.album : item)));
  }

  async function proposeAlbumChange(
    albumId: string,
    type: AlbumChangeRequestType,
    mediaIds: string[],
    options: { discardMediaOnReject?: boolean } = {},
  ) {
    const result = await withApiLoader(() =>
      requestJson<{ changeRequest: AlbumChangeRequest }>(`/api/albums/${albumId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, mediaIds, discardMediaOnReject: options.discardMediaOnReject }),
      }),
    );
    setAlbumChangeRequests((requests) => [
      result.changeRequest,
      ...requests.filter((request) => request.id !== result.changeRequest.id),
    ]);
  }

  async function voteAlbumChange(
    albumId: string,
    requestId: string,
    action: "approve" | "reject" | "cancel",
  ) {
    const result = await withApiLoader(() =>
      requestJson<{
        album?: Album;
        media?: Media[];
        deletedMediaIds?: string[];
        changeRequest: AlbumChangeRequest;
      }>(
        `/api/albums/${albumId}/changes/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      ),
    );
    setAlbumChangeRequests((requests) =>
      requests.map((request) =>
        request.id === result.changeRequest.id ? result.changeRequest : request,
      ),
    );
    if (result.album) {
      setAlbums((items) => items.map((item) => (item.id === result.album?.id ? result.album : item)));
    }
    if (result.media?.length) {
      const mediaById = new Map(result.media.map((item) => [item.id, item]));
      setMediaItems((items) => items.map((item) => mediaById.get(item.id) ?? item));
    }
    if (result.deletedMediaIds?.length) {
      const deletedIds = new Set(result.deletedMediaIds);
      setMediaItems((items) => items.filter((item) => !deletedIds.has(item.id)));
    }
  }

  async function createVoteSession(title: string) {
    const result = await withApiLoader(() =>
      requestJson<{ folder: VoteSession }>("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    );

    setVoteSessions((sessions) => [result.folder, ...sessions]);
    setActiveVoteSessionId(result.folder.id);
  }

  async function assignMediaToSessionBatch(mediaIds: string[], sessionId: string) {
    setVoteSessions((sessions) =>
      sessions.map((session) => {
        const remainingMediaIds = session.mediaIds.filter((mediaId) => !mediaIds.includes(mediaId));
        if (session.id !== sessionId) return { ...session, mediaIds: remainingMediaIds };
        return { ...session, mediaIds: [...mediaIds, ...remainingMediaIds] };
      }),
    );
    setActiveVoteSessionId(sessionId);

    try {
      const result = await withApiLoader(() =>
        requestJson<{ folders: VoteSession[] }>(`/api/folders/${sessionId}/media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaIds }),
        }),
      );
      setVoteSessions(result.folders);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to move media");
      void loadWorkspace();
    }
  }

  async function removeMediaFromVoteSessions(mediaIds: string[]) {
    setVoteSessions((sessions) =>
      sessions.map((session) => ({
        ...session,
        mediaIds: session.mediaIds.filter((mediaId) => !mediaIds.includes(mediaId)),
      })),
    );

    try {
      const result = await withApiLoader(() =>
        requestJson<{ folders: VoteSession[] }>("/api/folders/media", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaIds }),
        }),
      );
      setVoteSessions(result.folders);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to move media");
      void loadWorkspace();
    }
  }

  async function removeVoteSession(sessionId: string) {
    await withApiLoader(() =>
      requestJson<{ ok: boolean }>(`/api/folders/${sessionId}`, { method: "DELETE" }),
    );
    setVoteSessions((sessions) => {
      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      if (activeVoteSessionId === sessionId) {
        setActiveVoteSessionId(nextSessions[0]?.id ?? "");
      }
      return nextSessions;
    });
  }

  async function renameVoteSession(sessionId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;

    const result = await withApiLoader(() =>
      requestJson<{ folder: VoteSession }>(`/api/folders/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      }),
    );
    setVoteSessions((sessions) =>
      sessions.map((session) => (session.id === sessionId ? result.folder : session)),
    );
  }

  async function removeUploadedMedia(mediaId: string) {
    await withApiLoader(() =>
      requestJson<{ ok: boolean }>(`/api/media/${mediaId}`, { method: "DELETE" }),
    );
    setMediaItems((items) => items.filter((item) => item.id !== mediaId));
    setVoteSessions((sessions) =>
      sessions.map((session) => ({
        ...session,
        mediaIds: session.mediaIds.filter((id) => id !== mediaId),
        votes: session.votes.filter((item) => item.mediaId !== mediaId),
        comments: session.comments.filter((item) => item.mediaId !== mediaId),
      })),
    );
    setAlbums((items) =>
      items.map((album) => ({
        ...album,
        mediaIds: album.mediaIds.filter((id) => id !== mediaId),
      })),
    );
  }

  async function submitFolderModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createVoteSession(folderNameDraft.trim() || `Folder ${voteSessions.length + 1}`);
    setFolderNameDraft("");
    setIsFolderModalOpen(false);
    setActiveSection("media");
  }

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-sm font-semibold text-[#6b7177]">
        Loading...
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        onSubmit={handleAuthSubmit}
        error={workspaceError}
      />
    );
  }

  if (isLoadingWorkspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] text-sm font-semibold text-[#6b7177]">
        Loading workspace...
      </main>
    );
  }

  if (!hasPartner) {
    return (
      <PartnerOnboarding
        currentUser={currentUser}
        partnerEmail={partnerEmail}
        setPartnerEmail={setPartnerEmail}
        inviteLink={partnerInviteLink}
        invitedEmail={partnerInvitedEmail}
        emailSent={partnerInviteEmailSent}
        error={onboardingError}
        onSubmit={handlePartnerSubmit}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AppShell
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      onUpload={handleUpload}
      couple={couple}
      users={users}
      currentUserId={currentUserId}
      onOpenProfile={openProfileModal}
      onLogout={handleLogout}
    >
      {isApiPending && (
        <div className="fixed right-5 top-5 z-[70] inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d0c6] bg-white/95 px-3 text-sm font-semibold text-[#202124] shadow-lg backdrop-blur">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d8d0c6] border-t-[#1f7a7a]" />
          Syncing
        </div>
      )}

      {workspaceError && (
        <div className="mb-5 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-4 text-sm font-semibold text-[#9a3f34]">
          {workspaceError}
        </div>
      )}

      {isLoadingWorkspace && (
        <div className="rounded-md border border-[#e6e0d8] bg-white p-5 text-sm font-semibold text-[#6b7177]">
          Loading workspace...
        </div>
      )}

      {!isLoadingWorkspace && activeSection === "dashboard" && (
        <Dashboard
          stats={stats}
          album={latestAlbum}
          albumMedia={albumMedia}
          activeFolder={activeVoteSession ?? null}
          voteMedia={voteMedia}
          setActiveSection={setActiveSection}
        />
      )}

      {!isLoadingWorkspace && activeSection === "media" && (
        <div>
          <MediaVoting
            currentUserId={currentUserId}
            allMedia={mediaItems}
            users={users}
            voteMedia={voteMedia}
            voteSessions={voteSessions}
            activeSessionId={activeVoteSession?.id ?? ""}
            setActiveSessionId={setActiveVoteSessionId}
            unsortedMedia={unsortedMedia}
            uploadTasks={uploadTasks}
            isUploadDragActive={isMediaUploadDragActive}
            comments={comments}
            commentDrafts={commentDrafts}
            setCommentDrafts={setCommentDrafts}
            vote={vote}
            addComment={addComment}
            buildAlbumFromVotes={buildAlbumFromVotes}
            removeUploadedMedia={removeUploadedMedia}
            assignMediaToSessionBatch={assignMediaToSessionBatch}
            removeMediaFromVoteSessions={removeMediaFromVoteSessions}
            removeVoteSession={removeVoteSession}
            renameVoteSession={renameVoteSession}
            onAddFolder={() => setIsFolderModalOpen(true)}
            onUpload={handleUpload}
            partnerUserIds={couple.partnerIds.filter(Boolean)}
          />
        </div>
      )}

      {!isLoadingWorkspace && activeSection === "albums" && (
        <Albums
          albums={albums}
          mediaItems={mediaItems}
          onDeleteAlbum={deleteAlbum}
          onCancelAlbumDeletion={cancelAlbumDeletion}
          onAddAlbumComment={addAlbumComment}
          onUpdateAlbum={updateAlbum}
          onProposeAlbumChange={proposeAlbumChange}
          onVoteAlbumChange={voteAlbumChange}
          onUploadAlbumMedia={(files) => handleUpload(files, "albums")}
          albumChangeRequests={albumChangeRequests}
          availableMediaItems={unsortedMedia}
          currentUserId={currentUserId}
          users={users}
        />
      )}
      {!isLoadingWorkspace && activeSection === "memories" && <Memories memories={memories} />}
      {!isLoadingWorkspace && activeSection === "timeline" && <Timeline timeline={timeline} />}

      {isFolderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFolderModalOpen(false)}
        >
          <form
            onSubmit={submitFolderModal}
            className="w-full max-w-sm rounded-md bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Add folder</h3>
              <button
                type="button"
                title="Close"
                onClick={() => setIsFolderModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f4f1ec]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <input
              value={folderNameDraft}
              onChange={(event) => setFolderNameDraft(event.target.value)}
              placeholder="Folder name"
              autoFocus
              className="mt-4 w-full rounded-md border border-[#d8d0c6] px-3 py-2 text-sm outline-none focus:border-[#1f7a7a]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#202124] px-4 text-sm font-semibold text-white"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsProfileModalOpen(false)}
        >
          <form
            onSubmit={submitProfileModal}
            className="w-full max-w-sm rounded-md bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Profile settings</h3>
              <button
                type="button"
                title="Close"
                onClick={() => setIsProfileModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f4f1ec]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold">Name</span>
              <input
                value={profileNameDraft}
                onChange={(event) => setProfileNameDraft(event.target.value)}
                className="w-full rounded-md border border-[#d8d0c6] px-3 py-2 text-sm outline-none focus:border-[#1f7a7a]"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold">Avatar URL</span>
              <input
                value={profileAvatarDraft}
                onChange={(event) => setProfileAvatarDraft(event.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-[#d8d0c6] px-3 py-2 text-sm outline-none focus:border-[#1f7a7a]"
              />
            </label>
            {profileError && (
              <p className="mt-4 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                {profileError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#202124] px-4 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
