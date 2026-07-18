"use client";

import { Clock3, Eye, EyeOff, Heart, Lock, Mail, Play, Sparkles, User, Users, Vote } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { AuthMode } from "@/lib/app-types";
import { cn } from "@/lib/utils";

export function AuthScreen({
  authMode,
  setAuthMode,
  onSubmit,
  error,
}: {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff7f2] px-5 py-10 text-[#202124]">
      <div className="absolute inset-0 love-background" aria-hidden="true" />
      <HeartIconCloud />

      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-2xl shadow-[#b85c4b]/15 backdrop-blur-xl lg:grid-cols-[1fr_420px]">
        <div className="flex min-h-[620px] flex-col justify-between bg-[#ef6f5e] p-8 text-white lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/18">
              <Heart size={25} fill="currentColor" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/75">Mems</p>
              <h1 className="text-2xl font-semibold tracking-normal">Couple memories, together.</h1>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
              Shared space
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-tight tracking-normal">
              Save the moments you both want to remember.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/82">
              Upload photos and videos, vote on the keepers, turn them into albums, and build a timeline that belongs to the couple.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Private couple space", Lock],
              ["Photo voting", Vote],
              ["Shared timeline", Clock3],
            ].map(([label, Icon]) => {
              const DisplayIcon = Icon as typeof Lock;
              return (
                <div key={label as string} className="rounded-md bg-white/14 p-4">
                  <DisplayIcon size={20} aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">{label as string}</p>
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col justify-center p-7 sm:p-9">
          <div className="mb-8">
            <p className="text-sm font-medium text-[#6b7177]">
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">
              {authMode === "login" ? "Log in to Mems" : "Register for Mems"}
            </h2>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-md bg-[#f4f1ec] p-1">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={cn(
                "h-10 rounded-md text-sm font-semibold transition",
                authMode === "login" ? "bg-white shadow-sm" : "text-[#6b7177]",
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              className={cn(
                "h-10 rounded-md text-sm font-semibold transition",
                authMode === "register" ? "bg-white shadow-sm" : "text-[#6b7177]",
              )}
            >
              Register
            </button>
          </div>

          {authMode === "register" && (
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-semibold">Name</span>
              <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
                <User size={18} className="text-[#6b7177]" aria-hidden="true" />
                <input className="w-full outline-none" name="name" placeholder="john" />
              </span>
            </label>
          )}

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold">Email</span>
              <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
                <Mail size={18} className="text-[#6b7177]" aria-hidden="true" />
              <input className="w-full outline-none" name="email" type="email" placeholder="john@example.com" />
            </span>
          </label>

          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">Password</span>
            <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
              <Lock size={18} className="text-[#6b7177]" aria-hidden="true" />
              <input
                className="w-full outline-none"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                title={showPassword ? "Hide password" : "Show password"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6b7177] hover:bg-[#f4f1ec] hover:text-[#202124]"
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>

          {error && (
            <p className="mb-4 rounded-md border border-[#ef6f5e] bg-[#fff1ec] p-2 text-xs font-semibold text-[#ef6f5e]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#202124] px-5 text-sm font-semibold text-white shadow-sm"
          >
            <Heart size={17} fill="currentColor" aria-hidden="true" />
            {authMode === "login" ? "Enter dashboard" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function HeartIconCloud() {
  const icons = [
    { Icon: Heart, className: "left-[8%] top-[12%] text-[#ef6f5e]", delay: "0s" },
    { Icon: Sparkles, className: "left-[18%] bottom-[14%] text-[#f4d35e]", delay: "1.2s" },
    { Icon: Heart, className: "right-[10%] top-[18%] text-[#1f7a7a]", delay: "0.6s" },
    { Icon: Users, className: "right-[18%] bottom-[16%] text-[#ef6f5e]", delay: "1.8s" },
    { Icon: Play, className: "left-[48%] top-[8%] text-[#202124]", delay: "0.9s" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {icons.map(({ Icon, className, delay }, index) => (
        <div
          key={index}
          className={cn(
            "love-float absolute flex h-14 w-14 items-center justify-center rounded-full bg-white/72 shadow-lg shadow-[#b85c4b]/10 backdrop-blur",
            className,
          )}
          style={{ animationDelay: delay }}
        >
          <Icon size={24} fill={Icon === Heart ? "currentColor" : "none"} />
        </div>
      ))}
    </div>
  );
}
