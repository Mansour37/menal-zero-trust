import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "https://menal-api-dev-5j4ih577pq-ew.a.run.app";

export async function POST(request: NextRequest) {
  const { mfaToken, code } = await request.json();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const res = await fetch(`${API_URL}/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
    },
    body: JSON.stringify({ mfa_token: mfaToken, code }),
  });

  if (!res.ok) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

  const data = await res.json();
  const response = NextResponse.json({ ok: true });
  response.cookies.set("token", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 3600,
    path: "/",
  });
  return response;
}
