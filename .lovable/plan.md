# DB II — interner Aufwand pro vorbereiteter Einheit

Ziel: Neben dem bestehenden Deckungsbeitrag (DB I) zeigt jeder Catch einen zweiten Wert (DB II), der einen einzigen, editierbaren internen Aufwandssatz pro vorbereiteter Einheit abzieht. Keine Prozesskostenrechnung, keine neuen Pflichtschritte.

## Was neu ist

- Neues optionales Feld im Catch-Formular: **Interner Aufwand pro vorbereitete Einheit**, Standard bei neuen Catches CHF 2.50, Einheit dynamisch («CHF 2.50 / kg», «/ Stück»).
- Hilfetext: «Pauschale für direkt zurechenbare Logistik, Bereitstellung, Etikettierung und Verpackung.» plus Tooltip mit der Abgrenzung (enthalten: Wareneingang, interner Transport, Vorbereitung, Umpacken, Etikettierung, catchbezogene Administration, Verpackungs- und Etikettenmaterial — nicht enthalten: Miete, Energie, allgemeine Administration, normale Ladenarbeit, Marketing, Frequenz- und Cross-Selling-Effekte, sonstige Gemeinkosten).
- Vorkalkulation zeigt zusätzlich: Interner Aufwand pro Einheit, Interner Aufwand total, DB II, DB-II-Marge. DB I bleibt unverändert sichtbar und behält seine Definition.
- Nachkalkulation und Historie zeigen: effektiver Nettoerlös, effektiver DB I, interner Aufwand total, effektiver DB II, effektive DB-II-Marge.
- Sounding-Steckbrief, Prüfseite und Teams-Text enthalten DB I, internen Aufwand und DB II.
- Kundenkommunikation (WhatsApp, Instagram, Bild) bleibt vollständig unverändert — interne Werte erscheinen dort nie.

## Rechenregeln

Vorbereitete Menge = bestehende Einkaufsmenge in der gewählten Verkaufseinheit. Kein neues Mengenfeld.

```text
internal_handling_cost_total = purchase_quantity × internal_handling_cost_per_unit
planned_db_ii                = maximum_contribution_margin − internal_handling_cost_total
planned_db_ii_margin_percent = planned_db_ii ÷ maximum_net_revenue × 100
effective_db_ii              = effective_contribution_margin − internal_handling_cost_total
effective_db_ii_margin_percent = effective_db_ii ÷ effective_revenue × 100
```

- Nettoerlös 0 oder fehlend → Marge bleibt `null`, Anzeige «—». Keine Division durch Null.
- Unverkaufte Menge senkt den internen Aufwand nicht: immer die vorbereitete Menge.
- Ohne erfassten Satz bleiben DB II und Marge `null`; Anzeige «Interner Aufwand nicht erfasst». Kein stiller Rückfall auf CHF 2.50.
- Volle Präzision im Rechenkern, Rundung nur in der Anzeige (bestehende Formatierer).
- MWST-Logik unverändert: Kundenpreise brutto, DB I/DB II/Margen netto. Der interne Aufwand wird nie vom Bruttoumsatz abgezogen und trägt keine Umsatzsteuer.
- Negativer DB II wird in der bestehenden Warnfarbe gezeigt und blockiert das Speichern nicht.

## Datenbank

Additive Migration `add_internal_handling_cost`:

- `catches.internal_handling_cost_per_unit numeric` (nullable, CHECK `>= 0`, Standard nur für neu erfasste Catches über das Formular — kein Backfill bestehender Zeilen).
- Erweiterung von `catch_source_signature()` um `coalesce(internal_handling_cost_per_unit::text, '')`, damit eine Änderung des Satzes ein abgeschlossenes Sounding über den bestehenden Mechanismus als «überholt» markiert. Kein separater Genehmigungsprozess.
- Keine gespeicherten DB-II-Werte; DB II wird berechnet. In den bereits bestehenden Snapshots (Sounding-Snapshot, `reconciliation_snapshot`) werden Satz und Total mitgeschrieben, damit historische Ansichten nicht mit einem späteren Standardwert neu gerechnet werden.
- Schreibrechte laufen weiter über die bestehenden RLS-Regeln (Admin/Redaktion editierbar, Viewer lesend, geschlossene Catches unveränderlich). Keine neue Policy nötig.

