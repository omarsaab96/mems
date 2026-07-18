import { cn } from "@/lib/utils";
import type { Media } from "@/lib/entities";

export function MediaPreview({
  item,
  className,
  fit = "cover",
}: {
  item: Media;
  className?: string;
  fit?: "cover" | "contain";
}) {
  if (item.type === "video") {
    return (
      <video
        src={item.url}
        className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)}
        controls
        muted
      />
    );
  }

  return (
    <div
      className={cn(
        "h-full w-full bg-center",
        fit === "cover" ? "bg-cover" : "bg-contain bg-no-repeat",
        className,
      )}
      style={{ backgroundImage: `url(${item.url})` }}
      role="img"
      aria-label={item.title}
    />
  );
}
