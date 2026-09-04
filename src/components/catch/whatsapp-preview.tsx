import { Fragment } from "react";

import { CatchStatusBadge } from "@/components/catch/status-badge";
import { parsePostLine } from "@/lib/whatsapp-post";
import type { CatchStatus } from "@/lib/catch-domain";
import { cn } from "@/lib/utils";

interface WhatsappPreviewProps {
  text: string;
  imageUrl?: string | null;
  imageAlt: string;
  status: CatchStatus;
  className?: string;
}

/**
 * Vorschau des Posts in der Sprache des Cockpits — bewusst keine
 * Nachbildung der WhatsApp-Oberfläche. Formatzeichen werden nur
 * für die Anzeige interpretiert, der kopierte Text bleibt unverändert.
 */
export function WhatsappPreview({
  text,
  imageUrl,
  imageAlt,
  status,
  className,
}: WhatsappPreviewProps) {
  const lines = text.split("\n");

  return (
    <div className={cn("overflow-hidden rounded-md border bg-muted/20", className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Vorschau</span>
        <CatchStatusBadge status={status} />
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden border-b bg-background">
        {imageUrl ? (
          <img src={imageUrl} alt={imageAlt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground placeholder-hatch">
            Kein Bild vorbereitet
          </div>
        )}
      </div>
      <div className="max-h-[28rem] overflow-y-auto px-3 py-3 text-sm leading-relaxed">
        {lines.map((line, index) => (
          <p key={index} className={line.trim() === "" ? "h-3" : undefined}>
            {parsePostLine(line).map((segment, segmentIndex) => (
              <Fragment key={segmentIndex}>
                <span
                  className={cn(
                    segment.bold && "font-semibold",
                    segment.strike && "text-muted-foreground line-through",
                  )}
                >
                  {segment.text}
                </span>
              </Fragment>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
