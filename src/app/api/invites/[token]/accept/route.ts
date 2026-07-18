import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite-tokens";
import { CoupleModel, PartnerInviteModel, UserModel } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    await connectDb();
    const { token } = await params;
    const body = (await request.json()) as { name?: string; password?: string };
    const password = body.password ?? "";
    const name = body.name?.trim();

    if (password.length < 8) {
      return Response.json({ error: "An 8+ character password is required" }, { status: 400 });
    }

    const invite = await PartnerInviteModel.findOne({ tokenHash: hashInviteToken(token) });
    if (!invite) return Response.json({ error: "Invite not found" }, { status: 404 });
    if (invite.status !== "pending" || invite.expiresAt.getTime() <= Date.now()) {
      invite.status = invite.status === "pending" ? "expired" : invite.status;
      await invite.save();
      return Response.json({ error: "Invite is no longer active" }, { status: 410 });
    }

    const inviter = await UserModel.findById(invite.inviterUserId);
    if (!inviter) return Response.json({ error: "Inviter no longer exists" }, { status: 404 });

    let invitee = await UserModel.findOne({ email: invite.inviteeEmail });
    if (invitee?.passwordHash) {
      const isValid = await verifyPassword(password, String(invitee.passwordHash));
      if (!isValid) return Response.json({ error: "Invalid password" }, { status: 401 });
    } else if (invitee) {
      invitee.name = name || invitee.name || invite.inviteeEmail;
      invitee.passwordHash = await hashPassword(password);
      invitee.role = "partner";
      await invitee.save();
    } else {
      if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
      invitee = await UserModel.create({
        name,
        email: invite.inviteeEmail,
        passwordHash: await hashPassword(password),
        avatarUrl: "",
        role: "partner",
      });
    }

    const [inviterCouple, inviteeCouple] = await Promise.all([
      CoupleModel.findOne({ partnerIds: inviter._id }),
      CoupleModel.findOne({ partnerIds: invitee._id }),
    ]);

    if (inviterCouple && inviterCouple.partnerIds.length >= 2) {
      return Response.json({ error: "Inviter already has a partner connected" }, { status: 409 });
    }
    if (inviteeCouple && String(inviteeCouple._id) !== String(inviterCouple?._id)) {
      return Response.json({ error: "This account is already connected to another workspace" }, { status: 409 });
    }

    const couple =
      inviterCouple ??
      (await CoupleModel.create({
        partnerIds: [inviter._id, invitee._id],
        displayName: `${inviter.name} & ${invitee.name}`,
      }));
    couple.partnerIds = [inviter._id, invitee._id];
    couple.displayName = `${inviter.name} & ${invitee.name}`;
    await couple.save();

    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();
    await PartnerInviteModel.updateMany(
      { inviterUserId: inviter._id, status: "pending", _id: { $ne: invite._id } },
      { $set: { status: "expired" } },
    );

    await createSession(invitee._id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to accept invite" },
      { status: 500 },
    );
  }
}
