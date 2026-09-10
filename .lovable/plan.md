# Angebotseingang: Zeilen anklickbar machen

## Problem

In der Angebotsliste sieht jede Zeile anklickbar aus (Mauszeiger als Hand), aber nur das Empfangsdatum ist wirklich ein Link. Wer auf Lieferant, Betreff, Produkt, Status oder das Häkchen "Zu prüfen" klickt, landet nirgends. Auf schmalen Bildschirmen ist die Tabelle breiter als das Fenster, sodass der einzige funktionierende Link oft ausserhalb des sichtbaren Bereichs liegt.

Die Detailseite eines Angebots selbst funktioniert; es fehlt nur der Weg dorthin.

## Was geändert wird

1. **Ganze Zeile öffnet das Angebot** — Klick auf eine beliebige Stelle der Zeile führt zur Angebotsdetailseite. Die Zeile lässt sich mit der Tastatur ansteuern und mit Enter oder Leertaste öffnen, mit sichtbarer Hervorhebung beim Überfahren und bei Tastaturfokus.
2. **Eine sichtbare Schaltfläche** — in der letzten Spalte eine echte Schaltfläche "Prüfen" (bei bereits übernommenen Angeboten "Ansehen"). Der Statushinweis bleibt ein reines Info-Element, die Aktion ist davon klar getrennt. Ein Klick auf die Schaltfläche öffnet die Seite genau einmal.
3. **Empfangsdatum** bleibt sichtbar hervorgehoben, ist aber nicht mehr der einzige Weg in die Detailansicht.
4. **Schmale Bildschirme** — unterhalb der Tabellendarstellung erscheint stattdessen eine kompakte Kartenansicht pro Angebot mit Empfangsdatum, Lieferant, Betreff, Produkt, Anzahl Anhänge, Auswertungsstand, Status und einer Schaltfläche über die volle Breite. Kein seitliches Scrollen mehr nötig, um die Aktion zu erreichen.

Das Aussehen bleibt im bestehenden Kundi-Catch-Stil.

## Was unangetastet bleibt

E-Mail-Empfang, Zuordnung, Signaturprüfung, KI-Auswertung, Anhänge, Statuswerte, Rollenrechte, Übernahme in einen Catch-Entwurf, Datenbank und die bestehenden Filter.

## Technische Details

- Nur `src/routes/_authenticated/offers.index.tsx` wird geändert; ggf. eine neue Komponente `src/components/offers/offer-list-card.tsx` für die kompakte Ansicht.
- Navigation über `useNavigate()` aus TanStack Router im Zeilen-Handler bzw. `<Button asChild><Link to="/offers/$offerId" params={{ offerId: offer.id }}>` für die explizite Aktion. Kein `window.location`.
- Zeile: `role="link"`, `tabIndex={0}`, `aria-label` mit Betreff/Lieferant, `onKeyDown` für Enter und Leertaste (Leertaste mit `preventDefault`), `onClick` prüft `event.target.closest("a,button")` und ignoriert Klicks auf echte Bedienelemente sowie Klicks mit aktiver Textauswahl. Keine verschachtelten Links, valide Tabellenauszeichnung.
- Umschaltung Tabelle/Karten über Tailwind-Breakpoints (`hidden md:block` / `md:hidden`), keine JS-Messung.
- Prüfung: Typprüfung, bestehende Tests, Produktionsbuild sowie ein Klick- und Tastaturdurchlauf im Browser über die Vorschau.
