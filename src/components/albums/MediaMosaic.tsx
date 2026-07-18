import { MediaPreview } from "@/components/media/MediaPreview";
import type { Media } from "@/lib/entities";
import { cn } from "@/lib/utils";

export function MediaMosaic({
  mediaItems,
  onOpenMedia,
}: {
  mediaItems: Media[];
  onOpenMedia?: (mediaId: string) => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 max-[1300px]:mt-4 max-[1300px]:gap-2">
      {mediaItems.map((item, index) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onOpenMedia?.(item.id)}
          className={cn(
            "overflow-hidden rounded-md bg-[#f4f1ec] text-left",
            onOpenMedia && "transition hover:opacity-90",
            index === 0
              ? "col-span-2 row-span-2 h-72 max-[1300px]:h-60"
              : "h-34 min-h-34 max-[1300px]:h-28 max-[1300px]:min-h-28",
          )}
        >
          <MediaPreview item={item} />
        </button>
      ))}
    </div>
  );
}
