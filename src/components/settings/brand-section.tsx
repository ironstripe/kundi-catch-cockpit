import { useQueryClient } from "@tanstack/react-query";
import { Lock, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { KundiCatchLogo } from "@/components/brand/kundi-catch-logo";
import { NoAccess, SectionShell } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { BRAND_BUCKET, useBrandLogo } from "@/hooks/use-brand-logo";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import {
  BRAND_CLAIM_TEXT,
  BRAND_PURPOSE_TEXT,
  PROTECTED_BRAND_TEXTS,
  SETTING_AUDIT_IDS,
  SETTING_KEYS,
  fetchAppSettings,
  saveSetting,
  type BrandSettings,
} from "@/lib/app-settings";

const ALLOWED = ["image/svg+xml", "image/png"];
const MAX_SIZE = 2 * 1024 * 1024;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface AssetSlotProps {
  label: string;
  description: string;
  asset: BrandSettings | null;
  previewUrl: string | null;
  previewClassName: string;
  busy: boolean;
  onUpload: (file: File) => void;
}

/** Ein Markenasset (Icon oder vollständiges Logo) mit Vorschau und Upload. */
function AssetSlot({
  label,
  description,
  asset,
  previewUrl,
  previewClassName,
  busy,
  onUpload,
}: AssetSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-center rounded-md border bg-white p-6">
        <KundiCatchLogo className={previewClassName} src={previewUrl} />
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Datei</dt>
          <dd className="font-medium">{asset?.file_name ?? "Standardasset"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Format</dt>
          <dd className="font-medium">{asset?.mime_type ?? "PNG (Standard)"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Grösse</dt>
          <dd className="font-medium">{formatSize(asset?.size ?? null)}</dd>
        </div>
      </dl>
      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload /> SVG oder PNG hochladen
      </Button>
    </div>
  );
}

export function BrandSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const { url, brand, iconUrl, icon } = useBrandLogo();
  const [busy, setBusy] = useState(false);

  async function upload(file: File, target: "logo" | "icon") {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Nur SVG- oder PNG-Dateien sind zulässig. SVG wird bevorzugt.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Die Datei ist zu gross. Maximal 2 MB sind zulässig.");
      return;
    }
    setBusy(true);
    try {
      const settings = await fetchAppSettings();
      const extension = file.type === "image/svg+xml" ? "svg" : "png";
      const path = `${target}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(BRAND_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      const next = {
        path,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
      };
      const key = target === "icon" ? SETTING_KEYS.brandIcon : SETTING_KEYS.brand;
      const version =
        target === "icon" ? settings.brand_icon_version : settings.brand_version;
      await saveSetting(key, next, version);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_AUDIT_IDS[key]!,
        action: "logo_replaced",
        previous: { ...(target === "icon" ? settings.brand_icon : settings.brand) },
        next,
        summary:
          target === "icon"
            ? `Kundi-Catch-Icon ersetzt durch ${file.name}`
            : `Kundi-Catch-Logo ersetzt durch ${file.name}`,
      });
      toast.success(target === "icon" ? "Icon gespeichert." : "Logo gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["brand-logo"] });
    } catch {
      toast.error("Die Datei konnte nicht hochgeladen werden. Bitte Dateityp und Grösse prüfen.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return <NoAccess />;

  return (
    <SectionShell
      title="Marke"
      description="Icon, vollständiges Logo, Markenclaim und Kommunikationsabschluss sind klar getrennt. Assets werden nie automatisch verändert oder umgefärbt."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AssetSlot
          label="Kundi-Catch-Icon"
          description="Zwei-Fische-Symbol ohne Text. Für App-Icon, Favicon und kompakte Darstellungen."
          asset={icon}
          previewUrl={iconUrl}
          previewClassName="size-16"
          busy={busy}
          onUpload={(file) => void upload(file, "icon")}
        />
        <AssetSlot
          label="Kundi-Catch-Logo"
          description="KUNDI CATCH, Kundelfingerhof und der Markenclaim."
          asset={brand}
          previewUrl={url}
          previewClassName="size-24"
          busy={busy}
          onUpload={(file) => void upload(file, "logo")}
        />

        <div className="space-y-2 rounded-md border bg-card p-4">
          <p className="text-sm font-semibold">Markenclaim</p>
          <p className="text-xs text-muted-foreground">
            Primäre Kommunikationszeile. Nicht kürzen, ergänzen oder umformulieren.
          </p>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
            {BRAND_CLAIM_TEXT}
          </p>
        </div>

        <div className="space-y-2 rounded-md border bg-card p-4">
          <p className="text-sm font-semibold">Purpose / Kommunikationsabschluss</p>
          <p className="text-xs text-muted-foreground">
            Zurückhaltender Abschluss der Kommunikation — kein zweiter Markenclaim.
          </p>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{BRAND_PURPOSE_TEXT}</p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Lock className="size-3.5" /> Geschützte Markentexte
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {PROTECTED_BRAND_TEXTS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
