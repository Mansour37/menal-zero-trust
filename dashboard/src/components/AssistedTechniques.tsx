import { Sparkles } from "lucide-react";

import type { AssistedTechnique } from "@/lib/types";

// Affiche ce que la qualification assistee (encodeur ATT&CK-BERT) PROPOSE pour
// l'incident : les techniques ATT&CK les plus proches semantiquement, avec leur
// score de similarite. C'est l'apport original du socle rendu visible au moment
// ou l'analyste en a besoin — juste avant qu'il tranche (le verdict, lui, reste
// humain). Rien n'est applique automatiquement : le socle propose, l'humain decide.
export default function AssistedTechniques({ items }: { items: AssistedTechnique[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-xs text-[var(--ink-faint)]">
        Qualification en cours : l&apos;enrichissement sémantique s&apos;exécute toutes les 15 minutes.
        Aucun candidat ATT&amp;CK au-dessus du seuil (0,60) pour cette entité pour l&apos;instant.
      </p>
    );
  }

  const model = items.find((t) => t.model_version)?.model_version;

  return (
    <div className="space-y-2.5">
      {items.map((t, i) => {
        const pct = Math.round(t.similarity * 100);
        return (
          <div key={t.technique_id} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-[var(--ink-faint)] w-4 tabular-nums">{i + 1}</span>
            <span className="font-mono text-xs font-semibold text-[var(--ink)] w-24">{t.technique_id}</span>
            <span className="text-xs text-[var(--ink-muted)] flex-1 truncate">{t.tactic ?? "—"}</span>
            <div className="w-28 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: "var(--accent-grad, var(--sev-high))" }}
              />
            </div>
            <span className="text-xs font-mono tabular-nums text-[var(--ink)] w-12 text-right">
              {t.similarity.toFixed(2)}
            </span>
          </div>
        );
      })}
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)] pt-1">
        <Sparkles size={12} />
        Encodeur {model ?? "ATT&CK-BERT"} — rapprochement sémantique déterministe, exécuté localement.
        Le socle propose ; l&apos;analyste décide.
      </p>
    </div>
  );
}
