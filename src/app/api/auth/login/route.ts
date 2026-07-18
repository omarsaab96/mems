import { createSession, verifyPassword } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await UserModel.findOne({ email });
    const passwordHash = typeof user?.passwordHash === "string" ? user.passwordHash : "";
    const isValid = user ? await verifyPassword(password, passwordHash) : false;
    if (!user || !isValid) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user._id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to log in" },
      { status: 500 },
    );
  }
}
