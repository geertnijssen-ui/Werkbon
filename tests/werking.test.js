/* Klikt door de app en controleert de belangrijkste werking.
   Start eerst een webserver in de map van de app:  python3 -m http.server 8765
   Gebruik: node tests/werking.test.js [poort]   (vraagt Playwright met Chromium) */
const { chromium } = require("playwright");
const URL = "http://localhost:" + (process.argv[2] || 8765) + "/";
let fout = 0;
const check = (ok, tekst) => { console.log((ok ? "OK   " : "FOUT ") + tekst); if (!ok) fout++; };

async function nieuw(b, init) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    p.on("pageerror", e => check(false, "scriptfout: " + e.message));
    await p.addInitScript(extra => {
        if (sessionStorage.getItem("gezaaid")) return;
        sessionStorage.setItem("gezaaid", "1");
        localStorage.setItem("wb_toegang", JSON.stringify("MT2026"));
        localStorage.setItem("wb_introGezien", "true");
        Object.keys(extra || {}).forEach(k => localStorage.setItem(k, JSON.stringify(extra[k])));
    }, init);
    await p.goto(URL); await p.waitForTimeout(1000);
    return p;
}

(async () => {
    const b = await chromium.launch();

    /* 1. werkbon: tijden per kwartier en dagtotaal */
    let p = await nieuw(b);
    await p.click(".tbItem.nieuw"); await p.click(".taalknop >> nth=0");
    await p.fill('.veld:has(> span:text-is("Klant")) input', "X");
    await p.click(".navbalk .btn >> nth=-1"); await p.waitForTimeout(200);
    if (await p.$(".popup")) await p.click(".popup .btn >> nth=1");
    await p.click(".navbalk .btn >> nth=-1"); await p.waitForTimeout(300);
    await p.selectOption(".kwartier >> nth=0 >> select >> nth=0", "08");
    await p.selectOption(".kwartier >> nth=0 >> select >> nth=1", "15");
    await p.selectOption(".kwartier >> nth=1 >> select >> nth=0", "16");
    await p.selectOption(".kwartier >> nth=1 >> select >> nth=1", "45");
    const minuten = await p.$$eval(".kwartier >> nth=0 >> select >> nth=1 >> option", o => o.map(x => x.value).join(","));
    check(minuten === "00,15,30,45", "minuten per kwartier (" + minuten + ")");
    check((await p.textContent(".dagtotaal")).trim() === "8:00", "08:15-16:45 met 30 min pauze = 8:00");
    await p.context().close();

    /* 2. uren: een dag zonder klant blijft bewaard als je naar een andere dag gaat */
    p = await nieuw(b);
    await p.click(".tbItem >> text=Uren"); await p.waitForTimeout(300);
    await p.selectOption("#uT1", "07:00"); await p.fill("#uK1", "1000");
    await p.click('[aria-label="Vorige dag"]'); await p.waitForTimeout(200);
    await p.fill("#uKlant", "Klant gisteren");
    await p.click('[aria-label="Volgende dag"]'); await p.waitForTimeout(200);
    check(await p.inputValue("#uT1") === "07:00" && await p.inputValue("#uK1") === "1000", "uren van vandaag blijven na bekijken van gisteren");
    /* km-controle */
    await p.fill("#uK2", "900"); await p.waitForTimeout(150);
    check((await p.$$(".kmWaarsch")).length === 1, "waarschuwing bij km thuis lager dan vertrek");
    await p.click(".kmWaarsch .btn"); await p.waitForTimeout(150);
    check((await p.$$(".kmWaarsch")).length === 0, "waarschuwing weg na 'Klopt'");
    await p.context().close();

    /* 3. talen: Tsjechisch in plaats van Engels, oude instelling 'en' wordt Nederlands */
    p = await nieuw(b, { wb_settings: { appTaal: "en", bonTaal: "en" } });
    check(await p.$$eval(".taalmenu option", o => o.map(x => x.value).join(",")) === "nl,fr,cs", "app-talen nl, fr, cs");
    check(await p.inputValue(".taalmenu select") === "nl", "oude app-taal Engels wordt Nederlands");
    await p.selectOption(".taalmenu select", "cs"); await p.waitForTimeout(200);
    check(/Dobr/.test(await p.textContent(".groet")), "begroeting in het Tsjechisch");
    await p.click(".tbItem.nieuw");
    check(/Čeština/.test(await p.textContent(".taalgrid")) && !/English/.test(await p.textContent(".taalgrid")), "werkbon in het Tsjechisch, niet meer in het Engels");
    check((await p.$$("text=/scan/i")).length === 0, "geen scanknoppen meer");
    await p.context().close();

    await b.close();
    console.log(fout ? fout + " fouten" : "Werking: alles in orde");
    process.exit(fout ? 1 : 0);
})();
