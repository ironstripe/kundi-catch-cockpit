import logoAsset from "@/assets/kundi-catch-logo.png.asset.json";
import { useBrandLogo } from "@/hooks/use-brand-logo";
import { cn } from "@/lib/utils";

/**
 * Offizielles Food-Catch-Logo. Die Datei wird unverändert verwendet.
 * `src` überschreibt die Quelle (z. B. für Vorschauen in den Einstellungen).
 */
export function FoodCatchLogo({ className, src }: { className?: string; src?: string | null }) {
  return (
    <img
      src={src ?? logoAsset.url}
      alt="Food Catch — Kundelfingerhof"
      className={cn("object-contain", className)}
    />
  );
}

/**
 * Kompakte Marke für die Sidebar: Logo-Kachel plus Wortmarke.
 * Verwendet das in den Einstellungen hinterlegte Logo, sonst das Standardlogo.
 */
export function FoodCatchBrand({ collapsed = false }: { collapsed?: boolean }) {
  const { iconUrl } = useBrandLogo();
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card">
        <FoodCatchLogo className="size-8" src={iconUrl} />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">Food Catch</span>
          <span className="block truncate text-xs text-muted-foreground">
            Cockpit · Kundelfingerhof
          </span>
        </span>
      )}
    </div>
  );
}
