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

## Schritt 6: Authentifizierung, Rollen und Einstellungen (abgeschlossen)
- [x] Anmeldung ohne Selbstregistrierung, Passwort-Reset per E-Mail
- [x] Datenmodell: profiles, product_categories, application_settings, erweitertes Audit
- [x] Rollen Admin/Editor/Viewer über RLS und UI-Guards, Schutz des letzten Admins
- [x] Einstellungen: Standorte, Lieferanten, Produktkategorien, Kalkulationsregeln, WhatsApp-Vorlage, Marke, Nutzer und Rollen, Änderungsprotokoll
- [x] Profilmenü mit Name, E-Mail, Rolle, Abmelden
- [x] Tests für Authentifizierung, Rollen, Stammdaten, Einstellungen und Audit

## Schritt 7: Produktionsreife, PWA, Backup und finale Qualitätssicherung
- [x] Statusübergänge zentral über Datenbank-Trigger erzwungen (inkl. Audit mit Vorher/Nachher)
- [x] Beispieldaten und Platzhalter-Kennzeichnungen entfernt
- [x] PWA: Manifest, Icons, Service Worker, Update-Hinweis «Eine neue Version ist verfügbar.» / «Jetzt aktualisieren"
- [x] Offline: Indikator im Header, Meldungen «Du bist offline …» und «Verbindung wiederhergestellt.»
- [x] Excel-Export (Catches, Lieferanten, Standorte, Kategorien, Nutzer, Audit) mit Audit-Eintrag
- [x] Backup-Webhook mit kurzlebiger signierter URL und Statusanzeige
- [x] Historie lädt schrittweise (25 Einträge, «Mehr anzeigen»)
- [x] Automatisierte Tests: 80 grün (Kalkulation, Nachkalkulation, Post, Instagram-Caption, Historienfilter)

## Instagram-Publikations-Workflow (abgeschlossen)
- [x] Datenbankfelder für Instagram in `catches`, Statusmaschine, Trigger gegen Manipulation von Ergebnisfeldern
- [x] Deterministische Caption-Generierung ohne Mengen/Preise/Abholorte, Portrait-Bildzuschnitt im Client
- [x] Instagram-Workspace auf der Catch-Detailseite (selektieren, Caption editieren, freigeben, publizieren, retry)
- [x] Einstellungs-Tab «Instagram» für Aktivierung, Default-Publikationszeit und Call-to-Action
- [x] Sicherer Webhook-Callback unter `/api/public/instagram/callback` mit HMAC-Signatur, Idempotenzschlüssel und Audit-Logging
- [ ] Make.com-Webhook-URL (`MAKE_INSTAGRAM_WEBHOOK_URL`) hinterlegen, sobald das Szenario steht (vom Benutzer zeitweise übersprungen)

## Angebotseingang für Lieferantenangebote (Resend)
- [x] Tabellen `supplier_offer_emails`, `supplier_offer_attachments`, `inbound_email_log` inkl. RLS und Grants
- [x] Privater Ablagebereich `supplier-offers` (25 MB Limit) mit Zugriffsregeln
- [x] Webhook `/api/public/webhooks/resend` mit Signaturprüfung, Zeitfenster, Adressfilter, Idempotenz und Zustellprotokoll
- [x] Nachladen der vollständigen E-Mail und der Anhänge über die Resend-API, Logos und Signaturbilder werden ausgelassen
- [x] Serverseitige strukturierte Auswertung (25 Felder mit Wert, Einheit, Sicherheit, Textstelle) — keine erfundenen Werte
- [x] Seite «Angebotseingang» mit Filtern Offen/Übernommen/Fehlerhaft/Alle
- [x] Detailseite: Original-E-Mail, editierbares Prüfformular mit Herkunftsangaben, Anhänge, Hauptbildwahl
- [x] Einmalige Übernahme als Catch-Entwurf inkl. Bildübernahme, Verweis auf das Angebot und Audit
- [x] Admin-Diagnose in den Einstellungen: Einrichtung und Zustellprotokoll
- [ ] `RESEND_WEBHOOK_SECRET` und `RESEND_API_KEY` hinterlegen, Webhook in Resend auf `email.received` einrichten
