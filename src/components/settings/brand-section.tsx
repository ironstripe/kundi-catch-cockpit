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
import { PROTECTED_BRAND_TEXTS, SETTING_KEYS, fetchAppSettings, saveSetting } from "@/lib/app-settings";

const ALLOWED = ["image/svg+xml", "image/png"];
const MAX_SIZE = 2 * 1024 * 1024;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function BrandSection() {
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const { url, brand } = useBrandLogo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
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
      const path = `logo/${crypto.randomUUID()}.${extension}`;
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
      await saveSetting(SETTING_KEYS.brand, next, 1);
      await recordAudit({
        entityType: "settings",
        entityId: SETTING_KEYS.brand,
        action: "logo_replaced",
        previous: { ...settings.brand },
        next,
        summary: `Logo ersetzt durch ${file.name}`,
      });
      toast.success("Logo gespeichert.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["brand-logo"] });
    } catch {
      toast.error("Das Logo konnte nicht hochgeladen werden. Bitte Dateityp und Grösse prüfen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!isAdmin) return <NoAccess />;

  return (
    <SectionShell
      title="Marke"
      description="Offizielles Kundi-Catch-Logo und geschützte Markentexte. Das Logo wird nie automatisch verändert oder umgefärbt."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Vorschau auf hellem Hintergrund</p>
          <div className="flex items-center justify-center rounded-md border bg-white p-6">
            <KundiCatchLogo className="size-24" src={url} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Vorschau im Anwendungsheader</p>
          <div className="flex items-center gap-2 rounded-md border bg-sidebar px-3 py-3">
            <KundiCatchLogo className="size-8" src={url} />
            <span className="text-sm font-semibold">Kundi Catch</span>
            <span className="text-xs text-muted-foreground">Cockpit · Kundelfingerhof</span>
          </div>
        </div>
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Datei</dt>
          <dd className="font-medium">{brand?.file_name ?? "Standardlogo"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Format</dt>
          <dd className="font-medium">{brand?.mime_type ?? "PNG (Standard)"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Grösse</dt>
          <dd className="font-medium">{formatSize(brand?.size ?? null)}</dd>
        </div>
      </dl>

      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload /> Logo hochladen oder ersetzen
      </Button>

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
