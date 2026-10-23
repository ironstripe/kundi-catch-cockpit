import { ImageIcon, Loader2 } from "lucide-react";

import { useSignedImage } from "@/hooks/use-signed-image";
import type { CatchImageInfo } from "@/lib/catches";
import { cn } from "@/lib/utils";

function GalleryImage({ path, alt }: { path: string; alt: string }) {
  const signed = useSignedImage(path);
  if (signed.data) {
    return <img src={signed.data} alt={alt} className="size-full object-cover" />;
  }
  return (
    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Bild wird geladen
    </div>
  );
}

/**
 * Alle Produktbilder eines Catches in Reihenfolge: das Hauptbild gross,
 * weitere Fotos als Vorschau darunter. Rein lesend.
 */
export function CatchImageGallery({
  images,
  alt,
  emptyText = "Kein Bild hinterlegt",
  className,
}: {
  images: CatchImageInfo[];
  alt: string;
  emptyText?: string;
  className?: string;
}) {
  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center rounded-md border bg-muted/30 text-xs text-muted-foreground placeholder-hatch",
          className,
        )}
      >
        <ImageIcon className="mr-2 size-4" aria-hidden />
        {emptyText}
      </div>
    );
  }

  const [primary, ...rest] = images;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30">
        <GalleryImage path={primary!.storage_path} alt={`${alt} (Hauptbild)`} />
        <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          Hauptbild
        </span>
      </div>
      {rest.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {rest.map((image, index) => (
            <div
              key={image.id}
              className="relative aspect-square overflow-hidden rounded-md border bg-muted/30"
            >
              <GalleryImage path={image.storage_path} alt={`${alt} (${index + 2})`} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
