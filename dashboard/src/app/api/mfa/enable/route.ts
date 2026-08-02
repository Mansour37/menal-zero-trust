import { NextRequest, NextResponse } from "next/server";

import { apiUrl } from "@/lib/apiUrl";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const res = await fetch(`${apiUrl()}/auth/mfa/enable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: body.code }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json({ error: detail.detail || "Code invalide" }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
