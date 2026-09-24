import { useQuery } from "@tanstack/react-query";
import { Check, ImageIcon, ImageOff } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signedAttachmentUrl, type OfferAttachment } from "@/lib/supplier-offers";
import { cn } from "@/lib/utils";

export function AttachmentThumb({
  attachment,
  className,
}: {
  attachment: OfferAttachment;
  className?: string;
}) {
  const { data: url, isError } = useQuery({
    queryKey: ["offer-attachment", attachment.id],
    queryFn: () => signedAttachmentUrl(attachment.storage_path),
    staleTime: 30 * 60 * 1000,
  });
  if (url && !isError) {
    return (
      <img
        src={url}
        alt={attachment.file_name}
        loading="lazy"
        className={cn("size-full object-cover", className)}
      />
    );
  }
  return (
    <div className={cn("flex size-full items-center justify-center bg-muted", className)}>
      <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** Auswahl = Bild-Id, "none" = bewusst ohne Bild, null = noch nicht entschieden. */
export type ImageChoice = string | "none" | null;

export function CaseImagePicker({
  images,
  choice,
  onChoose,
  disabled,
  footer,
}: {
  images: OfferAttachment[];
  choice: ImageChoice;
  onChoose: (choice: ImageChoice) => void;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  if (!images.length) return null;
  return (
    <Card id="case-image-picker" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-sm">Produktbild für den Catch ({images.length} Bilder)</CardTitle>
        <CardDescription className="text-xs">
          Bitte das Produktfoto anklicken. Logos und Signaturbilder nicht wählen. Die
          Originalanhänge bleiben im Dossier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => {
            const selected = choice === image.id;
            return (
              <button
                key={image.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChoose(image.id)}
                className={cn(
                  "group relative overflow-hidden rounded-md border text-left transition disabled:cursor-default",
                  selected ? "border-primary ring-4 ring-primary" : "opacity-80 hover:opacity-100",
                )}
              >
                <div className="aspect-square w-full">
                  <AttachmentThumb attachment={image} />
                </div>
                {selected ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    <Check className="size-3" aria-hidden />
                    Hauptbild
                  </span>
                ) : null}
                <p className="truncate border-t bg-background px-2 py-1 text-[11px]">
                  {image.file_name}
                </p>
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            aria-pressed={choice === "none"}
            onClick={() => onChoose("none")}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed p-2 text-center text-xs",
              choice === "none" ? "border-primary ring-4 ring-primary" : "text-muted-foreground",
            )}
          >
            <ImageOff className="size-5" aria-hidden />
            Ohne Bild fortfahren
          </button>
        </div>
        {choice === null && !disabled ? (
          <p className="text-xs font-medium text-destructive">
            Noch keine Wahl: Produktbild wählen oder «Ohne Bild fortfahren».
          </p>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
