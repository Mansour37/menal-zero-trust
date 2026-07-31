import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "https://menal-api-dev-5j4ih577pq-ew.a.run.app";

export async function POST(request: NextRequest) {
  const body = await request.text();
  // Le rate-limit anti-bruteforce de l API (10/minute) doit s appliquer par
  // client reel, pas par ce serveur Next.js qui proxy toutes les requetes :
  // on relaie le X-Forwarded-For pose par le Load Balancer en amont (voir
  // app/auth/router.py cote API pour l extraction sure de l IP reelle).
  const forwardedFor = request.headers.get("x-forwarded-for");
  const res = await fetch(`${API_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
    },
    body,
  });

  if (!res.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await res.json();

  // Compte avec MFA active : pas de token tant que le second facteur n est
  // pas verifie (voir app/api/login/mfa/route.ts et app/auth/router.py).
  if (data.mfa_required) {
    return NextResponse.json({ mfaRequired: true, mfaToken: data.mfa_token });
  }

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
