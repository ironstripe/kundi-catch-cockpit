# Musterprüfung und internes Sounding

Jeder Food Catch bekommt zwei interne Freigabeschritte, bevor er für die Kundenpublikation bereit ist: eine Musterprüfung am aufgetauten Produkt und ein internes Sounding mit strukturierter Rückmeldung. Microsoft Teams dient nur als Benachrichtigungskanal — die Daten und Rückmeldungen bleiben im Cockpit. WhatsApp bleibt unverändert der Kundenkanal.

## Ablauf im Cockpit

1. Catch erfassen und kalkulieren, als Entwurf speichern.
2. Produktmuster offline auftauen und prüfen.
3. Ergebnis im Cockpit erfassen: Bestanden / Nicht bestanden, optionale Bemerkung.
4. Sounding starten: Prüfende auswählen, Nachricht kopieren, Teams-Gruppenchat öffnen, Nachricht dort einfügen und senden.
5. Prüfende öffnen den geschützten Cockpit-Link und geben Rückmeldung: «Passt für mich», «Rückfrage», «Stopp – so nicht umsetzen».
6. Admin oder Redaktion schliesst das Sounding ab.
7. Erst danach ist «Bereit» und die WhatsApp-Publikation möglich.

## Musterprüfung

- Zustände: Ausstehend (Standard, auch für bestehende unveröffentlichte Catches), Bestanden, Nicht bestanden.
- Kompakte Karte in Catch-Detail und Bearbeitung mit Ergebnis, geprüft von, geprüft am, Bemerkung.
- Admin und Redaktion erfassen und korrigieren; Betrachtende sehen nur.
- Ausstehend: Sounding gesperrt mit Hinweis. Nicht bestanden: Sounding, «Bereit» und Publikation gesperrt mit dem Hinweis «Die Musterprüfung wurde nicht bestanden. Dieser Catch kann nicht freigegeben werden.» Der Catch wird nicht automatisch abgebrochen.
- Änderungen an der Produktidentität setzen die Musterprüfung auf Ausstehend zurück und markieren ein laufendes Sounding als überholt: Produktname, Artikelnummer (neu), Lieferant, Kategorie, Frisch/TK, Verpackung, MHD, Produktbild. Preise, Menge, MWST, Lieferkosten, Verfügbarkeit, Posttext und interne Notizen lösen keine Rücksetzung aus. Das frühere Ergebnis bleibt im Änderungsprotokoll.
- Neu: optionales Feld «Artikelnummer» im Catch-Formular, sichtbar in Detail, Steckbrief und Sounding-Nachricht.

## Sounding

- Runden mit Zuständen: Angefragt, Rückmeldung erhalten, Abgeschlossen, Überholt, Abgebrochen. Frühere Runden und Rückmeldungen bleiben erhalten.
- Beim Start wird ein unveränderlicher Steckbrief gespeichert: Catch-Nummer, Produkt, Artikelnummer, Lieferant, Bildverweis, Menge und Einheit, Steuerbasis Einkauf, Netto-Einkaufspreis, Netto-Lieferkosten, Nettoinvestition, Food-Catch-Preis inkl. MWST, MWST-Satz, Normalpreis inkl. MWST, Preisvorteil, maximaler Brutto- und Nettoumsatz, maximaler Deckungsbeitrag, Rohmarge, Break-even-Abverkauf, Verfügbarkeit, Abholort, Handicap-Story sowie das Musterprüfungsergebnis mit Person, Zeit und Bemerkung. Keine dauerhaften öffentlichen Bild-Links.
- Auswahl der Prüfenden aus den aktiven Cockpit-Nutzenden, mindestens eine Person. Keine externen Empfängerinnen, keine E-Mail-Adressen, keine automatische Zuordnung.
- Administratoren hinterlegen in den Einstellungen Standard-Prüfende; diese sind im Dialog vorausgewählt und bleiben änderbar.
- Rückmeldung: genau drei Optionen plus ein kurzes Kommentarfeld. Bei «Rückfrage» und «Stopp» ist ein Kommentar Pflicht, bei «Passt für mich» optional. Jede ausgewählte Person hat eine aktuelle Rückmeldung und kann sie ändern, solange die Runde offen ist.
- Abschluss nur, wenn die Musterprüfung bestanden ist, mindestens eine Rückmeldung vorliegt, mindestens eine Zustimmung dabei ist, kein offenes «Stopp» besteht und der Steckbrief noch zum aktuellen Catch passt. «Rückfrage» zählt nicht als Zustimmung. Abschluss erfordert eine Bestätigung und setzt den Catch nicht automatisch auf «Bereit».
- Wird ein geprüfter Wert nachträglich geändert, wird die Runde überholt, die Rückmeldungen bleiben erhalten, «Bereit» ist gesperrt und es erscheint «Der Catch wurde seit dem Sounding verändert. Bitte erneut zum Sounding senden.»

