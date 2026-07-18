import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const context = await getAuthContext();
  return Response.json({ authenticated: Boolean(context) });
}
