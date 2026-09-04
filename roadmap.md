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

## Spätere Schritte (nicht implementiert)
- Abverkaufs-Rückmeldung, Nachkalkulation und Auswertung
- Historien-Analysen und Learning
- Nutzer- und Rollenverwaltung
