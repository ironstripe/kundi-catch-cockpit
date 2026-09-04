import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSignedImage } from "@/hooks/use-signed-image";
import { supabase } from "@/integrations/supabase/client";
import { CATCH_IMAGE_BUCKET } from "@/lib/catches";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic"];
const MAX_BYTES = 15 * 1024 * 1024;

interface CatchImageFieldProps {
  path: string | null;
  onChange: (path: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  invalid?: boolean;
}

/**
 * Hauptbild eines Catches: Drag-and-Drop oder Dateiauswahl,
 * Vorschau über signierte URL, Ersetzen und Entfernen.
 */
export function CatchImageField({
  path,
  onChange,
  onUploadingChange,
  invalid,
}: CatchImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const preview = useSignedImage(path);

  function setBusy(value: boolean) {
    setUploading(value);
    onUploadingChange?.(value);
  }

  async function handleFile(file: File) {
    setError(null);

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const typeOk = ACCEPTED.includes(file.type.toLowerCase());
    const extensionOk = ACCEPTED_EXTENSIONS.includes(extension);
    if (!typeOk && !extensionOk) {
      setError("Nur JPG, JPEG, PNG oder HEIC sind erlaubt.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Die Datei ist grösser als 15 MB.");
      return;
    }

    setBusy(true);
    setProgress(15);
    const ticker = window.setInterval(() => {
      setProgress((value) => (value < 85 ? value + 7 : value));
    }, 200);

    try {
      const objectPath = `${crypto.randomUUID()}${extension || ".jpg"}`;
      const { error: uploadError } = await supabase.storage
        .from(CATCH_IMAGE_BUCKET)
        .upload(objectPath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      if (path) {
        await supabase.storage.from(CATCH_IMAGE_BUCKET).remove([path]);
      }
      setProgress(100);
      onChange(objectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
      window.setTimeout(() => setProgress(0), 600);
    }
  }

  async function handleRemove() {
    if (!path) return;
    setBusy(true);
    try {
      await supabase.storage.from(CATCH_IMAGE_BUCKET).remove([path]);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" id="product_image" tabIndex={-1}>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      {path ? (
        <div className="space-y-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30">
            {preview.data ? (
              <img
                src={preview.data}
                alt="Vorschau des Produktbilds"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Vorschau wird geladen
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload />
              Ersetzen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => void handleRemove()}
            >
              <Trash2 />
              Entfernen
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Produktbild hochladen"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 p-4 text-center transition-colors placeholder-hatch",
            dragActive && "border-primary bg-accent",
            invalid && "border-destructive",
          )}
        >
          <ImageIcon className="size-5 text-muted-foreground" />
          <p className="text-xs font-medium">Bild hierher ziehen oder klicken</p>
          <p className="text-[11px] text-muted-foreground">JPG, JPEG, PNG oder HEIC — max. 15 MB</p>
        </div>
      )}

      {uploading || progress > 0 ? (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">Bild wird hochgeladen …</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
