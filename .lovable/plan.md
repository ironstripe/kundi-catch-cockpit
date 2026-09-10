# Warum «Als Catch-Entwurf übernehmen» gesperrt ist

## Ursache (geprüft)

Die Schaltfläche ist nicht defekt — sie verlangt drei Pflichtangaben:

- Produkt
- Verfügbare Menge
- Einkaufspreis

Beim Silberlachs-Angebot stehen Menge und Einkaufspreis nirgends in der E-Mail oder im PDF, also bleiben sie leer und die Übernahme bleibt gesperrt. Zusätzlich sperren: Angebot bereits übernommen, oder Nutzer ist nur Betrachter.

Das Problem ist, dass die Oberfläche das nicht sagt: neben der gesperrten Schaltfläche steht kein Hinweis, welche Angabe fehlt.

## Was gebaut wird

1. Direkt unter der gesperrten Schaltfläche einen deutlichen Hinweis anzeigen, z. B. «Noch nötig: Verfügbare Menge, Einkaufspreis» mit den echten Feldnamen.
2. Die fehlenden Felder im Formular markieren, damit man sie sofort findet.
3. Ein Klick auf einen fehlenden Feldnamen springt zum passenden Eingabefeld.
4. Sobald die fehlenden Werte von Hand eingetragen und gespeichert sind, wird die Übernahme automatisch aktiv (Verhalten bleibt wie heute).

Nichts an Auswertung, Anhängen, Rollen, Datenbank oder dem Catch-Workflow ändert sich; die Übernahme bleibt eine bewusste menschliche Handlung.

## Technisch

- `src/routes/_authenticated/offers.$offerId.tsx`: `missing` (aus `missingRequiredFields`) unterhalb der Aktionsleiste rendern, Labels aus `OFFER_FIELD_LABELS`, plus getrennte Hinweise für «bereits übernommen» und «nur Betrachter» (letzterer existiert schon).
- `src/components/offers/offer-fields-form.tsx`: Pflichtfelder mit fehlendem Wert visuell hervorheben (Rahmen/Hinweistext über bestehende Tokens) und per `id` anspringbar machen.
- Keine Änderung an `REQUIRED_FOR_CONVERSION`, Serverfunktionen oder Migrationen.
