import { useBrandLogo } from "@/hooks/use-brand-logo";
import { cn } from "@/lib/utils";

/** Textfreies Zwei-Fische-Symbol; enthält keine alte Wortmarke. */
const ICON_FALLBACK = "/icon-512.png";

/**
 * Food-Catch-Symbol. Zeigt das in den Einstellungen hinterlegte Icon, sonst das
 * textfreie Zwei-Fische-Symbol. Ein hinterlegtes Asset wird nie umgefärbt.
 */
export function FoodCatchLogo({ className, src }: { className?: string; src?: string | null }) {
  return (
    <img
      src={src ?? ICON_FALLBACK}
      alt="Food Catch — Kundelfingerhof"
      className={cn("object-contain", className)}
    />
  );
}

/**
 * Vorläufige typografische Wortmarke, bis ein freigegebenes Food-Catch-Logo
 * hochgeladen wird. Ein hinterlegtes Logo hat immer Vorrang.
 */
export function FoodCatchWordmark({ className, src }: { className?: string; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt="Food Catch — Kundelfingerhof"
        className={cn("object-contain", className)}
      />
    );
  }
  return (
    <span className={cn("inline-flex flex-col items-center gap-1 text-center", className)}>
      <img src={ICON_FALLBACK} alt="" aria-hidden className="size-10 object-contain" />
      <span className="text-lg font-semibold uppercase tracking-[0.28em] text-primary">
        Food Catch
      </span>
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Kundelfingerhof
      </span>
    </span>
  );
}

/**
 * Kompakte Marke für die Seitenleiste: Symbol plus Wortmarke.
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
