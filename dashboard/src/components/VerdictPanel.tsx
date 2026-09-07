"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldX, Eye, EyeOff, Check } from "lucide-react";

import type { Verdict } from "@/lib/types";

// Panneau de qualification analyste (UC5). Quatre verdicts alignes sur le
// contrat API (siem.py: ^(CONFIRMED|FALSE_POSITIVE|ACKNOWLEDGED|IGNORED)$).
// La decision reste humaine : le socle propose (score, techniques, candidats
// ATT&CK), l analyste tranche. L ecriture est append-only cote API : chaque
// verdict est un nouvel enregistrement horodate, jamais une modification.
const OPTIONS: { value: Verdict; label: string; cls: string; Icon: typeof ShieldCheck }[] = [
  { value: "CONFIRMED", label: "Vrai positif", cls: "btn-danger", Icon: ShieldCheck },
  { value: "FALSE_POSITIVE", label: "Faux positif", cls: "btn-ghost", Icon: ShieldX },
  { value: "ACKNOWLEDGED", label: "Pris en compte", cls: "btn-ghost", Icon: Eye },
  { value: "IGNORED", label: "Ignorer", cls: "btn-ghost", Icon: EyeOff },
];

const FR: Record<Verdict, string> = {
  CONFIRMED: "Vrai positif",
  FALSE_POSITIVE: "Faux positif",
  ACKNOWLEDGED: "Pris en compte",
  IGNORED: "Ignoré",
};

export default function VerdictPanel({
  entity,
  current,
  currentComment,
}: {
  entity: string;
  current: Verdict | null;
  currentComment: string | null;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<Verdict | null>(null);
  const [saved, setSaved] = useState<Verdict | null>(current);
  const [savedComment, setSavedComment] = useState<string | null>(currentComment);
  const [error, setError] = useState<string | null>(null);

  async function submit(verdict: Verdict) {
    setPending(verdict);
    setError(null);
    try {
      const res = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, verdict, comment }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Erreur ${res.status}`);
      }
      setSaved(verdict);
      setSavedComment(comment || savedComment);
      setComment("");
      // Rafraichit le rendu serveur : la liste /incidents et la sante des
      // regles refletent le nouveau verdict au prochain cycle de lecture.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {saved && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <Check size={15} className="mt-0.5 text-[var(--sev-low)]" />
          <div className="text-xs">
            <span className="font-semibold text-[var(--ink)]">Verdict actuel : {FR[saved]}</span>
            {savedComment && <span className="block text-[var(--ink-faint)] mt-0.5">{savedComment}</span>}
          </div>
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Note de qualification (optionnel) — contexte, source, action prise…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--border-strong)] focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label, cls, Icon }) => (
          <button
            key={value}
            type="button"
            disabled={pending !== null}
            onClick={() => submit(value)}
            className={`btn ${cls} text-xs px-3 py-1.5 inline-flex items-center gap-1.5`}
          >
            <Icon size={14} />
            {pending === value ? "Enregistrement…" : label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-[var(--sev-critical)]">{error}</p>}
      <p className="text-[11px] text-[var(--ink-faint)]">
        La décision reste humaine. Chaque verdict est horodaté et conservé sans écraser le précédent
        (traçabilité append-only).
      </p>
    </div>
  );
}
