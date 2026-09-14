# MWST vollständig zu Ende führen: Einkaufs- und Lieferbasis, Beschriftungen, Angebote, Export

## Was bereits erledigt ist

Bereits umgesetzt und geprüft: Kundenpreise gelten als Bruttopreise, Umsatz, Deckungsbeitrag, Rohmarge und Break-even rechnen netto, der MWST-Satz ist pro Catch gespeichert (Standard 2.6 %), Preisvorteil vergleicht Brutto mit Brutto, Nachkalkulation, Dashboard, Historie und Export weisen netto, brutto und MWST getrennt aus.

Offen sind die Teile des Auftrags, die die **Kostenseite** und die **Beschriftungen** betreffen.

## Was noch gebaut wird

### 1. MWST-Basis beim Einkaufspreis

Neu wird pro Catch festgehalten, ob der Einkaufspreis mit oder ohne MWST erfasst wurde, samt zugehörigem Satz (Standard 2.6 %). Im Formular steht die Basis direkt neben dem Preisfeld als kleine Umschaltung: «exkl. MWST» (Standard bei neuer Erfassung) oder «inkl. MWST». Ist «inkl. MWST» gewählt, wird für die Kalkulation der Nettoeinkaufspreis verwendet — die enthaltene Vorsteuer gilt nicht als Warenkosten.

### 2. MWST-Basis bei den Lieferkosten

Ebenfalls pro Catch: Basis der Lieferkosten (Standard «exkl. MWST») und Liefer-MWST-Satz (Standard 8.1 %, weil Transport dem Normalsatz unterliegt). Die beiden Felder erscheinen nur, wenn überhaupt Lieferkosten anfallen — bei «Lieferung inbegriffen» oder 0.00 bleiben sie ausgeblendet.

### 3. Klare Beschriftungen

- «Food-Catch-Preis inkl. MWST»
- «Normalpreis inkl. MWST»
- «Einkaufspreis exkl./inkl. MWST» (je nach Wahl)
- «MWST-Satz Verkauf», mit sichtbarem Hinweis auf den geltenden Standardsatz
- Kalkulationskarte trennt sichtbar Kundensicht (Angebotspreis inkl. MWST, maximaler Bruttoumsatz) von interner Rechnung (enthaltene MWST, Nettoumsatz, Nettoinvestition, maximaler DB, Rohmarge, Break-even-Abverkauf), mit kurzen Erklärtexten.
- Verwendete Begriffe überall gleich: Bruttoumsatz, Nettoumsatz, MWST, Deckungsbeitrag.

### 4. Kundenausgaben bleiben brutto

WhatsApp-Text, WhatsApp-Bild, Instagram-Inhalte, Publikationsbilder und alle Vorschauen zeigen weiterhin ausschliesslich den Bruttopreis. Zusätzlich erscheint im generierten Text ein knapper Zusatz «inkl. MWST» beim Preis. Ein Nettopreis wird der Kundschaft nie gezeigt.

### 5. Nachkalkulation, Dashboard, Historie

Die Nachkalkulation nutzt die neue Nettoinvestition (Einkauf und Lieferung netto) als Kostenbasis und den auf dem Catch gespeicherten MWST-Satz. Aggregationen und Vergleiche Plan gegen Ist verwenden durchgehend die gleiche Steuerbasis.

### 6. Angebotsauswertung

Die Auswertung von Lieferanten-E-Mails erkennt zusätzlich, ob ein Preis ausdrücklich «inkl. MWST» oder «exkl./zzgl. MWST» genannt ist, ebenso genannte Sätze für Ware und Lieferung. Steht nichts davon in der Quelle, bleibt das Feld leer und wird zur menschlichen Bestätigung markiert — es wird nie geraten. Der Verkaufs-MWST-Satz kommt nie aus dem Angebot.

### 7. Freigabe-Prüfung

Vor «Bereit» sind nötig: gültiger Food-Catch-Bruttopreis, gültiger Verkaufs-MWST-Satz, bestätigte Basis des Einkaufspreises samt gültigem Satz bei «inkl. MWST», und bei vorhandenen Lieferkosten bestätigte Basis samt gültigem Satz. Entwürfe bleiben mit unvollständigen Steuerangaben speicherbar.

### 8. Export

Zusätzliche bzw. präzisierte Spalten: Verkaufs-MWST-Satz, Food-Catch-Preis inkl. MWST, Normalpreis inkl. MWST, maximaler Brutto- und Nettoumsatz, maximale MWST, Basis und Satz des Einkaufspreises, Nettoeinkaufspreis, Basis und Satz der Lieferkosten, Nettolieferkosten, Nettoinvestition, Netto-Deckungsbeitrag, effektiver Brutto- und Nettoumsatz, effektive MWST, effektiver Deckungsbeitrag. Bestehende Spalten bleiben, unklare Überschriften werden eindeutig benannt.

