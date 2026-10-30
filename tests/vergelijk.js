/* Vergelijkt twee foto's van tests/schermen.js en toont de verschillen per scherm. */
const fs = require("fs");
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
let fout = 0;
Object.keys(a).forEach(k => {
    const x = a[k], y = b[k];
    if (!y) { console.log("ONTBREEKT", k); fout++; return; }
    if (x === "MISLUKT" || y === "MISLUKT") { if (x !== y) { console.log("MISLUKT", k); fout++; } return; }
    const n = Math.max(x.length, y.length); let d = 0;
    for (let i = 0; i < n; i++) {
        if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) {
            if (d < 4) console.log("VERSCHIL", k, "#" + i, "\n  voor:", JSON.stringify(x[i]), "\n  na:  ", JSON.stringify(y[i]));
            d++;
        }
    }
    if (d) { console.log("  ->", k, d, "elementen anders"); fout++; }
});
console.log(fout ? fout + " schermen met verschillen" : "Alle " + Object.keys(a).length + " schermen identiek");
process.exit(fout ? 1 : 0);
