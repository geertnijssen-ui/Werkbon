# Werkbon MT Service

Offline webapp (PWA) voor werkbonnen en de uren-timesheet (CDB / Prest) van MT Service.

- `index.html`: opstart (laadt de onderdelen in volgorde) en registratie van de service worker
- `css/app.css`: alle opmaak (huisstijl MT Service, gsm en desktop, donkere modus)
- `js/opslag.js`: opslag in IndexedDB en de Update-knop
- `js/basis.js`: constanten en standaardinstellingen
- `js/talen.js`: teksten van de app (nl, fr, cs) en van de werkbon (nl, fr, de, cs; en alleen voor oude bonnen)
- `js/bon-pdf.js`: berekening, weergave en PDF van een werkbon
- `js/onderdelen.js`: herbruikbare onderdelen (foto, logo, handtekening, vertaler, inspreken, popups)
- `js/app.js`: de schermen (dashboard, werkbonnen, wizard, instellingen)
- `js/uren-calc.js`, `js/uren-pdf.js`, `js/uren.js`: uren-module (berekening zoals het Excel-blad, CDB- en Prest-PDF, Excel-import)
- `sw.js`: service worker voor offline gebruik
- `libs/`, `fonts/`, `icons/`: lokaal meegeleverd zodat alles zonder internet werkt
- `tests/`: controles (zie hieronder)

Netlify publiceert deze map rechtstreeks (zie `netlify.toml`).

**Nieuwe versie uitbrengen:** verhoog `VERSIE` in `sw.js` en `const VERSIE` in `js/basis.js` naar hetzelfde nummer. Een nieuw bestand moet ook in de lijst `BESTANDEN` van `sw.js`. Geïnstalleerde apps halen de update dan vanzelf op.

## Vertaler (DeepL)
De vertaalknoppen gebruiken DeepL via de Netlify-functie `netlify/functions/vertaal.mjs`.
De sleutel staat in Netlify als omgevingsvariabele `DEEPL_KEY` (Production). Na het wijzigen van de sleutel moet de site opnieuw gedeployd worden.
Zonder sleutel valt de app terug op de gratis MyMemory-vertaler.

## Tests
- `node tests/berekening.test.js`: urenberekening tegen dagen uit de Excel-timesheet (geen browser nodig).
- `node tests/werking.test.js`: klikt door de app (kwartiertijden, uren bewaren, km-controle, talen). Vraagt Playwright en een lokale server: `python3 -m http.server 8765`.
- `node tests/schermen.js voor.json` en `node tests/vergelijk.js voor.json na.json`: legt van 34 schermen de opmaak vast en vergelijkt voor en na een aanpassing (handig bij opruimwerk).
