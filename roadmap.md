# Kundi Catch Cockpit — Roadmap

## Schritt 1: Fundament (abgeschlossen)
- [x] Kundivent-Designsystem als Tokenbasis (`src/styles.css`)
- [x] Logo, Favicon, PWA-Manifest
- [x] App-Shell mit Sidebar-Navigation (Dashboard / Neuer Catch / Historie / Einstellungen)
- [x] Dashboard mit KPI-Platzhaltern und Beispiel-Catches
- [x] Leere Seiten: Neuer Catch, Historie, Einstellungen
- [x] Datenbankschema: catches, catch_images, suppliers, locations, catch_locations, post_versions, audit_events

## Schritt 2: Catch-Erfassung und Bearbeitung (abgeschlossen)
- [x] Anmeldung, geschützte Routen
- [x] Formular, Validierung, Entwurf/Bereit, Bildupload, Detailseite
- [x] Catch-Nummer serverseitig (KC-YYYY-NNN)

## Schritt 3: Vorkalkulation und Entscheidungshilfe (abgeschlossen)
- [x] Berechnungslogik, Ampel, Schwellenwerte, Live-Kalkulation, Dashboard-KPIs
- [x] Unit-Tests

## Schritt 4: WhatsApp-Post und manuelle Publikation (abgeschlossen)
- [x] Deterministische Postgenerierung, Editieren, Zurücksetzen, Neu generieren
- [x] Bildoptimierung (max. 1080 px, ohne Metadaten) im privaten Bucket
- [x] Vorschau mit Formatierung, Bild-/Textkopie mit Fallbacks, WhatsApp öffnen
- [x] Warnung bei veralteten Posts, Publikationsbestätigung, Publikationsindikator im Dashboard
- [x] Unit-Tests für Postgenerierung und Kopier-Fallbacks

## Schritt 5: Nachkalkulation, Abschluss und Historie (abgeschlossen)
- [x] Datenmodell: Restmenge, Zählzeitpunkt, Learning, Abschluss-, Wiederöffnungs- und Abbruchfelder, Snapshot
- [x] Nachkalkulation mit Live-Vorschau, Plan/Ist-Vergleich und Break-even-Bewertung
- [x] Abschluss, Wiederöffnung mit Grund, Abbruch mit Grund, Audit-Einträge
- [x] Ergebnisansicht auf der Detailseite (fixierte Werte, Learning)
- [x] Historie mit echten Daten, KPIs, Filtern, Suche und klickbaren Zeilen
- [x] Dashboard: Ergebniswerte, Durchschnittlicher Abverkauf, Effektiver Gesamt-DB
- [x] Unit-Tests für Nachkalkulation, Aggregation und Historien-Filter

## Schritt 6: Authentifizierung, Rollen und Einstellungen (in Arbeit)
- [ ] Anmeldung ohne Selbstregistrierung, Passwort-Reset per E-Mail
- [ ] Datenmodell: profiles, product_categories, application_settings, erweitertes Audit
- [ ] Rollen Admin/Editor/Viewer über RLS und UI-Guards, Schutz des letzten Admins
- [ ] Einstellungen: Standorte, Lieferanten, Produktkategorien, Kalkulationsregeln, WhatsApp-Vorlage, Marke, Nutzer und Rollen, Änderungsprotokoll
- [ ] Profilmenü mit Name, E-Mail, Rolle, Abmelden
- [ ] Tests für Authentifizierung, Rollen, Stammdaten, Einstellungen und Audit

## Schritt 7: Produktionsreife, PWA, Backup und finale Qualitätssicherung (in Arbeit)
- [ ] Statusübergänge zentral und serverseitig erzwingen (inkl. Audit mit Vorher/Nachher)
- [ ] Platzhalter, Beispieldaten und sichtbare technische IDs entfernen
- [ ] PWA: Manifest, Icons, Service Worker, Update-Hinweis «Eine neue Version ist verfügbar.»
- [ ] Offline: Indikator, schreibgeschützter Modus, Meldungen
- [ ] Excel-Export (Catches, Lieferanten, Standorte, Kategorien, Nutzer, Audit) mit Audit-Eintrag
- [ ] Externes Backup über Webhook-Secret mit kurzlebiger signierter URL und Statusanzeige
- [ ] Fehlerbehandlung, Bestätigungsdialoge, Doppelklick-/Duplikatschutz
- [ ] Sicherheits-, Performance-, Responsive- und Accessibility-Review
- [ ] Rollentests Admin/Editor/Viewer, Felchenfilets-End-to-End-Test

- [x] Excel-Export (Catches, Stammdaten, Nutzer, Audit) im Einstellungen-Tab
- [x] Backup-Webhook mit kurzlebiger Download-URL und backup_runs-Protokoll
- [x] PWA: Service Worker, Update-Hinweis, Offline-Indikator
- [ ] Backup-Adresse (BACKUP_WEBHOOK_URL) hinterlegen
