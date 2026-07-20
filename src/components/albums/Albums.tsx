"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { MediaMosaic } from "@/components/albums/MediaMosaic";
import { MediaPreview } from "@/components/media/MediaPreview";
import type { Album, AlbumChangeRequest, AlbumChangeRequestType, Media, User } from "@/lib/entities";
import { formatDate } from "@/lib/utils";

export function Albums({
  albums,
  mediaItems,
  onDeleteAlbum,
  onCancelAlbumDeletion,
  onAddAlbumComment,
  onUpdateAlbum,
  onProposeAlbumChange,
  onVoteAlbumChange,
  onUploadAlbumMedia,
  albumChangeRequests,
  availableMediaItems,
  currentUserId,
  users,
}: {
  albums: Album[];
  mediaItems: Media[];
  onDeleteAlbum: (albumId: string) => Promise<void>;
  onCancelAlbumDeletion: (albumId: string) => Promise<void>;
  onAddAlbumComment: (albumId: string, mediaId: string, body: string) => Promise<void>;
  onUpdateAlbum: (albumId: string, values: { title: string; description: string }) => Promise<void>;
  onProposeAlbumChange: (
    albumId: string,
    type: AlbumChangeRequestType,
    mediaIds: string[],
    options?: { discardMediaOnReject?: boolean },
  ) => Promise<void>;
  onVoteAlbumChange: (
    albumId: string,
    requestId: string,
    action: "approve" | "reject" | "cancel",
  ) => Promise<void>;
  onUploadAlbumMedia: (files: FileList | null) => Promise<Media[]>;
  albumChangeRequests: AlbumChangeRequest[];
  availableMediaItems: Media[];
  currentUserId: string;
  users: User[];
}) {
  const [confirmingAlbumId, setConfirmingAlbumId] = useState<string | null>(null);
  const [previewAlbumId, setPreviewAlbumId] = useState<string | null>(null);
  const [previewRequestId, setPreviewRequestId] = useState<string | null>(null);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentError, setCommentError] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [busyAlbumId, setBusyAlbumId] = useState<string | null>(null);
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);
  const [deleteErrorByAlbumId, setDeleteErrorByAlbumId] = useState<Record<string, string>>({});
  const [selectedMediaByAlbumId, setSelectedMediaByAlbumId] = useState<Record<string, Set<string>>>({});
  const [selectedAddMediaByAlbumId, setSelectedAddMediaByAlbumId] = useState<Record<string, Set<string>>>({});
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumTitleDraft, setAlbumTitleDraft] = useState("");
  const [albumDescriptionDraft, setAlbumDescriptionDraft] = useState("");
  const [albumEditError, setAlbumEditError] = useState("");
  const [albumChangeErrorByAlbumId, setAlbumChangeErrorByAlbumId] = useState<Record<string, string>>({});
  const confirmingAlbum = albums.find((album) => album.id === confirmingAlbumId) ?? null;
  const currentUserApprovedDelete =
    confirmingAlbum?.deleteApprovalUserIds.includes(currentUserId) ?? false;
  const previewAlbum = albums.find((album) => album.id === previewAlbumId) ?? null;
  const previewRequest =
    albumChangeRequests.find((request) => request.id === previewRequestId) ?? null;
  const previewMediaItems = previewRequest
    ? requestMedia(previewRequest)
    : previewAlbum
      ? albumMedia(previewAlbum)
      : [];
  const previewMedia = previewMediaItems.find((item) => item.id === previewMediaId) ?? null;
  const previewMediaIndex = previewMedia
    ? previewMediaItems.findIndex((item) => item.id === previewMedia.id)
    : -1;
  const canNavigatePreview = previewMediaIndex >= 0 && previewMediaItems.length > 1;
  const previewComments =
    previewAlbum && previewMedia && !previewRequest
      ? previewAlbum.comments.filter((comment) => comment.mediaId === previewMedia.id)
      : [];

  useEffect(() => {
    if (!previewMedia || !canNavigatePreview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousPreview();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextPreview();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function albumMedia(album: Album) {
    return mediaItems.filter((item) => album.mediaIds.includes(item.id));
  }

  function selectedAlbumMediaIds(albumId: string) {
    return selectedMediaByAlbumId[albumId] ?? new Set<string>();
  }

  function selectedAddMediaIds(albumId: string) {
    return selectedAddMediaByAlbumId[albumId] ?? new Set<string>();
  }

  function toggleAlbumMediaSelection(albumId: string, mediaId: string) {
    setSelectedMediaByAlbumId((selectedByAlbum) => {
      const next = new Set(selectedByAlbum[albumId] ?? []);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return { ...selectedByAlbum, [albumId]: next };
    });
  }

  function setAlbumMediaSelection(albumId: string, mediaIds: string[]) {
    setSelectedMediaByAlbumId((selectedByAlbum) => ({
      ...selectedByAlbum,
      [albumId]: new Set(mediaIds),
    }));
  }

  function toggleAddMediaSelection(albumId: string, mediaId: string) {
    setSelectedAddMediaByAlbumId((selectedByAlbum) => {
      const next = new Set(selectedByAlbum[albumId] ?? []);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return { ...selectedByAlbum, [albumId]: next };
    });
  }

  function clearAlbumChangeError(albumId: string) {
    setAlbumChangeErrorByAlbumId((errors) => {
      const next = { ...errors };
      delete next[albumId];
      return next;
    });
  }

  function albumPendingChanges(albumId: string) {
    return albumChangeRequests.filter(
      (request) => request.albumId === albumId && request.status === "pending",
    );
  }

  function requestMedia(request: AlbumChangeRequest) {
    return request.mediaIds.flatMap((mediaId) => {
      const item = mediaItems.find((media) => media.id === mediaId);
      return item ? [item] : [];
    });
  }

  function userName(userId: string) {
    return users.find((user) => user.id === userId)?.name ?? "Mems user";
  }

  async function proposeChange(albumId: string, type: AlbumChangeRequestType, ids: string[]) {
    if (!ids.length) return;

    try {
      setBusyAlbumId(albumId);
      clearAlbumChangeError(albumId);
      await onProposeAlbumChange(albumId, type, ids);
      if (type === "add") {
        setSelectedAddMediaByAlbumId((selectedByAlbum) => ({ ...selectedByAlbum, [albumId]: new Set() }));
      } else {
        setSelectedMediaByAlbumId((selectedByAlbum) => ({ ...selectedByAlbum, [albumId]: new Set() }));
      }
    } catch (error) {
      setAlbumChangeErrorByAlbumId((errors) => ({
        ...errors,
        [albumId]: error instanceof Error ? error.message : "Failed to propose album change",
      }));
    } finally {
      setBusyAlbumId(null);
    }
  }

  async function updateChangeRequest(
    request: AlbumChangeRequest,
    action: "approve" | "reject" | "cancel",
  ) {
    try {
      setBusyAlbumId(request.albumId);
      clearAlbumChangeError(request.albumId);
      await onVoteAlbumChange(request.albumId, request.id, action);
    } catch (error) {
      setAlbumChangeErrorByAlbumId((errors) => ({
        ...errors,
        [request.albumId]: error instanceof Error ? error.message : "Failed to update album change",
      }));
    } finally {
      setBusyAlbumId(null);
    }
  }

  async function uploadAndProposeAdd(albumId: string, files: FileList | null) {
    if (!files?.length) return;

    try {
      setUploadingAlbumId(albumId);
      clearAlbumChangeError(albumId);
      const uploadedMedia = await onUploadAlbumMedia(files);
      if (uploadedMedia.length) {
        await onProposeAlbumChange(
          albumId,
          "add",
          uploadedMedia.map((item) => item.id),
          { discardMediaOnReject: true },
        );
      }
    } catch (error) {
      setAlbumChangeErrorByAlbumId((errors) => ({
        ...errors,
        [albumId]: error instanceof Error ? error.message : "Failed to upload media",
      }));
    } finally {
      setUploadingAlbumId(null);
    }
  }

  function downloadAlbum(album: Album, mediaIds?: string[]) {
    const query = mediaIds?.length ? `?mediaIds=${encodeURIComponent(mediaIds.join(","))}` : "";
    window.location.href = `/api/albums/${album.id}/download${query}`;
  }

  function startAlbumEdit(album: Album) {
    setEditingAlbumId(album.id);
    setAlbumTitleDraft(album.title);
    setAlbumDescriptionDraft(album.description);
    setAlbumEditError("");
  }

  async function saveAlbumEdit(album: Album) {
    try {
      setBusyAlbumId(album.id);
      setAlbumEditError("");
      await onUpdateAlbum(album.id, {
        title: albumTitleDraft,
        description: albumDescriptionDraft,
      });
      setEditingAlbumId(null);
    } catch (error) {
      setAlbumEditError(error instanceof Error ? error.message : "Failed to update album");
    } finally {
      setBusyAlbumId(null);
    }
  }

  function setAlbumError(albumId: string, message: string) {
    setDeleteErrorByAlbumId((errors) => ({ ...errors, [albumId]: message }));
  }

  function clearAlbumError(albumId: string) {
    setDeleteErrorByAlbumId((errors) => {
      const next = { ...errors };
      delete next[albumId];
      return next;
    });
  }

  function openPreview(albumId: string, mediaId: string) {
    setPreviewAlbumId(albumId);
    setPreviewRequestId(null);
    setPreviewMediaId(mediaId);
  }

  function openPendingPreview(request: AlbumChangeRequest, mediaId: string) {
    setPreviewAlbumId(request.albumId);
    setPreviewRequestId(request.id);
    setPreviewMediaId(mediaId);
  }

  function closePreview() {
    setPreviewAlbumId(null);
    setPreviewRequestId(null);
    setPreviewMediaId(null);
    setCommentError("");
  }

  function showPreviewByOffset(offset: number) {
    if (!canNavigatePreview) return;

    const nextIndex = (previewMediaIndex + offset + previewMediaItems.length) % previewMediaItems.length;
    setPreviewMediaId(previewMediaItems[nextIndex].id);
  }

  function showPreviousPreview() {
    showPreviewByOffset(-1);
  }

  function showNextPreview() {
    showPreviewByOffset(1);
  }

  async function confirmDelete(album: Album) {
    try {
      setBusyAlbumId(album.id);
      clearAlbumError(album.id);
      await onDeleteAlbum(album.id);
      setConfirmingAlbumId(null);
    } catch (error) {
      setAlbumError(album.id, error instanceof Error ? error.message : "Failed to delete album");
    } finally {
      setBusyAlbumId(null);
    }
  }

  async function cancelDeleteRequest(album: Album) {
    try {
      setBusyAlbumId(album.id);
      clearAlbumError(album.id);
      await onCancelAlbumDeletion(album.id);
    } catch (error) {
      setAlbumError(
        album.id,
        error instanceof Error ? error.message : "Failed to cancel delete request",
      );
    } finally {
      setBusyAlbumId(null);
    }
  }

  async function submitAlbumComment() {
    if (!previewAlbum || !previewMedia) return;

    const draftKey = `${previewAlbum.id}:${previewMedia.id}`;
    const body = commentDrafts[draftKey]?.trim();
    if (!body) return;

    try {
      setIsAddingComment(true);
      setCommentError("");
      await onAddAlbumComment(previewAlbum.id, previewMedia.id, body);
      setCommentDrafts((drafts) => ({ ...drafts, [draftKey]: "" }));
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Failed to add comment");
    } finally {
      setIsAddingComment(false);
    }
  }

  if (!albums.length) {
    return (
      <section className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm max-[1300px]:p-4">
        <h3 className="text-2xl font-semibold tracking-normal max-[1300px]:text-xl">No albums yet</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7177]">
          Create an album from a folder after voting.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {albums.map((album) => {
          const items = albumMedia(album);
          const selectedMediaIds = selectedAlbumMediaIds(album.id);
          const selectedAddIds = selectedAddMediaIds(album.id);
          const selectedCount = selectedMediaIds.size;
          const selectedAddCount = selectedAddIds.size;
          const isEditing = editingAlbumId === album.id;
          const isPendingDeletion = album.deleteApprovalUserIds.length > 0;
          const hasCurrentUserApproved = album.deleteApprovalUserIds.includes(currentUserId);
          const deleteError = deleteErrorByAlbumId[album.id];
          const albumChangeError = albumChangeErrorByAlbumId[album.id];
          const isBusy = busyAlbumId === album.id;
          const isUploading = uploadingAlbumId === album.id;
          const pendingChanges = albumPendingChanges(album.id);
          const availableForAlbum = availableMediaItems.filter(
            (item) =>
              !pendingChanges.some((request) => request.type === "add" && request.mediaIds.includes(item.id)),
          );

          return (
            <section
              key={album.id}
              className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm max-[1300px]:p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="max-w-2xl space-y-2">
                      <input
                        value={albumTitleDraft}
                        onChange={(event) => setAlbumTitleDraft(event.target.value)}
                        className="w-full rounded-md border border-[#d8d0c6] px-3 py-2 text-xl font-semibold outline-none focus:border-[#1f7a7a]"
                        aria-label="Album name"
                      />
                      <textarea
                        value={albumDescriptionDraft}
                        onChange={(event) => setAlbumDescriptionDraft(event.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border border-[#d8d0c6] px-3 py-2 text-sm leading-6 outline-none focus:border-[#1f7a7a]"
                        aria-label="Album description"
                        placeholder="Album description"
                      />
                      {albumEditError && (
                        <p className="rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                          {albumEditError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-semibold tracking-normal max-[1300px]:text-xl">{album.title}</h3>
                        <button
                          type="button"
                          title="Edit album"
                          onClick={() => startAlbumEdit(album)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-[#5f666d] transition hover:bg-[#f4f1ec] hover:text-[#202124]"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-[#6b7177]">
                        {album.description || "No description yet."}
                      </p>
                    </>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAlbumId(null)}
                      disabled={isBusy}
                      className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveAlbumEdit(album)}
                      disabled={isBusy}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f7a7a] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Check size={16} aria-hidden="true" />
                      {isBusy ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : isPendingDeletion && hasCurrentUserApproved ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center text-xs text-[#6b7177]">
                      Pending approval from partner
                    </span>
                    <button
                      type="button"
                      onClick={() => void cancelDeleteRequest(album)}
                      disabled={isBusy}
                      className="inline-flex text-[#6b7177] transition hover:text-[#ef6f5e] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="text-[12px]  font-bold">{isBusy ? "Cancelling..." : "Cancel"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {isPendingDeletion && <span className="inline-flex items-center justify-center text-xs text-[#6b7177]">
                      Your partner has requested to delete this album
                    </span>}

                    <button
                      type="button"
                      onClick={() => {
                        clearAlbumError(album.id);
                        setConfirmingAlbumId(album.id);
                      }}
                      className={isPendingDeletion ? "inline-flex text-[#6b7177] transition hover:text-[#ef6f5e] disabled:cursor-not-allowed disabled:opacity-60" : "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ef6f5e] px-3 text-sm font-semibold text-[#ef6f5e] transition hover:bg-[#f8e4df]"}
                    >
                      {!isPendingDeletion && <Trash2 size={16} aria-hidden="true" />}
                      {isPendingDeletion ? (<span className="text-xs font-bold">
                        Approve deletion
                      </span>
                      ) : (
                        <span>Delete album</span>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#1f7a7a] px-3 text-xs font-semibold text-white shadow-sm">
                        <ImagePlus size={16} aria-hidden="true" />
                        {isUploading ? "Uploading..." : "Upload to album"}
                        <input
                          className="sr-only"
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          disabled={isUploading}
                          onChange={(event) => {
                            void uploadAndProposeAdd(album.id, event.target.files);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => downloadAlbum(album)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d0c6] px-3 text-xs font-semibold"
                      >
                        <Download size={16} aria-hidden="true" />
                        Download album
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadAlbum(album, Array.from(selectedMediaIds))}
                        disabled={!selectedCount}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d0c6] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download size={16} aria-hidden="true" />
                        Download selected {selectedCount ? `(${selectedCount})` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlbumMediaSelection(album.id, items.map((item) => item.id))}
                        disabled={!items.length || selectedCount === items.length}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlbumMediaSelection(album.id, [])}
                        disabled={!selectedCount}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => void proposeChange(album.id, "remove", Array.from(selectedMediaIds))}
                        disabled={!selectedCount || isBusy}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ef6f5e] px-3 text-xs font-semibold text-[#9a3f34] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Suggest remove {selectedCount ? `(${selectedCount})` : ""}
                      </button>
                    </div>
                  </div>

                )}
              </div>

              {deleteError && confirmingAlbumId !== album.id && (
                <p className="mt-4 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                  {deleteError}
                </p>
              )}
              {albumChangeError && (
                <p className="mt-4 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                  {albumChangeError}
                </p>
              )}
              {pendingChanges.length > 0 && (
                <div className="mt-5 rounded-md border border-[#d8d0c6] bg-[#fbfaf8] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Check size={16} className="text-[#1f7a7a]" aria-hidden="true" />
                    Pending album changes
                  </div>
                  <div className="mt-3 space-y-3">
                    {pendingChanges.map((request) => {
                      const proposerIsCurrentUser = request.proposedByUserId === currentUserId;
                      const currentUserVote = request.votes.find(
                        (vote) => vote.voterUserId === currentUserId,
                      );
                      const items = requestMedia(request);

                      return (
                        <div
                          key={request.id}
                          className="flex flex-col gap-3 rounded-md border border-[#e6e0d8] bg-white p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {request.type === "add" ? "Add" : "Remove"} {request.mediaIds.length} media
                            </p>
                            <p className="mt-1 text-xs text-[#6b7177]">
                              Proposed by {userName(request.proposedByUserId)}
                              {currentUserVote ? ` - You voted ${currentUserVote.value}` : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {items.map((item) => (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => openPendingPreview(request, item.id)}
                                  className="group relative h-20 w-20 overflow-hidden rounded-md bg-[#f4f1ec] text-left ring-offset-2 ring-offset-white transition hover:ring-2 hover:ring-[#1f7a7a]"
                                  title={item.title}
                                >
                                  <MediaPreview item={item} />
                                  {/* <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] font-semibold text-white">
                                    {item.title}
                                  </span> */}
                                </button>
                              ))}
                              {/* {items.length > 6 && (
                                <span className="flex h-20 w-20 items-center justify-center rounded-md bg-[#f4f1ec] text-xs font-semibold text-[#6b7177]">
                                  +{items.length - 6}
                                </span>
                              )} */}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {proposerIsCurrentUser ? (
                              <button
                                type="button"
                                onClick={() => void updateChangeRequest(request, "cancel")}
                                disabled={isBusy}
                                className="inline-flex h-9 items-center justify-center rounded-md border border-[#d8d0c6] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void updateChangeRequest(request, "reject")}
                                  disabled={isBusy}
                                  className="inline-flex h-9 items-center justify-center rounded-md border border-[#ef6f5e] px-3 text-xs font-semibold text-[#9a3f34] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateChangeRequest(request, "approve")}
                                  disabled={isBusy}
                                  className="inline-flex h-9 items-center justify-center rounded-md bg-[#1f7a7a] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <MediaMosaic
                mediaItems={items}
                onOpenMedia={(mediaId) => openPreview(album.id, mediaId)}
                selectedMediaIds={selectedMediaIds}
                onToggleMedia={(mediaId) => toggleAlbumMediaSelection(album.id, mediaId)}
              />
              {/* {availableForAlbum.length > 0 && (
                <div className="mt-5 border-t border-[#e6e0d8] pt-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Available media</p>
                      <p className="mt-1 text-xs text-[#6b7177]">
                        Select uploaded media to suggest adding it to this album.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void proposeChange(album.id, "add", Array.from(selectedAddIds))}
                      disabled={!selectedAddCount || isBusy}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f7a7a] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ImagePlus size={16} aria-hidden="true" />
                      Suggest add {selectedAddCount ? `(${selectedAddCount})` : ""}
                    </button>
                  </div>
                  <MediaMosaic
                    mediaItems={availableForAlbum}
                    selectedMediaIds={selectedAddIds}
                    onToggleMedia={(mediaId) => toggleAddMediaSelection(album.id, mediaId)}
                  />
                </div>
              )} */}
            </section>
          );
        })}
      </div>

      {confirmingAlbum && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmingAlbumId(null)}
        >
          <div
            className="w-full max-w-sm rounded-md bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {currentUserApprovedDelete ? "Deletion requested" : "Approve album deletion?"}
              </h3>
              <button
                type="button"
                title="Close"
                onClick={() => setConfirmingAlbumId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f4f1ec]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#6b7177]">
              Both partners must approve deleting {confirmingAlbum.title}. If this is the second
              approval, the album will be deleted.
            </p>
            {deleteErrorByAlbumId[confirmingAlbum.id] && (
              <p className="mt-4 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                {deleteErrorByAlbumId[confirmingAlbum.id]}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingAlbumId(null)}
                disabled={busyAlbumId === confirmingAlbum.id}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete(confirmingAlbum)}
                disabled={busyAlbumId === confirmingAlbum.id || currentUserApprovedDelete}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9a3f34] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} aria-hidden="true" />
                {busyAlbumId === confirmingAlbum.id
                  ? "Deleting..."
                  : currentUserApprovedDelete
                    ? "Already requested"
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
        >
          <div
            className="relative grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-md bg-white shadow-2xl lg:grid-cols-[minmax(0,1fr)_340px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-[320px] items-center justify-center bg-[#111] lg:h-[min(72vh,720px)]">
              <MediaPreview item={previewMedia} fit="contain" className="max-h-[92vh]" />
              {canNavigatePreview && (
                <>
                  <button
                    type="button"
                    onClick={showPreviousPreview}
                    title="Previous media"
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-[#202124] shadow-lg transition hover:bg-white"
                  >
                    <ChevronLeft size={24} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextPreview}
                    title="Next media"
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-[#202124] shadow-lg transition hover:bg-white"
                  >
                    <ChevronRight size={24} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            <aside className="flex min-h-0 flex-col border-l border-[#e6e0d8]">
              <header className="flex items-center justify-between border-b border-[#e6e0d8] p-4">
                <div>
                  <h4 className="font-semibold">{previewMedia.title}</h4>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[#6b7177]">
                    <CalendarDays size={14} aria-hidden="true" />
                    {formatDate(previewMedia.capturedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  title="Close media viewer"
                  className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f4f1ec]"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </header>
              <div className="border-b border-[#e6e0d8] p-4">
                <p className="text-sm font-semibold">
                  {previewRequest
                    ? `Pending ${previewRequest.type === "add" ? "addition" : "removal"}`
                    : previewAlbum?.title}
                </p>
                <p className="mt-1 text-sm text-[#6b7177]">
                  {previewMediaIndex + 1} of {previewMediaItems.length}
                </p>
              </div>
              {previewRequest ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <p className="rounded-md bg-[#f4f1ec] p-3 text-sm leading-6 text-[#6b7177]">
                    This media is still waiting for partner approval before it becomes part of the album.
                  </p>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                      <MessageCircle size={16} aria-hidden="true" />
                      Comments
                    </div>
                    <div className="space-y-4">
                      {previewComments.map((comment) => {
                        const author = users.find((user) => user.id === comment.userId);
                        return (
                          <div key={comment.id} className="flex gap-3">
                            {author?.avatarUrl?.trim() ? (
                              <Image
                                src={author.avatarUrl.trim()}
                                alt={author.name}
                                width={34}
                                height={34}
                                className="h-[34px] w-[34px] rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#ef6f5e] text-sm font-bold text-white">
                                {(author?.name ?? "M").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <p className="text-sm leading-6 text-[#4d5358]">
                              <span className="font-semibold text-[#202124]">{author?.name ?? "Mems user"} </span>
                              {comment.body}
                            </p>
                          </div>
                        );
                      })}
                      {!previewComments.length && (
                        <p className="rounded-md bg-[#f4f1ec] p-3 text-sm text-[#6b7177]">
                          No comments yet.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-[#e6e0d8] p-4">
                    {commentError && (
                      <p className="mb-3 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                        {commentError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[`${previewAlbum?.id}:${previewMedia.id}`] || ""}
                        onChange={(event) =>
                          setCommentDrafts((drafts) => ({
                            ...drafts,
                            [`${previewAlbum?.id}:${previewMedia.id}`]: event.target.value,
                          }))
                        }
                        placeholder="Add a comment"
                        className="min-w-0 flex-1 rounded-md border border-[#d8d0c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7a7a]"
                      />
                      <button
                        type="button"
                        onClick={() => void submitAlbumComment()}
                        disabled={isAddingComment}
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-[#202124] text-white disabled:cursor-not-allowed disabled:opacity-60"
                        title="Add comment"
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
