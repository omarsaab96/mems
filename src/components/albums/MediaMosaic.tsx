import { MediaPreview } from "@/components/media/MediaPreview";
import type { Media } from "@/lib/entities";
import { cn } from "@/lib/utils";
import { Check, Play } from "lucide-react";

export function MediaMosaic({
  mediaItems,
  onOpenMedia,
  selectedMediaIds,
  onToggleMedia,
}: {
  mediaItems: Media[];
  onOpenMedia?: (mediaId: string) => void;
  selectedMediaIds?: Set<string>;
  onToggleMedia?: (mediaId: string) => void;
}) {
  return (
    <div className="relative mt-5 flex flex-wrap gap-2 max-[1300px]:mt-4">
      {mediaItems.map((item) => {
        const isSelected = selectedMediaIds?.has(item.id) ?? false;

        return (
          <div
            key={item.id}
            className={cn(
              "group relative h-32 w-32 shrink-0 cursor-grab overflow-hidden rounded-md bg-[#f4f1ec] ring-offset-2 ring-offset-white active:cursor-grabbing max-[1300px]:h-28 max-[1300px]:w-28",
              isSelected && "ring-2 ring-[#1f7a7a]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenMedia?.(item.id)}
              className={cn("absolute inset-0 text-left", onOpenMedia && "transition hover:opacity-90")}
            >
              <MediaPreview item={item} fit="cover" />
              {item.type === "video" && (
                <div className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 justify-center p-2 rounded-full bg-black/55 text-white">
                  <Play size={10} fill="currentColor" aria-hidden="true" />
                </div>
              )}
              {isSelected && (
                <div className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#1f7a7a] text-white shadow-sm">
                  <Check size={16} aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />
            </button>
            {onToggleMedia && (
              <button
                type="button"
                title={isSelected ? "Unselect media" : "Select media"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleMedia(item.id);
                }}
                className={cn(
                  "absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white shadow-sm backdrop-blur transition hover:bg-black/60",
                  isSelected && "border-[#1f7a7a] bg-[#1f7a7a]",
                )}
              >
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
