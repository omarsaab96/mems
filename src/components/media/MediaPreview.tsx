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
  const previewUrl = fit === "cover" ? (item.thumbnailUrl ?? item.url) : item.url;

  if (item.type === "video") {
    if (fit === "cover" && item.thumbnailUrl) {
      return (
        <div
          className={cn("h-full w-full bg-cover bg-center", className)}
          style={{ backgroundImage: `url(${previewUrl})` }}
          role="img"
          aria-label={item.title}
        />
      );
    }

    return (
      <video
        src={previewUrl}
        className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain", className)}
        controls={fit === "contain"}
        muted
        preload={fit === "cover" ? "metadata" : "auto"}
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
      style={{ backgroundImage: `url(${previewUrl})` }}
      role="img"
      aria-label={item.title}
    />
  );
}