### 9. Bestehende Catches

Bestehende Preise bleiben unverändert und gelten als Bruttopreise. Fehlt ein Verkaufs-MWST-Satz, gilt 2.6 %. Für die Einkaufsbasis gilt die betriebliche Annahme «exkl. MWST»; diese Annahme wird dokumentiert und im Catch-Formular sichtbar zur Prüfung markiert. Abgeschlossene und abgebrochene Catches bleiben unberührt. Erfasste Quelldaten werden nicht überschrieben.

## Technisches Detail

- **Migration (additiv, keine Umbenennung, keine Löschung):** `catches.purchase_price_includes_vat boolean not null default false`, `catches.purchase_vat_rate numeric default 2.6`, `catches.delivery_cost_includes_vat boolean not null default false`, `catches.delivery_vat_rate numeric default 8.1`, `catches.vat_basis_confirmed boolean not null default false` (Prüfmarkierung für Altbestand), Validierungs-Trigger 0 ≤ Satz < 100. Die bestehende Spalte `vat_rate` bleibt der Verkaufs-Satz-Snapshot (entspricht `sales_vat_rate`); eine zweite Spalte mit gleicher Bedeutung wird bewusst nicht angelegt.
- **`src/lib/vat.ts`:** `DEFAULT_PURCHASE_VAT_RATE = 2.6`, `DEFAULT_DELIVERY_VAT_RATE = 8.1`, `netFromGross` wiederverwendet.
- **`src/lib/catch-calculation.ts`:** `CalculationInput` erhält `purchase_price_includes_vat`, `purchase_vat_rate`, `delivery_cost_includes_vat`, `delivery_vat_rate`. Neue Ausgaben: `net_purchase_price_per_unit`, `net_delivery_cost`, `net_investment`, `maximum_net_revenue`, `maximum_gross_revenue`, `maximum_sales_vat` als eindeutig benannte Aliasse; bestehende Felder (`total_investment`, `maximum_revenue`, …) bleiben erhalten und werden auf Nettobasis gefüllt, damit alle Konsumenten weiterlaufen. Formeln exakt nach Auftrag; Rundung nur bei der Anzeige.
- **`src/lib/catch-reconciliation.ts`:** `effectiveContributionMargin = effectiveNetRevenue − netInvestment`; Restmengenlogik unverändert.
- **`src/lib/catches.ts`:** Formularfelder, Mapping, Save-Payload und die drei Konverter um die neuen Felder erweitern.
- **`src/lib/catch-validation.ts`:** neue Regeln in `validateReady`, `validateDraft` unverändert.
- **`src/lib/supplier-offer-extraction.ts` + `supplier-offer-ai.server.ts`:** Feldschlüssel `purchase_price_includes_vat`, `purchase_vat_rate`, `delivery_cost_includes_vat`, `delivery_vat_rate` mit Labels, Boolean-Normalisierung nur bei ausdrücklicher Nennung, Provenance beibehalten, Warnung bei fehlender Angabe; Prompt erhält die Regel «nie raten».
- **UI:** `catch-form.tsx` (Basis-Umschalter, Beschriftungen, bedingte Lieferfelder), `calculation-card.tsx` (Kundensicht/interne Rechnung getrennt, Tooltips), `reconciliation-card.tsx`, `reconciliation-workspace.tsx`, `history.tsx`, Dashboard-KPIs, `offer-fields-form.tsx`.
- **Kundenausgabe:** `whatsapp-post.ts` und `instagram-post.ts` ergänzen «inkl. MWST» beim Preis; Bildpreise bleiben brutto.
- **Export:** `export-workbook.ts` Spalten wie oben.
- **Tests:** neue Fälle in `catch-calculation.test.ts`, `catch-reconciliation.test.ts`, `supplier-offer-extraction.test.ts`, `whatsapp-post.test.ts`, `instagram-post.test.ts` inkl. Referenzbeispiel (100 kg, EK 6.50 exkl., Catch 7.90 inkl., 2.6 % → netto 7.6998/kg, Nettoumsatz 769.98, MWST 20.02, Nettoinvestition 650.00, DB 119.98, Rohmarge ≈ 15.58 %, Break-even ≈ 84.42 kg / 84.42 %), Lieferkosten mit 8.1 %, Lieferkosten 0, Einkauf inkl. MWST, fehlende Basis-Validierung.
- **Abschlussprüfung:** Vitest, `tsgo`, Lint, Produktionsbuild.

## Ergebnis

Die Kundschaft sieht und bezahlt unverändert den Bruttopreis. Intern werden Umsatz, Deckungsbeitrag, Rohmarge und Break-even konsistent aus Nettowerten gerechnet — mit dem auf dem Catch gespeicherten Verkaufssatz und einer ausdrücklich erfassten Steuerbasis für Einkaufspreis und Lieferkosten.
