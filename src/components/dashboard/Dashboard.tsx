"use client";

import { Vote, type LucideIcon } from "lucide-react";
import { MediaMosaic } from "@/components/albums/MediaMosaic";
import type { Album, Media, VoteSession } from "@/lib/entities";
import type { AppSection } from "@/lib/app-types";

export function Dashboard({
  stats,
  album,
  albumMedia,
  activeFolder,
  voteMedia,
  setActiveSection,
}: {
  stats: Array<{ label: string; value: number; icon: LucideIcon }>;
  album: Album | null;
  albumMedia: Media[];
  activeFolder: VoteSession | null;
  voteMedia: Media[];
  setActiveSection: (section: AppSection) => void;
}) {
  return (
    <div className="space-y-6 max-[1300px]:space-y-5">
      <div className="grid gap-4 md:grid-cols-4 max-[1300px]:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-md border border-[#e6e0d8] bg-white p-4 shadow-sm max-[1300px]:p-3">
              <Icon size={20} className="text-[#ef6f5e]" aria-hidden="true" />
              <p className="mt-4 text-3xl font-semibold max-[1300px]:mt-3 max-[1300px]:text-2xl">{stat.value}</p>
              <p className="text-sm font-medium text-[#6b7177]">{stat.label}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] max-[1300px]:gap-4">
        <section className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm max-[1300px]:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#6b7177]">Latest album</p>
              <h3 className="text-2xl font-semibold tracking-normal max-[1300px]:text-xl">
                {album?.title ?? "No albums yet"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("albums")}
              className="rounded-md border border-[#d8d0c6] px-3 py-2 text-sm font-semibold"
            >
              Go to albums
            </button>
          </div>
          <MediaMosaic mediaItems={albumMedia} />
          {!album && (
            <p className="mt-4 text-sm leading-6 text-[#6b7177]">
              Create an album from a folder after voting.
            </p>
          )}
        </section>

        <section className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm max-[1300px]:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#6b7177]">Needs voting</p>
              <h3 className="text-2xl font-semibold tracking-normal max-[1300px]:text-xl">
                {activeFolder?.title ?? "No folders yet"}
              </h3>
            </div>
            <Vote size={22} className="text-[#ef6f5e]" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-6 text-[#6b7177]">
            {voteMedia.length} photos/videos are waiting for keep or delete decisions from the couple and invited guests.
          </p>
          <button
            type="button"
            onClick={() => setActiveSection("media")}
            className="mt-5 rounded-md border border-[#d8d0c6] px-3 py-2 text-sm font-semibold"
          >
            Review media
          </button>
        </section>
      </div>
    </div>
  );
}
