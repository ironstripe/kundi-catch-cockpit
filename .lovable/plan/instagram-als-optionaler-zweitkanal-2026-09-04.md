# Instagram als optionaler Zweitkanal

WhatsApp bleibt der Hauptkanal. Instagram kommt erst danach, ist freiwillig und braucht nur zwei Klicks: auswählen und freigeben. Alles Weitere läuft automatisch.

## Ablauf im Cockpit

1. Catch wird wie bisher erstellt, kalkuliert, als WhatsApp-Post vorbereitet und manuell als publiziert markiert. Daran ändert sich nichts.
2. Erst danach erscheint unterhalb des WhatsApp-Bereichs ein kompakter, optisch zurückhaltender Abschnitt "Instagram (optional)" mit dem Schalter "Diesen Catch für Instagram nutzen". Standard: aus.
3. Beim Aktivieren erzeugt das Cockpit automatisch aus den vorhandenen Catch-Daten: einen kurzen Instagram-Text, ein Bild im Hochformat 4:5, eine Vorschau und einen Vorschlag für den Veröffentlichungszeitpunkt (sofort oder Standardzeit aus den Einstellungen).
4. Der Text ist editierbar. Vorschau zeigt Bild, Text, Zielkonto (Kundelfingerhof) und Zeitpunkt.
5. Eine Hauptaktion: "Freigeben und auf Instagram veröffentlichen". Danach Fortschritt und Ergebnis: Status, Zeitpunkt, freigebende Person, Link zum Beitrag.
6. Bei Fehler bleiben Text und Bild erhalten, es erscheint eine klare Meldung und eine einzelne Aktion "Veröffentlichung erneut versuchen". Doppelte Beiträge werden verhindert.

Vor der WhatsApp-Publikation ist der ganze Bereich nicht bedienbar, mit dem Hinweis, dass zuerst WhatsApp bestätigt werden muss. Viewer sehen alles nur lesend; auswählen, bearbeiten und freigeben dürfen nur Admin und Editor.

## Textlogik

Kurzer Teaser, kein Abbild des WhatsApp-Posts. Keine Mengen, keine Abholorte, keine Verfügbarkeitsdetails. Aufbau:

```text
KUNDI CATCH
Guter Fisch. Kleines Handicap. Grosser Fang.

<Produktname> — <kurzer Hinweis auf das Handicap aus der Handicap-Story>

Die aktuellen Kundi Catches gibt es zuerst in unserer WhatsApp-Gruppe.
Jetzt über den Link in der Bio beitreten.

Gut essen. Food Waste vermeiden.
```

Der Aufruf zur WhatsApp-Gruppe ist in den Einstellungen anpassbar.

## Bild

Für diese erste Version wird das bereits optimierte Produktbild auf 4:5 Hochformat zugeschnitten und als eigene Ableitung gespeichert; Original und WhatsApp-Variante bleiben unangetastet. Eine gestaltete Markenvorlage mit Logo-Overlay bleibt als spätere Erweiterung offen.

## Einstellungen (nur Admin)

Neuer Abschnitt "Instagram" mit: Automatisierung aktiv/inaktiv, Hinweis auf die serverseitig hinterlegte Webhook-Adresse (nie im Browser lesbar), WhatsApp-Gruppenlink, Standard-Aufruftext, Standardzeitpunkt und ein Verbindungstest mit Statusanzeige.

## Änderungsprotokoll

Protokolliert werden: ausgewählt, freigegeben, Veröffentlichung gestartet, veröffentlicht, fehlgeschlagen, erneut versucht — die handelnde Person wird immer serverseitig ermittelt.

## Technische Umsetzung

- **Migration (additiv, keine bestehende Migration wird geändert):** neue Spalten auf `catches`: `instagram_selected`, `instagram_caption`, `instagram_asset_url`, `instagram_status` (not_selected | draft | ready | publishing | published | failed), `instagram_approved_by`, `instagram_approved_at`, `instagram_published_at`, `instagram_media_id`, `instagram_permalink`, `instagram_error`, `instagram_idempotency_key` (unique). Zusätzlich Row `instagram_settings` in `application_settings` mit Audit-ID, neue Audit-Aktionen. RLS: Schreiben der Instagram-Felder nur für Editor/Admin, Statusfelder (`published`, `media_id`, `permalink`) nur serverseitig.
- **Serverfunktionen** (`src/lib/instagram.functions.ts`, `requireSupabaseAuth`): `selectForInstagram`, `saveInstagramCaption`, `approveAndPublish`, `retryInstagramPublish`. Rollenprüfung und WhatsApp-Vorbedingung serverseitig; Idempotenzschlüssel = `catchId:versuchsnummer`; Signierte Bild-URL mit 24 h Gültigkeit; Aufruf des Make-Webhooks mit HMAC-Signatur.
- **Callback-Route** `src/routes/api/public/instagram/callback.ts`: prüft HMAC-Signatur und Idempotenzschlüssel, schreibt Ergebnis über den Admin-Client.
- **Secrets** (nur serverseitig): `MAKE_INSTAGRAM_WEBHOOK_URL`, `MAKE_INSTAGRAM_WEBHOOK_SECRET`, `INSTAGRAM_CALLBACK_SECRET`.
- **Neue Dateien:** `src/lib/instagram-post.ts` (Textgenerierung, deterministisch, mit Unit-Tests), `src/lib/instagram-image.ts` (4:5-Ableitung), `src/components/catch/instagram-workspace.tsx`, `src/components/settings/instagram-section.tsx`.
- **Bestehendes bleibt unverändert:** WhatsApp-Generierung, Kalkulation, Nachkalkulation, Historie.

### Webhook-Nutzdaten an Make.com

```json
{
  "catch_id": "uuid",
  "catch_number": "KC-2026-001",
  "idempotency_key": "uuid:1",
  "caption": "…",
  "image_url": "https://… (24 h gültig)",
  "publish_at": "2026-09-05T09:00:00Z",
  "approved_by": { "id": "uuid", "name": "…" },
  "callback_url": "https://…/api/public/instagram/callback",
  "callback_token": "hmac"
}
```

Erwartete Antwort: `202` mit `{ "accepted": true }`; das Ergebnis (`media_id`, `permalink` oder Fehlertext) kommt über den Callback.

## Abschliessende Prüfungen

Typprüfung, Unit-Tests (inkl. neuer Tests für Textgenerierung, Rollen- und Reihenfolgeregeln), Produktionsbuild sowie eine Durchsicht im Browser: kein Instagram vor WhatsApp, keine automatische Auswahl, Viewer gesperrt, doppelte Freigabe erzeugt keinen zweiten Beitrag.

Zum Schluss liefere ich die geforderte Zusammenfassung: Workflow, Migrationen, neue Secrets, exakte Webhook-Nutzdaten und Antwort, Schritt-für-Schritt-Aufbau des Make.com-Szenarios, verbleibende Meta-/Instagram-Einrichtungsschritte und Testergebnisse.
