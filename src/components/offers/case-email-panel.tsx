import { FolderInput, FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { CaseAssignDialog } from "@/components/offers/case-assign-dialog";
import { OfferAttachments } from "@/components/offers/offer-attachments";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/format";
import type { CaseEmail } from "@/lib/offer-cases";
import { EXTRACTION_STATUS_LABELS } from "@/lib/supplier-offers";

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
    <div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function EmailBody({ email }: { email: CaseEmail }) {
  const body = useMemo(() => plainText(email.html_body, email.text_body), [email]);
  if (!body) {
    return (
      <p className="text-sm text-muted-foreground">
        Es ist kein Text vorhanden. Über «E-Mail und Anhänge neu laden» kann der Inhalt erneut
        geholt werden.
      </p>
    );
  }
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-relaxed">
      {body}
    </pre>
  );
}

/**
 * Alle E-Mails eines Angebotsdossiers in zeitlicher Reihenfolge, jede mit
 * ihren eigenen Anhängen und Zuweisungsaktionen.
 */
export function CaseEmailPanel({
  caseId,
  emails,
  canEdit,
  locked,
  busy,
  onChanged,
  onAssign,
  onSplit,
}: {
  caseId: string;
  emails: CaseEmail[];
  canEdit: boolean;
  locked: boolean;
  busy: boolean;
  onChanged: () => void;
  onAssign: (emailId: string, targetCaseId: string) => void;
  onSplit: (emailId: string) => void;
}) {
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const canMove = canEdit && !locked;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Quellen im Dossier ({emails.length})</CardTitle>
        <CardDescription className="text-xs">
          Jede E-Mail bleibt unverändert erhalten. E-Mails werden nur durch eine bewusste Zuweisung
          zusammengeführt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {emails.map((email, index) => (
            <AccordionItem key={email.id} value={email.id}>
              <AccordionTrigger className="text-left">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="truncate text-sm font-medium">
                    {email.subject ?? "(kein Betreff)"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(email.received_at)} · {email.attachments.length} Anhang/Anhänge
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Row
                  label="Weitergeleitet von"
                  value={
                    email.forwarded_by_name
                      ? `${email.forwarded_by_name} (${email.forwarded_by_email ?? "unbekannt"})`
                      : (email.forwarded_by_email ?? "unbekannt")
                  }
                />
                <Row
                  label="Erkannter Lieferant"
                  value={email.original_sender_email ?? "nicht erkannt"}
                />
                <Row label="An" value={email.to_address ?? "unbekannt"} />
                <Row label="Empfangen" value={formatDateTime(email.received_at)} />
                <Row
                  label="Verarbeitung"
                  value={
                    EXTRACTION_STATUS_LABELS[email.extraction_status] ?? email.extraction_status
                  }
                />
                {email.extraction_error ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                    {email.extraction_error}
                  </p>
                ) : null}

                <EmailBody email={email} />

                <OfferAttachments
                  offerId={email.id}
                  attachments={email.attachments}
                  canEdit={canEdit}
                  locked={locked}
                  onChanged={onChanged}
                />

                {canMove ? (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setAssignFor(email.id)}
                      >
                        <FolderInput className="mr-2 size-4" aria-hidden />
                        E-Mail zu anderem Angebotsdossier zuweisen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || emails.length < 2}
                        onClick={() => onSplit(email.id)}
                      >
                        <FolderPlus className="mr-2 size-4" aria-hidden />
                        Neues Angebotsdossier aus E-Mail erstellen
                      </Button>
                    </div>
                    {emails.length < 2 ? (
                      <p className="text-xs text-muted-foreground">
                        Die letzte E-Mail eines Dossiers kann nicht herausgelöst werden.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>

      <CaseAssignDialog
        open={assignFor !== null}
        onOpenChange={(open) => setAssignFor(open ? assignFor : null)}
        title="E-Mail zuweisen"
        description="Wähle das Angebotsdossier, in dem diese E-Mail künftig geprüft wird."
        excludeCaseId={caseId}
        confirmLabel="Zuweisen"
        busy={busy}
        onConfirm={(targetCaseId) => {
          const emailId = assignFor;
          setAssignFor(null);
          if (emailId) onAssign(emailId, targetCaseId);
        }}
      />
    </Card>
  );
}
