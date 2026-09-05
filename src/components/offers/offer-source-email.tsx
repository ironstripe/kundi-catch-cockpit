import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/format";
import type { OfferDetail } from "@/lib/supplier-offers";

/** Entfernt Markup und zeigt nur den lesbaren Text der Original-E-Mail. */
function plainText(html: string | null, text: string | null): string {
  if (text && text.trim()) return text.trim();
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

export function OfferSourceEmail({ offer }: { offer: OfferDetail }) {
  const body = useMemo(() => plainText(offer.html_body, offer.text_body), [offer]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Original-E-Mail</CardTitle>
        <CardDescription className="text-xs">
          Unveränderter Inhalt der Weiterleitung — Grundlage jeder Prüfung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          label="Weitergeleitet von"
          value={
            offer.forwarded_by_name
              ? `${offer.forwarded_by_name} (${offer.forwarded_by_email ?? "unbekannt"})`
              : (offer.forwarded_by_email ?? "unbekannt")
          }
        />
        <Row
          label="Ursprünglicher Absender"
          value={offer.original_sender_email ?? "nicht erkannt"}
        />
        <Row label="An" value={offer.to_address ?? "unbekannt"} />
        <Row label="Betreff" value={offer.subject ?? "(kein Betreff)"} />
        <Row label="Empfangen" value={formatDateTime(offer.received_at)} />
        <Separator />
        {body ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-relaxed">
            {body}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Es ist kein Text vorhanden. Über «E-Mail neu laden» kann der Inhalt erneut geholt werden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
