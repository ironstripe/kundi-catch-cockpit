# Anhänge wirklich lesen: Inhalte aus PDF, Tabellen und Bildern in den Angebotsvorschlag

## Ausgangslage (geprüft)

`retryOfferExtraction` und der Resend-Webhook übergeben an die Auswertung nur Betreff, Absender,
E-Mail-Text und die **Dateinamen** der Anhänge (`attachmentNames`). In
`supplier-offer-ai.server.ts` landen diese Namen als eine Zeile im Prompt. Der Inhalt der
gespeicherten Dateien im privaten Ablagebereich wird nie gelesen. Alles, was nur im PDF steht,
fehlt deshalb im Vorschlag.

## Was gebaut wird

### 1. Inhalte lesen (serverseitig)

Neuer Baustein `supplier-offer-content.server.ts`, der eine gespeicherte Datei in Text verwandelt:

- **PDF mit Text**: Text mit Leseabfolge extrahieren (Bibliothek `unpdf`, läuft im Server-Runtime).
- **PDF ohne verwertbaren Text** (unter ~200 Zeichen): nicht als gelesen ausgeben, sondern als
  Bild-PDF behandeln und an die multimodale Auswertung übergeben (Datei als Anhang im Prompt).
- **Tabellen**: `.xlsx` und `.csv` werden gelesen (Blattnamen, Kopfzeilen, gefüllte Zeilen; keine
  Formeln, keine Makros). `.xls` (altes Binärformat) und `.ods` werden als „Nicht unterstützt"
  markiert statt falsch gelesen.
- **Bilder** (JPEG/PNG/WebP) der Arten Etikett, Unterlagen, Preisliste, Produktbild: multimodale
  Auswertung. Deko-Bilder (Logo, Signatur, Icon, klein) werden weiterhin gar nicht erst abgelegt.
- **Weitergeleitete `.eml`**: Absender, Betreff, Textteil, Anhangnamen — keine verschachtelte
  Weiterverarbeitung.

Grenzen: max. 25 MB pro Datei (unverändert), max. 30 PDF-Seiten, max. 300 Tabellenzeilen und
50 Spalten, max. 20 000 Zeichen pro Quelle, max. 8 Anhänge pro Auswertung. Bei Überschreitung wird
gekürzt und als gekürzt markiert. Eine kaputte Datei bricht nie die ganze Auswertung ab.

### 2. Zustand pro Anhang (additive Migration)

`supplier_offer_attachments` erhält: `content_extraction_status`
(`pending | processing | done | unsupported | failed`), `extracted_text`, `extraction_error`,
`extracted_at`, `extraction_meta` (Seitenzahl, Blattnamen, gekürzt-Kennzeichen). Bestehende Zeilen
starten auf `pending`. Keine kommerziellen Werte in der Anhangzeile, nur Quelltext und Protokoll.
Ablagebereich bleibt privat, Zugriffsregeln unverändert.

### 3. Quellenmodell und Auswertung

Die Auswertung bekommt statt Dateinamen eine Liste von Quellen:

```ts
type OfferExtractionSource = {
  source_type: "email" | "pdf" | "spreadsheet" | "image" | "eml";
  source_name: string;
  text: string;
  truncated: boolean;
};
```

E-Mail ist immer eine eigene Quelle, jeder gelesene Anhang eine weitere — klar getrennt im Prompt.
Bild-Quellen und Bild-PDFs werden zusätzlich als Bild-/Dateiblock mitgeschickt.
Die Anweisungen an das Modell werden ergänzt: nur belegte Werte, sonst `null`; Haltbarkeitsdauer ist
kein Ablaufdatum; Stück pro Gebinde ist keine Liefermenge; Preis pro Kilo, pro Stück und pro Karton
unterscheiden; Netto und Brutto unterscheiden; Lieferant ist nicht die weiterleitende Person;
Widersprüche zwischen Quellen melden statt still entscheiden; mehrere Produkte melden statt
zusammenzuführen. Striktes JSON-Schema bleibt.

### 4. Herkunft je Feld

Jedes Feld erhält zusätzlich `source_name` und `source_type` neben `value`, `unit`, `confidence`,
`source_excerpt`. Rückwärtskompatibel: ältere Datensätze ohne diese Angaben werden weiterhin
angezeigt. Zusätzlich liefert die Auswertung `conflicts` (Liste) und `multiple_products` (ja/nein);
beide fliessen in die bestehenden Warnhinweise.

