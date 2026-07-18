import { requireUserContext, unauthorizedResponse } from "@/lib/auth";
import { serializeUser } from "@/lib/api-serializers";
import { connectDb } from "@/lib/db";
import { UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    await connectDb();
    const { userId } = await requireUserContext();
    const body = (await request.json()) as { name?: string; avatarUrl?: string };
    const name = body.name?.trim();
    const avatarUrl = body.avatarUrl?.trim() ?? "";

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { name, avatarUrl } },
      { new: true },
    );
    if (!user) return unauthorizedResponse();

    return Response.json({ user: serializeUser(user.toObject()) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 },
    );
  }
}