## Technische Umsetzung

- `src/lib/vat.ts` bzw. neue Konstante: `DEFAULT_INTERNAL_HANDLING_COST = 2.5` in `catch-calculation.ts`, nur als Formular-Standard verwendet.
- `src/lib/catch-calculation.ts`: `CalculationInput.internal_handling_cost_per_unit?: number | null`; `CalculationValues` erhält `internal_handling_cost_per_unit`, `internal_handling_cost_total`, `db_i` (Alias auf `maximum_contribution_margin`), `db_ii`, `db_ii_margin_percentage` (alle `null`, wenn kein Satz erfasst ist). Bestehende Felder, Schwellenwertlogik und Ampel bleiben unangetastet — DB II beeinflusst die Entscheidungsstufe nicht.
- `src/lib/catch-reconciliation.ts`: gleiche Zusatzfelder in `ReconciliationValues`, plus Aggregation in `HistoryTotals` (`internal_handling_cost`, `contribution_margin_ii`).
- `src/lib/catches.ts`: Feld in `CatchFormValues`, `CatchListItem`, `CatchDetail`, `LIST_SELECT`, `DETAIL_SELECT`, `catchDetailToForm`, `saveCatch`, `EMPTY_CATCH_FORM` (Standard `"2.50"`), Konverter aus Angebotsdossiers unverändert (kein KI-Wert).
- `src/components/catch/catch-form.tsx`: Eingabefeld bei den direkten Kosten, dynamische Einheit, Hilfetext, Tooltip; nur editierbar für Admin/Redaktion und offene Catches.
- `src/components/catch/calculation-card.tsx`: neuer Abschnitt DB I / interner Aufwand / DB II / DB-II-Marge mit Erklärsatz «DB II berücksichtigt den direkt zurechenbaren internen Catch-Aufwand, jedoch keine allgemeinen Betriebs- oder Gemeinkosten.»
- `src/components/catch/reconciliation-card.tsx`, `completed-summary.tsx`, `src/routes/_authenticated/history.tsx`, `src/lib/export-workbook.ts`: effektive DB-II-Werte ergänzen, bestehende Spalten erhalten.
- `src/lib/sounding.ts`: `SoundingSnapshot` um `internal_handling_cost_per_unit`, `internal_handling_cost_total`, `db_ii`, `db_ii_margin_percentage`; Teams-Text erhält kompakte Zeilen für DB I, internen Aufwand und DB II. Alte Snapshots ohne diese Felder werden tolerant als «nicht erfasst» gelesen.
- `src/routes/_authenticated/catches.$catchId.index.tsx` und `.review.tsx`: Anzeige der neuen Werte.
- `src/lib/whatsapp-post.ts` und `instagram-post.ts`: keine Änderung; Test sichert das ab.

## Tests

Neu in `catch-calculation.test.ts`, `catch-reconciliation.test.ts`, `sounding.test.ts`, `whatsapp-post.test.ts`: Standard 2.50 bei neuem Catch, `null` bleibt `null`, Total über vorbereitete Menge, unverkaufte Menge senkt den Aufwand nicht, geplanter und effektiver DB II, Marge auf Nettobasis, Bruttopreis mit 2.6 % MWST, Nulldivision, negativer DB II, Satzänderung ändert das Ergebnis, Satzänderung markiert Sounding als überholt, interne Werte im Steckbrief und Teams-Text, keine internen Werte im Kundenpost, Viewer ohne Schreibrecht, historische Catches unverändert.

Zusätzlich: bestehende Testsuite, TypeScript-Check, Lint, Produktionsbuild.

## Handoff am Ende

Zusammenfassung, Migrationsname und Feld, implementierte Formeln, Herleitung der vorbereiteten Menge, Verhalten bestehender Catches ohne Wert, Bestätigung des unveränderten Kundenposts, Prüfergebnisse, verbleibende manuelle Browsertests.
