import { MediaPreview } from "@/components/media/MediaPreview";
import type { Media } from "@/lib/entities";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 max-[1300px]:mt-4 max-[1300px]:gap-2">
      {mediaItems.map((item, index) => {
        const isSelected = selectedMediaIds?.has(item.id) ?? false;

        return (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-md bg-[#f4f1ec] text-left ring-offset-2 ring-offset-white",
              index === 0
                ? "col-span-2 row-span-2 h-72 max-[1300px]:h-60"
                : "h-34 min-h-34 max-[1300px]:h-28 max-[1300px]:min-h-28",
              isSelected && "ring-2 ring-[#1f7a7a]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenMedia?.(item.id)}
              className={cn("h-full w-full text-left", onOpenMedia && "transition hover:opacity-90")}
            >
              <MediaPreview item={item} />
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
                  "absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white shadow-sm backdrop-blur transition hover:bg-black/60",
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
