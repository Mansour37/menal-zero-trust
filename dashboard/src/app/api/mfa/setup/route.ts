import { NextRequest, NextResponse } from "next/server";

import { apiUrl } from "@/lib/apiUrl";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // POST sans corps : le Google Front End (Cloud Run) rejette en 411 Length
  // Required un POST dépourvu d'en-tête Content-Length. On le force à 0 — sinon
  // l'enrôlement MFA échoue avant même d'atteindre l'API (le QR ne s'affiche pas).
  const res = await fetch(`${apiUrl()}/auth/mfa/setup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: new TextEncoder().encode("{}"),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json({ error: detail.detail || "Erreur" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
