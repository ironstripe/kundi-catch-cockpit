# KC-2026-004 mit CHF 2.50 internem Aufwand rechnen

Der Catch KC-2026-004 «Silberlachs geräuchert vorgeschnitten, Wildfang» (Status «Bereit», 100 Stk) hat aktuell keinen internen Aufwand gespeichert, deshalb bleibt DB II bei «Interner Aufwand nicht erfasst».

## Was passiert

Der Standardwert CHF 2.50 pro vorbereiteter Einheit wird für genau diesen Catch gespeichert:

- Interner Aufwand: CHF 2.50 / Stk
- Interner Aufwand total: CHF 250.00 (100 Stk × 2.50)
- DB II erscheint danach in Kalkulation, Nachkalkulation, Prüfansicht und Teams-Text
- Eintrag im Änderungsprotokoll als «Standardwert interner Aufwand übernommen»

Andere Catches und die Kundenkommunikation über WhatsApp bleiben unverändert.

## Wichtiger Hinweis

Der interne Aufwand ist Teil der Angaben, die das Sounding absichert. Sobald der Wert gesetzt wird, markiert das bestehende System die abgeschlossene Sounding-Runde automatisch als «überholt». Der Catch bleibt auf «Bereit» und kann publiziert werden; wird er aber zurück auf «Entwurf» gesetzt, braucht er vor dem nächsten «Bereit» eine neue Sounding-Runde.

Falls das nicht gewünscht ist, kann der Wert stattdessen erst nach der Publikation gesetzt werden — dann bitte kurz Bescheid geben.

## Technische Umsetzung

Datenänderung an der Zeile in `catches`: `internal_handling_cost_per_unit = 2.5000` für `id = 59d21d99-ef9e-4ff1-b6e1-1eb3a868d6d5`, nur wenn der Wert dort noch leer ist. Dazu ein Audit-Eintrag mit Aktion `internal_handling_applied` (Vorher `null`, Nachher `2.5`). Keine Codeänderung, keine Migration, keine Änderung an den bestehenden Formeln (`total = purchase_quantity × Satz`, `DB II = DB I − total`).

Alternativ derselbe Effekt ohne Datenbankeingriff: in der Kalkulationskarte des Catches die Aktion «Standardwert CHF 2.50 übernehmen» klicken — sie ist genau dafür da und protokolliert die handelnde Person.
