/* Maakt een "foto" van alle schermen: per element de berekende opmaak, positie en tekst.
   Gebruik: node tests/schermen.js <uitvoer.json> [poort]
   Vergelijk twee foto's met: node tests/vergelijk.js voor.json na.json */
const { chromium } = require("playwright");
const fs = require("fs");
const uit = process.argv[2] || "schermen.json";
const URL = "http://localhost:" + (process.argv[3] || 8765) + "/";

const vandaag = new Date().toISOString().slice(0, 10);
const GEGEVENS = {
    wb_toegang: "MT2026", wb_introGezien: true,
    wb_settings: { techNaam: "Test Technieker", techEmail: "t@example.com" },
    wb_klanten: [{ id: "k1", naam: "Klant A", straat: "Straat 1", stad: "1000 Brussel", emails: ["a@example.com"], machines: [{ id: "m1", naam: "Draaibank", merk: "TOS", serienr: "123" }] }],
    wb_bonnen: [{ id: "b1", nr: 15001, taal: "nl", klantId: "k1", klantNaam: "Klant A", klantStraat: "Straat 1", klantStad: "1000 Brussel", machineNaam: "Draaibank", machineMerk: "TOS", machineSerie: "123", beschrijving: "Spindel vervangen", opmerkingen: "", fotos: [], dagen: [{ datum: vandaag, begin: "08:00", einde: "16:00", pauze: 30, supplUren: "", supplKm: "" }], tech1: "Test Technieker", contractnr: "", bestelnr: "", contact: "", email: "" }],
    wb_gebruikt: [15001],
    wb_uren: { [vandaag]: { soort: "werk", klant: "Klant A", opm: "", hotel: false, pauze: "normaal", kmStart: "1000", kmEind: "1100", vertrekThuis: "07:00", aankomstKlant: "08:00", vertrekKlant: "16:00", aankomstThuis: "17:00", opgeslagen: true } }
};

async function foto(p) {
    return p.evaluate(() => {
        const props = ["display", "position", "color", "background-color", "background-image", "font-family", "font-size", "font-weight", "line-height", "padding", "margin", "border", "border-radius", "box-shadow", "gap", "grid-template-columns", "flex-direction", "justify-content", "align-items", "width", "height", "opacity", "text-transform", "letter-spacing", "zoom", "transform", "z-index", "overflow"];
        const r = [];
        document.querySelectorAll("#root *").forEach((el, i) => {
            const cs = getComputedStyle(el), b = el.getBoundingClientRect();
            const eigen = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").slice(0, 60);
            r.push([el.tagName + "." + (typeof el.className === "string" ? el.className : ""), eigen, props.map(k => cs.getPropertyValue(k)).join("|"), [b.x, b.y, b.width, b.height].map(Math.round).join(",")]);
        });
        return r;
    });
}

(async () => {
    const b = await chromium.launch();
    const res = {};
    const scenario = async (naam, opties, stappen) => {
        const ctx = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, opties || {}));
        const p = await ctx.newPage();
        p.on("pageerror", e => console.log("FOUT", naam, e.message));
        await p.addInitScript(g => { if (sessionStorage.getItem("gezaaid")) return; sessionStorage.setItem("gezaaid", "1"); Object.keys(g).forEach(k => localStorage.setItem(k, JSON.stringify(g[k]))); }, GEGEVENS);
        await p.goto(URL); await p.waitForTimeout(1200);
        await p.evaluate(() => { const d = new Date(2026, 9, 30, 10, 0); Date.now = () => d.getTime(); });
        for (const [label, actie] of stappen) {
            try { if (actie) await actie(p); await p.waitForTimeout(250); res[naam + " · " + label] = await foto(p); }
            catch (e) { console.log("STAP MISLUKT", naam, label, e.message.split("\n")[0]); res[naam + " · " + label] = "MISLUKT"; }
        }
        await ctx.close();
    };
    const tik = s => p => p.click(s);
    const gsm = [
        ["dashboard", null],
        ["werkbonnen", tik(".tbItem >> nth=1")],
        ["bon acties", tik(".bonrij .open >> nth=0")],
        ["nieuw taal", p => p.click(".tbItem.nieuw")],
        ["stap 1", tik(".taalknop >> nth=0")],
        ["stap 1 klant", p => p.fill(".zoekveld input, input[placeholder]", "Klant").catch(() => {})],
        ["stap 2", p => p.click(".navbalk .btn >> nth=-1")],
        ["stap 3", p => p.click(".navbalk .btn >> nth=-1")],
        ["stap 4", p => p.click(".navbalk .btn >> nth=-1")],
    ];
    await scenario("gsm", null, gsm);
    await scenario("gsm-bewerken", null, [
        ["stap 1", async p => { await p.click(".tbItem >> nth=1"); await p.click(".bonrij .open >> nth=0"); await p.waitForTimeout(200); await p.click(".btn >> text=Bewerken"); }],
        ["stap 3", async p => { await p.click(".navbalk .btn >> nth=-1"); await p.waitForTimeout(150); await p.click(".navbalk .btn >> nth=-1"); }],
        ["stap 4", p => p.click(".navbalk .btn >> nth=-1")],
        ["klantpreview", p => p.click(".btn.groot")]]);
    await scenario("gsm-instellingen", null, [["bedrijf", tik(".tbItem >> nth=4")], ["tech", tik(".tabs .tab >> nth=1")], ["klanten", tik(".tabs .tab >> nth=2")], ["bonnen", tik(".tabs .tab >> nth=3")], ["delen", tik(".tabs .tab >> nth=4")]]);
    await scenario("gsm-uren", null, [["dag", tik(".tbItem >> nth=3")], ["maand", tik(".urenTabs .tab >> nth=1")], ["aankopen", tik(".urenTabs .tab >> nth=2")], ["statistiek", tik(".urenTabs .tab >> nth=3")], ["instellingen", tik(".urenTabs .tab >> nth=4")]]);
    await scenario("gsm-donker", { colorScheme: "dark" }, [["dashboard", null], ["uren", tik(".tbItem >> nth=3")], ["werkbonnen", tik(".tbItem >> nth=1")]]);
    await scenario("gsm-groot", null, [["groot", async p => { await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("wb_settings")); }); await p.click(".tbItem >> nth=4"); await p.click(".tabs .tab >> nth=1"); await p.click("text=Grote letters").catch(() => {}); await p.click(".tbItem >> nth=0"); }]]);
    await scenario("desktop", { viewport: { width: 1366, height: 900 } }, [["dashboard", null], ["werkbonnen", tik(".zbItem >> nth=2")], ["uren", p => p.click(".zbItem >> text=Uren")], ["maand", tik(".urenTabs .tab >> nth=1")], ["instellingen", tik(".zbItem >> nth=4")], ["nieuw", tik(".zbItem >> nth=1")], ["stap 1", tik(".taalknop >> nth=0")]]);
    await b.close();
    fs.writeFileSync(uit, JSON.stringify(res));
    console.log(Object.keys(res).length + " schermen bewaard in " + uit);
})();
