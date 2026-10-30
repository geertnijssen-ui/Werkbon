/* Controleert de urenberekening tegen dagen uit de Excel-timesheet (CDB 2026).
   Gebruik: node tests/berekening.test.js   (geen browser nodig) */
require("../js/uren-calc.js");
const C = globalThis.UrenCalc;
const t = v => { const u = Math.floor(v + 1e-9), m = Math.round((v - u) * 100); return String(u).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };
/* datum, pauze, vertrek thuis, aankomst klant, vertrek klant, thuis (u.mm), en uit de Excel: recup, reis extra, werk extra */
const GEVALLEN = [
    ["2026-09-01", "p", 7.45, 8, 13, 13.45, -3, null, -3],
    ["2026-09-02", "normaal", 6.3, 8.3, 15.3, 17.15, 0.75, 2.25, -1.5],
    ["2026-09-07", "p", 6.45, 9, 12, 14.45, -1.5, 3, -4.5],
    ["2026-09-25", "normaal", 8, 8, 15.3, 15.3, 0, null, 0],
    ["2026-10-05", "p", 7.15, 10, 16, 18.3, 1.75, 3.75, -2],
    ["2026-10-14", "p", 7.15, 10.15, 14.15, 17.3, 0.75, 4.75, -4],
    ["2026-10-16", "p", 7.15, 9.15, 11.15, 13, -2.75, 1.75, -4.5],
    ["2026-10-21", "normaal", 7.45, 8.3, 15.15, 15.45, -1.75, null, -1.75]
];
const gelijk = (a, b) => (a === null || a === undefined) ? (b === null || b === 0) : b !== null && Math.abs(a - b) < 0.011;
let fout = 0;
GEVALLEN.forEach(([datum, pauze, a, b, c, d, recup, reis, werk]) => {
    const dag = { soort: "werk", klant: "Test", pauze, hotel: false, vertrekThuis: t(a), aankomstKlant: t(b), vertrekKlant: t(c), aankomstThuis: t(d), kmStart: "", kmEind: "" };
    const r = C.berekenDag(dag, datum, C.STD_PARAMS);
    const ok = gelijk(r.recup, recup) && gelijk(r.reisExtra, reis) && gelijk(r.werkExtra, werk);
    if (!ok) { fout++; console.log("FOUT", datum, "verwacht", [recup, reis, werk], "kreeg", [r.recup, r.reisExtra, r.werkExtra]); }
});
/* verlof- en recupdagen */
const v = C.berekenDag({ soort: "V", klant: "" }, "2026-10-28", C.STD_PARAMS);
if (v.recup !== null) { fout++; console.log("FOUT verlofdag geeft recup", v.recup); }
const r = C.berekenDag({ soort: "R", klant: "" }, "2026-10-27", C.STD_PARAMS);
if (!(r.recup < 0)) { fout++; console.log("FOUT recupdag trekt geen dag af", r.recup); }
console.log(fout ? fout + " fouten" : "Berekening: alle " + (GEVALLEN.length + 2) + " gevallen kloppen met de Excel");
process.exit(fout ? 1 : 0);
