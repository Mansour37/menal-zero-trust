"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("menal-theme", next ? "light" : "dark");
    } catch {
      // stockage indisponible (navigation privee) : le theme reste actif pour la session
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Passer au theme sombre" : "Passer au theme clair"}
      className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-[var(--ink-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition"
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
      {isLight ? "Theme sombre" : "Theme clair"}
    </button>
  );
}
