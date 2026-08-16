import { FlaskConical } from "lucide-react";

// Couleur accent (jamais rouge/vert) : c'est la seule teinte de la palette
// qui n'est pas déjà réservée à un sens de sévérité/statut — voir globals.css
// ("les jaunes/rouges ont un sens, ils ne décorent pas").
export default function DemoBadge() {
  return (
    <span
      className="pill bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
      title="Données fictives générées localement — l'API MENAL n'est pas joignable depuis cet environnement."
    >
      <FlaskConical size={11} strokeWidth={2.4} />
      Mode démonstration
    </span>
  );
}
