import { createSession, hashPassword } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!name || !email || password.length < 8) {
      return Response.json(
        { error: "Name, email, and an 8+ character password are required" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const existing = await UserModel.findOne({ email });
    if (existing && typeof existing.passwordHash === "string" && existing.passwordHash.length > 0) {
      return Response.json({ error: "Email is already registered" }, { status: 409 });
    }

    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.role = "partner";
      await existing.save();
      await UserModel.collection.updateOne(
        { _id: existing._id },
        { $set: { name, passwordHash, role: "partner" } },
      );

      await createSession(existing._id);

      return Response.json({ ok: true });
    }

    const user = await UserModel.create({
      name,
      email,
      passwordHash,
      avatarUrl: "",
      role: "partner",
    });
    await createSession(user._id);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to register" },
      { status: 500 },
    );
  }
}
