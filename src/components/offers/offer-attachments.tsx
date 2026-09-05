import { useQuery } from "@tanstack/react-query";
import { Download, ImageIcon, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOfferAttachment } from "@/lib/supplier-offers.functions";
import {
  ATTACHMENT_KIND_LABELS,
  signedAttachmentUrl,
  type OfferAttachment,
} from "@/lib/supplier-offers";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentPreview({ attachment }: { attachment: OfferAttachment }) {
  const { data: url } = useQuery({
    queryKey: ["offer-attachment", attachment.id],
    queryFn: () => signedAttachmentUrl(attachment.storage_path),
    staleTime: 30 * 60 * 1000,
  });

  if (attachment.mime_type.startsWith("image/") && url) {
    return (
      <img
        src={url}
        alt={attachment.file_name}
        className="size-16 shrink-0 rounded-md border object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted">
      <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
    </div>
  );
}

export function OfferAttachments({
  offerId,
  attachments,
  canEdit,
  locked,
  onChanged,
}: {
  offerId: string;
  attachments: OfferAttachment[];
  canEdit: boolean;
  locked: boolean;
  onChanged: () => void;
}) {
  async function update(attachmentId: string, patch: { kind?: string; primary?: boolean }) {
    try {
      await updateOfferAttachment({ data: { offerId, attachmentId, ...patch } });
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen.");
    }
  }

  async function open(attachment: OfferAttachment) {
    const url = await signedAttachmentUrl(attachment.storage_path);
    if (!url) {
      toast.error("Die Datei konnte nicht geöffnet werden.");
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Anhänge ({attachments.length})</CardTitle>
        <CardDescription className="text-xs">
          Produktbilder, Etiketten und Unterlagen aus der Weiterleitung. Ein Produktbild kann als
          Hauptbild für den Catch übernommen werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Diese E-Mail enthält keine Anhänge.</p>
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3"
            >
              <AttachmentPreview attachment={attachment} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(attachment.file_size)} · {attachment.mime_type}
                </p>
                {attachment.is_primary_image ? (
                  <Badge variant="secondary" className="mt-1">
                    Hauptbild
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={attachment.kind}
                  onValueChange={(value) => update(attachment.id, { kind: value })}
                  disabled={!canEdit || locked}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATTACHMENT_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {attachment.mime_type.startsWith("image/") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEdit || locked || attachment.is_primary_image}
                    onClick={() => update(attachment.id, { primary: true })}
                  >
                    <Star className="mr-1 size-3.5" aria-hidden />
                    Hauptbild
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => open(attachment)}>
                  <Download className="mr-1 size-3.5" aria-hidden />
                  Öffnen
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
