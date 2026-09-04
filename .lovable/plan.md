# Benutzer- und Zugriffslogik an Kundivent angleichen

Ziel: Kundi Catch übernimmt die bewährte Anmelde-, Rollen- und Verwaltungslogik von Kundivent. Aussehen und Branding von Kundi Catch bleiben unverändert.

## 1. Vergleich: heute vs. Kundivent

| Bereich | Kundi Catch heute | Kundivent | Ergebnis |
| --- | --- | --- | --- |
| Konto anlegen | Einladungsmail, bei Fehlschlag still ein Passwort erzeugt | Admin setzt Startpasswort, erzwungene Änderung beim ersten Login | Kundivent übernehmen |
| Selbstregistrierung | serverseitig gesperrt | gesperrt | bleibt |
| Deaktivierte Nutzer | können sich anmelden, Oberfläche lädt teilweise | eigener Hinweis „Zugang deaktiviert" mit Abmelden | Kundivent übernehmen |
| Passwortwechsel erzwingen | nicht vorhanden | `must_change_password` blockiert die App | neu |
| Rollen | eigene Rollentabelle (sicherer) + Prüffunktionen | Rolle im Profil | Rollentabelle behalten, Verhalten angleichen |
| Nutzer löschen | nicht möglich | möglich, letzter Admin geschützt | neu |
| Bilder-Speicher | **jede angemeldete Person darf hoch- und runterladen, ersetzen, löschen** | rollenabhängig | Lücke, wird geschlossen |
| Eigenes Profil | **eigene Zeile ist voll änderbar, inkl. „aktiv"** | privilegierte Felder per Datenbank-Trigger gesperrt | Lücke, wird geschlossen |
| Änderungsprotokoll | Client sendet die handelnde Person selbst mit | serverseitig gesetzt | wird abgesichert |
| Protokoll-Aktionen | `export_created` und `backup_sent` werden von der Datenbank abgelehnt, Fehler bleibt unsichtbar | – | Fehler, wird behoben |

## 2. Umsetzung

### Anmeldung und Sitzung
- Anmeldeseite ohne Registrierung, Hinweis „Konten werden von der Administration erstellt", verständliche deutsche Fehlermeldungen (bestehende Übersetzung bleibt).
- Neuer Schritt „Passwort ändern" nach dem ersten Login bzw. nach einem Zurücksetzen durch Admins: die App bleibt gesperrt, bis ein persönliches Passwort gesetzt ist.
- Deaktivierte Konten sehen sofort den Hinweis „Zugang deaktiviert" mit Abmelden-Schaltfläche; kein Zugriff auf Inhalte, keine Selbst-Reaktivierung.
- Abmelden räumt weiterhin Zwischenspeicher und Verlauf auf.

### Rollen
- Admin: alles, inklusive Nutzerverwaltung, Einstellungen, Wiederöffnen und Abbrechen von Catches.
- Editor: Catches anlegen, bearbeiten, publizieren, abschliessen; Bilder hochladen und ersetzen.
- Viewer: nur lesen — auch technisch, nicht nur durch ausgeblendete Schaltflächen.

### Nutzerverwaltung (Einstellungen → Nutzer und Rollen)
Liste mit Name, E-Mail, Rolle, Status, letzter Anmeldung; Aktionen: Nutzer anlegen (mit Startpasswort), bearbeiten, Rolle ändern, aktivieren/deaktivieren, Passwort zurücksetzen, löschen. Sicherheitsrelevante Aktionen mit konkretem Bestätigungstext; der letzte aktive Administrator kann weder herabgestuft, deaktiviert noch gelöscht werden; niemand kann sich selbst herabstufen. Kein still erzeugtes Passwort mehr — Fehler werden klar angezeigt.

### Datenbank- und Speicher-Sicherheit
- Bilder im privaten Catch-Bilder-Speicher: Lesen für aktive Nutzer, Schreiben/Ersetzen/Löschen nur für aktive Admins und Editoren.
- Profil: eigene Zeile nur mit Name änderbar; „aktiv" und Rolle nur über die Nutzerverwaltung.
- Alle Schreibrechte auf Catches, Bilder, Standortzuordnungen und Posts hängen an „aktiv + Admin/Editor"; Wiederöffnen und Abbrechen zusätzlich nur für Admins.
- Änderungsprotokoll: handelnde Person wird von der Datenbank gesetzt, ein Client kann sie nicht mehr frei wählen; fehlende Aktionen `export_created` und `backup_sent` werden ergänzt und Protokollfehler nicht mehr verschluckt.
- Server-Funktionen prüfen Rolle und Aktiv-Status weiterhin serverseitig; Passwort-Rücksetzung und E-Mail-Adresse werden serverseitig aus der Nutzer-ID gelesen, Weiterleitungsziele nur auf die eigene Anwendung.

### Bestandsschutz
Alle bestehenden Nutzer, Rollen und Catch-Daten bleiben erhalten. Nur ergänzende Migrationen; bestehende Migrationen und die Statusregeln für Catches bleiben unverändert. Kundivent-Themen wie Events, Planungsbereiche oder Kategorien werden nicht übernommen.

## 3. Neue Migrationen (geplant)

1. `must_change_password` im Profil, Trigger gegen Änderungen an privilegierten Profilfeldern, engere Profil-Schreibregel.
2. Rollen-Hilfsfunktionen (aktiver Admin / aktiver Editor) und angepasste Zugriffsregeln für Catches, Bilder, Standortzuordnungen, Posts.
3. Speicherregeln für den Catch-Bilder-Speicher nach Rolle.
4. Änderungsprotokoll: automatische Zuordnung der handelnden Person, erweiterte erlaubte Aktionen.

## 4. Tests und Prüfung

Automatisiert: Rollen- und Berechtigungslogik, Nutzerverwaltungs-Regeln (letzter Admin, Selbst-Herabstufung, Passwortprüfung), Protokoll-Aktionen; bestehende Kalkulations- und Nachkalkulationstests bleiben grün. Dazu Typprüfung, Produktions-Build und Linting.

Manuell im Browser: Admin-Login und Nutzerverwaltung, erzwungener Passwortwechsel, Editor- und Viewer-Verhalten, deaktiviertes Konto, Bild-Upload je Rolle.

Zum Schluss folgt eine kurze Zusammenfassung mit Vergleich, Änderungen, Migrationen und Testergebnissen.
