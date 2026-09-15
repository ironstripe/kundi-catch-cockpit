# Abholorte mit Adresse und optionaler Produktlink

## Ausgangslage (geprüft)

- In den Standortdaten existieren genau zwei Einträge: «Hofladen Kundelfingerhof» und «Stadtladen Schaffhausen». Der Schaffhausen-Eintrag ist vorhanden, seine Adresse und der Abholhinweis sind aktuell leer. Es wird also nichts neu angelegt, nur ergänzt.
- Catches laden heute nur Name und ID des Abholorts, keine Adresse und keinen Abholhinweis. Deshalb kann bisher keine Adresse angezeigt werden.
- Am Catch gibt es noch kein Feld für einen Produktlink.

## 1. Standortdaten Schaffhausen

Eine ergänzende, mehrfach ausführbare Datenbank-Änderung setzt beim bestehenden Eintrag (erkannt über die Namensvarianten «Stadtladen Schaffhausen» und «Hofladen Schaffhausen», ohne Rücksicht auf Gross-/Kleinschreibung):

- Name: Stadtladen Schaffhausen
- Adresse: Kirchhofplatz 10, 8200 Schaffhausen
- Abholhinweis: bleibt unverändert, wenn er befüllt ist; leere Hinweise werden nicht überschrieben

Kein neuer Standort, kein Duplikat. Die Standortdaten bleiben die einzige Quelle der Wahrheit; die Adresse wird nirgends im Text-Generator fest eingebaut.

## 2. Vollständige Standortangaben überall

Catch-Daten liefern künftig je gewählten Abholort ID, Name, Adresse und Abholhinweis. Damit zeigen Adresse und Hinweis in: Catch-Detail, Bearbeitungsmaske, Sounding-Steckbrief, Prüfseite, WhatsApp-Vorschau, publizierter Post, Historie und Export.

## 3. Format im Kundenpost

Ein Abholort:

```text
📍 Abholung:
Stadtladen Schaffhausen
Kirchhofplatz 10
8200 Schaffhausen
```

Mehrere Abholorte werden als Aufzählung mit eingerückter Adresse ausgegeben. Ein vorhandener Abholhinweis folgt auf der nächsten Zeile. Fehlt eine Adresse, erscheint nur der Name — ohne Leerzeilen oder Platzhalter.

## 4. Optionaler Produktlink

Neues, optionales Feld am Catch: «Produktlink im Onlineshop», Hilfetext «Optionaler Direktlink zum Produkt. Wird im WhatsApp-Post angezeigt, wenn eine gültige URL hinterlegt ist.», Platzhalter `https://...`.

- Administration und Redaktion können ihn erfassen und ändern, Betrachtende nur öffnen.
- Er ist für Speichern, Musterprüfung, Sounding und Publikation nie Pflicht.
- Erlaubt sind nur `https://`-Adressen (sowie `http://localhost` in der Entwicklung). Abgewiesen werden `javascript:`, `data:`, unsichere Protokolle, fehlerhafte und leere Eingaben; Leerzeichen werden vor dem Speichern entfernt. Die Prüfung erfolgt zusätzlich in der Datenbank, damit sie nicht umgangen werden kann.
- Auf internen Seiten erscheint er als Link «Produkt im Onlineshop öffnen», der in einem neuen Tab mit sicheren Linkattributen öffnet; ohne Eintrag steht dort kompakt «Nicht hinterlegt».
- Keine Shop-Anbindung, keine automatische Linksuche, kein Tracking, keine Linkverkürzung.

## 5. Sounding

Ist ein Produktlink vorhanden, wird er in den unveränderlichen Steckbrief aufgenommen, auf der Prüfseite angezeigt und in der Teams-Nachricht als eine Zeile `Onlineshop: [URL]` ergänzt — ohne Link entfällt die Zeile.

Ein nachträglich ergänzter oder korrigierter Produktlink macht ein abgeschlossenes Sounding **nicht** ungültig. Änderungen an Produkt, Preisen, Menge, Verfügbarkeit oder Abholorten machen es weiterhin ungültig.

## 6. Kundenpost

Mit Link wird kurz vor dem Schlussaufruf ergänzt:

```text
🛒 Im Onlineshop bestellen:
https://…
```

Ohne Link entfällt der Block vollständig. Der publizierte Post bleibt als unveränderliche Momentaufnahme erhalten; späteres Bearbeiten verändert ihn nicht.

## 7. Export

Der Export erhält Standortnamen, Adressen, Abholhinweise und den Produktlink; bestehende Spalten bleiben erhalten.

## Technische Umsetzung

- Migration 1 (Standort): idempotentes `UPDATE public.locations` über normalisierten Namensvergleich, `pickup_note` nur bei leerem Wert setzen.
- Migration 2 (Feld): `ALTER TABLE public.catches ADD COLUMN online_shop_url text`, plus `CHECK` auf `https://` bzw. `http://localhost`. Da `catch_source_signature` das Feld nicht enthält, invalidiert eine Linkänderung das Sounding nicht; `catch_locations` bleibt Teil der Signatur.
- `src/lib/catches.ts`: Detail- und Listen-Select um `locations ( id, name, address, pickup_note )` und `online_shop_url` erweitern; neuer Typ `CatchLocation`; `location_names` als abgeleiteter Wert erhalten, damit Historie/Karten/Filter unverändert funktionieren.
- `src/lib/whatsapp-post.ts`: `PostSource.locations` (statt nur Namen) und `online_shop_url`; neue reine Hilfsfunktion für den Abholblock; `POST_TEMPLATE_VERSION` erhöhen; Signatur um Adressen und Link ergänzen.
- `src/lib/publication.ts` (`catchToPostSource`), `src/lib/sounding.ts` (Steckbrief-Feld `locations`, `online_shop_url`, Teams-Zeile), `catch-form.tsx` (Feld + Validierung in `catch-validation.ts`), `catches.$catchId.index.tsx`, `catches.$catchId.review.tsx`, `publication-workspace.tsx`, `sounding-workspace.tsx`, `history.tsx`, `export-workbook.ts`.
- Tests: Standort-Update ohne Duplikat, Adressformat für einen/mehrere/adresslose Standorte, URL-Validierung inkl. unsicherer Protokolle, Link optional in allen Abläufen, Steckbrief und Teams-Nachricht nur mit Link, Signaturverhalten (Link neutral, Standortwechsel invalidierend), Export-Spalten. Danach gesamte Testsuite, Typprüfung, Lint und Produktionsbuild.
