/** PWA-Hilfen: Service-Worker-Registrierung, Update-Hinweis und Online-Status. */

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

export function useServiceWorker() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              toast("Eine neue Version ist verfügbar.", {
                duration: Infinity,
                action: {
                  label: "Neu laden",
                  onClick: () => {
                    worker.postMessage("SKIP_WAITING");
                    window.location.reload();
                  },
                },
              });
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);
}
