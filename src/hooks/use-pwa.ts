/** PWA-Hilfen: Service-Worker-Registrierung, Update-Hinweis und Online-Status. */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const OFFLINE_MESSAGE =
  "Du bist offline. Bereits geladene Daten können angezeigt, aber nicht bearbeitet werden.";
export const ONLINE_MESSAGE = "Verbindung wiederhergestellt.";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    wasOffline.current = !navigator.onLine;
    if (!navigator.onLine) {
      toast.warning(OFFLINE_MESSAGE, { id: "connection-state" });
    }

    const goOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success(ONLINE_MESSAGE, { id: "connection-state" });
      }
    };
    const goOffline = () => {
      setOnline(false);
      wasOffline.current = true;
      toast.warning(OFFLINE_MESSAGE, { id: "connection-state" });
    };

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
                id: "app-update",
                duration: Infinity,
                action: {
                  label: "Jetzt aktualisieren",
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
