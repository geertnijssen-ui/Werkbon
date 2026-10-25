/* Werkbon MT Service: uren-module (timesheet). Gebruikt React (globaal), UrenCalc en UrenPdf. */
(function () {
    const { useState, useMemo, useEffect, useRef } = React;
    const h = React.createElement;
    const C = window.UrenCalc, PDF = window.UrenPdf;

    const lees = (k, d) => { const v = window.WBStore.cache["wb_" + k]; return v === undefined ? d : v; };
    const bewaar = (k, v) => window.WBStore.zet("wb_" + k, v);
    const vandaag = () => { const d = new Date(); return C.isoDatum(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    const DAGNAAM = ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
    const MAAND = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const SOORTEN = [["werk", "Werkdag"], ["V", "Verlof"], ["R", "Recup"], ["F", "Feestdag"], ["Z", "Ziek"]];
    const getal = (v, dec) => {
        if (v === null || v === undefined || isNaN(v)) return "–";
        const t = Number(v).toLocaleString("nl-BE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return /^-0(,0+)?$/.test(t) ? t.slice(1) : t; /* geen "-0,00" */
    };
    const uren = v => (v === null || v === undefined) ? "–" : (v > 0 ? "+" : "") + getal(v, 2) + " u";
    const verschuif = (datum, n) => { const d = new Date(datum + "T12:00:00"); d.setDate(d.getDate() + n); return C.isoDatum(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    const leesbaar = datum => { const d = new Date(datum + "T12:00:00"); return DAGNAAM[C.isoWeekdag(datum)] + " " + d.getDate() + " " + MAAND[d.getMonth()] + " " + d.getFullYear(); };
    const leegDag = () => ({ soort: "werk", klant: "", opm: "", hotel: false, pauze: "normaal", kmStart: "", kmEind: "", vertrekThuis: "", aankomstKlant: "", vertrekKlant: "", aankomstThuis: "" });

    /* ---------- PDF maken en delen ---------- */
    function laadScript(src) {
        return new Promise((res, rej) => {
            if (document.querySelector('script[src="' + src + '"]')) return res();
            const s = document.createElement("script");
            s.src = src; s.onload = res; s.onerror = () => rej(new Error("laden mislukt"));
            document.head.appendChild(s);
        });
    }
    async function maakPdf(html) {
        await laadScript("libs/html2canvas.min.js");
        await laadScript("libs/jspdf.umd.min.js");
        const houder = document.createElement("div");
        houder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
        houder.innerHTML = html;
        document.body.appendChild(houder);
        try {
            const canvas = await window.html2canvas(houder.querySelector(".pg"), { scale: 2, backgroundColor: "#ffffff", logging: false });
            const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
            doc.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, 297);
            return doc.output("blob");
        } finally { document.body.removeChild(houder); }
    }
    async function kopieer(tekst) {
        if (!tekst) return false;
        try { await navigator.clipboard.writeText(tekst); return true; } catch (e) { return false; }
    }
    async function deelPdf(html, naam, aan, onderwerp, tekst, melding) {
        const gekopieerd = await kopieer(aan);
        try {
            const blob = await maakPdf(html);
            const file = new File([blob], naam, { type: "application/pdf" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: onderwerp, text: tekst });
                if (gekopieerd) melding("Adres " + aan + " gekopieerd: plak het in het Aan-veld");
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = naam; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
                melding("PDF bewaard" + (gekopieerd ? ", adres " + aan + " gekopieerd" : ""));
            }
        } catch (e) {
            if (e && e.name === "AbortError") return;
            melding("PDF maken lukt niet: " + (e && e.message ? e.message : e));
        }
    }

    /* ---------- kleine bouwstenen ---------- */
    const Veld = (label, input, extra) => h("label", { className: "veld" + (extra ? " " + extra : "") }, h("span", null, label), input);
    const Tijd = (waarde, zet, id) => h("div", { className: "tijdrij" },
        h("input", { id, type: "time", value: waarde || "", onChange: e => zet(e.target.value) }),
        h("button", { type: "button", className: "nuknop", onClick: () => zet(window.nuTijd ? window.nuTijd() : "") }, "Nu"));
    const Num = (waarde, zet, id, ph) => h("input", { id, type: "number", inputMode: "numeric", value: waarde === undefined ? "" : waarde, placeholder: ph || "", onChange: e => zet(e.target.value) });

    function Resultaat({ b, dag }) {
        if (!dag || !C.heeftInhoud(dag)) return h("div", { className: "urenRes leeg" }, "Vul de dag in om de berekening te zien.");
        const r = (k, v, cls) => h("div", { className: "urenResRij" + (cls ? " " + cls : "") }, h("span", null, k), h("b", null, v));
        return h("div", { className: "urenRes" },
            r("Recup deze dag", uren(b.recup), b.recup > 0 ? "plus" : b.recup < 0 ? "min" : ""),
            r("Reistijd extra", b.reisExtra === null ? "–" : getal(b.reisExtra, 2) + " u"),
            r("Werktijd extra", uren(b.werkExtra)),
            r("Dagvergoeding", b.vergoeding === null ? (b.hotel ? "geen (hotel)" : "–") : "€ " + getal(b.vergoeding, 2) + (b.dubbel ? " (dubbel)" : "")),
            b.km ? r("Kilometers", getal(b.km, 0) + " km") : null);
    }

    /* ---------- dagscherm ---------- */
    /* ---------- km-teller scannen: km + tijd (vertrek: kwartier ervoor, thuis: kwartier erna) ---------- */
    const kwartier = (d, omhoog) => {
        let m = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() > 0 && omhoog ? 1 : 0);
        m = omhoog ? Math.ceil(m / 15) * 15 : Math.floor(m / 15) * 15;
        if (m >= 24 * 60) m = 24 * 60 - 15;
        return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    };
    /* alle getallen van 3 tot 7 cijfers (ook "123 456"), de beste eerst: net boven de vorige km-stand */
    function kmKandidaten(teksten, vorige) {
        const set = [];
        teksten.forEach(t => {
            const schoon = String(t).replace(/[OoDQ]/g, "0").replace(/[Il|]/g, "1").replace(/[Ss]/g, "5").replace(/B/g, "8");
            (schoon.match(/\d{1,3}(?:[ .'’]\d{3})+|\d{3,7}/g) || []).forEach(x => { const n = Number(x.replace(/\D/g, "")); if (n >= 100 && n < 10000000 && set.indexOf(n) < 0) set.push(n); });
        });
        const v = Number(vorige) || 0;
        const score = n => v ? (n >= v && n - v <= 3000 ? n - v : n >= v ? 100000 + (n - v) : 1000000 + (v - n)) : -n;
        return set.sort((a, b) => score(a) - score(b));
    }
    /* km-controle: te laag, veel te hoog of een cijfer te veel/te weinig */
    function kmCheck(km, ref, wat) {
        const n = Number(km), r = Number(ref);
        if (km === "" || km === undefined || isNaN(n) || !ref || isNaN(r)) return "";
        const cijfers = String(Math.round(n)).length - String(Math.round(r)).length;
        const extra = cijfers > 0 ? " Een cijfer te veel?" : cijfers < 0 ? " Een cijfer te weinig?" : "";
        if (n < r) return n + " km is lager dan " + wat + " (" + r + ")." + extra;
        if (n - r > 1500) return n + " km is " + (n - r) + " km meer dan " + wat + " (" + r + ")." + extra;
        return "";
    }
    window.kmCheck = kmCheck;
    function KmScan({ moment, vorigeKm, melding, onKlaar, onSluit }) {
        const [fase, setFase] = useState("start");
        const [info, setInfo] = useState("");
        const [km, setKm] = useState("");
        const [tijd, setTijd] = useState("");
        const [kand, setKand] = useState([]);
        const [foto, setFoto] = useState("");
        const vertrek = moment === "vertrek";
        const lees = async file => {
            /* tijd van de foto zelf (bij een foto van vandaag), anders nu */
            const ft = file.lastModified && Math.abs(Date.now() - file.lastModified) < 12 * 3600 * 1000 ? new Date(file.lastModified) : new Date();
            setTijd(kwartier(ft, !vertrek));
            setFoto(URL.createObjectURL(file));
            setFase("bezig"); setInfo("Teller lezen…");
            try {
                const teksten = await window.ocrFoto(file, { alleen: "0123456789 .'kmKM", ookNegatief: true, voortgang: p => setInfo("Teller lezen… " + p + "%") });
                const k = kmKandidaten(teksten, vorigeKm);
                setKand(k.slice(0, 8));
                setKm(k.length ? String(k[0]) : "");
                setInfo(k.length ? "" : "Geen km-stand gevonden: typ hem zelf in of neem een scherpere foto.");
            } catch (e) { setInfo("Lezen mislukt: typ de km-stand zelf in."); }
            setFase("klaar");
        };
        const [ok, setOk] = useState("");
        const waarsch = ok === km ? "" : kmCheck(km, vorigeKm, vertrek ? "je vorige km-stand" : "de km bij vertrek");
        return h("div", { className: "overlay", onClick: onSluit },
            h("div", { className: "popup", onClick: e => e.stopPropagation() },
                h("h3", null, vertrek ? "Vertrek: km-teller scannen" : "Thuis: km-teller scannen"),
                fase === "start" ? h("p", { className: "klein" }, "Neem een foto van de km-teller op je dashboard. De app leest de km-stand; de tijd neemt hij van je gsm (" + (vertrek ? "vertrek: het kwartier ervoor" : "thuis: het volgende kwartier") + ").") : null,
                foto ? h("img", { className: "scanfoto", src: foto, alt: "" }) : null,
                fase === "bezig" ? h("div", { className: "scanbezig" }, h("span", { className: "draaier" }), info) : (info ? h("p", { className: "waarschuwing" }, info) : null),
                fase === "klaar" ? h(React.Fragment, null,
                    Veld(vertrek ? "Km vertrek" : "Km thuis", h("input", { id: "kmScanVeld", type: "number", inputMode: "numeric", value: km, onChange: e => setKm(e.target.value) })),
                    h("p", { className: "klein" }, (vertrek ? "Vertrek thuis: " : "Thuis: ") + tijd),
                    waarsch ? h("div", { className: "kmWaarsch" },
                        h("b", null, "Klopt deze km-stand?"), h("span", null, waarsch),
                        h("div", { className: "rijtje" },
                            h("button", { className: "btn grijs", onClick: () => { const el = document.getElementById("kmScanVeld"); if (el) el.focus(); } }, "Aanpassen"),
                            h("button", { className: "btn", onClick: () => setOk(km) }, "Klopt (bv. nieuwe auto)"))) : null,
                    kand.length > 1 ? h(React.Fragment, null,
                        h("p", { className: "klein" }, "Ander getal gelezen? Tik erop:"),
                        h("div", { className: "scanstukjes" }, kand.map(n => h("button", { key: n, type: "button", className: "chip" + (String(n) === km ? " aan" : ""), onClick: () => setKm(String(n)) }, String(n))))) : null) : null,
                fase !== "bezig" ? h("label", { className: "btn" + (fase === "klaar" ? " grijs" : "") }, window.Ic ? window.Ic("camera") : null, fase === "klaar" ? "Nieuwe foto" : "Foto nemen",
                    h("input", { type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) lees(f); } })) : null,
                fase === "klaar" ? h("div", { className: "rijtje" },
                    h("button", { className: "btn grijs", onClick: onSluit }, "Annuleren"),
                    h("button", { className: "btn", disabled: !!waarsch, onClick: () => onKlaar(km, tijd, ok === km && !!km) }, "Invullen")) : h("button", { className: "btn grijs", onClick: onSluit }, "Annuleren")));
    }

    /* start/stop vanaf het beginscherm: scan opslaan in de dag van vandaag */
    const vorigeKmVoor = (dagen, datum) => {
        const k = Object.keys(dagen).filter(x => x < datum && dagen[x] && dagen[x].kmEind !== "" && dagen[x].kmEind !== undefined).sort().pop();
        return k ? dagen[k].kmEind : "";
    };
    window.KmScan = KmScan;
    window.urenScan = {
        vorigeKm: (moment) => { const d = lees("uren", {}), v = vandaag(); return moment === "thuis" && d[v] && d[v].kmStart ? d[v].kmStart : vorigeKmVoor(d, v); },
        opslaan: (moment, km, tijd, bevestigd) => {
            const alle = Object.assign({}, lees("uren", {})), v = vandaag();
            const dag = Object.assign(leegDag(), alle[v] || {});
            if (moment === "vertrek") { dag.soort = "werk"; if (km) dag.kmStart = km; if (tijd) dag.vertrekThuis = tijd; }
            else { if (km) dag.kmEind = km; if (tijd) dag.aankomstThuis = tijd; if (dag.kmStart === "") dag.kmStart = vorigeKmVoor(alle, v); }
            if (bevestigd) dag.kmOk = Object.assign({}, dag.kmOk, { [moment === "vertrek" ? "kmStart" : "kmEind"]: km });
            alle[v] = Object.assign(dag, { opgeslagen: false });
            bewaar("uren", alle);
        }
    };

    function DagScherm({ datum, setDatum, dagen, zetDag, params, bonnen, klanten, melding }) {
        const opgeslagen = dagen[datum];
        const [dag, setDag] = useState(() => Object.assign(leegDag(), opgeslagen || {}));
        const [gewijzigd, setGewijzigd] = useState(false);
        const [scan, setScan] = useState("");
        const b = useMemo(() => C.berekenDag(dag, datum, params), [dag, datum, params]);

        const vorigeKm = useMemo(() => {
            const k = Object.keys(dagen).filter(x => x < datum && dagen[x] && dagen[x].kmEind !== "" && dagen[x].kmEind !== undefined).sort().pop();
            return k ? dagen[k].kmEind : "";
        }, [dagen, datum]);
        /* elke wijziging wordt meteen tussentijds bewaard, zodat niets verloren gaat */
        const zet = (velden) => {
            const n = Object.assign({}, dag, velden);
            if (n.soort === "werk" && (n.kmStart === "" || n.kmStart === undefined) && vorigeKm !== "" && !("kmStart" in velden)) n.kmStart = vorigeKm;
            setDag(n);
            setGewijzigd(true);
            zetDag(datum, C.heeftInhoud(n) ? Object.assign({}, n, { opgeslagen: false }) : null);
        };
        const opslaan = () => {
            if (!C.heeftInhoud(dag)) { melding("Vul eerst een klant of een soort dag in"); return; }
            zetDag(datum, Object.assign({}, dag, { opgeslagen: true, opgeslagenOp: new Date().toISOString() }));
            setGewijzigd(false);
            melding("Dag opgeslagen");
        };
        const wissen = () => { zetDag(datum, null); setDag(leegDag()); setGewijzigd(false); melding("Dag gewist"); };

        const bonVanDag = (bonnen || []).filter(x => (x.dagen || []).some(d => d.datum === datum));
        /* meerdere bonnen op één dag: begin van de vroegste bon en einde van de laatste bon */
        const neemOver = () => {
            const naUur = t => /^\d{1,2}:\d{2}$/.test(t || "") ? t.padStart(5, "0") : "";
            const regels = [];
            bonVanDag.forEach(bon => (bon.dagen || []).filter(x => x.datum === datum).forEach(d => regels.push({ bon, begin: naUur(d.begin), einde: naUur(d.einde) })));
            regels.sort((a, b) => (a.begin || "99:99").localeCompare(b.begin || "99:99"));
            const begins = regels.map(r => r.begin).filter(Boolean).sort();
            const eindes = regels.map(r => r.einde).filter(Boolean).sort();
            const namen = [];
            regels.forEach(r => { const n = (r.bon.klantNaam || "").trim(); if (n && namen.indexOf(n) < 0) namen.push(n); });
            zet({ soort: "werk", klant: namen.join(" / ") || dag.klant, aankomstKlant: begins[0] || dag.aankomstKlant, vertrekKlant: eindes[eindes.length - 1] || dag.vertrekKlant });
            melding(bonVanDag.length > 1 ? "Overgenomen van " + bonVanDag.length + " werkbonnen: begin " + (begins[0] || "?") + ", einde " + (eindes[eindes.length - 1] || "?") : "Overgenomen van werkbon N° " + bonVanDag[0].nr);
        };
        const status = opgeslagen && opgeslagen.opgeslagen && !gewijzigd ? "opgeslagen" : C.heeftInhoud(dag) ? "concept" : "leeg";
        const isWerk = dag.soort === "werk";

        return h("div", { className: "urenDag" },
            h("div", { className: "urenDatum" },
                h("button", { className: "terug", "aria-label": "Vorige dag", onClick: () => setDatum(verschuif(datum, -1)) }, "‹"),
                h("div", { className: "urenDatumMidden" },
                    h("b", null, leesbaar(datum)),
                    h("input", { type: "date", value: datum, onChange: e => e.target.value && setDatum(e.target.value), "aria-label": "Kies datum" })),
                h("button", { className: "terug", "aria-label": "Volgende dag", onClick: () => setDatum(verschuif(datum, 1)) }, "›")),
            h("div", { className: "urenStatus " + status }, status === "opgeslagen" ? "Opgeslagen" : status === "concept" ? "Nog niet opgeslagen (tussentijds bewaard)" : "Nog niets ingevuld"),
            Veld("Soort dag", h("select", { id: "uSoort", value: dag.soort, onChange: e => zet({ soort: e.target.value }) }, SOORTEN.map(([k, l]) => h("option", { key: k, value: k }, l)))),
            isWerk ? h(React.Fragment, null,
                bonVanDag.length ? h("button", { className: "btn grijs urenBon", onClick: neemOver },
                    bonVanDag.length > 1 ? "Neem over van " + bonVanDag.length + " werkbonnen (N° " + bonVanDag.map(x => x.nr).join(", ") + ")" : "Neem over van werkbon N° " + bonVanDag[0].nr + (bonVanDag[0].klantNaam ? " · " + bonVanDag[0].klantNaam : "")) : null,
                Veld("Klant", h("input", { id: "uKlant", list: "urenKlanten", value: dag.klant, onChange: e => zet({ klant: e.target.value }), placeholder: "Naam klant of omschrijving" })),
                h("datalist", { id: "urenKlanten" }, (klanten || []).map(k => h("option", { key: k.id || k.naam, value: k.naam }))),
                h("div", { className: "urenTwee2" },
                    Veld("Pauze", h("select", { id: "uPauze", value: dag.pauze || "normaal", onChange: e => zet({ pauze: e.target.value }) },
                        [["normaal", "Normale pauze"], ["p", "Geen pauze"], ["pt", "Geen pauze tijdens traject"]].map(([k, l]) => h("option", { key: k, value: k }, l)))),
                    h("label", { className: "schakel" + (dag.hotel ? " aan" : "") },
                        h("input", { type: "checkbox", checked: !!dag.hotel, onChange: e => zet({ hotel: e.target.checked }) }),
                        h("span", { className: "schakelBol" }), "Hotel (geen dagvergoeding)")),
                window.ocrFoto ? h("div", { className: "rijtje kmScanKnoppen" },
                    h("button", { className: "btn grijs", onClick: () => setScan("vertrek") }, window.Ic ? window.Ic("camera") : null, "Vertrek: scan teller"),
                    h("button", { className: "btn grijs", onClick: () => setScan("thuis") }, window.Ic ? window.Ic("camera") : null, "Thuis: scan teller")) : null,
                scan ? h(KmScan, { moment: scan, vorigeKm: scan === "vertrek" ? vorigeKm : (dag.kmStart || vorigeKm), melding, onSluit: () => setScan(""),
                    onKlaar: (km, tijd, bevestigd) => {
                        const veld = scan === "vertrek" ? "kmStart" : "kmEind";
                        zet(Object.assign(scan === "vertrek" ? Object.assign({ soort: "werk" }, km ? { kmStart: km } : {}, tijd ? { vertrekThuis: tijd } : {}) : Object.assign({}, km ? { kmEind: km } : {}, tijd ? { aankomstThuis: tijd } : {}), bevestigd ? { kmOk: Object.assign({}, dag.kmOk, { [veld]: km }) } : {}));
                        melding((scan === "vertrek" ? "Vertrek" : "Thuis") + " ingevuld: " + (tijd || "") + (km ? " · " + km + " km" : ""));
                        setScan("");
                    } }) : null,
                h("div", { className: "dagvelden" },
                    h("label", null, "Vertrek thuis", Tijd(dag.vertrekThuis, v => zet({ vertrekThuis: v }), "uT1")),
                    h("label", null, "Aankomst klant", Tijd(dag.aankomstKlant, v => zet({ aankomstKlant: v }), "uT2")),
                    h("label", null, "Vertrek klant", Tijd(dag.vertrekKlant, v => zet({ vertrekKlant: v }), "uT3")),
                    h("label", null, "Thuis", Tijd(dag.aankomstThuis, v => zet({ aankomstThuis: v }), "uT4")),
                    h("label", null, "Km vertrek", Num(dag.kmStart, v => zet({ kmStart: v }), "uK1", vorigeKm ? String(vorigeKm) : "")),
                    h("label", null, "Km thuis", Num(dag.kmEind, v => zet({ kmEind: v }), "uK2"))),
                [["kmStart", vorigeKm, "je vorige km-stand"], ["kmEind", dag.kmStart, "de km bij vertrek"]].map(([veld, ref, wat]) => {
                    const w = dag.kmOk && dag.kmOk[veld] === dag[veld] ? "" : kmCheck(dag[veld], ref, wat);
                    return w ? h("div", { key: veld, className: "kmWaarsch" },
                        h("b", null, veld === "kmStart" ? "Km vertrek nakijken" : "Km thuis nakijken"), h("span", null, w),
                        h("button", { className: "btn grijs", onClick: () => zet({ kmOk: Object.assign({}, dag.kmOk, { [veld]: dag[veld] }) }) }, "Klopt (bv. nieuwe auto)")) : null;
                })
            ) : Veld(dag.soort === "F" ? "Naam feestdag (bv. Pasen)" : "Opmerking (bv. brugdag)", h("input", { id: "uOpm", value: dag.opm || "", onChange: e => zet({ opm: e.target.value }) })),
            h(Resultaat, { b, dag }),
            h("div", { className: "rijtje" },
                h("button", { className: "btn grijs", onClick: wissen, disabled: !opgeslagen && !C.heeftInhoud(dag) }, "Wissen"),
                h("button", { className: "btn", onClick: opslaan }, "Dag opslaan")));
    }

    /* ---------- maandscherm ---------- */
    function MaandScherm({ jaar, maand, setMaand, dagen, params, jaarP, naam, mail, openDag, melding, setBezig }) {
        const md = useMemo(() => C.maand(dagen, jaar, maand, params, jaarP), [dagen, jaar, maand, params, jaarP]);
        const [voorbeeld, setVoorbeeld] = useState("");
        const html = voorbeeld === "cdb" ? PDF.cdb(md, naam, params) : voorbeeld === "prest" ? PDF.prest(md, naam) : "";
        const ref = useRef(null);
        const [schaal, setSchaal] = useState(0.45);
        useEffect(() => { if (ref.current) setSchaal(Math.min(1, ref.current.clientWidth / 794)); }, [voorbeeld]);
        const mnd = PDF.MND[maand - 1] + " " + jaar;
        const verstuur = async (soort) => {
            setBezig("PDF maken...");
            const inhoud = soort === "cdb" ? PDF.cdb(md, naam, params) : PDF.prest(md, naam);
            const titel = (soort === "cdb" ? "Carnet de bord " : "Prestaties ") + mnd + " " + naam;
            await deelPdf(inhoud, ((soort === "cdb" ? "CDB " : "Prest ") + mnd + " " + naam).trim() + ".pdf", soort === "cdb" ? mail.cdb : mail.prest, titel, titel, melding);
            setBezig("");
        };
        const T = md.tot;
        return h("div", null,
            h("div", { className: "urenDatum" },
                h("button", { className: "terug", "aria-label": "Vorige maand", onClick: () => setMaand(maand === 1 ? 12 : maand - 1, maand === 1 ? jaar - 1 : jaar) }, "‹"),
                h("div", { className: "urenDatumMidden" }, h("b", null, MAAND[maand - 1] + " " + jaar)),
                h("button", { className: "terug", "aria-label": "Volgende maand", onClick: () => setMaand(maand === 12 ? 1 : maand + 1, maand === 12 ? jaar + 1 : jaar) }, "›")),
            h("div", { className: "stats" },
                h("div", { className: "stat" }, h("b", null, getal(T.recup, 2)), h("span", null, "Recup maand")),
                h("div", { className: "stat" }, h("b", null, getal(md.nieuwRecup, 2)), h("span", null, "Recup saldo")),
                h("div", { className: "stat" }, h("b", null, "€" + getal(T.vergoeding, 0)), h("span", null, "Dagvergoeding"))),
            h("div", { className: "urenTwee" }, h("div", null,
            h("div", { className: "urenLijst" },
                /* kolomkoppen en extra kolommen verschijnen alleen op een breed scherm */
                h("div", { className: "urenLijstRij urenKopRij alleenDesk" },
                    h("span", { className: "d" }, "Dag"), h("span", { className: "k" }, "Klant / code"),
                    h("span", { className: "urenX" }, "Vertr."), h("span", { className: "urenX" }, "Aank."),
                    h("span", { className: "urenX" }, "Vertr."), h("span", { className: "urenX" }, "Thuis"),
                    h("span", { className: "urenX km" }, "Km"), h("span", { className: "u" }, "Recup")),
                md.rijen.map(r => {
                const lbl = C.label(r.dag, "prest");
                const d = r.dag || {};
                return h("button", { key: r.datum, className: "urenLijstRij" + (r.wd >= 6 ? " weekend" : "") + (r.dag && !r.dag.opgeslagen ? " concept" : ""), onClick: () => openDag(r.datum) },
                    h("span", { className: "d" }, DAGNAAM[r.wd].slice(0, 2) + " " + Number(r.datum.slice(8))),
                    h("span", { className: "k" }, lbl || (r.wd >= 6 ? "" : "–")),
                    h("span", { className: "urenX" }, d.vertrekThuis || ""),
                    h("span", { className: "urenX" }, d.aankomstKlant || ""),
                    h("span", { className: "urenX" }, d.vertrekKlant || ""),
                    h("span", { className: "urenX" }, d.aankomstThuis || ""),
                    h("span", { className: "urenX km" }, d.kmStart && d.kmEind ? (Number(d.kmEind) - Number(d.kmStart)) + " km" : ""),
                    h("span", { className: "u" }, r.b.recup !== null ? getal(r.b.recup, 2) : ""));
            })),
            h("div", { className: "infoblok klein" }, "Verlof: " + md.verlof.opgenomen + " opgenomen, " + md.verlof.toekomst + " gepland, " + md.verlof.rest + " vrij van " + md.verlof.teNemen + ". Recupdagen deze maand: " + T.recupDagen + "."),
            ), h("div", null,
            h("h2", null, "Maandblad"),
            h("div", { className: "tabs" },
                h("button", { className: "tab" + (voorbeeld === "cdb" ? " aan" : ""), onClick: () => setVoorbeeld(voorbeeld === "cdb" ? "" : "cdb") }, "Bekijk CDB"),
                h("button", { className: "tab" + (voorbeeld === "prest" ? " aan" : ""), onClick: () => setVoorbeeld(voorbeeld === "prest" ? "" : "prest") }, "Bekijk Prest")),
            voorbeeld ? h("div", { ref, className: "urenVoorbeeld", style: { height: Math.round(1123 * schaal) + "px" } },
                h("div", { style: { transform: "scale(" + schaal + ")", transformOrigin: "0 0", width: "794px" }, dangerouslySetInnerHTML: { __html: html } })) : null,
            h("button", { className: "btn", onClick: () => verstuur("cdb") }, "CDB mailen naar " + (mail.cdbNaam || "Martine")),
            h("button", { className: "btn", onClick: () => verstuur("prest") }, "Prest mailen naar " + (mail.prestNaam || "Jo / Franck")),
            h("p", { className: "klein" }, "Mailen opent het deelmenu: kies Outlook. Het e-mailadres staat dan al op je klembord, zodat je het in het Aan-veld kunt plakken."))));
    }

    /* ---------- aankopen (Fact) ---------- */
    function FactScherm({ jaar, aankopen, zetAankopen, recupNu, params, naam, mail, melding, setBezig }) {
        const lijst = aankopen.filter(a => !a.datum || a.datum.slice(0, 4) === String(jaar));
        const totExcl = lijst.reduce((s, a) => s + (Number(a.excl) || 0), 0);
        const euro = Number(params.recupEuroPerUur) || 0;
        const urenAf = euro ? -totExcl / euro : 0;
        const zetRij = (id, v) => zetAankopen(aankopen.map(a => a.id === id ? Object.assign({}, a, v) : a));
        const nieuw = () => zetAankopen(aankopen.concat([{ id: Date.now().toString(36), leverancier: "", datum: vandaag(), incl: "", excl: "" }]));
        const weg = id => zetAankopen(aankopen.filter(a => a.id !== id));
        const verstuur = async () => {
            setBezig("PDF maken...");
            await deelPdf(PDF.fact(aankopen, jaar, recupNu, euro, naam), ("Aankopen " + jaar + " " + naam).trim() + ".pdf", mail.fact || mail.prest, "Aankopen " + jaar + " " + naam, "Aankopen " + jaar, melding);
            setBezig("");
        };
        return h("div", null,
            h("p", { className: "klein" }, "Aankopen worden verrekend met je recup: het bedrag excl. btw gedeeld door € " + getal(euro, 2) + " per uur."),
            lijst.length === 0 ? h("p", { className: "leegtekst" }, "Nog geen aankopen in " + jaar) : null,
            lijst.map(a => h("div", { key: a.id, className: "machineKaart" },
                h("input", { value: a.leverancier, placeholder: "Leverancier", onChange: e => zetRij(a.id, { leverancier: e.target.value }) }),
                h("div", { className: "dagvelden" },
                    h("label", null, "Datum", h("input", { type: "date", value: a.datum || "", onChange: e => zetRij(a.id, { datum: e.target.value }) })),
                    h("label", null, "Incl. btw (facultatief)", h("input", { type: "number", inputMode: "decimal", value: a.incl, onChange: e => zetRij(a.id, { incl: e.target.value }) })),
                    h("label", null, "Excl. btw (verplicht)", h("input", { type: "number", inputMode: "decimal", value: a.excl, onChange: e => zetRij(a.id, { excl: e.target.value }) })),
                    h("label", null, " ", h("button", { className: "btn grijs klein", onClick: () => weg(a.id) }, "Verwijderen"))))),
            h("button", { className: "btn grijs", onClick: nieuw }, "Aankoop toevoegen"),
            h("div", { className: "urenRes" },
                h("div", { className: "urenResRij" }, h("span", null, "Totaal excl. btw"), h("b", null, "€ " + getal(totExcl, 2))),
                h("div", { className: "urenResRij" }, h("span", null, "In recup-uren"), h("b", null, getal(urenAf, 2) + " u")),
                h("div", { className: "urenResRij" }, h("span", null, "Recup in " + jaar), h("b", null, getal(recupNu, 2) + " u")),
                h("div", { className: "urenResRij" }, h("span", null, "Resterende recup op " + (jaar + 1)), h("b", null, getal(recupNu + urenAf, 2) + " u"))),
            h("button", { className: "btn", onClick: verstuur }, "Aankopen mailen"));
    }

    /* ---------- statistiek (STAT) ---------- */
    function StatScherm({ jaar, dagen }) {
        const s = useMemo(() => C.stat(dagen, jaar), [dagen, jaar]);
        const [zoek, setZoek] = useState("");
        const iv = useMemo(() => C.interventies(dagen, jaar, zoek), [dagen, jaar, zoek]);
        const um = v => v === null || v === undefined ? "–" : C.decNaarUmin(v).replace(".", ":");
        const rij = (k, v) => h("div", { className: "urenResRij" }, h("span", null, k), h("b", null, v));
        const datums = l => l.length ? l.map(d => d.slice(8) + "/" + d.slice(5, 7)).join(", ") : "–";
        return h("div", null,
            h("div", { className: "stats" },
                h("div", { className: "stat" }, h("b", null, s.lijst.V.length), h("span", null, "Verlof")),
                h("div", { className: "stat" }, h("b", null, s.lijst.R.length), h("span", null, "Recup")),
                h("div", { className: "stat" }, h("b", null, s.lijst.F.length), h("span", null, "Feest")),
                h("div", { className: "stat" }, h("b", null, s.lijst.Z.length), h("span", null, "Ziek")),
                h("div", { className: "stat" }, h("b", null, s.lijst.H.length), h("span", null, "Hotel"))),
            h("h2", null, "Kilometers " + jaar),
            h("div", { className: "urenRes" },
                rij("Totaal", getal(s.km.totaal, 0) + " km"),
                rij("Werk", getal(s.km.werk, 0) + " km" + (s.km.totaal ? " (" + getal(100 * s.km.werk / s.km.totaal, 1) + " %)" : "")),
                rij("Privé", getal(s.km.prive, 0) + " km" + (s.km.totaal ? " (" + getal(100 * s.km.prive / s.km.totaal, 1) + " %)" : "")),
                rij("Per dag minimaal / gemiddeld / maximaal", getal(s.km.min, 0) + " / " + getal(s.km.gem, 0) + " / " + getal(s.km.max, 0))),
            h("h2", null, "Tijden"),
            h("div", { className: "urenRes" },
                rij("Vertrek thuis: vroegst / gemiddeld / laatst", um(s.vertrek.min) + " / " + um(s.vertrek.gem) + " / " + um(s.vertrek.max)),
                rij("Thuiskomst: vroegst / gemiddeld / laatst", um(s.thuis.min) + " / " + um(s.thuis.gem) + " / " + um(s.thuis.max)),
                rij("Gemiddelde tijd weg van huis", um(s.weg))),
            h("h2", null, "Dagen"),
            h("div", { className: "infoblok klein" },
                h("div", null, h("b", null, "Verlof: "), datums(s.lijst.V)),
                h("div", null, h("b", null, "Recup: "), datums(s.lijst.R)),
                h("div", null, h("b", null, "Feestdagen: "), datums(s.lijst.F)),
                h("div", null, h("b", null, "Ziek: "), datums(s.lijst.Z)),
                h("div", null, h("b", null, "Hotel: "), datums(s.lijst.H))),
            h("h2", null, "Interventies bij een klant"),
            h("input", { className: "slotVeld", style: { textAlign: "left", letterSpacing: 0, fontSize: "16px" }, placeholder: "Zoek klant", value: zoek, onChange: e => setZoek(e.target.value) }),
            zoek ? h("p", { className: "klein" }, iv.length + " keer, waarvan " + iv.filter(x => x.hotel).length + " met hotel") : null,
            iv.map(x => h("div", { key: x.datum, className: "nrrij" }, h("span", null, x.datum.split("-").reverse().join("/")), h("span", null, x.klant + (x.hotel ? " (H)" : "")))));
    }

    /* ---------- instellingen (PR + PT + mail) ---------- */
    /* ---------- import uit de Excel-timesheet (tabblad Input, tabblad PT) ---------- */
    let xlsxLaden = null;
    const laadXlsx = () => xlsxLaden || (xlsxLaden = new Promise((ok, fout) => {
        if (window.XLSX) return ok(window.XLSX);
        const sc = document.createElement("script");
        sc.src = "libs/xlsx/xlsx.mini.min.js";
        sc.onload = () => ok(window.XLSX);
        sc.onerror = () => { xlsxLaden = null; fout(new Error("laden")); };
        document.head.appendChild(sc);
    }));
    /* 7.45 -> "07:45", 8.3 -> "08:30" (u.mm zoals in de Excel) */
    const umTijd = v => {
        if (v === null || v === undefined || v === "") return "";
        if (typeof v === "string") { const m = v.trim().match(/^(\d{1,2})[.,:h](\d{1,2})?$/); if (!m) return ""; v = Number(m[1]) + (m[2] ? Number((m[2] + "0").slice(0, 2)) / 100 : 0); }
        const u = Math.floor(v + 1e-9), mi = Math.round((v - u) * 100);
        if (u > 24 || mi > 59) return "";
        return String(u).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
    };
    const serieDatum = n => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return C.isoDatum(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
    function leesExcel(buf, XLSX) {
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets["Input"];
        if (!ws) throw new Error("Tabblad Input niet gevonden");
        /* vaste kolommen van het Input-blad: C datum, D klant, E-F km, G-J tijden */
        const bereik = XLSX.utils.decode_range(ws["!ref"]);
        const rijen = [];
        for (let i = bereik.s.r; i <= bereik.e.r; i++) {
            rijen.push([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => { const cel = ws[XLSX.utils.encode_cell({ r: i, c })]; return cel && cel.v !== "" ? cel.v : null; }));
        }
        const dagen = {};
        rijen.forEach(r => {
            const dn = r[2];
            if (typeof dn !== "number" || dn < 30000) return;
            const ruw = r[3] === null ? "" : String(r[3]);
            const km = v => (typeof v === "number" ? String(v) : "");
            const tijden = [r[6], r[7], r[8], r[9]].map(umTijd);
            if (!ruw.trim() && !km(r[4]) && !tijden.some(Boolean)) return;
            const dag = { soort: "werk", klant: "", opm: "", hotel: false, pauze: "normaal", kmStart: km(r[4]), kmEind: km(r[5]), vertrekThuis: tijden[0], aankomstKlant: tijden[1], vertrekKlant: tijden[2], aankomstThuis: tijden[3], opgeslagen: true, bron: "excel" };
            const code = ruw.match(/^\s*([VCZMRF])(\s|$)(.*)$/i);
            if (code) {
                const c = code[1].toUpperCase();
                dag.soort = c === "C" ? "V" : c === "M" ? "Z" : c;
                dag.opm = code[3].trim();
                dag.kmStart = dag.kmEind = dag.vertrekThuis = dag.aankomstKlant = dag.vertrekKlant = dag.aankomstThuis = "";
            } else {
                let k = ruw;
                const suf = k.match(/\s*,\s*(h|p|pt|hp|hpt)$/i); /* zoals de Excel: een spatie na ",p" telt niet als code */
                if (suf) {
                    const s = suf[1].toLowerCase();
                    dag.hotel = s[0] === "h";
                    const rest = dag.hotel ? s.slice(1) : s;
                    dag.pauze = rest === "p" ? "p" : rest === "pt" ? "pt" : "normaal";
                    k = k.slice(0, suf.index);
                }
                dag.klant = k.trim();
            }
            dagen[serieDatum(dn)] = dag;
        });
        let jaar = null;
        const pt = wb.Sheets["PT"];
        if (pt) {
            const w = a => pt[a] ? pt[a].v : undefined;
            if (typeof w("D6") === "number") jaar = { jaar: w("D6"), overdrachtVerlof: Number(w("D8")) || 0, verlofdagen: Number(w("D9")) || 0, overdrachtRecup: Number(w("D10")) || 0 };
        }
        const naam = pt && pt["D5"] ? String(pt["D5"].v || "").trim() : "";
        return { dagen, jaar, naam };
    }
    function ExcelImport({ dagen, importeer, melding }) {
        const [res, setRes] = useState(null);
        const [kies, setKies] = useState({});
        const [metJaar, setMetJaar] = useState(true);
        const [bezig, setBezig] = useState(false);
        const kiesBestand = async e => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!f) return;
            setBezig(true);
            try {
                const XLSX = await laadXlsx();
                const r = leesExcel(new Uint8Array(await f.arrayBuffer()), XLSX);
                const maanden = {};
                Object.keys(r.dagen).forEach(k => { maanden[k.slice(0, 7)] = true; });
                if (!Object.keys(maanden).length) throw new Error("Geen ingevulde dagen gevonden");
                setRes(r); setKies(maanden);
            } catch (err) {
                melding(err && err.message === "laden" ? "Excel-lezer laden mislukt: probeer opnieuw met netwerk" : "Dit bestand kan ik niet lezen" + (err && err.message && err.message !== "laden" ? " (" + err.message + ")" : ""));
            }
            setBezig(false);
        };
        const maanden = res ? Object.keys(kies).sort() : [];
        const aantal = m => Object.keys(res.dagen).filter(k => k.slice(0, 7) === m).length;
        const bestaand = m => Object.keys(dagen).filter(k => k.slice(0, 7) === m && C.heeftInhoud(dagen[k])).length;
        const doe = () => {
            const n = {};
            Object.keys(res.dagen).forEach(k => { if (kies[k.slice(0, 7)]) n[k] = res.dagen[k]; });
            const tel = Object.keys(n).length;
            if (!tel) { melding("Kies minstens één maand"); return; }
            if (!window.confirm(tel + " dagen overnemen? Dagen die al in de app staan op dezelfde datum worden overschreven.")) return;
            importeer(n, metJaar ? res.jaar : null, res.naam);
            setRes(null);
            melding(tel + " dagen overgenomen uit Excel");
        };
        return h("div", { className: "machineKaart" },
            h("b", null, "Overnemen uit Excel-timesheet"),
            h("p", { className: "klein" }, "Kies je Excel-bestand (CDB / time sheet). De app leest het tabblad Input en zet de gekozen maanden in de timesheet."),
            h("label", { className: "btn grijs" }, bezig ? "Bezig met lezen…" : "Excel-bestand kiezen",
                h("input", { type: "file", accept: ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", style: { display: "none" }, onChange: kiesBestand, disabled: bezig })),
            res ? h("div", { className: "xlImport" },
                maanden.map(m => h("label", { key: m, className: "vinkrij" },
                    h("input", { type: "checkbox", checked: !!kies[m], onChange: e => setKies(Object.assign({}, kies, { [m]: e.target.checked })) }),
                    h("span", null, MAAND[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4) + " · " + aantal(m) + (aantal(m) === 1 ? " dag" : " dagen") + (bestaand(m) ? " (" + bestaand(m) + " al in de app)" : "")))),
                res.jaar ? h("label", { className: "vinkrij" },
                    h("input", { type: "checkbox", checked: metJaar, onChange: e => setMetJaar(e.target.checked) }),
                    h("span", null, "Ook jaargegevens (jaar " + res.jaar.jaar + ", " + res.jaar.verlofdagen + " verlofdagen, overdracht recup " + getal(res.jaar.overdrachtRecup, 2) + " u)")) : null,
                h("p", { className: "klein" }, "Tip: neem alle maanden van het jaar over, dan kloppen je recup- en verlofsaldo."),
                h("div", { className: "rijtje" },
                    h("button", { className: "btn grijs", onClick: () => setRes(null) }, "Annuleren"),
                    h("button", { className: "btn", onClick: doe }, "Overnemen"))) : null);
    }

    function InstScherm({ params, setParams, jaarP, setJaarP, naam, setNaam, mail, setMail, dagen, importeer, melding }) {
        const zetR = (wd, v) => setParams(Object.assign({}, params, { rooster: Object.assign({}, params.rooster, { [wd]: Object.assign({}, params.rooster[wd], v) }) }));
        const zetP = v => setParams(Object.assign({}, params, v));
        const zetJ = v => setJaarP(Object.assign({}, jaarP, v));
        const zetM = v => setMail(Object.assign({}, mail, v));
        const inp = (waarde, zet, type, extra) => h("input", Object.assign({ type: type || "text", value: waarde === undefined || waarde === null ? "" : waarde, onChange: e => zet(type === "number" ? e.target.value : e.target.value) }, extra || {}));
        const wkUren = [1, 2, 3, 4, 5].reduce((s, i) => s + (Number(params.rooster[i].uren) || 0), 0);
        return h("div", null,
            h(ExcelImport, { dagen, importeer, melding }),
            h("h2", null, "Persoonlijk en jaar"),
            Veld("Naam technieker (komt op de bladen)", inp(naam, setNaam)),
            h("div", { className: "dagvelden" },
                h("label", null, "Jaar", inp(jaarP.jaar, v => zetJ({ jaar: Number(v) || jaarP.jaar }), "number")),
                h("label", null, "Verlofdagen dit jaar", inp(jaarP.verlofdagen, v => zetJ({ verlofdagen: v }), "number")),
                h("label", null, "Overdracht verlofdagen vorig jaar", inp(jaarP.overdrachtVerlof, v => zetJ({ overdrachtVerlof: v }), "number")),
                h("label", null, "Overdracht recup-uren vorig jaar", inp(jaarP.overdrachtRecup, v => zetJ({ overdrachtRecup: v }), "number", { step: "0.25", inputMode: "decimal" }))),
            h("h2", null, "Mailadressen"),
            h("div", { className: "dagvelden" },
                h("label", null, "CDB naar (naam)", inp(mail.cdbNaam, v => zetM({ cdbNaam: v }))),
                h("label", null, "CDB naar (e-mail)", inp(mail.cdb, v => zetM({ cdb: v }), "email")),
                h("label", null, "Prest naar (naam)", inp(mail.prestNaam, v => zetM({ prestNaam: v }))),
                h("label", null, "Prest naar (e-mail)", inp(mail.prest, v => zetM({ prest: v }), "email")),
                h("label", null, "Aankopen naar (e-mail)", inp(mail.fact, v => zetM({ fact: v }), "email"))),
            h("p", { className: "klein" }, "Meerdere adressen scheid je met een puntkomma (;)."),
            h("h2", null, "Uurrooster (" + getal(wkUren, 1) + " u per week)"),
            [1, 2, 3, 4, 5].map(wd => h("div", { key: wd, className: "machineKaart" },
                h("b", null, DAGNAAM[wd]),
                h("div", { className: "dagvelden" },
                    h("label", null, "Te presteren uren", inp(params.rooster[wd].uren, v => zetR(wd, { uren: v }), "number", { step: "0.25", inputMode: "decimal" })),
                    h("label", null, "Pauze (min)", inp(params.rooster[wd].pauze, v => zetR(wd, { pauze: v }), "number")),
                    h("label", null, "Normaal vertrek thuis", inp(params.rooster[wd].vertrekThuis, v => zetR(wd, { vertrekThuis: v }), "time")),
                    h("label", null, "Normale aankomst klant", inp(params.rooster[wd].aankomstKlant, v => zetR(wd, { aankomstKlant: v }), "time")),
                    h("label", null, "Normaal vertrek klant", inp(params.rooster[wd].vertrekKlant, v => zetR(wd, { vertrekKlant: v }), "time")),
                    h("label", null, "Normaal thuis", inp(params.rooster[wd].thuis, v => zetR(wd, { thuis: v }), "time")),
                    h("label", null, "Reistijd heen (min)", inp(params.rooster[wd].reisHeen, v => zetR(wd, { reisHeen: v }), "number")),
                    h("label", null, "Reistijd terug (min)", inp(params.rooster[wd].reisTerug, v => zetR(wd, { reisTerug: v }), "number"))))),
            h("h2", null, "Vergoedingen"),
            h("div", { className: "dagvelden" },
                h("label", null, "Dagvergoeding (€/dag)", inp(params.dagvergoeding, v => zetP({ dagvergoeding: v }), "number", { inputMode: "decimal" })),
                h("label", null, "Dubbel vanaf zoveel weg van huis", inp(params.dubbelVanafWeg, v => zetP({ dubbelVanafWeg: v }), "time")),
                h("label", null, "Dubbel bij thuiskomst na (leeg = nooit)", inp(params.dubbelThuisNa, v => zetP({ dubbelThuisNa: v }), "time")),
                h("label", null, "Km-vergoeding (€/km, 0 = firmawagen)", inp(params.kmVergoeding, v => zetP({ kmVergoeding: v }), "number", { step: "0.01", inputMode: "decimal" })),
                h("label", null, "Carwash (€/maand)", inp(params.carwash, v => zetP({ carwash: v }), "number")),
                h("label", null, "Carwash op CDB", h("select", { value: params.carwashTonen ? "1" : "0", onChange: e => zetP({ carwashTonen: e.target.value === "1" }) }, h("option", { value: "0" }, "Niet tonen"), h("option", { value: "1" }, "Tonen"))),
                h("label", null, "Reiniging werkkledij (€/maand)", inp(params.kledij, v => zetP({ kledij: v }), "number")),
                h("label", null, "Kledij op CDB", h("select", { value: String(params.kledijModus || 0), onChange: e => zetP({ kledijModus: Number(e.target.value) }) }, h("option", { value: "0" }, "Niet tonen"), h("option", { value: "1" }, "Vast bedrag"), h("option", { value: "2" }, "Volgens gewerkte dagen"))),
                h("label", null, "Recup (€/uur, voor aankopen)", inp(params.recupEuroPerUur, v => zetP({ recupEuroPerUur: v }), "number"))));
    }

    /* ---------- hoofdmodule ---------- */
    function UrenModule({ onTerug, bonnen, klanten, settings, setMelding, setBezig }) {
        const [tab, setTab] = useState("dag");
        const [dagen, setDagen] = useState(() => lees("uren", {}));
        const [params, setParamsS] = useState(() => {
            const p = lees("urenParams", null);
            return p ? Object.assign({}, C.STD_PARAMS, p, { rooster: Object.assign({}, C.STD_PARAMS.rooster, p.rooster || {}) }) : JSON.parse(JSON.stringify(C.STD_PARAMS));
        });
        const [jaarP, setJaarPS] = useState(() => Object.assign({}, C.STD_JAAR, lees("urenJaar", {})));
        const [naam, setNaamS] = useState(() => lees("urenNaam", (settings && settings.techNaam) || ""));
        const [mail, setMailS] = useState(() => Object.assign({ cdbNaam: "Martine", cdb: "", prestNaam: "Jo / Franck", prest: "", fact: "" }, lees("urenMail", {})));
        const [aankopen, setAankopenS] = useState(() => lees("aankopen", []));
        const [datum, setDatum] = useState(vandaag());
        const [mm, setMm] = useState(() => ({ j: new Date().getFullYear(), m: new Date().getMonth() + 1 }));

        const setParams = v => { setParamsS(v); bewaar("urenParams", v); };
        const setJaarP = v => { setJaarPS(v); bewaar("urenJaar", v); };
        const setNaam = v => { setNaamS(v); bewaar("urenNaam", v); };
        const setMail = v => { setMailS(v); bewaar("urenMail", v); };
        const zetAankopen = v => { setAankopenS(v); bewaar("aankopen", v); };
        const zetDag = (d, waarde) => setDagen(oud => {
            const n = Object.assign({}, oud);
            if (waarde) n[d] = waarde; else delete n[d];
            bewaar("uren", n);
            return n;
        });
        const importeer = (nieuw, jaarNieuw, naamNieuw) => {
            setDagen(oud => { const n = Object.assign({}, oud, nieuw); bewaar("uren", n); return n; });
            if (jaarNieuw) setJaarP(Object.assign({}, jaarP, jaarNieuw));
            if (naamNieuw && !naam) setNaam(naamNieuw);
        };
        /* het jaar van de bladen volgt het jaar uit de instellingen */
        const jaar = Number(jaarP.jaar) || new Date().getFullYear();
        const recupNu = useMemo(() => {
            const nu = new Date();
            const m = nu.getFullYear() === jaar ? nu.getMonth() + 1 : 12;
            return C.maand(dagen, jaar, m, params, jaarP).nieuwRecup;
        }, [dagen, jaar, params, jaarP]);

        const TABS = [["dag", "Dag"], ["maand", "Maand"], ["fact", "Aankopen"], ["stat", "Statistiek"], ["inst", "Instellingen"]];
        return h("div", { className: "scherm" },
            h("div", { className: "appkop" },
                h("button", { className: "terug", onClick: onTerug, "aria-label": "Terug" }, window.Ic ? window.Ic("terug") : "‹"),
                h("h1", null, "Uren " + jaar)),
            h("div", { className: "tabs urenTabs" }, TABS.map(([k, l]) => h("button", { key: k, className: "tab" + (tab === k ? " aan" : ""), onClick: () => setTab(k) }, l))),
            tab === "dag" ? h(DagScherm, { key: datum, datum, setDatum, dagen, zetDag, params, bonnen, klanten, melding: setMelding }) : null,
            tab === "maand" ? h(MaandScherm, { jaar: mm.j, maand: mm.m, setMaand: (m, j) => setMm({ j, m }), dagen, params, jaarP: mm.j === jaar ? jaarP : Object.assign({}, jaarP, { overdrachtRecup: 0, overdrachtVerlof: 0 }), naam, mail, openDag: d => { setDatum(d); setTab("dag"); }, melding: setMelding, setBezig }) : null,
            tab === "fact" ? h(FactScherm, { jaar, aankopen, zetAankopen, recupNu, params, naam, mail, melding: setMelding, setBezig }) : null,
            tab === "stat" ? h(StatScherm, { jaar, dagen }) : null,
            tab === "inst" ? h(InstScherm, { params, setParams, jaarP, setJaarP, naam, setNaam, mail, setMail, dagen, importeer, melding: setMelding }) : null);
    }

    window.UrenModule = UrenModule;
})();
