"use client";

import { Album, Clock3, Heart, Home as HomeIcon, ImagePlus, LogOut, Settings, Upload } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { AppSection } from "@/lib/app-types";
import type { Couple, User } from "@/lib/entities";
import { cn } from "@/lib/utils";

export function AppShell({
  activeSection,
  setActiveSection,
  onUpload,
  couple,
  users,
  currentUserId,
  onOpenProfile,
  onLogout,
  headerActions,
  children,
}: {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  onUpload: (files: FileList | null) => void;
  couple: Couple;
  users: User[];
  currentUserId: string;
  onOpenProfile: () => void;
  onLogout: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0] ?? null;

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-[#202124]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr] max-[1300px]:lg:grid-cols-[240px_1fr]">
        <aside className="flex h-screen max-h-screen flex-col overflow-hidden border-r border-[#e6e0d8] bg-white p-5 lg:sticky lg:top-0 max-[1300px]:p-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#ef6f5e] text-white max-[1300px]:h-10 max-[1300px]:w-10">
                <Heart size={20} fill="currentColor" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6b7177]">Mems</p>
                <h1 className="text-xl font-semibold tracking-normal max-[1300px]:text-lg">{couple.displayName || "Mems"}</h1>
              </div>
            </div>

            <nav className="mt-8 space-y-2 max-[1300px]:mt-6">
              {[
                ["dashboard", "Dashboard", HomeIcon],
                ["media", "Media voting", ImagePlus],
                ["albums", "Albums", Album],
                ["memories", "Memories", Heart],
                ["timeline", "Timeline", Clock3],
              ].map(([id, label, Icon]) => {
                const DisplayIcon = Icon as typeof HomeIcon;
                return (
                  <button
                    key={id as string}
                    type="button"
                    onClick={() => setActiveSection(id as AppSection)}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition max-[1300px]:h-10 max-[1300px]:gap-2 max-[1300px]:text-[13px]",
                      activeSection === id
                        ? "bg-[#fff1ec] text-[#b84f3f]"
                        : "text-[#5f666d] hover:bg-[#f4f1ec] hover:text-[#202124]",
                    )}
                  >
                    <DisplayIcon size={18} aria-hidden="true" />
                    {label as string}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 rounded-md bg-[#202124] p-4 text-white max-[1300px]:mt-6 max-[1300px]:p-3">
              <p className="text-sm font-semibold">Shared with</p>
              <div className="mt-1 flex -space-x-2">
                {users.map((user) =>
                  user.avatarUrl?.trim() ? (
                    <Image
                      key={user.id}
                      src={user.avatarUrl.trim()}
                      alt={user.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border-2 border-[#202124] object-cover"
                    />
                  ) : (
                    <div
                      key={user.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#202124] bg-[#ef6f5e] text-xs font-bold"
                    >
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                  ),
                )}
                {!users.length && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#202124] bg-[#ef6f5e] text-sm font-bold">
                    M
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs leading-4 text-white/70">
                Partners manage everything. Guests can vote and comment when invited.
              </p>
            </div>
          </div>

          <div className="mt-auto border-t border-[#e6e0d8] pt-4">
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-[#f4f1ec]"
            >
              {currentUser?.avatarUrl?.trim() ? (
                <Image
                  src={currentUser.avatarUrl.trim()}
                  alt={currentUser.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef6f5e] text-sm font-bold text-white">
                  {(currentUser?.name ?? "M").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{currentUser?.name ?? "Mems user"}</p>
                <p className="truncate text-xs text-[#6b7177]">{currentUser?.email ?? ""}</p>
              </div>
              <Settings size={16} className="shrink-0 text-[#6b7177]" aria-hidden="true" />
            </button>
            <div className="mt-3">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d8d0c6] text-sm font-semibold text-[#9a3f34] transition hover:bg-[#f8e4df]"
              >
                <LogOut size={16} aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5 lg:p-8 max-[1300px]:lg:p-5">
          {activeSection !== "media" && (
            <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-[#6b7177]">Couple workspace</p>
                <h2 className="text-3xl font-semibold tracking-normal max-[1300px]:text-2xl">
                  {activeSection === "dashboard" && "Dashboard"}
                  {activeSection === "albums" && "Albums"}
                  {activeSection === "memories" && "Memories"}
                  {activeSection === "timeline" && "Timeline"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {headerActions}
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
          )}

          {children}
        </section>
      </div>
    </main>
  );
}
