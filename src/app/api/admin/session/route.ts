import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminSessionCookie,
  adminSessionLifetimeSeconds,
  createAdminSessionToken,
  isValidAdminAccessCode,
} from "@/lib/admin-session";

const loginSchema = z.object({ accessCode: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "ADMIN_SESSION_SECRET is not configured" }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidAdminAccessCode(parsed.data.accessCode)) {
    return NextResponse.json({ error: "رمز الإدارة غير صحيح" }, { status: 401 });
  }

  const session = createAdminSessionToken();
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(adminSessionCookie, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: adminSessionLifetimeSeconds,
    expires: new Date(session.expiresAt * 1000),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}