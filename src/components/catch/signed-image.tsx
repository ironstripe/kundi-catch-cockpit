import { ImageOff, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSignedImage } from "@/hooks/use-signed-image";
import { cn } from "@/lib/utils";

/**
 * Privates Produktbild über eine signierte URL. Fehler beim Signieren oder
 * Laden zeigen eine klare Meldung mit «Erneut laden» (neue signierte URL)
 * statt eines endlosen Spinners oder eines kaputten Bildes.
 *
 * `localPreviewUrl` überbrückt nur die Wartezeit auf die signierte URL —
 * sobald sie da ist (oder fehlschlägt), zählt allein das gespeicherte Objekt.
 */
export function SignedImage({
  path,
  alt,
  className,
  localPreviewUrl,
  loadingLabel = "Bild wird geladen",
}: {
  path: string;
  alt: string;
  className?: string;
  localPreviewUrl?: string;
  loadingLabel?: string;
}) {
  const signed = useSignedImage(path);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => setLoadFailed(false), [signed.data]);

  if (signed.isError || loadFailed) {
    return (
      <div
        role="alert"
        className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-destructive"
      >
        <ImageOff className="size-4" aria-hidden />
        <span className="font-medium">Bild konnte nicht geladen werden</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadFailed(false);
            void signed.refetch();
          }}
        >
          <RefreshCw />
          Erneut laden
        </Button>
      </div>
    );
  }

  if (signed.data) {
    return (
      <img
        src={signed.data}
        alt={alt}
        className={cn("size-full object-cover", className)}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  if (localPreviewUrl) {
    return (
      <img src={localPreviewUrl} alt={alt} className={cn("size-full object-cover", className)} />
    );
  }

  return (
    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
      {loadingLabel}
    </div>
  );
}
