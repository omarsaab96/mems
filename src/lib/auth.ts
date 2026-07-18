import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import {
  AlbumModel,
  CoupleModel,
  MediaModel,
  MemoryModel,
  SessionModel,
  TimelineItemModel,
  UserModel,
  VoteSessionModel,
} from "@/lib/models";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "mems_session";
const SESSION_TTL_MS = 60 * 60 * 1000;

export type AuthContext = {
  userId: Types.ObjectId;
  coupleId?: Types.ObjectId;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function findActiveCoupleForUser(userId: Types.ObjectId) {
  const couple = await CoupleModel.findOne({
    partnerIds: userId,
    "partnerIds.1": { $exists: true },
  }).sort({ createdAt: -1 });

  if (!couple) return null;

  const staleCouples = await CoupleModel.find({
    _id: { $ne: couple._id },
    partnerIds: userId,
    "partnerIds.1": { $exists: false },
  });
  const staleCoupleIds = staleCouples.map((item) => item._id);

  if (staleCoupleIds.length) {
    await Promise.all([
      MediaModel.updateMany({ coupleId: { $in: staleCoupleIds } }, { $set: { coupleId: couple._id } }),
      VoteSessionModel.updateMany({ coupleId: { $in: staleCoupleIds } }, { $set: { coupleId: couple._id } }),
      AlbumModel.updateMany({ coupleId: { $in: staleCoupleIds } }, { $set: { coupleId: couple._id } }),
      MemoryModel.updateMany({ coupleId: { $in: staleCoupleIds } }, { $set: { coupleId: couple._id } }),
      TimelineItemModel.updateMany({ coupleId: { $in: staleCoupleIds } }, { $set: { coupleId: couple._id } }),
      CoupleModel.deleteMany({ _id: { $in: staleCoupleIds } }),
    ]);
  }

  return couple;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(userId: Types.ObjectId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await SessionModel.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    lastSeenAt: new Date(),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDb();
    await SessionModel.deleteOne({ tokenHash: hashToken(token) });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  await connectDb();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await SessionModel.findOne({ tokenHash: hashToken(token) });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await SessionModel.findByIdAndDelete(session._id);
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const user = await UserModel.findById(session.userId);
  if (!user) {
    await SessionModel.findByIdAndDelete(session._id);
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const couple = await findActiveCoupleForUser(user._id);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  session.expiresAt = expiresAt;
  session.lastSeenAt = new Date();
  await session.save();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return {
    userId: user._id,
    coupleId: couple?._id,
  };
}

export async function requireUserContext() {
  const context = await getAuthContext();
  if (!context) {
    throw new Error("Unauthorized");
  }
  return context;
}

export async function requireAuthContext() {
  const context = await requireUserContext();
  if (!context.coupleId) {
    throw new Error("OnboardingRequired");
  }
  return {
    userId: context.userId,
    coupleId: context.coupleId,
  };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function onboardingRequiredResponse() {
  return Response.json({ error: "Partner onboarding is required" }, { status: 428 });
}
