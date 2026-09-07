import { NextRequest, NextResponse } from "next/server";

import { apiUrl } from "@/lib/apiUrl";

// BFF de qualification analyste (UC5). Le dashboard ne parle jamais a BigQuery
// ni ne detient de droit d ecriture : il relaie le verdict a l API, qui seule
// ecrit dans `analyst_verdicts` (append-only, role admin — voir
// api/app/routers/siem.py::submit_verdict). Le token admin reste dans le cookie
// httpOnly, jamais expose au navigateur (meme pattern que app/api/mfa/*).
const ALLOWED = new Set(["CONFIRMED", "FALSE_POSITIVE", "ACKNOWLEDGED", "IGNORED"]);

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { entity?: string; verdict?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide" }, { status: 400 });
  }

  const entity = (body.entity ?? "").trim();
  const verdict = (body.verdict ?? "").trim();
  if (!entity) return NextResponse.json({ error: "Entite manquante" }, { status: 400 });
  if (!ALLOWED.has(verdict)) return NextResponse.json({ error: "Verdict invalide" }, { status: 400 });

  const res = await fetch(`${apiUrl()}/siem/incidents/${encodeURIComponent(entity)}/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ verdict, comment: (body.comment ?? "").slice(0, 500) }),
  });

  if (res.status === 403) {
    // Role viewer : la qualification est reservee a l admin (siem.py:520).
    return NextResponse.json({ error: "Reserve au role administrateur" }, { status: 403 });
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json({ error: detail.detail || "Erreur API" }, { status: res.status });
  }
  return NextResponse.json(await res.json(), { status: 201 });
}
