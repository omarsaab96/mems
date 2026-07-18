"use client";

import { Eye, EyeOff, Heart, Lock, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, type FormEvent } from "react";

type InviteInfo = {
  inviteeEmail: string;
  inviterName: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: string;
  inviteeExists: boolean;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }
  return payload as T;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeclined, setIsDeclined] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const result = await requestJson<{ invite: InviteInfo }>(`/api/invites/${token}`, {
          cache: "no-store",
        });
        setInvite(result.invite);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load invite");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvite();
  }, [token]);

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await requestJson<{ ok: boolean }>(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      router.replace("/");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Failed to accept invite");
    }
  }

  async function declineInvite() {
    setError("");

    try {
      await requestJson<{ ok: boolean }>(`/api/invites/${token}/decline`, {
        method: "POST",
      });
      setIsDeclined(true);
    } catch (declineError) {
      setError(declineError instanceof Error ? declineError.message : "Failed to decline invite");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] p-5 text-[#202124]">
      <section className="w-full max-w-md rounded-md border border-[#e6e0d8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#ef6f5e] text-white">
            <Heart size={22} fill="currentColor" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#6b7177]">Mems invite</p>
            <h1 className="text-xl font-semibold tracking-normal">Join your partner</h1>
          </div>
        </div>

        {isLoading && (
          <p className="mt-6 rounded-md bg-[#f4f1ec] p-3 text-sm font-semibold text-[#6b7177]">
            Loading invite...
          </p>
        )}

        {!isLoading && invite && invite.status !== "pending" && (
          <p className="mt-6 rounded-md bg-[#f4f1ec] p-3 text-sm font-semibold text-[#6b7177]">
            This invite is {invite.status}.
          </p>
        )}

        {isDeclined && (
          <p className="mt-6 rounded-md bg-[#f4f1ec] p-3 text-sm font-semibold text-[#6b7177]">
            Invite declined.
          </p>
        )}

        {!isLoading && invite?.status === "pending" && !isDeclined && (
          <>
            <p className="mt-6 text-sm leading-6 text-[#5f666d]">
              {invite.inviterName} invited {invite.inviteeEmail} to create a shared Mems
              workspace.
            </p>

            <form onSubmit={acceptInvite} className="mt-5 space-y-4">
              {!invite.inviteeExists && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Your name</span>
                  <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
                    <User size={18} className="text-[#6b7177]" aria-hidden="true" />
                    <input
                      className="w-full outline-none"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                    />
                  </span>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  {invite.inviteeExists ? "Password" : "Create password"}
                </span>
                <span className="flex h-12 items-center gap-3 rounded-md border border-[#d8d0c6] bg-white px-3">
                  <Lock size={18} className="text-[#6b7177]" aria-hidden="true" />
                  <input
                    className="w-full outline-none"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                <p className="rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={declineInvite}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[#d8d0c6] text-sm font-semibold"
                >
                  Decline
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#202124] text-sm font-semibold text-white"
                >
                  Accept
                </button>
              </div>
            </form>
          </>
        )}

        {!isLoading && !invite && error && (
          <p className="mt-6 rounded-md border border-[#f1c7be] bg-[#fff1ec] p-3 text-sm font-semibold text-[#9a3f34]">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