## Teams

- Neue Einstellung «Teams-Gruppenchat-Link», nur für Administratoren, Pflicht auf HTTPS, mit Hinweis, wenn die Adresse nicht wie ein Teams-Link aussieht. Änderbar und entfernbar, nicht öffentlich sichtbar, nicht im allgemeinen Änderungsprotokoll.
- Im Sounding-Dialog: «Text kopieren» ist immer verfügbar, «Teams öffnen» öffnet den hinterlegten Chat in einem neuen Tab. Ohne Eintrag ist der Knopf deaktiviert mit dem Hinweis «Der Teams-Gruppenchat ist noch nicht in den Einstellungen hinterlegt.»
- Keine Teams-Schnittstelle, keine Bots, Webhooks oder automatisch gesendeten Nachrichten. Einfügen und Senden geschieht manuell.
- Nachrichtenaufbau (aus dem Steckbrief, kompakt, ohne interne Kennungen):

```text
🐟 FOOD CATCH – Sounding

[Produkt]
Menge: [Menge und Einheit]

Einkauf inkl. Lieferung: [Nettoinvestition]
Verkaufspreis: [Food-Catch-Preis] inkl. MWST
Preisvorteil: [Prozent]
Maximaler DB: [Netto-Deckungsbeitrag]
Rohmarge: [Prozent]
Break-even: [Abverkauf in Prozent]

Musterprüfung: ✅ Bestanden
Geprüft am: [Datum]

Bitte Feedback im Cockpit erfassen:
[geschützter Review-Link]
```

## Review-Seite

- Geschützte Adresse `/catches/{catchId}/review`, kein öffentlicher Zugang und kein Token. Nicht angemeldete Personen werden zur Anmeldung geführt und danach automatisch auf die Review-Seite zurückgebracht. Direktes Neuladen funktioniert.
- Mobil optimiert, weil die Seite aus Teams heraus geöffnet wird.
- Abschnitte: Produkt mit Bild, Lieferant, Artikelnummer, Menge, Verfügbarkeit, Abholort und Handicap-Story; Musterprüfung; Kalkulation mit Nettoinvestition, Preis inkl. MWST, MWST-Satz, Normalpreis, Preisvorteil, Brutto- und Nettoumsatz, Deckungsbeitrag, Rohmarge, Break-even und der bestehenden Ampelbewertung; Rückmeldung mit den drei Optionen und Kommentarfeld sowie der Liste bereits erfasster Rückmeldungen mit Person, Entscheid, Kommentar und Zeit.
- Keine Chatverläufe, Erwähnungen, Reaktionen oder Dateiuploads.

## Berechtigungen

- Admin und Redaktion: Musterprüfung erfassen und korrigieren, Prüfende wählen, Sounding starten und abschliessen, neue Runde starten, Nachricht kopieren, Teams öffnen.
- Ausgewählte aktive Personen — auch Betrachtende — öffnen ihre Review, sehen den Steckbrief und erfassen oder ändern ihre eigene Rückmeldung, solange die Runde offen ist.
- Betrachtende ändern keine Catch-Daten, keine Musterprüfung, keine Auswahl, schliessen kein Sounding ab, publizieren nicht und ändern keine fremde Rückmeldung.
- Alle Prüfungen laufen in Datenbank und Serverlogik, nicht nur über ausgeblendete Knöpfe. Personen und Zeitstempel werden serverseitig bestimmt.

## Reihenfolge auf der Catch-Seite

