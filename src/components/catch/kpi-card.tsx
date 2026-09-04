import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  /** Zeigt den Platzhalter-Hinweis, solange keine echten Daten vorliegen. */
  placeholder?: boolean;
}

/** Kompakte KPI-Kachel. */
export function KpiCard({ label, value, hint, icon: Icon, placeholder = false }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden py-0">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          {placeholder ? (
            <span className="mt-1.5 inline-block rounded border px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground placeholder-hatch">
              Platzhalter
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>

  );
}
