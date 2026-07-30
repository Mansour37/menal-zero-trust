"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // In local dev, NEVER register the SW (it caches JS and hides hot changes).
    // Also actively unregister any previously-installed dev SW + nuke its caches.
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (isLocal) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("SW registered, scope:", reg.scope);
        setInterval(() => reg.update(), 60 * 60 * 1000); // every hour
      })
      .catch((err) => console.warn("SW registration failed:", err));
  }, []);

  return null;
}
