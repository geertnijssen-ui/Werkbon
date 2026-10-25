# Werkbon MT Service

Offline webapp (PWA) voor werkbonnen en de uren-timesheet (CDB / Prest) van MT Service.

- `index.html`: de app (werkbonnen, klanten, instellingen)
- `uren-calc.js`, `uren-pdf.js`, `uren.js`: uren-module (berekening zoals het Excel-blad, CDB- en Prest-PDF)
- `sw.js`: service worker voor offline gebruik
- `libs/`, `fonts/`, `icons/`: lokaal meegeleverd zodat alles zonder internet werkt

Netlify publiceert deze map rechtstreeks (zie `netlify.toml`).

**Nieuwe versie uitbrengen:** verhoog `VERSIE` in `sw.js` en `const VERSIE` in `index.html` naar hetzelfde nummer. Geïnstalleerde apps halen de update dan vanzelf op.
