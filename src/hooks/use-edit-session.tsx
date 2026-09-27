import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Kundi-Family Edit-Modell (Pass 2): scoped Ctrl/Cmd+Enter = gewöhnliches
 * Speichern, Esc = aktive Bearbeitung verwerfen. Kein Autosave.
 */
export type EditShortcut = "commit" | "cancel" | null;

const OVERLAY_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"]',
  "[data-radix-popper-content-wrapper]",
].join(",");

/** Liegt ein offenes Overlay ausserhalb des Scopes über der Bearbeitung? */
export function hasForeignOverlay(scope: Element, doc: Document = document): boolean {
  return Array.from(doc.querySelectorAll(OVERLAY_SELECTOR)).some(
    (overlay) => !overlay.contains(scope) && !scope.contains(overlay),
  );
}

export function resolveEditShortcut(
  event: Pick<
    KeyboardEvent<HTMLElement>,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "target" | "currentTarget"
  > & { nativeEvent?: { isComposing?: boolean } },
): EditShortcut {
  if (event.nativeEvent?.isComposing || event.repeat) return null;
  const scope = event.currentTarget as Element;
  const target = event.target as Element | null;
  // Ereignisse aus Portalen (Select/Menü) oder aus verschachtelten Scopes ignorieren.
  if (!target || !scope.contains(target)) return null;
  if (target.closest("[data-edit-scope]") !== scope) return null;
  if (target.closest('[aria-expanded="true"]')) return null;
  if (hasForeignOverlay(scope, scope.ownerDocument)) return null;
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.altKey) return "commit";
  if (
    event.key === "Escape" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  )
    return "cancel";
  return null;
}

interface ShortcutOptions {
  onCommit: () => unknown;
  onCancel?: () => void;
  busy?: boolean;
  enabled?: boolean;
}

/** Props für das Scope-Element einer Bearbeitung. */
export function useEditShortcuts({
  onCommit,
  onCancel,
  busy = false,
  enabled = true,
}: ShortcutOptions) {
  const inFlight = useRef(false);
  const latest = useRef({ onCommit, onCancel, busy, enabled });
  latest.current = { onCommit, onCancel, busy, enabled };

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const current = latest.current;
    if (!current.enabled || event.defaultPrevented) return;
    const intent = resolveEditShortcut(event);
    if (intent === null) return;
    if (intent === "cancel" && !current.onCancel) return;
    event.preventDefault();
    event.stopPropagation();
    // Während eines laufenden Speicherns weder erneut speichern noch abbrechen.
    if (current.busy || inFlight.current) return;
    if (intent === "cancel") {
      current.onCancel?.();
      return;
    }
    let result: unknown;
    try {
      result = current.onCommit();
    } catch {
      return;
    }
    if (result instanceof Promise) {
      inFlight.current = true;
      result
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    }
  }, []);

  return { "data-edit-scope": "", onKeyDown } as const;
}

/**
 * Router- und Browser-Guard für echte ungespeicherte Änderungen.
 * `allowNextNavigation()` vor gewollter Navigation nach Speichern/Verwerfen.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  const allowRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
    if (dirty) allowRef.current = false;
  }, [dirty]);

  const shouldBlock = () => dirtyRef.current && !allowRef.current;
  const blocker = useBlocker({
    shouldBlockFn: shouldBlock,
    enableBeforeUnload: shouldBlock,
    withResolver: true,
  });

  const allowNextNavigation = useCallback(() => {
    allowRef.current = true;
  }, []);

  return { blocker, allowNextNavigation };
}

export function UnsavedChangesDialog({
  guard,
}: {
  guard: ReturnType<typeof useUnsavedChangesGuard>;
}) {
  const { blocker } = guard;
  const open = blocker.status === "blocked";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && blocker.status === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ungespeicherte Änderungen verwerfen?</AlertDialogTitle>
          <AlertDialogDescription>
            Es gibt Änderungen, die noch nicht gespeichert wurden. Beim Verlassen gehen sie
            verloren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>Weiter bearbeiten</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>
            Verwerfen und verlassen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
