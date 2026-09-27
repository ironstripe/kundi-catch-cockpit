import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditShortcuts } from "@/hooks/use-edit-session";

/**
 * Stift-Bearbeitung des Dossiertitels: Fokus sofort, «Fertig» bzw.
 * Ctrl/Cmd+Enter speichert, Esc verwirft. Schliesst nur bei Erfolg.
 */
export function CaseTitleEditor({
  title,
  disabled,
  onSave,
  onDirtyChange,
}: {
  title: string;
  disabled?: boolean;
  onSave: (title: string) => Promise<boolean>;
  /** Meldet ungespeicherte Titeländerungen an den Seiten-Guard. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = draft !== null && draft.trim() !== title;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (draft !== null) inputRef.current?.focus();
    // nur beim Öffnen fokussieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null]);

  async function commit() {
    if (draft === null || pending) return;
    const next = draft.trim();
    if (!next) {
      setError("Der Titel darf nicht leer sein.");
      return;
    }
    if (next === title) {
      setDraft(null);
      return;
    }
    setPending(true);
    setError(null);
    let ok = false;
    try {
      ok = await onSave(next);
    } catch {
      ok = false;
    } finally {
      setPending(false);
    }
    if (ok) setDraft(null);
    else setError("Umbenennen fehlgeschlagen. Titel bleibt zum erneuten Versuch erhalten.");
  }

  function cancel() {
    if (pending) return;
    setDraft(null);
    setError(null);
  }

  const scope = useEditShortcuts({ onCommit: commit, onCancel: cancel, busy: pending });

  if (draft === null) {
    return (
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setDraft(title)}>
        <Pencil className="mr-2 size-4" aria-hidden />
        Titel ändern
      </Button>
    );
  }

  return (
    <div className="space-y-2" {...scope}>
      <Input
        ref={inputRef}
        value={draft}
        aria-label="Titel des Angebotsdossiers"
        aria-invalid={error ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => void commit()}>
          Fertig
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={cancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