### 5. Ablauf und Wiederholung

Reihenfolge beim Eingang: Signatur prüfen → E-Mail speichern → Anhänge ablegen → Anhangsinhalte
lesen → Auswertung mit allen Quellen → Vorschlag und Warnungen speichern → Prüfung durch Menschen.
Das Angebot bleibt sichtbar, auch wenn Lesen oder Auswertung teilweise scheitern.

- **E-Mail und Anhänge neu laden**: holt fehlende Dateien nach, ohne Duplikate, ohne kommerzielle
  Werte zu überschreiben.
- **Auswertung wiederholen**: liest noch ungelesene Anhänge nach, nutzt bereits gelesene erneut,
  wertet mit allen Quellen aus und nennt im Ergebnis, welche Quellen einbezogen wurden. Wurden
  Werte von Hand geändert, wird vorher gewarnt und die Bestätigung verlangt. Wiederholungen sind
  idempotent.

### 6. Prüfansicht

In der Anhangliste je Datei: Name, Art, Lesestatus („Inhalt gelesen" / „Nicht unterstützt" /
„Lesen fehlgeschlagen"), verständlicher Fehlertext, Aktion „Inhalt erneut lesen" für Berechtigte,
Öffnen/Herunterladen wie bisher. Je Feld zusätzlich die Quelldatei zum Textbeleg. Ein Anhang wird
nur dann als einbezogen dargestellt, wenn das Lesen erfolgreich war. Warnungen zu Widersprüchen und
mehreren Produkten stehen oben im Prüfbereich.

## Nicht Teil dieser Arbeit

Kein automatischer Catch, keine automatische Preisübernahme, keine Mehrfach-Catch-Erstellung, keine
Änderungen an Kalkulation, WhatsApp-Publikation, Rollen oder Zugriffsregeln; der Ablagebereich
bleibt privat.

## Technische Details

- Neue Abhängigkeit: `unpdf` (reines JS, Worker-tauglich). Tabellen über das bereits vorhandene
  `exceljs`; CSV eigener kleiner Parser. Keine nativen Bibliotheken, kein Browser-Parsing.
- Multimodale Schritte laufen über das vorhandene Lovable-AI-Gateway mit `LOVABLE_API_KEY`; Bilder
  und Bild-PDFs werden als Base64 eingebettet, keine Ablage-Links im Prompt. Fehlerbehandlung nach
  Gateway-Semantik (429/5xx erneut mit Wartezeit, 402/403 als klare Meldung).
- Betroffene Dateien: `supplier-offer-content.server.ts` (neu),
  `supplier-offer-sources.ts` (neu, reine Regeln und Grenzen),
  `supplier-offer-ai.server.ts`, `supplier-offer-extraction.ts`, `supplier-offers.functions.ts`,
  `supplier-offers.ts`, `routes/api/public/webhooks/resend.ts`,
  `components/offers/offer-attachments.tsx`, `components/offers/offer-fields-form.tsx`,
  `routes/_authenticated/offers.$offerId.tsx`.
- Tests (vitest, reine Logik): Grenzen und Kürzung, Erkennung von Bild-PDF, Tabellenauslesung,
  Deko-Bild-Ausschluss, defekte Datei, Herkunftsangaben, fehlende Werte bleiben leer,
  Haltbarkeitsdauer wird kein Ablaufdatum, Gebindeinhalt wird keine Liefermenge, Widerspruch
  zwischen E-Mail und PDF, Mehrproduktwarnung, idempotente Wiederholung, Schutz manuell geprüfter
  Werte, bestehende E-Mail-only-Auswertung. Dazu Typprüfung, Lint, bestehende Testsuite und
  Produktionsbuild.
- Abnahme am vorhandenen Silberlachs-Angebot: „Auswertung wiederholen" liest das gespeicherte PDF,
  schlägt Lieferant, Produkt, Artikelnummer, Kategorie, TK, Herkunft, Gebinde/24 Stück und die
  Haltbarkeitsangabe mit dem PDF-Dateinamen als Quelle vor, lässt Einkaufspreis, Normalpreis,
  Menge, Lieferkosten und Ablaufdatum leer und verlangt weiterhin die manuelle Freigabe.
