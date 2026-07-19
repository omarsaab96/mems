"use client";

import {
  Album,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  FolderPlus,
  ImagePlus,
  Pencil,
  MessageCircle,
  Play,
  Plus,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { MediaPreview } from "@/components/media/MediaPreview";
import {
  type Media,
  type MediaComment,
  type UploadTask,
  type User,
  type VoteSession,
  type VoteValue,
} from "@/lib/entities";
import { cn, formatDate } from "@/lib/utils";

type SelectionBox = {
  sourceId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type PreviewContext = {
  sourceId: string;
};

type AlbumValidationStatus = "keep" | "delete" | "conflict";

const largeMediaRenderLimit = 96;

export function MediaVoting({
  currentUserId,
  allMedia,
  users,
  voteSessions,
  activeSessionId,
  setActiveSessionId,
  unsortedMedia,
  uploadTasks,
  isUploadDragActive,
  comments,
  commentDrafts,
  setCommentDrafts,
  vote,
  addComment,
  buildAlbumFromVotes,
  removeUploadedMedia,
  assignMediaToSessionBatch,
  removeMediaFromVoteSessions,
  removeVoteSession,
  renameVoteSession,
  onAddFolder,
  onUpload,
  partnerUserIds,
}: {
  currentUserId: string;
  allMedia: Media[];
  users: User[];
  voteMedia: Media[];
  voteSessions: VoteSession[];
  activeSessionId: string;
  setActiveSessionId: (sessionId: string) => void;
  unsortedMedia: Media[];
  uploadTasks: UploadTask[];
  isUploadDragActive: boolean;
  comments: MediaComment[];
  commentDrafts: Record<string, string>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  vote: (mediaId: string, value: VoteValue) => void;
  addComment: (mediaId: string) => void;
  buildAlbumFromVotes: (sessionId?: string) => Promise<void>;
  removeUploadedMedia: (mediaId: string) => void;
  assignMediaToSessionBatch: (mediaIds: string[], sessionId: string) => void;
  removeMediaFromVoteSessions: (mediaIds: string[]) => void;
  removeVoteSession: (sessionId: string) => void;
  renameVoteSession: (sessionId: string, title: string) => void;
  onAddFolder: () => void;
  onUpload: (files: FileList | null) => void;
  partnerUserIds: string[];
}) {
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<PreviewContext>({ sourceId: "tray" });
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [lastSelectionContext, setLastSelectionContext] = useState<{
    sourceId: string;
    index: number;
  } | null>(null);
  const [isMediaDragging, setIsMediaDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [validatingAlbumSessionIds, setValidatingAlbumSessionIds] = useState<Record<string, boolean>>({});
  const [albumValidationStamps, setAlbumValidationStamps] = useState<
    Record<string, Record<string, AlbumValidationStatus>>
  >({});
  const [albumValidationMessages, setAlbumValidationMessages] = useState<Record<string, string>>({});
  const [albumConfirmationTimers, setAlbumConfirmationTimers] = useState<Record<string, number>>({});
  const [confirmingAlbumSessionId, setConfirmingAlbumSessionId] = useState<string | null>(null);
  const [visibleMediaLimits, setVisibleMediaLimits] = useState<Record<string, number>>({});
  const selectedMedia = allMedia.find((item) => item.id === selectedMediaId) ?? null;
  const confirmingAlbumSession =
    voteSessions.find((session) => session.id === confirmingAlbumSessionId) ?? null;
  const mediaById = useMemo(
    () => new Map(allMedia.map((item) => [item.id, item])),
    [allMedia],
  );
  const voteCountsByMediaId = useMemo(() => {
    const counts = new Map<string, { keep: number; delete: number }>();

    voteSessions.forEach((session) => {
      session.votes.forEach((voteItem) => {
        const current = counts.get(voteItem.mediaId) ?? { keep: 0, delete: 0 };
        counts.set(voteItem.mediaId, {
          ...current,
          [voteItem.value]: current[voteItem.value] + 1,
        });
      });
    });

    return counts;
  }, [voteSessions]);
  const commentsByMediaId = useMemo(() => {
    const grouped = new Map<string, MediaComment[]>();

    comments.forEach((comment) => {
      grouped.set(comment.mediaId, [...(grouped.get(comment.mediaId) ?? []), comment]);
    });

    return grouped;
  }, [comments]);
  const selectedCounts = selectedMedia
    ? (voteCountsByMediaId.get(selectedMedia.id) ?? { keep: 0, delete: 0 })
    : { keep: 0, delete: 0 };
  const selectedComments = selectedMedia ? (commentsByMediaId.get(selectedMedia.id) ?? []) : [];
  const selectionContainerRefs = useRef(new Map<string, HTMLDivElement>());
  const mediaItemRefs = useRef(new Map<string, HTMLElement>());
  const dropTargetRefs = useRef(new Map<string, HTMLElement>());
  const draggingMediaIdsRef = useRef<string[]>([]);
  const dragOverTargetIdRef = useRef<string | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragGhostCountRef = useRef<HTMLDivElement | null>(null);
  const dragGhostLabelRef = useRef<HTMLDivElement | null>(null);
  const albumValidationMessageTimeoutRefs = useRef<Record<string, number>>({});
  const albumConfirmationTimeoutRefs = useRef<Record<string, number>>({});
  const selectionDragStartRef = useRef<{
    sourceId: string;
    sourceItems: Media[];
    clientX: number;
    clientY: number;
    containerLeft: number;
    containerTop: number;
    addToSelection: boolean;
    baseSelection: Set<string>;
  } | null>(null);
  const isBoxSelectingRef = useRef(false);
  const hasSelection = selectedMediaIds.size > 0;
  const visibleTrayMedia = visibleMediaItems(unsortedMedia, "tray");
  const overallUploadProgress = uploadTasks.length
    ? Math.round(
      uploadTasks.reduce(
        (total, task) => total + (task.status === "error" ? 100 : task.progress),
        0,
      ) / uploadTasks.length,
    )
    : 0;

  useEffect(() => {
    const ghost = document.createElement("div");
    ghost.className =
      "fixed left-[-9999px] top-[-9999px] flex items-center gap-2 rounded-md border border-[#1f7a7a] bg-white px-3 py-2 text-sm font-semibold text-[#202124] shadow-2xl";

    const count = document.createElement("div");
    count.style.width = "34px";
    count.style.height = "34px";
    count.style.borderRadius = "6px";
    count.style.overflow = "hidden";
    count.style.background = "#f4f1ec";
    count.style.display = "flex";
    count.style.alignItems = "center";
    count.style.justifyContent = "center";
    count.style.color = "#1f7a7a";
    count.style.fontWeight = "700";

    const label = document.createElement("div");
    ghost.append(count, label);
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    dragGhostCountRef.current = count;
    dragGhostLabelRef.current = label;

    return () => {
      ghost.remove();
      dragGhostRef.current = null;
      dragGhostCountRef.current = null;
      dragGhostLabelRef.current = null;
    };
  }, []);
  const previewItems = useMemo(() => {
    if (previewContext.sourceId === "tray") return unsortedMedia;

    const session = voteSessions.find((item) => item.id === previewContext.sourceId);
    if (!session) return allMedia;

    return session.mediaIds.flatMap((mediaId) => {
      const item = mediaById.get(mediaId);
      return item ? [item] : [];
    });
  }, [allMedia, mediaById, previewContext.sourceId, unsortedMedia, voteSessions]);
  const selectedPreviewIndex = selectedMedia
    ? previewItems.findIndex((item) => item.id === selectedMedia.id)
    : -1;
  const canNavigatePreview = selectedPreviewIndex >= 0 && previewItems.length > 1;

  useEffect(() => {
    if (!selectedMedia || !canNavigatePreview) return;

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

  useEffect(() => {
    if (!Object.values(albumConfirmationTimers).some((seconds) => seconds > 0)) return;

    const intervalId = window.setInterval(() => {
      setAlbumConfirmationTimers((timers) => {
        const next: Record<string, number> = {};

        Object.entries(timers).forEach(([sessionId, seconds]) => {
          const remaining = seconds - 1;
          if (remaining > 0) next[sessionId] = remaining;
        });

        return next;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [albumConfirmationTimers]);

  function sessionMedia(session: VoteSession) {
    return session.mediaIds.flatMap((mediaId) => {
      const item = mediaById.get(mediaId);
      return item ? [item] : [];
    });
  }

  function visibleMediaItems(items: Media[], sourceId: string) {
    const limit = visibleMediaLimits[sourceId] ?? largeMediaRenderLimit;
    const selectedItems = items.filter((item) => selectedMediaIds.has(item.id));
    const stampedItems =
      sourceId === "tray"
        ? []
        : items.filter((item) => Boolean(albumValidationStamps[sourceId]?.[item.id]));
    const indexById = new Map(items.map((item, index) => [item.id, index]));
    const visible = items
      .slice(0, limit)
      .concat(selectedItems, stampedItems)
      .filter((item, index, list) => list.findIndex((current) => current.id === item.id) === index);

    return visible.sort((left, right) => (indexById.get(left.id) ?? 0) - (indexById.get(right.id) ?? 0));
  }

  function showMoreMedia(sourceId: string) {
    setVisibleMediaLimits((limits) => ({
      ...limits,
      [sourceId]: (limits[sourceId] ?? largeMediaRenderLimit) + largeMediaRenderLimit,
    }));
  }

  function openMediaPreview(mediaId: string, sourceId: string) {
    setPreviewContext({ sourceId });
    setSelectedMediaId(mediaId);
  }

  function showPreviewByOffset(offset: number) {
    if (!canNavigatePreview) return;

    const nextIndex = (selectedPreviewIndex + offset + previewItems.length) % previewItems.length;
    setSelectedMediaId(previewItems[nextIndex].id);
  }

  function showPreviousPreview() {
    showPreviewByOffset(-1);
  }

  function showNextPreview() {
    showPreviewByOffset(1);
  }

  function getAlbumValidationStatus(mediaId: string, session: VoteSession): AlbumValidationStatus {
    const requiredPartnerVotes = partnerUserIds.map(
      (partnerId) =>
        session.votes.find((item) => item.mediaId === mediaId && item.voterUserId === partnerId)
          ?.value,
    );

    if (requiredPartnerVotes.length < 2 || requiredPartnerVotes.some((value) => !value)) {
      return "conflict";
    }

    if (requiredPartnerVotes.every((value) => value === "keep")) return "keep";
    if (requiredPartnerVotes.every((value) => value === "delete")) return "delete";
    return "conflict";
  }

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function showAlbumValidationMessage(sessionId: string, message: string) {
    const currentTimeout = albumValidationMessageTimeoutRefs.current[sessionId];
    if (currentTimeout) {
      window.clearTimeout(currentTimeout);
    }

    setAlbumValidationMessages((messages) => ({ ...messages, [sessionId]: message }));
    albumValidationMessageTimeoutRefs.current[sessionId] = window.setTimeout(() => {
      setAlbumValidationMessages((messages) => {
        const next = { ...messages };
        delete next[sessionId];
        return next;
      });
      delete albumValidationMessageTimeoutRefs.current[sessionId];
    }, 3000);
  }

  function resetAlbumValidation(sessionId: string) {
    const messageTimeout = albumValidationMessageTimeoutRefs.current[sessionId];
    if (messageTimeout) {
      window.clearTimeout(messageTimeout);
      delete albumValidationMessageTimeoutRefs.current[sessionId];
    }

    const confirmationTimeout = albumConfirmationTimeoutRefs.current[sessionId];
    if (confirmationTimeout) {
      window.clearTimeout(confirmationTimeout);
      delete albumConfirmationTimeoutRefs.current[sessionId];
    }

    setAlbumValidationStamps((stamps) => {
      const next = { ...stamps };
      delete next[sessionId];
      return next;
    });
    setAlbumValidationMessages((messages) => {
      const next = { ...messages };
      delete next[sessionId];
      return next;
    });
    setAlbumConfirmationTimers((timers) => {
      const next = { ...timers };
      delete next[sessionId];
      return next;
    });
    setConfirmingAlbumSessionId((current) => (current === sessionId ? null : current));
  }

  function startAlbumConfirmation(sessionId: string) {
    const existingTimeout = albumConfirmationTimeoutRefs.current[sessionId];
    if (existingTimeout) window.clearTimeout(existingTimeout);

    setAlbumConfirmationTimers((timers) => ({ ...timers, [sessionId]: 30 }));
    albumConfirmationTimeoutRefs.current[sessionId] = window.setTimeout(() => {
      resetAlbumValidation(sessionId);
    }, 30000);
  }

  async function confirmAlbumCreation(sessionId: string) {
    setConfirmingAlbumSessionId(null);
    const confirmationTimeout = albumConfirmationTimeoutRefs.current[sessionId];
    if (confirmationTimeout) {
      window.clearTimeout(confirmationTimeout);
      delete albumConfirmationTimeoutRefs.current[sessionId];
    }
    try {
      await buildAlbumFromVotes(sessionId);
    } catch (error) {
      showAlbumValidationMessage(
        sessionId,
        error instanceof Error ? error.message : "Failed to create album",
      );
      setAlbumConfirmationTimers((timers) => {
        const next = { ...timers };
        delete next[sessionId];
        return next;
      });
    }
  }

  function handleAlbumButtonClick(session: VoteSession, items: Media[]) {
    if (albumConfirmationTimers[session.id]) {
      setConfirmingAlbumSessionId(session.id);
      return;
    }

    void validateAndBuildAlbum(session, items);
  }

  async function validateAndBuildAlbum(session: VoteSession, items: Media[]) {
    if (validatingAlbumSessionIds[session.id]) return;

    setSelectedMediaIds(new Set());
    setActiveSessionId(session.id);
    setAlbumValidationStamps((stamps) => ({ ...stamps, [session.id]: {} }));
    setAlbumValidationMessages((messages) => {
      const next = { ...messages };
      delete next[session.id];
      return next;
    });
    setValidatingAlbumSessionIds((sessions) => ({ ...sessions, [session.id]: true }));

    const nextStamps: Record<string, AlbumValidationStatus> = {};
    let hasConflict = false;

    for (const item of items) {
      await wait(220);
      const status = getAlbumValidationStatus(item.id, session);
      nextStamps[item.id] = status;
      if (status === "conflict") hasConflict = true;
      setAlbumValidationStamps((stamps) => ({ ...stamps, [session.id]: { ...nextStamps } }));
    }

    if (hasConflict) {
      showAlbumValidationMessage(
        session.id,
        "Resolve all yellow items before creating an album. Both partners must vote and agree.",
      );
      setValidatingAlbumSessionIds((sessions) => ({ ...sessions, [session.id]: false }));
      return;
    }

    await wait(180);
    setValidatingAlbumSessionIds((sessions) => ({ ...sessions, [session.id]: false }));
    startAlbumConfirmation(session.id);
  }

  function startRename(session: VoteSession) {
    setRenamingSessionId(session.id);
    setRenameDraft(session.title);
  }

  function finishRename() {
    if (!renamingSessionId) return;
    renameVoteSession(renamingSessionId, renameDraft);
    setRenamingSessionId(null);
    setRenameDraft("");
  }

  function cancelRename() {
    setRenamingSessionId(null);
    setRenameDraft("");
  }

  function handleMediaSelect(
    event: MouseEvent,
    item: Media,
    sourceId: string,
    sourceItems: Media[],
    index: number,
  ) {
    if (isBoxSelectingRef.current) return;

    setSelectedMediaIds((current) => {
      if (event.shiftKey && lastSelectionContext?.sourceId === sourceId) {
        const start = Math.min(lastSelectionContext.index, index);
        const end = Math.max(lastSelectionContext.index, index);
        return new Set(sourceItems.slice(start, end + 1).map((mediaItem) => mediaItem.id));
      }

      if (event.ctrlKey || event.metaKey) {
        const next = new Set(current);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      }

      return new Set([item.id]);
    });
    setLastSelectionContext({ sourceId, index });
  }

  function startMediaDrag(event: DragEvent, item: Media) {
    if (isBoxSelectingRef.current) {
      event.preventDefault();
      return;
    }

    const ids = selectedMediaIds.has(item.id) ? Array.from(selectedMediaIds) : [item.id];
    draggingMediaIdsRef.current = ids;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ids.join(","));

    if (dragGhostCountRef.current) dragGhostCountRef.current.textContent = String(ids.length);
    if (dragGhostLabelRef.current) {
      dragGhostLabelRef.current.textContent =
        ids.length === 1 ? item.title : `${ids.length} media selected`;
    }
    if (dragGhostRef.current) event.dataTransfer.setDragImage(dragGhostRef.current, 24, 24);
    window.setTimeout(() => setIsMediaDragging(true), 0);
  }

  function finishMediaDrag() {
    draggingMediaIdsRef.current = [];
    setDragOverTarget(null);
    setIsMediaDragging(false);
  }

  function getDroppedMediaIds(event: DragEvent) {
    const ids = draggingMediaIdsRef.current.length
      ? draggingMediaIdsRef.current
      : event.dataTransfer.getData("text/plain").split(",").filter(Boolean);
    return Array.from(new Set(ids));
  }

  function dropIntoSession(event: DragEvent, sessionId: string) {
    event.preventDefault();
    const ids = getDroppedMediaIds(event);
    if (!ids.length) return;
    assignMediaToSessionBatch(ids, sessionId);
    setActiveSessionId(sessionId);
    setSelectedMediaIds(new Set(ids));
    finishMediaDrag();
  }

  function dropIntoTray(event: DragEvent) {
    event.preventDefault();
    const ids = getDroppedMediaIds(event);
    if (!ids.length) return;
    removeMediaFromVoteSessions(ids);
    setSelectedMediaIds(new Set(ids));
    finishMediaDrag();
  }

  function setDragOverTarget(targetId: string | null) {
    if (dragOverTargetIdRef.current === targetId) return;
    if (dragOverTargetIdRef.current) {
      dropTargetRefs.current
        .get(dragOverTargetIdRef.current)
        ?.classList.remove("media-drop-target-active");
    }
    dragOverTargetIdRef.current = targetId;
    if (targetId) {
      dropTargetRefs.current.get(targetId)?.classList.add("media-drop-target-active");
    }
  }

  function handleDragEnter(event: DragEvent, targetId: string) {
    event.preventDefault();
    setDragOverTarget(targetId);
  }

  function handleDragOver(event: DragEvent, targetId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTarget(targetId);
  }

  function handleDragLeave(event: DragEvent, targetId: string) {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    if (dragOverTargetIdRef.current === targetId) setDragOverTarget(null);
  }

  function beginSelectionBox(
    event: ReactPointerEvent<HTMLDivElement>,
    sourceId: string,
    sourceItems: Media[],
  ) {
    if (event.button !== 0) return;
    if ((event.target as Element).closest("[data-grid-action='true']")) return;

    const mediaCard = (event.target as Element).closest("[data-media-id]");
    if (mediaCard) return;

    const container = selectionContainerRefs.current.get(sourceId);
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    selectionDragStartRef.current = {
      sourceId,
      sourceItems,
      clientX: event.clientX,
      clientY: event.clientY,
      containerLeft: bounds.left,
      containerTop: bounds.top,
      addToSelection: event.ctrlKey || event.metaKey,
      baseSelection: new Set(selectedMediaIds),
    };
    isBoxSelectingRef.current = false;
  }

  function moveSelectionBox(event: ReactPointerEvent<HTMLDivElement>) {
    const start = selectionDragStartRef.current;
    if (!start) return;

    const movedX = Math.abs(event.clientX - start.clientX);
    const movedY = Math.abs(event.clientY - start.clientY);
    if (movedX < 6 && movedY < 6) return;

    event.preventDefault();
    isBoxSelectingRef.current = true;

    const left = Math.min(start.clientX, event.clientX);
    const right = Math.max(start.clientX, event.clientX);
    const top = Math.min(start.clientY, event.clientY);
    const bottom = Math.max(start.clientY, event.clientY);

    setSelectionBox({
      sourceId: start.sourceId,
      left: left - start.containerLeft,
      top: top - start.containerTop,
      width: right - left,
      height: bottom - top,
    });

    const next = start.addToSelection ? new Set(start.baseSelection) : new Set<string>();
    start.sourceItems.forEach((item) => {
      const node = mediaItemRefs.current.get(item.id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const intersects = rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top;
      if (intersects) next.add(item.id);
    });
    setSelectedMediaIds(next);
  }

  function endSelectionBox() {
    selectionDragStartRef.current = null;
    setSelectionBox(null);
    window.setTimeout(() => {
      isBoxSelectingRef.current = false;
    }, 0);
  }

  function removeFromSession(mediaId: string) {
    removeMediaFromVoteSessions([mediaId]);
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      next.delete(mediaId);
      return next;
    });
  }

  function renderUploadTaskTile(task: UploadTask) {
    const progress = task.status === "error" ? 100 : task.progress;

    return (
      <article
        key={task.id}
        className="relative aspect-square min-h-[136px] flex-[0_0_calc((100%-0.5rem)/2)] overflow-hidden rounded-md bg-[#f4f1ec] max-[1300px]:min-h-[116px]"
      >
        {task.type === "video" ? (
          <video src={task.previewUrl} className="h-full w-full object-cover" muted />
        ) : (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${task.previewUrl})` }}
            role="img"
            aria-label={task.name}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/48 p-3 text-center text-white backdrop-blur-[2px]">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${task.status === "error" ? "#ef6f5e" : "#76c7b7"} ${progress * 3.6}deg, rgba(255,255,255,0.24) 0deg)`,
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/62 text-sm font-semibold">
              {task.status === "error" ? "!" : `${task.progress}%`}
            </div>
          </div>
          <p className="mt-2 w-full truncate text-xs font-semibold drop-shadow">
            {task.status === "processing" ? "Processing..." : ""}
          </p>
          {task.status === "error" && task.error && (
            <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[#ffd8d1]">{task.error}</p>
          )}
        </div>
      </article>
    );
  }

  function renderMediaCard(item: Media, sourceId: string, sourceItems: Media[], index: number) {
    const counts = voteCountsByMediaId.get(item.id) ?? { keep: 0, delete: 0 };
    const itemComments = commentsByMediaId.get(item.id) ?? [];
    const totalVotes = counts.keep + counts.delete;
    const deletePercent = totalVotes === 0 ? 0 : (counts.delete / totalVotes) * 100;
    const keepPercent = totalVotes === 0 ? 0 : (counts.keep / totalVotes) * 100;
    const isSelected = selectedMediaIds.has(item.id);
    const canRemoveUpload = sourceId === "tray" && item.uploadedByUserId === currentUserId;
    const albumValidationStamp =
      sourceId === "tray" ? undefined : albumValidationStamps[sourceId]?.[item.id];

    return (
      <article
        key={item.id}
        data-media-id={item.id}
        data-media-card="true"
        draggable
        ref={(node) => {
          if (node) {
            mediaItemRefs.current.set(item.id, node);
          } else {
            mediaItemRefs.current.delete(item.id);
          }
        }}
        onDragStart={(event) => startMediaDrag(event, item)}
        onDragEnd={finishMediaDrag}
        className={cn(
          "group relative aspect-square cursor-grab overflow-hidden rounded-md bg-[#f4f1ec] ring-offset-2 ring-offset-white active:cursor-grabbing",
          sourceId === "tray"
            ? "min-h-[136px] flex-[0_0_calc((100%-0.5rem)/2)] max-[1300px]:min-h-[116px]"
            : "min-h-[160px] max-[1300px]:min-h-[132px]",
          isSelected && "ring-2 ring-[#1f7a7a]",
          isMediaDragging && isSelected && "opacity-55",
        )}
      >
        <button
          type="button"
          onClick={(event) => handleMediaSelect(event, item, sourceId, sourceItems, index)}
          onDoubleClick={() => openMediaPreview(item.id, sourceId)}
          className="absolute inset-0 text-left"
        >
          <MediaPreview item={item} fit="cover" />
          {item.type === "video" && (
            <div className="absolute left-50 top-50 -translate-50 flex h-8 items-center gap-2 justify-center rounded-full bg-black/55 text-white text-xs">
              <Play size={16} fill="currentColor" aria-hidden="true" />
              Double click to play
            </div>
          )}
          {isSelected && (
            <div className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#1f7a7a] text-white shadow-sm">
              <Check size={16} aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />
        </button>

        {albumValidationStamp && (
          <div
            className={cn(
              "album-validation-stamp pointer-events-none absolute z-30 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl",
              albumValidationStamp === "keep" && "bg-[#1f7a7a]",
              albumValidationStamp === "delete" && "bg-[#9a3f34]",
              albumValidationStamp === "conflict" && "bg-[#d99a18]",
            )}
          >
            {albumValidationStamp === "keep" && <Check size={28} strokeWidth={1} aria-hidden="true" />}
            {albumValidationStamp === "delete" && <X size={28} strokeWidth={1} aria-hidden="true" />}
            {albumValidationStamp === "conflict" && <AlertTriangle size={28} strokeWidth={1} aria-hidden="true" />}
          </div>
        )}

        <div className="absolute right-3 top-3 z-20 flex gap-2">
          {sourceId !== "tray" && (
            <button
              type="button"
              title="Return to tray"
              data-grid-action="true"
              onClick={() => removeFromSession(item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/18 text-white shadow-sm backdrop-blur transition hover:bg-white/28"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
          {canRemoveUpload && (
            <button
              type="button"
              title="Remove uploaded media"
              data-grid-action="true"
              onClick={() => removeUploadedMedia(item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/18 text-white shadow-sm backdrop-blur transition hover:bg-[#9a3f34]/75"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 min-w-0 flex-1 items-center overflow-hidden rounded-full border border-white/20 bg-white/18 px-2 text-white shadow-sm backdrop-blur">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex items-center gap-0.5 text-[15px] drop-shadow">
                <Trash2 size={13} aria-hidden="true" />
                {counts.delete}
              </span>
              <div className="relative flex flex-1 items-center">
                <div className="flex w-1/2 justify-end overflow-hidden">
                  <div
                    className="h-3 rounded-l-full bg-[#ef6f5e]"
                    style={{ width: `${deletePercent}%` }}
                  />
                </div>
                <div className="absolute left-1/2 h-5 w-[1px] -translate-x-1/2 bg-white/65" />
                <div className="w-1/2 overflow-hidden">
                  <div
                    className="h-3 rounded-r-full bg-[#76c7b7]"
                    style={{ width: `${keepPercent}%` }}
                  />
                </div>
              </div>
              <span className="inline-flex items-center gap-0.5 text-[15px] drop-shadow">
                {counts.keep}
                <Check size={13} aria-hidden="true" />
              </span>
            </div>
          </div>
          <button
            type="button"
            data-grid-action="true"
            onClick={() => openMediaPreview(item.id, sourceId)}
            title="Open comments"
            className="pointer-events-auto flex h-8 shrink-0 items-center justify-center gap-0.5 rounded-full border border-white/20 bg-white/18 px-2 text-[15px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/28"
          >
            <MessageCircle size={17} aria-hidden="true" />
            {itemComments.length}
          </button>
        </div>
      </article>
    );
  }

  return (
    <>
      {isUploadDragActive && (
        <div className="pointer-events-none fixed inset-x-4 bottom-6 top-6 z-30 flex items-center justify-center rounded-md border-2 border-dashed border-[#1f7a7a] bg-[#e3f1ed]/82 text-center shadow-2xl shadow-[#202124]/18 backdrop-blur-sm">
          <div className="rounded-md px-5 py-4">
            <ImagePlus className="mx-auto text-[#1f7a7a]" size={34} aria-hidden="true" />
            <p className="mt-3 text-lg font-semibold text-[#202124]">Drop media to upload</p>
            <p className="mt-1 text-sm text-[#6b7177]">Images and videos will appear in the tray.</p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid min-w-0 gap-5",
          (unsortedMedia.length > 0 || uploadTasks.length > 0) &&
          "lg:grid-cols-[minmax(0,1fr)_360px] max-[1300px]:lg:grid-cols-[minmax(0,1fr)_320px]",
          isMediaDragging && "select-none",
        )}
      >
        <section className="min-w-0 space-y-5">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b7177]">Couple workspace</p>
              <h2 className="text-3xl font-semibold tracking-normal max-[1300px]:text-2xl">Media voting</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAddFolder}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d8d0c6] bg-white px-4 text-sm font-semibold text-[#202124] shadow-sm transition hover:bg-[#f4f1ec] max-[1300px]:h-10 max-[1300px]:px-3"
              >
                <FolderPlus size={17} aria-hidden="true" />
                Add folder
              </button>
              <label className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f7a7a] px-4 text-sm font-semibold text-white shadow-sm max-[1300px]:h-10 max-[1300px]:px-3">
                <Upload size={17} aria-hidden="true" />
                Upload media
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(event) => onUpload(event.target.files)}
                />
              </label>
            </div>
          </header>

          {/*<div className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm">
          <div>
            <div>
              <h3 className="text-2xl font-semibold tracking-normal">Folders</h3>
              <p className="mt-1 flex items-center gap-2 text-sm text-[#6b7177]">
                <MousePointer2 size={14} aria-hidden="true" />
                Select one or many media, then drag them between folders or back to the tray.
              </p>
            </div>
          </div>
        </div>*/}

          {!voteSessions.length && (
            <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-[#d8d0c6] bg-white p-8 text-center">
              <div>
                <ImagePlus className="mx-auto text-[#ef6f5e]" size={34} aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">
                  {unsortedMedia.length
                    ? "Create a folder to sort uploaded media"
                    : "Upload media to start voting"}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-6 text-[#6b7177]">
                  {unsortedMedia.length
                    ? "Your uploaded media is waiting in the tray. Create folders, then drag media into each to sort them."
                    : "Upload, sort, group, order your media and vote on what to keep or delete."}
                </p>
              </div>
            </div>
          )}

          {voteSessions.map((session) => {
            const items = sessionMedia(session);
            const visibleItems = visibleMediaItems(items, session.id);
            const isActive = activeSessionId === session.id;
            const isValidatingAlbum = Boolean(validatingAlbumSessionIds[session.id]);
            const albumValidationMessage = albumValidationMessages[session.id];
            const albumConfirmationTimer = albumConfirmationTimers[session.id];

            return (
              <section
                key={session.id}
                ref={(node) => {
                  if (node) {
                    dropTargetRefs.current.set(session.id, node);
                  } else {
                    dropTargetRefs.current.delete(session.id);
                  }
                }}
                onClick={() => setActiveSessionId(session.id)}
                onDragEnter={(event) => handleDragEnter(event, session.id)}
                onDragOver={(event) => handleDragOver(event, session.id)}
                onDragLeave={(event) => handleDragLeave(event, session.id)}
                onDrop={(event) => dropIntoSession(event, session.id)}
                className={cn(
                  "relative rounded-md border bg-white p-5 shadow-sm transition max-[1300px]:p-4",
                  // isActive ? "border-[#ef6f5e]" : "border-[#e6e0d8]",
                  isActive ? "border-[#e6e0d8]" : "border-[#e6e0d8]",
                )}
              >
                <header className="flex flex-col gap-4 md:flex-row md:items-top md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {renamingSessionId === session.id ? (
                        <input
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={finishRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              finishRename();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          autoFocus
                          className="min-w-0 rounded-md border border-[#1f7a7a] bg-white px-2 py-1 text-xl font-semibold tracking-normal outline-none max-[1300px]:text-lg"
                          aria-label="Folder name"
                        />
                      ) : (
                        <h3 className="text-xl font-semibold tracking-normal max-[1300px]:text-lg">{session.title}</h3>
                      )}
                      <button
                        type="button"
                        title="Rename folder"
                        onClick={(event) => {
                          event.stopPropagation();
                          startRename(session);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[#5f666d] transition hover:bg-[#f4f1ec] hover:text-[#202124]"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-[#6b7177]">
                      {items.length} media · Drop selected media here
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAlbumButtonClick(session, items);
                      }}
                      disabled={isValidatingAlbum}
                      className={cn(
                        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60",
                        albumConfirmationTimer
                          ? "animate-pulse bg-[#1f7a7a] shadow-lg shadow-[#1f7a7a]/25"
                          : "bg-[#ef6f5e]",
                      )}
                    >
                      <Album size={16} aria-hidden="true" />
                      {isValidatingAlbum
                        ? "Validating..."
                        : albumConfirmationTimer
                          ? `Confirm ${albumConfirmationTimer}`
                          : "Create album"}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeVoteSession(session.id);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d0c6] px-3 text-sm font-semibold text-[#9a3f34]"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Remove folder
                    </button>
                  </div>
                </header>

                {albumValidationMessage && (
                  <p className="absolute right-5 top-20 z-30 max-w-sm rounded-md border border-[#ead19b] bg-[#fff8e6] p-3 text-sm font-semibold text-[#8a650e] shadow-lg">
                    {albumValidationMessage}
                  </p>
                )}

                {items.length ? (
                  <div>
                    <div
                      ref={(node) => {
                        if (node) {
                          selectionContainerRefs.current.set(session.id, node);
                        } else {
                          selectionContainerRefs.current.delete(session.id);
                        }
                      }}
                      className="relative mt-5 flex flex-wrap gap-2 max-[1300px]:mt-4 max-[1300px]:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
                      onPointerDown={(event) => beginSelectionBox(event, session.id, items)}
                      onPointerMove={moveSelectionBox}
                      onPointerUp={endSelectionBox}
                      onPointerCancel={endSelectionBox}
                    >
                      {visibleItems.map((item) =>
                        renderMediaCard(item, session.id, items, items.findIndex((media) => media.id === item.id)),
                      )}
                      {selectionBox?.sourceId === session.id && (
                        <div
                          className="pointer-events-none absolute z-30 border border-[#1f7a7a] bg-[#1f7a7a]/14"
                          style={{
                            left: selectionBox.left,
                            top: selectionBox.top,
                            width: selectionBox.width,
                            height: selectionBox.height,
                          }}
                        />
                      )}

                    </div>
                    {visibleItems.length < items.length && (
                      <button
                        type="button"
                        onClick={() => showMoreMedia(session.id)}
                        className="col-span-full mt-2 inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] bg-white px-4 text-sm font-semibold text-[#202124] transition hover:bg-[#f4f1ec]"
                      >
                        Show {Math.min(largeMediaRenderLimit, items.length - visibleItems.length)} more
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-md border border-dashed border-[#d8d0c6] bg-[#fbfaf8] p-6 text-center text-sm font-medium text-[#6b7177]">
                    Drop media here to build this folder.
                  </div>
                )}
              </section>
            );
          })}
        </section>

        {(unsortedMedia.length > 0 || uploadTasks.length > 0) && (
          <aside
            ref={(node) => {
              if (node) {
                dropTargetRefs.current.set("tray", node);
              } else {
                dropTargetRefs.current.delete("tray");
              }
            }}
            onDragEnter={(event) => handleDragEnter(event, "tray")}
            onDragOver={(event) => handleDragOver(event, "tray")}
            onDragLeave={(event) => handleDragLeave(event, "tray")}
            onDrop={dropIntoTray}
            className={cn(
              "flex h-[calc(100vh-2.5rem)] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-md border bg-white/96 shadow-sm transition lg:h-[calc(100vh-4rem)] lg:sticky lg:top-8 max-[1300px]:min-h-[360px] max-[1300px]:lg:top-5",
              "border-[#d8d0c6]",
            )}
          >
            <div className="flex items-center justify-between border-b border-[#e6e0d8] bg-[#fbfaf8] p-3">
              <div>
                <p className="text-sm font-semibold">Media tray</p>
                <p className="text-xs text-[#6b7177]">{unsortedMedia.length} unsorted media</p>
              </div>
              {uploadTasks.length > 0 && (
                <div className="upload-shimmer flex items-center gap-2">
                  <span className="flex items-center justify-center rounded-full text-[#1f7a7a]">
                    <UploadCloud size={20} aria-hidden="true" />
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#1f7a7a]">{overallUploadProgress}%</p>
                    {/* <p className="text-[11px] font-medium text-[#6b7177]">Uploading</p> */}
                  </div>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div
                ref={(node) => {
                  if (node) {
                    selectionContainerRefs.current.set("tray", node);
                  } else {
                    selectionContainerRefs.current.delete("tray");
                  }
                }}
                className="relative flex min-h-full flex-wrap content-start gap-2"
                onPointerDown={(event) => beginSelectionBox(event, "tray", unsortedMedia)}
                onPointerMove={moveSelectionBox}
                onPointerUp={endSelectionBox}
                onPointerCancel={endSelectionBox}
              >
                {uploadTasks.map((task) => renderUploadTaskTile(task))}
                {visibleTrayMedia.map((item) =>
                  renderMediaCard(item, "tray", unsortedMedia, unsortedMedia.findIndex((media) => media.id === item.id)),
                )}
                {selectionBox?.sourceId === "tray" && (
                  <div
                    className="pointer-events-none absolute z-30 border border-[#1f7a7a] bg-[#1f7a7a]/14"
                    style={{
                      left: selectionBox.left,
                      top: selectionBox.top,
                      width: selectionBox.width,
                      height: selectionBox.height,
                    }}
                  />
                )}
                {visibleTrayMedia.length < unsortedMedia.length && (
                  <button
                    type="button"
                    onClick={() => showMoreMedia("tray")}
                    className="mt-2 inline-flex h-10 flex-[0_0_100%] items-center justify-center rounded-md border border-[#d8d0c6] bg-white px-4 text-sm font-semibold text-[#202124] transition hover:bg-[#f4f1ec]"
                  >
                    Show {Math.min(largeMediaRenderLimit, unsortedMedia.length - visibleTrayMedia.length)} more
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {hasSelection && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-md border border-[#d8d0c6] bg-white/96 p-3 shadow-2xl shadow-[#202124]/18 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare size={16} className="text-[#1f7a7a]" aria-hidden="true" />
              {selectedMediaIds.size} selected
              <button
                type="button"
                onClick={() => setSelectedMediaIds(new Set())}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[#d8d0c6] px-3 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectedMediaIds.forEach((mediaId) => vote(mediaId, "keep"))}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#e3f1ed] px-3 text-sm font-semibold text-[#1f7a7a]"
              >
                <Check size={15} aria-hidden="true" />
                Vote keep
              </button>
              <button
                type="button"
                onClick={() => selectedMediaIds.forEach((mediaId) => vote(mediaId, "delete"))}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#f8e4df] px-3 text-sm font-semibold text-[#9a3f34]"
              >
                <Trash2 size={15} aria-hidden="true" />
                Vote delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingAlbumSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmingAlbumSessionId(null)}
        >
          <div
            className="w-full max-w-sm rounded-md bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Create album?</h3>
            <p className="mt-2 text-sm leading-6 text-[#6b7177]">
              Validation passed for {confirmingAlbumSession.title}. Create the album now?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resetAlbumValidation(confirmingAlbumSession.id)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d0c6] px-4 text-sm font-semibold"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void confirmAlbumCreation(confirmingAlbumSession.id)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#1f7a7a] px-4 text-sm font-semibold text-white"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedMediaId(null)}
        >
          <div
            className="relative grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-md bg-white shadow-2xl lg:grid-cols-[minmax(0,1fr)_390px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-[320px] items-center justify-center bg-[#111] lg:h-[min(72vh,720px)]">
              <MediaPreview item={selectedMedia} fit="contain" className="max-h-[92vh]" />
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
                  <h4 className="font-semibold">{selectedMedia.title}</h4>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[#6b7177]">
                    <CalendarDays size={14} aria-hidden="true" />
                    {formatDate(selectedMedia.capturedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMediaId(null)}
                  title="Close media viewer"
                  className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#f4f1ec]"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </header>

              <div className="border-b border-[#e6e0d8] p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => vote(selectedMedia.id, "keep")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#e3f1ed] text-sm font-semibold text-[#1f7a7a]"
                  >
                    <Check size={16} aria-hidden="true" />
                    Keep {selectedCounts.keep}
                  </button>
                  <button
                    type="button"
                    onClick={() => vote(selectedMedia.id, "delete")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#f8e4df] text-sm font-semibold text-[#9a3f34]"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete {selectedCounts.delete}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle size={16} aria-hidden="true" />
                  Comments
                </div>
                <div className="space-y-4">
                  {selectedComments.map((comment) => {
                    const author = users.find((user) => user.id === comment.userId);
                    return (
                      <div key={comment.id} className="flex gap-3">
                        {author?.avatarUrl?.trim() ? (
                          <Image
                            src={author.avatarUrl.trim()}
                            alt={author.name}
                            width={34}
                            height={34}
                            className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
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
                  {!selectedComments.length && (
                    <p className="rounded-md bg-[#f4f1ec] p-3 text-sm text-[#6b7177]">
                      No comments yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-[#e6e0d8] p-4">
                <div className="flex gap-2">
                  <input
                    value={commentDrafts[selectedMedia.id] || ""}
                    onChange={(event) =>
                      setCommentDrafts((drafts) => ({
                        ...drafts,
                        [selectedMedia.id]: event.target.value,
                      }))
                    }
                    placeholder="Add a comment"
                    className="min-w-0 flex-1 rounded-md border border-[#d8d0c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f7a7a]"
                  />
                  <button
                    type="button"
                    onClick={() => addComment(selectedMedia.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-[#202124] text-white"
                    title="Add comment"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
