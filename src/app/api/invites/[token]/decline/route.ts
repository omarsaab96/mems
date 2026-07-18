import { connectDb } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite-tokens";
import { PartnerInviteModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await connectDb();
    const { token } = await params;
    const invite = await PartnerInviteModel.findOne({ tokenHash: hashInviteToken(token) });
    if (!invite) return Response.json({ error: "Invite not found" }, { status: 404 });
    if (invite.status !== "pending") {
      return Response.json({ error: "Invite is no longer active" }, { status: 410 });
    }

    invite.status = "declined";
    invite.declinedAt = new Date();
    await invite.save();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to decline invite" },
      { status: 500 },
    );
  }
}
