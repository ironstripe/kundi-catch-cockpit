import { AlertTriangle, CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { DecisionLevel } from "@/lib/catch-calculation";
import { cn } from "@/lib/utils";

export const DECISION_ICONS: Record<DecisionLevel, ReactNode> = {
  green: <CheckCircle2 className="size-4" />,
  orange: <TriangleAlert className="size-4" />,
  red: <AlertTriangle className="size-4" />,
  incomplete: <CircleDashed className="size-4" />,
};

export const DECISION_CLASSES: Record<DecisionLevel, string> = {
  green: "border-success/40 bg-success/10 text-success",
  orange: "border-warning/50 bg-warning/10 text-warning-foreground",
  red: "border-destructive/40 bg-destructive/10 text-destructive",
  incomplete: "border-border bg-muted/40 text-muted-foreground",
};

/** Kompakter Ampel-Chip — nie nur Farbe, immer Icon und Text. */
export function DecisionBadge({
  level,
  label,
  className,
}: {
  level: DecisionLevel;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        DECISION_CLASSES[level],
        className,
      )}
    >
      {DECISION_ICONS[level]}
      {label}
    </span>
  );
}
