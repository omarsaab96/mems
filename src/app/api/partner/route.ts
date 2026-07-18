import { requireUserContext, unauthorizedResponse } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { sendPartnerInviteEmail } from "@/lib/email";
import { buildInviteUrl, createInviteToken, hashInviteToken, INVITE_TTL_MS } from "@/lib/invite-tokens";
import { CoupleModel, PartnerInviteModel, UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connectDb();
    const { userId } = await requireUserContext();
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return Response.json({ error: "Partner email is required" }, { status: 400 });
    }

    const [currentUser, partner] = await Promise.all([
      UserModel.findById(userId),
      UserModel.findOne({ email }),
    ]);

    if (!currentUser) return unauthorizedResponse();
    if (String(currentUser.email).toLowerCase() === email) {
      return Response.json({ error: "Use your partner's email, not your own." }, { status: 400 });
    }

    const currentCouple = await CoupleModel.findOne({ partnerIds: currentUser._id });
    if (currentCouple && currentCouple.partnerIds.length >= 2) {
      return Response.json({ error: "You already have a partner connected." }, { status: 409 });
    }

    const partnerCouple = partner ? await CoupleModel.findOne({ partnerIds: partner._id }) : null;
    if (partnerCouple && String(partnerCouple._id) !== String(currentCouple?._id)) {
      return Response.json(
        { error: "That partner is already connected to another workspace." },
        { status: 409 },
      );
    }

    await PartnerInviteModel.updateMany(
      { inviterUserId: currentUser._id, status: "pending" },
      { $set: { status: "expired" } },
    );

    const token = createInviteToken();
    const invite = await PartnerInviteModel.create({
      inviterUserId: currentUser._id,
      inviteeEmail: email,
      tokenHash: hashInviteToken(token),
      status: "pending",
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    const inviteUrl = buildInviteUrl(request, token);
    const emailDelivery = await sendPartnerInviteEmail({
      to: email,
      inviterName: currentUser.name,
      inviteUrl,
    });

    return Response.json({
      invite: {
        id: String(invite._id),
        inviteeEmail: email,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        inviteUrl,
      },
      emailDelivery,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorizedResponse();
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to invite partner" },
      { status: 500 },
    );
  }
}
