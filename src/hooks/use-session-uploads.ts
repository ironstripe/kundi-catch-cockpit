import { useCallback, useEffect, useRef } from "react";

/**
 * Besitz frisch hochgeladener Speicherobjekte einer Editor-Sitzung.
 *
 * Aufgeräumt wird nur bei echtem Verlassen: React StrictMode und Fast
 * Refresh führen Effekt-Cleanup und -Setup am noch gemounteten Formular
 * erneut aus. Das Setup setzt den Lebenszyklus deshalb zurück, und das
 * Aufräumen wird verzögert — läuft das Setup vorher wieder, war es nur ein
 * Replay und nichts wird gelöscht. Uploads, die nach echtem Unmount fertig
 * werden, landen ebenfalls im verzögerten Aufräumen.
 */
export function useSessionUploads(onAbandon: (paths: string[]) => void | Promise<void>) {
  const uploadedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAbandonRef = useRef(onAbandon);
  onAbandonRef.current = onAbandon;

  const scheduleAbandon = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Replay (StrictMode/Fast Refresh): Setup lief wieder → nichts löschen.
      if (mountedRef.current) return;
      const pending = [...uploadedRef.current];
      uploadedRef.current.clear();
      if (pending.length > 0) void onAbandonRef.current(pending);
    }, 0);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      mountedRef.current = false;
      scheduleAbandon();
    };
  }, [scheduleAbandon]);

  /** Meldet einen frisch hochgeladenen Pfad dieser Sitzung. */
  const register = useCallback(
    (storagePath: string) => {
      uploadedRef.current.add(storagePath);
      if (!mountedRef.current) scheduleAbandon();
    },
    [scheduleAbandon],
  );

  /** Aktuell besessene, noch nicht übernommene Sitzungs-Uploads. */
  const pending = useCallback(() => [...uploadedRef.current], []);

  /** Nach erfolgreichem Speichern: Besitz ist übergeben bzw. aufgeräumt. */
  const clear = useCallback(() => uploadedRef.current.clear(), []);

  return { register, pending, clear };
}
