import "server-only";

import nodemailer from "nodemailer";

function smtpPort() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) ? port : 587;
}

function smtpSecure(port: number) {
  if (process.env.SMTP_SECURE) return process.env.SMTP_SECURE === "true";
  return port === 465;
}

export async function sendPartnerInviteEmail({
  to,
  inviterName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  inviteUrl: string;
}) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.INVITE_EMAIL_FROM;
  const port = smtpPort();

  if (!host || !from) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_HOST and INVITE_EMAIL_FROM.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: smtpSecure(port),
    auth: user || pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `${inviterName} invited you to Mems`,
      text: `${inviterName} invited you to create a shared Mems workspace. Accept the invite: ${inviteUrl}`,
      html: `
        <p>${inviterName} invited you to create a shared Mems workspace.</p>
        <p><a href="${inviteUrl}">Accept the invite</a></p>
      `,
    });

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "SMTP failed to send the invite.",
    };
  }
}