Catch-Angaben und Kalkulation → Musterprüfung → Internes Sounding → WhatsApp-Publikation. Im Entwurf sind Musterprüfung und Sounding aktiv, die Kundenpublikation bleibt gesperrt. Ab «Bereit» sind Musterprüfung und Sounding schreibgeschützt und die Publikation verfügbar. Bei publizierten, abgeschlossenen und abgebrochenen Catches bleibt die Historie einsehbar, aber unveränderlich.

## Kundenpublikation bleibt unberührt

Der WhatsApp-Bereich zeigt weiterhin nur Kundeninhalte: Produktangaben, Bruttopreis inkl. MWST, Abholort, Verfügbarkeit, Story und Aufruf. Keine internen Entscheide, Namen, Kommentare, Netto-Einkaufspreise, Deckungsbeiträge oder Teams-Links.

## Änderungsprotokoll

Erfasst werden: Musterprüfung bestanden, nicht bestanden, korrigiert, zurückgesetzt; Sounding gestartet, Prüfende zugewiesen, Rückmeldung erfasst und geändert, Sounding abgeschlossen, überholt, neue Runde gestartet. Der Teams-Link wird nicht mitprotokolliert.

## Technische Umsetzung

- Additive Migration: `catches.article_number`, `sample_check_status` (Default `pending`), `sample_checked_at`, `sample_checked_by`, `sample_check_note`; neue Tabellen `catch_review_rounds` (catch_id, round_number, status, snapshot jsonb, source_signature, requested_by/at, completed_by/at, outdated_at, Zeitstempel), `catch_review_recipients` (round_id, user_id, unique), `catch_review_responses` (round_id, user_id, decision, comment, unique je Runde und Person). GRANTs für `authenticated` und `service_role`, RLS aktiv.
- RLS: Lesen für aktive Nutzende; Runden und Prüfende schreiben nur `can_edit()`; Rückmeldungen nur `user_id = auth.uid()` und nur bei Zugehörigkeit zur Runde und offenem Status. Trigger blockt Kommentarpflicht bei `question`/`stop`, fremde Bearbeitung und Änderungen an abgeschlossenen oder überholten Runden.
- Bestehender Trigger `enforce_catch_status_transition` wird erweitert: Übergang `draft → ready` nur bei `sample_check_status = 'passed'`, einer Runde mit `status = 'completed'` und übereinstimmender `source_signature`; deutsche Fehlermeldungen gemäss Vorgabe. Lifecycle-Enum bleibt unverändert.
- Trigger auf `catches`: Änderung eines Identitätsfelds setzt Musterprüfung zurück und markiert offene sowie abgeschlossene Runden als `outdated`; Änderung eines geprüften Kalkulations- oder Aktionsfelds markiert Runden als `outdated`, ohne die Musterprüfung zu berühren. Vorherige Werte gehen als Audit-Event in `audit_events`.
- Neu: `src/lib/sample-check.ts`, `src/lib/sounding.ts` (Steckbrief, deterministische Signatur, Nachrichtentext, Abschlussregeln), `src/lib/sounding.functions.ts` für serverseitige Aktionen mit `requireSupabaseAuth`; UI in `src/components/catch/sample-check-card.tsx`, `sounding-workspace.tsx`, `sounding-dialog.tsx`, Einstellungsabschnitt `src/components/settings/sounding-section.tsx` (Teams-Link, Standard-Prüfende über `application_settings`), neue Route `src/routes/_authenticated/catches.$catchId.review.tsx`; Rücksprung nach Anmeldung über bestehende `redirect`-Logik in `src/routes/auth.tsx`.
- `catch-validation.ts` und `catch-form.tsx` erhalten die neuen Bedingungen für «Bereit»; `catches.ts` Select/Mapping/Save um Artikelnummer und Musterprüfung erweitert; `audit.ts` um die neuen Aktionen und Beschriftungen.
- Tests: Signatur- und Invalidierungslogik, Abschlussregeln, Nachrichtengenerierung (Bruttopreis, Netto-DB, kein WhatsApp-Wortlaut), Kommentarpflicht, Musterprüfungs-Zustände sowie die bestehende Suite; danach Typprüfung, Lint und Produktionsbuild.
