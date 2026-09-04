import logoAsset from "@/assets/kundi-catch-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Offizielles Kundi-Catch-Logo. Die Datei wird unverändert verwendet.
 */
export function KundiCatchLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Kundi Catch — Kundelfingerhof"
      className={cn("object-contain", className)}
    />
  );
}

/**
 * Kompakte Marke für die Sidebar: Logo-Kachel plus Wortmarke.
 */
export function KundiCatchBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card">
        <KundiCatchLogo className="size-8" />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">Kundi Catch</span>
          <span className="block truncate text-xs text-muted-foreground">
            Cockpit · Kundelfingerhof
          </span>
        </span>
      )}
    </div>
  );
}
