# MWST bei bestehenden Catches nachziehen

## Was los ist

Die MWST-Rechnung funktioniert — bei diesem Catch ist aber ausdrücklich «0 %» hinterlegt. Prüfung in der Datenbank:

- Catch KC-2026-004 (Silberlachs, Entwurf): MWST-Satz = 0
- Catch KC-2026-003 (Felchen, abgeschlossen): MWST-Satz = 0
- Standardsatz in den Einstellungen: 2.6 %

Beim Umbau wurden alle damals vorhandenen Catches auf 0 % gesetzt, damit sich keine bereits kommunizierten Zahlen rückwirkend verändern. Ein leeres Feld würde den Standardsatz von 2.6 % verwenden, eine hinterlegte 0 wird respektiert — deshalb steht in der Vorschau «kein Mehrwertsteuersatz hinterlegt».

## Vorgeschlagene Korrektur

1. Bei allen noch nicht abgeschlossenen Catches (Entwurf, Bereit, Publiziert) den Wert 0 entfernen, damit automatisch der Standardsatz 2.6 % greift. Betrifft aktuell nur den Silberlachs-Entwurf.
2. Abgeschlossene und abgebrochene Catches bleiben unverändert bei 0 % (Historie friert ein). Betrifft den Felchen-Catch.
3. Im Catch-Formular das MWST-Feld künftig leer vorbelegen statt mit einer Zahl, sodass immer der aktuelle Standardsatz gilt, solange nichts Abweichendes eingetragen wird. Ein bewusst eingetragenes «0» bleibt weiterhin möglich und wird respektiert.
4. Der Hinweistext im Formular nennt den aktuell gültigen Standardsatz, damit sichtbar ist, was bei leerem Feld gerechnet wird.

## Ergebnis

Beim Silberlachs steht dann «Food-Catch-Preis netto (MWST 2.6 %)», der maximale Umsatz wird netto gerechnet und die enthaltene MWST separat ausgewiesen. Neue Catches rechnen ohne Zusatzaufwand mit 2.6 %.

## Technisches Detail

- Migration: `UPDATE public.catches SET vat_rate = NULL WHERE vat_rate = 0 AND status IN ('draft','ready','published')`.
- `EMPTY_FORM_VALUES.vat_rate` in `src/lib/catches.ts` von `String(DEFAULT_VAT_RATE)` auf `""` ändern; die bestehende Fallback-Kette (`parseVatRate(...) ?? defaultVatRate`) greift damit.
- Feldbeschriftung/Hinweis in `src/components/catch/catch-form.tsx` auf den geladenen Standardsatz aus den Einstellungen beziehen.
