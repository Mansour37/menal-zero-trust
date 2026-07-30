"use client";

import { useEffect } from "react";

/**
 * Light client-side deterrents. Real protection is server-side.
 */
export function AntiScraping() {
  useEffect(() => {
    // Block right-click
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // Block Ctrl+U (view source)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "u") e.preventDefault();
    };

    // Disable text selection on hassaniya content
    const style = document.createElement("style");
    style.textContent = `[dir="rtl"] { user-select: none; -webkit-user-select: none; }`;
    document.head.appendChild(style);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      style.remove();
    };
  }, []);

  return null;
}
