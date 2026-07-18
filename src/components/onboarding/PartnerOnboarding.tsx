"use client";

import { Heart, LogOut, Mail, Users } from "lucide-react";
import type { FormEvent } from "react";
import type { User } from "@/lib/entities";

export function PartnerOnboarding({
  currentUser,
  partnerEmail,
  setPartnerEmail,
  inviteLink,
  invitedEmail,
  emailSent,
  error,
  onSubmit,
  onLogout,
}: {
  currentUser: User | null;
  partnerEmail: string;
  setPartnerEmail: (value: string) => void;
  inviteLink: string;
  invitedEmail: string;
  emailSent: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] p-5 text-[#202124]">
      <section className="w-full max-w-lg rounded-md border border-[#e6e0d8] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#ef6f5e] text-white">
              <Heart size={22} fill="currentColor" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#6b7177]">Mems setup</p>
              <h1 className="text-xl font-semibold tracking-normal">Invite your partner</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            className="flex p-1 items-center justify-center rounded-md hover:bg-[#f4f1ec] gap-1 text-[#6b7177]"
          >
            <span>{currentUser?.name.split(" ")[0]}</span>
            <LogOut size={17} aria-hidden="true" />
          </button>

        </div>

        <div className="mt-6 rounded-md bg-[#f4f1ec] p-4">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#1f7a7a]" aria-hidden="true" />
            <p className="text-sm leading-6 text-[#5f666d]">
              You need a partner account connected before using Mems.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Partner email</span>
            <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
              <Mail size={18} className="text-[#6b7177]" aria-hidden="true" />
              <input
                className="w-full outline-none"
                type="email"
                value={partnerEmail}
                onChange={(event) => setPartnerEmail(event.target.value)}
                placeholder="partner@example.com"
                autoFocus
              />
            </span>
          </label>

          {error && (
            <p className="mt-4 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#202124] px-4 text-sm font-semibold text-white"
          >
            Send invite
          </button>
        </form>

        {inviteLink && (
          <div className="mt-5 rounded-md border border-[#d8d0c6] bg-[#fbfaf8] p-4">
            <p className="text-sm font-semibold">Invite created</p>
            <p className="mt-1 text-xs leading-5 text-[#6b7177]">
              {emailSent
                ? `We sent an invitation to ${invitedEmail}.`
                : `SMTP is not configured or the email could not be sent. Share this invite link with ${invitedEmail}.`}
            </p>
            <input
              readOnly
              value={inviteLink}
              className="mt-3 w-full rounded-md border border-[#d8d0c6] bg-white px-3 py-2 text-xs outline-none"
            />
            <a
              href={inviteLink}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#1f7a7a] px-4 text-sm font-semibold text-white"
            >
              Open invite
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
