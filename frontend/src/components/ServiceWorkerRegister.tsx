"use client";

import { useEffect } from "react";

// Registers /public/sw.js in production. In dev it removes any worker left over
// from testing a production build on the same port, since its cache would keep
// serving stale dev chunks (dev chunk names aren't content-hashed).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) return;
        Promise.all(registrations.map((r) => r.unregister()))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kaamlee-")).map((k) => caches.delete(k))))
          .then(() => window.location.reload());
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("Service worker registration failed:", error));
  }, []);

  return null;
}
