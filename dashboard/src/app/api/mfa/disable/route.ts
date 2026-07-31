import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "https://menal-api-dev-5j4ih577pq-ew.a.run.app";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const res = await fetch(`${API_URL}/auth/mfa/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password: body.password, code: body.code }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json({ error: detail.detail || "Requête invalide" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
