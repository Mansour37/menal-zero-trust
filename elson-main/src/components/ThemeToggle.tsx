"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Light/dark toggle. The actual theme is applied before paint by an inline script
// in layout.tsx (reads localStorage, falls back to system). This just flips it and
// persists the choice.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* private mode */ }
  };

  return (
    <button onClick={toggle} aria-label="Thème" title="Thème clair / sombre" style={{
      background: "var(--surface-1)", border: "1px solid var(--border)",
      color: "var(--text-muted)", padding: "8px 10px", borderRadius: 10,
      cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.25s",
    }}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
