import { useCallback, useEffect, useRef, useState } from "react";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lokaler Bearbeitungsstand gegenüber Serverdaten desselben Objekts.
 * - Anderes Objekt (identity): harter Reset, keine Werte aus A in B.
 * - Gleiches Objekt, unverändert: Refetch übernimmt die neuen Serverwerte.
 * - Gleiches Objekt, lokal bearbeitet: Refetch überschreibt nichts; der
 *   Öffnungsstand für Esc bleibt der Stand beim Beginn der Bearbeitung.
 * - Nach bestätigtem Speichern (`markSaved(snapshot)`) wird nur zurückgesetzt,
 *   wenn seit dem Absenden nichts weiter getippt wurde.
 */
export function useSyncedDraft<T>(identity: string, server: T) {
  const [value, setValueState] = useState<T>(server);
  const valueRef = useRef(value);
  const baseRef = useRef({ identity, server });
  const openingRef = useRef<T>(server);
  const savedRef = useRef<{ snapshot: T } | null>(null);

  const setValue = useCallback((next: T) => {
    valueRef.current = next;
    setValueState(next);
  }, []);

  useEffect(() => {
    const previous = baseRef.current;
    baseRef.current = { identity, server };
    if (previous.identity === identity && same(previous.server, server)) {
      // Gleicher Serverwert: eine bestätigte Speicherung trotzdem quittieren.
      const pending = savedRef.current;
      if (pending && same(valueRef.current, pending.snapshot)) {
        savedRef.current = null;
        openingRef.current = server;
        setValue(server);
      }
      return;
    }
    const saved = savedRef.current;
    savedRef.current = null;
    const current = valueRef.current;
    const reset =
      previous.identity !== identity ||
      same(current, previous.server) ||
      (saved !== null && same(current, saved.snapshot));
    if (reset) {
      openingRef.current = server;
      setValue(server);
    }
  }, [identity, server, setValue]);

  const markSaved = useCallback((snapshot: T) => {
    savedRef.current = { snapshot };
  }, []);

  /**
   * Nach bestätigtem Speichern mit den frisch geladenen, kanonischen Serverdaten
   * abgleichen (z. B. «1.0» → «1»). Greift auch, wenn der Refetch denselben
   * Wert/dieselbe Referenz liefert. Nach dem Absenden Getipptes bleibt erhalten.
   */
  const reconcileSaved = useCallback(
    (snapshot: T, canonical: T) => {
      savedRef.current = null;
      if (!same(valueRef.current, snapshot)) return;
      openingRef.current = canonical;
      setValue(canonical);
    },
    [setValue],
  );

  const restoreOpening = useCallback(() => setValue(openingRef.current), [setValue]);

  return {
    value,
    setValue,
    base: server,
    dirty: !same(value, server),
    markSaved,
    reconcileSaved,
    restoreOpening,
  };
}
