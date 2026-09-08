import { useQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSignedImage } from "@/hooks/use-signed-image";
import { supabase } from "@/integrations/supabase/client";
import { CATCH_IMAGE_BUCKET, type CatchDetail } from "@/lib/catches";
import { formatDateTime } from "@/lib/format";
import { optimizedFileName, downloadBlob, supportsTextClipboard } from "@/lib/whatsapp-image";

/**
 * Nur-Lese-Ansicht des archivierten Posts. Zeigt ausschliesslich den
 * unveränderlichen Publikationsschnappschuss (published_text / published_image_path).
 */
export function PublishedPostCard({ item }: { item: CatchDetail }) {
  const image = useSignedImage(item.published_image_path);
  const publisher = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 1000 * 60 * 10,
  });

  if (!item.published_text && !item.published_at) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Für diesen Catch wurde kein WhatsApp-Post publiziert.
        </CardContent>
      </Card>
    );
  }

  const publishedByLabel =
    item.published_by && publisher.data?.id === item.published_by
      ? (publisher.data.email ?? "Du")
      : item.published_by
        ? `Nutzer ${item.published_by.slice(0, 8)}`
        : "—";

  async function copyText() {
    const text = item.published_text ?? "";
    if (!supportsTextClipboard()) {
      toast.error("Text konnte nicht kopiert werden", {
        description: "Text markieren und manuell kopieren.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Text kopiert ✓");
    } catch {
      toast.error("Text konnte nicht kopiert werden");
    }
  }

  async function downloadImage() {
    if (!item.published_image_path) return;
    const { data, error } = await supabase.storage
      .from(CATCH_IMAGE_BUCKET)
      .download(item.published_image_path);
    if (error || !data) {
      toast.error("Bild konnte nicht geladen werden");
      return;
    }
    const extension = data.type === "image/png" ? "png" : "jpg";
    downloadBlob(data, optimizedFileName(item.catch_number, item.product_name, extension));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Publizierter WhatsApp-Post</CardTitle>
        <CardDescription className="text-xs">
          Unveränderter Stand zum Zeitpunkt der Publikation — nur zum Ansehen und Kopieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-2">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/30">
            {image.data ? (
              <img
                src={image.data}
                alt={`Publiziertes Bild von ${item.product_name}`}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground placeholder-hatch">
                Kein publiziertes Bild
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <p>
              Publiziert am {item.published_at ? formatDateTime(item.published_at) : "unbekannt"}
            </p>
            <p>Publiziert von: {publishedByLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copyText()}>
              <Copy />
              Text kopieren
            </Button>
            {item.published_image_path ? (
              <Button size="sm" variant="outline" onClick={() => void downloadImage()}>
                <Download />
                Bild herunterladen
              </Button>
            ) : null}
          </div>
        </div>
        <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          {item.published_text ?? "—"}
        </pre>
      </CardContent>
    </Card>
  );
}
