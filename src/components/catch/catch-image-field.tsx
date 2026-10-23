import { ArrowDown, ArrowUp, Crown, Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SignedImage } from "@/components/catch/signed-image";
import { supabase } from "@/integrations/supabase/client";
import {
  addImages,
  makePrimary,
  moveImage,
  removeImage,
  type FormCatchImage,
} from "@/lib/catch-images";
import { CATCH_IMAGE_BUCKET } from "@/lib/catches";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic"];
const MAX_BYTES = 15 * 1024 * 1024;
/** Formate, die der Browser direkt als lokale Vorschau anzeigen kann. */
const LOCAL_PREVIEW_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const EXTENSION_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
};

/** MIME-Typ für den Upload: Dateityp oder, falls leer, aus der Endung. */
export function uploadContentType(file: File): string | undefined {
  if (file.type) return file.type;
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return EXTENSION_TYPES[extension];
}

interface CatchImagesFieldProps {
  images: FormCatchImage[];
  onChange: Dispatch<SetStateAction<FormCatchImage[]>>;
  /** Meldet frisch hochgeladene Pfade für das Aufräumen beim Verwerfen. */
  onUploaded: (storagePath: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  invalid?: boolean;
}

function validateFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const typeOk = ACCEPTED.includes(file.type.toLowerCase());
  const extensionOk = ACCEPTED_EXTENSIONS.includes(extension);
  if (!typeOk && !extensionOk) return "Nur JPG, JPEG, PNG oder HEIC sind erlaubt.";
  if (file.size > MAX_BYTES) return "Die Datei ist grösser als 15 MB.";
  return null;
}

/**
 * Produktbilder eines Catches: Mehrfach-Auswahl und Drag-and-Drop hängen
 * Bilder an, ersetzen nie stillschweigend Bestehendes. Das erste Bild ist
 * das Hauptbild; Reihenfolge und Hauptbild sind frei wählbar. Hochgeladene
 * Objekte werden erst beim bestätigten Speichern referenziert oder
 * aufgeräumt — nie vorher gelöscht.
 */
export function CatchImagesField({
  images,
  onChange,
  onUploaded,
  onUploadingChange,
  invalid,
}: CatchImagesFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  // Lokale Vorschau nur bis die signierte URL des gespeicherten Objekts da ist.
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef(localPreviews);
  previewsRef.current = localPreviews;
  useEffect(
    () => () => {
      for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  function setBusy(value: boolean) {
    setUploading(value);
    onUploadingChange?.(value);
  }

  async function handleFiles(files: File[]) {
    const messages: string[] = [];
    const valid: File[] = [];
    for (const file of files) {
      const problem = validateFile(file);
      if (problem) messages.push(`${file.name}: ${problem}`);
      else valid.push(file);
    }
    setErrors(messages);
    if (valid.length === 0) return;

    setBusy(true);
    setProgress(5);
    let done = 0;
    try {
      for (const file of valid) {
        const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        const objectPath = `${crypto.randomUUID()}${extension || ".jpg"}`;
        const { error } = await supabase.storage
          .from(CATCH_IMAGE_BUCKET)
          .upload(objectPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: uploadContentType(file),
          });
        if (error) {
          messages.push(`${file.name}: ${error.message}`);
          continue;
        }
        onUploaded(objectPath);
        if (LOCAL_PREVIEW_TYPES.includes(file.type.toLowerCase()) && URL.createObjectURL) {
          const url = URL.createObjectURL(file);
          setLocalPreviews((current) => ({ ...current, [objectPath]: url }));
        }
        onChange((current) => addImages(current, [objectPath]));
        done += 1;
        setProgress(Math.round(5 + (done / valid.length) * 90));
      }
      setProgress(100);
      if (messages.length > 0) setErrors(messages);
    } finally {
      window.setTimeout(() => setProgress(0), 600);
      setBusy(false);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-2" id="product_image" tabIndex={-1}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void handleFiles(files);
          event.target.value = "";
        }}
      />

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <CatchImageTile
              key={image.key}
              image={image}
              localPreviewUrl={localPreviews[image.storagePath]}
              index={index}
              total={images.length}
              busy={uploading}
              onSetPrimary={() => onChange((current) => makePrimary(current, image.key))}
              onMove={(delta) => onChange((current) => moveImage(current, image.key, delta))}
              onRemove={() => onChange((current) => removeImage(current, image.key))}
            />
          ))}
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label="Produktbilder hochladen"
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const files = Array.from(event.dataTransfer.files ?? []);
          if (files.length > 0) void handleFiles(files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-muted/30 p-4 text-center transition-colors placeholder-hatch",
          images.length === 0 && "aspect-[4/3]",
          dragActive && "border-primary bg-accent",
          invalid && "border-destructive",
        )}
      >
        <ImageIcon className="size-5 text-muted-foreground" />
        <p className="text-xs font-medium">Bilder hierher ziehen oder klicken</p>
        <p className="text-[11px] text-muted-foreground">
          JPG, JPEG, PNG oder HEIC — max. 15 MB pro Bild, mehrere möglich
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading}
        onClick={openPicker}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
        Bilder hinzufügen
      </Button>

      {uploading || progress > 0 ? (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">Bilder werden hochgeladen …</p>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div role="alert" className="space-y-0.5">
          {errors.map((message) => (
            <p key={message} className="text-xs font-medium text-destructive">
              {message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CatchImageTile({
  image,
  localPreviewUrl,
  index,
  total,
  busy,
  onSetPrimary,
  onMove,
  onRemove,
}: {
  image: FormCatchImage;
  localPreviewUrl?: string;
  index: number;
  total: number;
  busy: boolean;
  onSetPrimary: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isPrimary = index === 0;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30",
          isPrimary && "border-primary ring-2 ring-primary/40",
        )}
      >
        <SignedImage
          path={image.storagePath}
          alt={`Produktbild ${index + 1}`}
          localPreviewUrl={localPreviewUrl}
          loadingLabel="Vorschau"
        />
        {isPrimary ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Crown className="size-3" aria-hidden />
            Hauptbild
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {!isPrimary ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label="Als Hauptbild setzen"
            onClick={onSetPrimary}
          >
            <Crown />
            Hauptbild
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || index === 0}
          aria-label="Bild nach vorne"
          onClick={() => onMove(-1)}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || index === total - 1}
          aria-label="Bild nach hinten"
          onClick={() => onMove(1)}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label="Bild entfernen"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
