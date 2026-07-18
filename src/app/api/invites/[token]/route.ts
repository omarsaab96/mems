import { connectDb } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite-tokens";
import { PartnerInviteModel, UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await connectDb();
    const { token } = await params;
    const invite = await PartnerInviteModel.findOne({ tokenHash: hashInviteToken(token) });
    if (!invite) return Response.json({ error: "Invite not found" }, { status: 404 });

    if (invite.status === "pending" && invite.expiresAt.getTime() <= Date.now()) {
      invite.status = "expired";
      await invite.save();
    }

    const [inviter, invitee] = await Promise.all([
      UserModel.findById(invite.inviterUserId),
      UserModel.findOne({ email: invite.inviteeEmail }),
    ]);

    return Response.json({
      invite: {
        inviteeEmail: invite.inviteeEmail,
        inviterName: inviter?.name ?? "Your partner",
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        inviteeExists: Boolean(invitee?.passwordHash),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load invite" },
      { status: 500 },
    );
  }
}
