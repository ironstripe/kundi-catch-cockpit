import { ExternalLink } from "lucide-react";

import { isValidProductUrl } from "@/lib/product-link";

/**
 * Interne Anzeige des optionalen Produktlinks.
 * Öffnet in einem neuen Tab mit sicheren Linkattributen.
 */
export function ProductLink({ url }: { url: string | null }) {
  if (!isValidProductUrl(url)) {
    return <span className="text-sm text-muted-foreground">Nicht hinterlegt</span>;
  }
  return (
    <a
      href={url as string}
      target="_blank"
      rel="noopener noreferrer external"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      Produkt im Onlineshop öffnen
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}
