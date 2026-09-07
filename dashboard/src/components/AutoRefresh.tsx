"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraichit les donnees de la page en arriere-plan, sans rechargement visible.
 *
 * Les pages SOC sont des Server Components : elles chargent leurs donnees cote
 * serveur a chaque requete. `router.refresh()` re-execute ce fetch serveur et
 * fusionne le nouveau rendu dans le DOM existant — l'etat client, le scroll et
 * le focus sont preserves (pas de flash de rechargement). L'analyste voit donc
 * une nouvelle detection apparaitre seule, ~intervalMs apres son ecriture.
 *
 * Pause automatique quand l'onglet est masque (document.hidden) pour ne pas
 * marteler l'API en arriere-plan ; reprise immediate au retour sur l'onglet.
 */
export default function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function start() {
      if (timer.current) return;
      timer.current = setInterval(() => {
        if (!document.hidden) router.refresh();
      }, intervalMs);
    }
    function stop() {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }
    if (live) start();
    else stop();

    function onVisible() {
      if (!document.hidden && live) router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs, live]);

  return (
    <button
      type="button"
      onClick={() => setLive((v) => !v)}
      title={live ? "Rafraichissement automatique actif — cliquer pour mettre en pause" : "En pause — cliquer pour reprendre"}
      className="pill mono inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${live ? "bg-[var(--ok)] animate-pulse" : "bg-[var(--ink-faint)]"}`}
      />
      {live ? "Live" : "Pause"}
    </button>
  );
}
