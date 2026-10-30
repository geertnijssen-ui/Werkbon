/* Werkbon MT Service: planner (agenda per week, uren voor facturatie) en demogegevens */
(function () {
    const { useState, useMemo, useEffect } = React;
    const h = React.createElement;

    /* ---------- datums ---------- */
    const pad = n => String(n).padStart(2, "0");
    const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const datum = s => new Date(s + "T12:00:00");
    const plusDagen = (s, n) => { const d = datum(s); d.setDate(d.getDate() + n); return iso(d); };
    const maandag = s => { const d = datum(s); return plusDagen(s, -((d.getDay() + 6) % 7)); };
    const vandaag = () => iso(new Date());
    const isWeekend = s => { const g = datum(s).getDay(); return g === 0 || g === 6; };
    const DAG = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
    const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    const kort = s => { const d = datum(s); return d.getDate() + " " + MND[d.getMonth()]; };
    const weeknr = s => { const d = datum(s); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7); };
    /* valt een planning-item op deze dag (weekend overslaan tenzij aangevinkt) */
    const opDag = (p, d) => d >= p.van && d <= (p.tot || p.van) && (!isWeekend(d) || p.weekend);
    const urenTekst = min => Math.floor(min / 60) + ":" + pad(min % 60);
    const adresVan = k => k ? [k.straat, k.stad].filter(Boolean).join(", ") : "";

    function lijstTechniekers(planning, bonnen, settings) {
        const s = new Set(LS.get("techniekers", []));
        planning.forEach(p => p.tech && s.add(p.tech));
        bonnen.forEach(b => { if (b.tech1) s.add(b.tech1); if (b.tech2) s.add(b.tech2); });
        if (settings.techNaam) s.add(settings.techNaam);
        return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }

    /* ---------- navigeren ---------- */
    function NavKnoppen({ adres }) {
        if (!adres) return null;
        const q = encodeURIComponent(adres);
        return h("div", { className: "navKnoppen" },
            h("a", { className: "btn waze", href: "https://waze.com/ul?q=" + q + "&navigate=yes", target: "_blank", rel: "noopener" }, "Waze"),
            h("a", { className: "btn grijs", href: "https://www.google.com/maps/dir/?api=1&destination=" + q, target: "_blank", rel: "noopener" }, "Google Maps"));
    }
    window.NavKnoppen = NavKnoppen;

    /* ---------- formulier inplannen ---------- */
    function PlanForm({ item, techs, klanten, onBewaar, onSluit, onWis }) {
        const [f, setF] = useState(item);
        const [nieuweTech, setNieuweTech] = useState(!item.tech && !techs.length);
        const zet = v => setF(Object.assign({}, f, v));
        const kiesKlant = naam => {
            const k = klanten.find(x => x.naam.toLowerCase() === naam.trim().toLowerCase());
            zet(k ? { klant: naam, klantId: k.id, adres: f.adres || adresVan(k) } : { klant: naam, klantId: "" });
        };
        const k = klanten.find(x => x.id === f.klantId);
        const ok = f.tech && f.klant && f.van;
        return h(window.Popup, { titel: item.nieuw ? "Klant inplannen" : "Planning aanpassen", onSluit },
            h("label", { className: "veld" }, h("span", null, "Technieker"),
                nieuweTech
                    ? h("input", { id: "pTechNieuw", value: f.tech || "", placeholder: "Naam technieker", onChange: e => zet({ tech: e.target.value }) })
                    : h("select", { id: "pTech", value: f.tech || "", onChange: e => e.target.value === "+" ? (setNieuweTech(true), zet({ tech: "" })) : zet({ tech: e.target.value }) },
                        h("option", { value: "" }, "Kies technieker"),
                        techs.map(t => h("option", { key: t, value: t }, t)),
                        h("option", { value: "+" }, "+ Nieuwe technieker"))),
            h("label", { className: "veld" }, h("span", null, "Klant"),
                h("input", { id: "pKlant", list: "planKlanten", value: f.klant || "", onChange: e => kiesKlant(e.target.value), placeholder: "Naam klant" })),
            h("datalist", { id: "planKlanten" }, klanten.map(x => h("option", { key: x.id, value: x.naam }))),
            h("label", { className: "veld" }, h("span", null, "Adres"),
                h("input", { id: "pAdres", value: f.adres || "", onChange: e => zet({ adres: e.target.value }), placeholder: "Straat, postcode gemeente" })),
            k && (k.machines || []).length ? h("label", { className: "veld" }, h("span", null, "Machine"),
                h("select", { id: "pMachine", value: f.machine || "", onChange: e => zet({ machine: e.target.value }) },
                    h("option", { value: "" }, "—"),
                    k.machines.map(m => h("option", { key: m.id || m.naam, value: m.naam }, [m.naam, m.merk].filter(Boolean).join(" · ")))))
                : h("label", { className: "veld" }, h("span", null, "Machine"), h("input", { id: "pMachine", value: f.machine || "", onChange: e => zet({ machine: e.target.value }) })),
            h("label", { className: "veld" }, h("span", null, "Opdracht"),
                h("input", { id: "pOpdracht", value: f.opdracht || "", onChange: e => zet({ opdracht: e.target.value }), placeholder: "bv. jaarlijks onderhoud" })),
            h("div", { className: "twee" },
                h("label", { className: "veld" }, h("span", null, "Van"),
                    h("input", { id: "pVan", type: "date", value: f.van || "", onChange: e => zet({ van: e.target.value, tot: !f.tot || f.tot < e.target.value ? e.target.value : f.tot }) })),
                h("label", { className: "veld" }, h("span", null, "Tot en met"),
                    h("input", { id: "pTot", type: "date", value: f.tot || f.van || "", min: f.van, onChange: e => zet({ tot: e.target.value }) }))),
            f.tot && f.tot !== f.van ? h("label", { className: "schakel" + (f.weekend ? " aan" : "") },
                h("input", { type: "checkbox", checked: !!f.weekend, onChange: e => zet({ weekend: e.target.checked }) }),
                h("span", { className: "schakelBol" }), "Ook op zaterdag en zondag") : null,
            h("div", { className: "rijtje" },
                h("button", { className: "btn grijs", onClick: onSluit }, "Annuleren"),
                h("button", { className: "btn", disabled: !ok, onClick: () => { const n = Object.assign({}, f, { tot: f.tot && f.tot >= f.van ? f.tot : f.van }); delete n.nieuw; onBewaar(n); } }, "Opslaan")),
            onWis ? h("button", { className: "btn rood", onClick: onWis }, "Verwijderen") : null);
    }

    /* ---------- agenda ---------- */
    function Agenda({ planning, setPlanning, techs, klanten, desk, startBon, settings, verlof }) {
        const [week, setWeek] = useState(() => maandag(vandaag()));
        const [tech, setTech] = useState(() => LS.get("planTech", ""));
        const [form, setForm] = useState(null);
        const [detail, setDetail] = useState(null);
        useEffect(() => { LS.set("planTech", tech); }, [tech]);
        const dagenWeek = Array.from({ length: 7 }, (_, i) => plusDagen(week, i));
        /* goedgekeurd verlof staat mee in de agenda */
        const zichtbaar = planning.concat((verlof || []).map(v => ({ id: "v-" + v.id, tech: v.tech, klant: v.soort, opdracht: v.opm, van: v.van, tot: v.tot || v.van, verlof: true })))
            .filter(p => !tech || p.tech === tech);
        /* weekend alleen tonen als er iets gepland is */
        const dagen = dagenWeek.filter((d, i) => i < 5 || zichtbaar.some(p => opDag(p, d)));
        const nieuw = (d, t) => setForm({ id: uid(), nieuw: true, tech: t || tech || "", klant: "", klantId: "", adres: "", machine: "", opdracht: "", van: d || vandaag(), tot: d || vandaag(), weekend: false });
        const bewaar = n => { setPlanning(l => l.findIndex(x => x.id === n.id) < 0 ? l.concat([n]) : l.map(x => x.id === n.id ? n : x)); setForm(null); setDetail(null); };
        const wis = p => { if (!window.confirm("Deze planning verwijderen?")) return; setPlanning(l => l.filter(x => x.id !== p.id)); setForm(null); setDetail(null); };
        const vd = vandaag();
        const Blok = (p, d, metTech) => h("button", { key: p.id + d, className: "planItem" + (p.verlof ? " verlofItem" : ""), onClick: () => setDetail(p) },
            h("b", null, p.klant),
            p.opdracht || p.machine ? h("small", null, [p.machine, p.opdracht].filter(Boolean).join(" · ")) : null,
            metTech || p.tot !== p.van ? h("span", { className: "planMeta" },
                metTech ? h("span", { className: "pil oranje" }, p.tech) : null,
                p.tot !== p.van ? h("span", { className: "planPeriode" }, kort(p.van) + " – " + kort(p.tot)) : null) : null);

        const kop = h("div", { className: "planKop" },
            h("select", { id: "planTechKeuze", className: "planTech", value: tech, onChange: e => setTech(e.target.value) },
                h("option", { value: "" }, "Alle techniekers"),
                techs.map(t => h("option", { key: t, value: t }, t))),
            h("div", { className: "planWeek" },
                h("button", { className: "terug", "aria-label": "Vorige week", onClick: () => setWeek(plusDagen(week, -7)) }, window.Ic("terug")),
                h("button", { className: "planWeekTekst", onClick: () => setWeek(maandag(vd)) },
                    h("b", null, "Week " + weeknr(week)), h("span", null, kort(week) + " – " + kort(plusDagen(week, 6)))),
                h("button", { className: "terug", "aria-label": "Volgende week", onClick: () => setWeek(plusDagen(week, 7)) }, window.Ic("verder"))),
            h("button", { className: "btn", onClick: () => nieuw() }, "+ Inplannen"));

        /* computer en alle techniekers: raster technieker x dag */
        const raster = desk && !tech ? h("div", { className: "planRasterHouder" },
            h("div", { className: "planRaster", style: { gridTemplateColumns: "150px repeat(" + dagen.length + ", minmax(0,1fr))" } },
                h("div", { className: "planCel kopCel" }),
                dagen.map(d => h("div", { key: d, className: "planCel kopCel" + (d === vd ? " isVandaag" : "") }, h("b", null, DAG[datum(d).getDay()]), " " + kort(d))),
                techs.map(t => [
                    h("div", { key: t, className: "planCel techCel" }, t),
                    dagen.map(d => {
                        const l = zichtbaar.filter(p => p.tech === t && opDag(p, d));
                        return h("div", { key: t + d, className: "planCel" + (d === vd ? " isVandaag" : "") + (l.length ? "" : " leeg"), onClick: l.length ? undefined : () => nieuw(d, t) },
                            l.map(p => Blok(p, d, false)));
                    })]))) : null;

        /* gsm of één technieker: lijst per dag */
        const lijst = raster ? null : h("div", { className: "planDagen" }, dagen.map(d => {
            const l = zichtbaar.filter(p => opDag(p, d)).sort((a, b) => a.tech.localeCompare(b.tech));
            return h("div", { key: d, className: "planDag" + (d === vd ? " isVandaag" : "") },
                h("div", { className: "planDagKop" },
                    h("b", null, DAG[datum(d).getDay()] + " " + kort(d)),
                    d === vd ? h("span", { className: "pil groen" }, "Vandaag") : null,
                    h("button", { className: "linkknop", onClick: () => nieuw(d) }, "+")),
                l.length ? l.map(p => Blok(p, d, !tech)) : h("p", { className: "planLeeg" }, "Niets gepland"));
        }));

        return h("div", null, kop, raster, lijst,
            !techs.length ? h("p", { className: "klein" }, "Nog geen techniekers. Kies \"+ Inplannen\" en voeg een technieker toe.") : null,
            form ? h(PlanForm, { item: form, techs, klanten, onBewaar: bewaar, onSluit: () => setForm(null), onWis: form.nieuw ? null : () => wis(form) }) : null,
            detail && !form ? h(window.Popup, { titel: detail.klant, onSluit: () => setDetail(null) },
                h("div", { className: "planDetail" },
                    h("div", null, h("span", { className: "klein" }, "Technieker"), h("b", null, detail.tech)),
                    h("div", null, h("span", { className: "klein" }, "Wanneer"), h("b", null, detail.tot !== detail.van ? kort(detail.van) + " – " + kort(detail.tot) : DAG[datum(detail.van).getDay()] + " " + kort(detail.van))),
                    detail.machine ? h("div", null, h("span", { className: "klein" }, "Machine"), h("b", null, detail.machine)) : null,
                    detail.opdracht ? h("div", null, h("span", { className: "klein" }, "Opdracht"), h("b", null, detail.opdracht)) : null,
                    detail.adres ? h("div", null, h("span", { className: "klein" }, "Adres"), h("b", null, detail.adres)) : null),
                detail.verlof ? h("button", { className: "btn grijs", onClick: () => setDetail(null) }, "Sluiten") : h(React.Fragment, null,
                    h(NavKnoppen, { adres: detail.adres }),
                    h("button", { className: "btn", onClick: () => { setDetail(null); startBon(detail); } }, "Start werkbon"),
                    h("div", { className: "rijtje" },
                        h("button", { className: "btn grijs", onClick: () => setForm(detail) }, "Aanpassen"),
                        h("button", { className: "btn grijs", onClick: () => setDetail(null) }, "Sluiten")))) : null);
    }

    /* ---------- uren voor facturatie ---------- */
    function Facturatie({ bonnen, techs, setMelding }) {
        const [f, setF] = useState({ klant: "", tech: "", van: "", tot: "" });
        const [gekozen, setGekozen] = useState([]);
        const zetF = v => setF(Object.assign({}, f, v));
        const klantNamen = useMemo(() => Array.from(new Set(bonnen.map(b => b.klantNaam).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [bonnen]);
        const eerste = b => (b.dagen || []).map(d => d.datum).filter(Boolean).sort()[0] || String(b.gemaakt || "").slice(0, 10);
        const lijst = bonnen.filter(b => (!f.klant || b.klantNaam === f.klant) && (!f.tech || b.tech1 === f.tech || b.tech2 === f.tech)
            && (!f.van || (b.dagen || []).some(d => d.datum >= f.van)) && (!f.tot || (b.dagen || []).some(d => d.datum && d.datum <= f.tot)))
            .sort((a, b) => eerste(a).localeCompare(eerste(b)) || a.nr - b.nr);
        const sel = lijst.filter(b => gekozen.indexOf(b.id) >= 0);
        const wissel = id => setGekozen(g => g.indexOf(id) >= 0 ? g.filter(x => x !== id) : g.concat([id]));
        const alles = sel.length === lijst.length && lijst.length > 0;
        const regels = [];
        sel.forEach(b => (b.dagen || []).slice().sort((x, y) => (x.datum || "").localeCompare(y.datum || "")).forEach(d => regels.push({ b, d, min: dagMinuten(d) })));
        const tot = totalen([].concat.apply([], sel.map(b => b.dagen || [])));
        const techTekst = b => [b.tech1, b.tech2].filter(Boolean).join(" & ");
        const kopieer = async () => {
            const rijen = [["Datum", "Bon", "Klant", "Technieker", "Begin", "Einde", "Pauze (min)", "Uren", "Voorbereiding (u)", "Km"]]
                .concat(regels.map(r => [datumNL(r.d.datum), r.b.nr, r.b.klantNaam, techTekst(r.b), r.d.begin, r.d.einde, r.d.pauze, urenTekst(r.min), r.d.supplUren || "", r.d.supplKm || ""]))
                .concat([["Totaal", "", "", "", "", "", "", urenTekst(tot.min), tot.vb || "", tot.km || ""]]);
            const tekst = rijen.map(r => r.join("\t")).join("\n");
            try { await navigator.clipboard.writeText(tekst); setMelding("Gekopieerd: plak in Excel"); } catch (e) { setMelding("Kopiëren lukt niet op dit toestel"); }
        };
        return h("div", null,
            h("div", { className: "factFilters" },
                h("label", { className: "veld" }, h("span", null, "Klant"),
                    h("select", { id: "fKlant", value: f.klant, onChange: e => zetF({ klant: e.target.value }) }, h("option", { value: "" }, "Alle klanten"), klantNamen.map(k => h("option", { key: k, value: k }, k)))),
                h("label", { className: "veld" }, h("span", null, "Technieker"),
                    h("select", { id: "fTech", value: f.tech, onChange: e => zetF({ tech: e.target.value }) }, h("option", { value: "" }, "Alle techniekers"), techs.map(t => h("option", { key: t, value: t }, t)))),
                h("label", { className: "veld" }, h("span", null, "Van"), h("input", { id: "fVan", type: "date", value: f.van, onChange: e => zetF({ van: e.target.value }) })),
                h("label", { className: "veld" }, h("span", null, "Tot"), h("input", { id: "fTot", type: "date", value: f.tot, onChange: e => zetF({ tot: e.target.value }) }))),
            h("div", { className: "zoekinfo" },
                h("span", null, lijst.length + " bonnen · " + sel.length + " aangevinkt"),
                lijst.length ? h("button", { className: "btn klein grijs", onClick: () => setGekozen(alles ? [] : lijst.map(b => b.id)) }, alles ? "Niets aanvinken" : "Alles aanvinken") : null),
            lijst.length === 0 ? h("p", { className: "leegtekst" }, "Geen bonnen gevonden.") : h("div", { className: "factLijst" }, lijst.map(b => {
                const t = totalen(b.dagen);
                const dd = (b.dagen || []).map(d => d.datum).filter(Boolean).sort();
                return h("label", { key: b.id, className: "factBon" + (gekozen.indexOf(b.id) >= 0 ? " aan" : "") },
                    h("input", { type: "checkbox", checked: gekozen.indexOf(b.id) >= 0, onChange: () => wissel(b.id) }),
                    h("span", { className: "nr" }, b.nr),
                    h("span", { className: "wie" }, b.klantNaam || "—",
                        h("small", null, [dd.length > 1 ? datumNL(dd[0]) + " – " + datumNL(dd[dd.length - 1]) + " (" + dd.length + " d)" : datumNL(dd[0] || ""), techTekst(b)].filter(Boolean).join(" · "))),
                    h("b", { className: "factUren" }, urenTekst(t.min)));
            })),
            sel.length ? h("div", { className: "factTotaal" },
                h("div", { className: "factTabelHouder" },
                    h("table", { className: "factTabel" },
                        h("thead", null, h("tr", null, ["Datum", "Bon", "Klant", "Technieker", "Begin", "Einde", "Pauze", "Uren", "Km"].map(x => h("th", { key: x }, x)))),
                        h("tbody", null, regels.map((r, i) => h("tr", { key: i },
                            h("td", null, datumNL(r.d.datum)), h("td", null, r.b.nr), h("td", null, r.b.klantNaam), h("td", null, techTekst(r.b)),
                            h("td", null, r.d.begin), h("td", null, r.d.einde), h("td", null, r.d.pauze ? r.d.pauze + "'" : ""), h("td", { className: "getal" }, urenTekst(r.min)), h("td", { className: "getal" }, r.d.supplKm || "")))),
                        h("tfoot", null, h("tr", null, h("td", { colSpan: 7 }, "Totaal " + sel.length + (sel.length === 1 ? " bon" : " bonnen") + " · " + regels.length + " dagen"), h("td", { className: "getal" }, urenTekst(tot.min)), h("td", { className: "getal" }, tot.km || ""))))),
                h("div", { className: "factSom" },
                    h("div", null, h("span", null, "Werkuren"), h("b", null, urenTekst(tot.min))),
                    h("div", null, h("span", null, "Voorbereiding"), h("b", null, (tot.vb || 0) + " u")),
                    h("div", null, h("span", null, "Suppl. km"), h("b", null, tot.km || 0))),
                h("button", { className: "btn", onClick: kopieer }, "Kopieer voor Excel")) : null);
    }

    /* ---------- verlof ---------- */
    const SOORT_VERLOF = ["Verlof", "Recup", "Klein verlet", "Ziekte"];
    const STATUS = { wacht: ["In afwachting", "oranje"], ok: ["Goedgekeurd", "groen"], nee: ["Geweigerd", "rood"] };
    const periode = v => v.tot && v.tot !== v.van ? kort(v.van) + " – " + kort(v.tot) : DAG[datum(v.van).getDay()] + " " + kort(v.van);
    const werkdagenIn = v => { let n = 0, d = v.van; while (d <= (v.tot || v.van)) { if (!isWeekend(d)) n++; d = plusDagen(d, 1); } return n; };
    function Verlof({ verlof, setVerlof, techs, settings, setMelding }) {
        const [goedk, setGoedk] = useState(() => LS.get("goedkeurders", []));
        useEffect(() => { LS.set("goedkeurders", goedk); }, [goedk]);
        const ik = settings.techNaam || "";
        const leeg = () => ({ tech: ik || techs[0] || "", soort: "Verlof", van: plusDagen(vandaag(), 7), tot: plusDagen(vandaag(), 7), opm: "" });
        const [f, setF] = useState(leeg);
        const [weiger, setWeiger] = useState(null);
        const zetF = v => setF(Object.assign({}, f, v));
        const stuur = () => {
            if (!f.tech || !f.van) return;
            setVerlof(l => [{ id: uid(), tech: f.tech, soort: f.soort, van: f.van, tot: f.tot >= f.van ? f.tot : f.van, opm: f.opm, status: "wacht", aangevraagd: new Date().toISOString() }].concat(l));
            setF(leeg());
            setMelding(goedk.length ? "Aanvraag verstuurd naar " + goedk.join(", ") : "Aanvraag bewaard");
        };
        const beslis = (v, status, reden) => {
            setVerlof(l => l.map(x => x.id === v.id ? Object.assign({}, x, { status, reden: reden || "", beslist: new Date().toISOString(), door: ik }) : x));
            /* goedgekeurd verlof van jezelf meteen in je urenregistratie (niet tijdens de demo) */
            if (status === "ok" && v.tech === ik && !LS.get("demoBackup") && (v.soort === "Verlof" || v.soort === "Recup")) {
                const uren = Object.assign({}, LS.get("uren", {}));
                let d = v.van;
                while (d <= (v.tot || v.van)) { if (!isWeekend(d) && !uren[d]) uren[d] = { soort: v.soort === "Recup" ? "R" : "V", klant: "", opm: v.opm || "", opgeslagen: true }; d = plusDagen(d, 1); }
                LS.set("uren", uren);
            }
            setWeiger(null);
            setMelding(status === "ok" ? "Goedgekeurd" : "Geweigerd");
        };
        const teKeuren = verlof.filter(v => v.status === "wacht").sort((a, b) => a.van.localeCompare(b.van));
        const besl = verlof.filter(v => v.status !== "wacht").sort((a, b) => b.van.localeCompare(a.van));
        const Kaart = (v, knoppen) => h("div", { key: v.id, className: "kaart verlofKaart" },
            h("div", { className: "verlofRij" },
                h("div", { className: "verlofWie" }, h("b", null, v.tech + " · " + v.soort), h("span", { className: "klein" }, periode(v) + " · " + werkdagenIn(v) + (werkdagenIn(v) === 1 ? " werkdag" : " werkdagen"))),
                h("span", { className: "pil " + STATUS[v.status][1] }, STATUS[v.status][0])),
            v.opm ? h("span", { className: "klein" }, v.opm) : null,
            v.reden ? h("span", { className: "klein" }, "Reden: " + v.reden) : null,
            knoppen ? h("div", { className: "rijtje" },
                h("button", { className: "btn grijs", onClick: () => setWeiger({ v, reden: "" }) }, "Weigeren"),
                h("button", { className: "btn", onClick: () => beslis(v, "ok") }, "Goedkeuren")) : null);
        return h("div", { className: "verlof" },
            h("div", { className: "sectiekop" }, h("h2", null, "Te keuren (" + teKeuren.length + ")")),
            teKeuren.length ? teKeuren.map(v => Kaart(v, true)) : h("p", { className: "leegtekst" }, "Geen openstaande aanvragen."),
            h("div", { className: "sectiekop" }, h("h2", null, "Verlof aanvragen")),
            h("div", { className: "kaart verlofForm" },
                h("div", { className: "twee" },
                    h("label", { className: "veld" }, h("span", null, "Voor"),
                        h("select", { id: "vTech", value: f.tech, onChange: e => zetF({ tech: e.target.value }) }, techs.map(t => h("option", { key: t, value: t }, t)))),
                    h("label", { className: "veld" }, h("span", null, "Soort"),
                        h("select", { id: "vSoort", value: f.soort, onChange: e => zetF({ soort: e.target.value }) }, SOORT_VERLOF.map(t => h("option", { key: t, value: t }, t))))),
                h("div", { className: "twee" },
                    h("label", { className: "veld" }, h("span", null, "Van"), h("input", { id: "vVan", type: "date", value: f.van, onChange: e => zetF({ van: e.target.value, tot: f.tot < e.target.value ? e.target.value : f.tot }) })),
                    h("label", { className: "veld" }, h("span", null, "Tot en met"), h("input", { id: "vTot", type: "date", value: f.tot, min: f.van, onChange: e => zetF({ tot: e.target.value }) }))),
                h("label", { className: "veld" }, h("span", null, "Opmerking"), h("input", { id: "vOpm", value: f.opm, onChange: e => zetF({ opm: e.target.value }), placeholder: "bv. herfstvakantie" })),
                h("button", { className: "btn", disabled: !f.tech || !f.van, onClick: stuur }, "Aanvraag versturen"),
                h("span", { className: "klein" }, goedk.length ? "Gaat naar: " + goedk.join(", ") : "Kies hieronder wie de aanvragen krijgt.")),
            h("div", { className: "sectiekop" }, h("h2", null, "Wie keurt verlof goed")),
            h("div", { className: "kaart" }, techs.map(t => h("label", { key: t, className: "schakel" + (goedk.indexOf(t) >= 0 ? " aan" : "") },
                h("input", { type: "checkbox", checked: goedk.indexOf(t) >= 0, onChange: e => setGoedk(g => e.target.checked ? g.concat([t]) : g.filter(x => x !== t)) }),
                h("span", { className: "schakelBol" }), t))),
            h("p", { className: "klein" }, "Voorlopig staat alles op dit toestel. Na de koppeling met Microsoft 365 krijgen de goedkeurders de aanvraag echt door."),
            besl.length ? h("div", { className: "sectiekop" }, h("h2", null, "Beslist")) : null,
            besl.map(v => Kaart(v, false)),
            weiger ? h(window.Popup, { titel: "Aanvraag weigeren", onSluit: () => setWeiger(null) },
                h("p", null, weiger.v.tech + " · " + weiger.v.soort + " · " + periode(weiger.v)),
                h("label", { className: "veld" }, h("span", null, "Reden (optioneel)"), h("input", { id: "vReden", value: weiger.reden, onChange: e => setWeiger(Object.assign({}, weiger, { reden: e.target.value })) })),
                h("div", { className: "rijtje" },
                    h("button", { className: "btn grijs", onClick: () => setWeiger(null) }, "Annuleren"),
                    h("button", { className: "btn rood", onClick: () => beslis(weiger.v, "nee", weiger.reden) }, "Weigeren"))) : null);
    }

    /* ---------- module ---------- */
    function PlannerModule({ onTerug, bonnen, klanten, settings, desk, startBon, setMelding }) {
        const [tab, setTab] = useState("agenda");
        const [planning, setPlanning] = useState(() => LS.get("planning", []));
        useEffect(() => { LS.set("planning", planning); }, [planning]);
        const [verlof, setVerlof] = useState(() => LS.get("verlof", []));
        useEffect(() => { LS.set("verlof", verlof); }, [verlof]);
        const openVerlof = verlof.filter(v => v.status === "wacht").length;
        const techs = useMemo(() => lijstTechniekers(planning, bonnen, settings), [planning, bonnen, settings]);
        return h("div", { className: "scherm planner" },
            h("div", { className: "appkop" },
                h("button", { className: "terug", onClick: onTerug, "aria-label": "Terug" }, window.Ic("terug")),
                h("h1", null, "Planner")),
            h("div", { className: "tabs" }, [["agenda", "Agenda"], ["verlof", "Verlof" + (openVerlof ? " (" + openVerlof + ")" : "")], ["fact", "Uren facturatie"]].map(([k, l]) => h("button", { key: k, className: "tab" + (tab === k ? " aan" : ""), onClick: () => setTab(k) }, l))),
            tab === "agenda" ? h(Agenda, { planning, setPlanning, techs, klanten, desk, startBon, settings, verlof: verlof.filter(v => v.status === "ok") })
                : tab === "verlof" ? h(Verlof, { verlof, setVerlof, techs, settings, setMelding }) : h(Facturatie, { bonnen, techs, setMelding }));
    }
    window.PlannerModule = PlannerModule;

    /* planning van één technieker op een dag (voor het beginscherm) */
    window.planningVandaag = naam => !naam ? [] : LS.get("planning", []).filter(p => p.tech === naam && opDag(p, vandaag()));

    /* ---------- demogegevens ---------- */
    function handtekening(naam, seed) {
        try {
            const c = document.createElement("canvas"); c.width = 360; c.height = 120;
            const x = c.getContext("2d");
            x.fillStyle = "#fff"; x.fillRect(0, 0, 360, 120);
            x.strokeStyle = "#1b2a6b"; x.lineWidth = 2.6; x.lineCap = "round"; x.lineJoin = "round";
            let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
            x.beginPath(); x.moveTo(20, 70 + rnd() * 10);
            for (let i = 1; i <= 14; i++) x.quadraticCurveTo(20 + i * 22 - 11, 30 + rnd() * 70, 20 + i * 22, 50 + rnd() * 35);
            x.stroke();
            x.beginPath(); x.moveTo(40, 95); x.lineTo(300, 88 + rnd() * 8); x.stroke();
            return c.toDataURL("image/png");
        } catch (e) { return ""; }
    }
    window.maakDemo = function (settings) {
        const TECH = ["Pieter Claes", "Sofie Maes", "Karim El Amrani", "Jan Peeters", "Lucas Dubois"];
        const KL = [
            { naam: "Vandamme Metaalbouw", straat: "Industrieweg 14", stad: "8800 Roeselare", taal: "nl", m: [["CNC-draaibank", "DMG Mori", "NLX 2500"], ["Kantpers", "Trumpf", "TruBend 5130"]], c: "Bart Vandamme" },
            { naam: "Brabo Precisie", straat: "Noorderlaan 112", stad: "2030 Antwerpen", taal: "nl", m: [["Freesbank 5-assig", "Hermle", "C 42 U"], ["Slijpmachine", "Studer", "S33"]], c: "Ilse Janssens" },
            { naam: "Ateliers Dumont", straat: "Rue de l'Industrie 8", stad: "7110 La Louvière", taal: "fr", m: [["Lasrobot", "Fanuc", "ARC Mate 100iD"], ["Bandzaag", "Behringer", "HBE 320"]], c: "Marc Dumont" },
            { naam: "Kempen Plastics", straat: "Kanaalstraat 41", stad: "2400 Mol", taal: "nl", m: [["Spuitgietmachine", "Engel", "victory 200"], ["Granulaatdroger", "Motan", "Luxor 120"]], c: "Wim Verlinden" },
            { naam: "Delta Draaiwerk", straat: "Ambachtenlaan 5", stad: "3001 Leuven", taal: "nl", m: [["Langdraaiautomaat", "Citizen", "L20"], ["CNC-draaibank", "Mazak", "QT 250"]], c: "Eline Wouters" },
            { naam: "Ardennes Usinage", straat: "Zoning des Hauts-Sarts 22", stad: "4040 Herstal", taal: "fr", m: [["Bewerkingscentrum", "Haas", "VF-4"], ["Draadvonkmachine", "GF", "CUT 300"]], c: "Julie Lambert" },
            { naam: "Noordzee Staal", straat: "Havenrandweg 3", stad: "8380 Zeebrugge", taal: "nl", m: [["Plasmasnijtafel", "Messer", "OmniMat"], ["Pons-nibbelmachine", "Amada", "EM 2510"]], c: "Tom De Smet" }
        ];
        const klanten = KL.map((k, i) => ({ id: "demo-k" + i, naam: k.naam, straat: k.straat, stad: k.stad, email: "", emails: ["onderhoud@" + k.naam.toLowerCase().replace(/[^a-z]/g, "") + ".be"],
            machines: k.m.map((m, j) => ({ id: "demo-m" + i + j, naam: m[0], merk: m[1], serienr: m[2] + "-" + (24000 + i * 131 + j * 17) })) }));
        const OPDR = [
            ["Jaarlijks onderhoud uitgevoerd: olie en filters vervangen, smering nagekeken, spelingen gemeten en afgesteld.", "Volgend onderhoud over 12 maanden."],
            ["Storing hydraulische druk. Drukregelventiel gedemonteerd, gereinigd en afdichtingen vervangen. Machine getest onder last.", ""],
            ["Spindellager maakt geluid. Lagers vervangen, spindel uitgelijnd en getest op 8000 tpm.", "Klant verwittigd: koelvloeistof bijvullen."],
            ["Foutmelding servo-as Y. Encoderkabel vervangen, as opnieuw gerefereerd.", ""],
            ["Nieuwe machine geïnstalleerd en waterpas gezet, aangesloten en proefdraai met operator.", "Opleiding operator gegeven."],
            ["Veiligheidsdeur sluit niet meer. Eindschakelaar vervangen en deurmechanisme afgesteld.", ""],
            ["Lekkage koelvloeistof. Pomp en leidingen nagekeken, koppeling vervangen.", "Pomp maakt slijtage: vervanging aan te raden."],
            ["Preventief onderhoud: geleidingen gereinigd en gesmeerd, riemspanning gecontroleerd, software-back-up genomen.", ""]
        ];
        const tijden = [["07:30", "16:00", 30], ["08:00", "16:30", 30], ["07:45", "15:45", 30], ["08:30", "12:30", 0], ["07:00", "17:15", 45], ["13:00", "17:00", 0]];
        /* werkdagen terug vanaf vandaag */
        const werkdagen = []; let d = vandaag();
        while (werkdagen.length < 30) { d = plusDagen(d, -1); if (!isWeekend(d)) werkdagen.push(d); }
        const lengtes = [1, 3, 1, 2, 1, 1, 4, 1, 2, 1, 1, 3, 1, 1, 2, 1, 1, 2, 1, 1];
        const bonnen = lengtes.map((n, i) => {
            const k = KL[i % KL.length], kl = klanten[i % KL.length], m = kl.machines[i % 2];
            const start = werkdagen[Math.min(29, Math.floor(i * 1.4) + n)];
            const dagen = [];
            let dd = start;
            for (let j = 0; j < n; j++) {
                const t = tijden[(i + j) % tijden.length];
                dagen.push({ datum: dd, begin: t[0], einde: t[1], pauze: t[2], supplUren: j === 0 && i % 4 === 0 ? "1" : "", supplKm: i % 5 === 1 && j === 0 ? "35" : "" });
                do { dd = plusDagen(dd, 1); } while (isWeekend(dd));
            }
            const o = OPDR[i % OPDR.length];
            const getekend = i >= 3;
            const tech1 = TECH[i % TECH.length], tech2 = n >= 3 ? TECH[(i + 2) % TECH.length] : "";
            return {
                id: "demo-b" + i, nr: 15400 + 20 - i, taal: k.taal, contractnr: i % 3 === 0 ? "C-2026-0" + (40 + i) : "", bestelnr: i % 2 ? "PO" + (88120 + i * 7) : "", contact: k.c, email: kl.emails[0],
                klantId: kl.id, klantNaam: kl.naam, klantStraat: kl.straat, klantStad: kl.stad,
                machineNaam: m.naam, machineMerk: m.merk, machineSerie: m.serienr,
                beschrijving: o[0], opmerkingen: o[1], fotos: [], dagen,
                matBestelJa: i % 3 === 1, matBestelTxt: i % 3 === 1 ? "Afdichtingsset en 2 filters" : "", matGelevJa: i % 4 === 2, matGelevTxt: i % 4 === 2 ? "Lagerset SKF 7014" : "", beeindigd: i % 6 !== 2,
                tech1, tech2, klantTekenNaam: getekend ? k.c : "", klantEmail: getekend ? kl.emails[0] : "", klantSig: getekend ? handtekening(k.c, i + 1) : "",
                afgetekend: getekend, getekendOp: getekend ? dagen[dagen.length - 1].datum + "T16:00:00.000Z" : null, teVerzenden: i === 3 || i === 5, gemaakt: start + "T07:30:00.000Z", demo: true
            };
        });
        /* planning: vorige, deze en volgende week */
        const ma = maandag(vandaag());
        const P = (w, dag, lengte, ti, ki, mi, opdr) => {
            const van = plusDagen(ma, w * 7 + dag); const kl = klanten[ki];
            return { id: "demo-p" + w + dag + ti + ki, tech: TECH[ti], klant: kl.naam, klantId: kl.id, adres: adresVan(kl), machine: kl.machines[mi].naam, opdracht: opdr, van, tot: plusDagen(van, lengte - 1), weekend: false };
        };
        const planning = [
            P(-1, 0, 2, 0, 0, 0, "Jaarlijks onderhoud"), P(-1, 2, 3, 0, 4, 1, "Revisie revolver"), P(-1, 0, 1, 1, 1, 0, "Storing spindel"), P(-1, 1, 4, 1, 3, 0, "Installatie nieuwe machine"),
            P(-1, 0, 5, 2, 2, 0, "Ombouw lascel"), P(-1, 1, 1, 3, 5, 1, "Onderhoud"), P(-1, 3, 2, 3, 6, 0, "Kalibratie"), P(-1, 0, 2, 4, 5, 0, "Storing as Y"),
            P(0, 0, 1, 0, 1, 1, "Slijpschijf vervangen"), P(0, 1, 3, 0, 0, 1, "Hydrauliek nakijken"), P(0, 4, 1, 0, 4, 0, "Oplevering"),
            P(0, 0, 2, 1, 3, 1, "Preventief onderhoud"), P(0, 2, 3, 1, 6, 1, "Revisie"), P(0, 0, 5, 2, 2, 1, "Montage nieuwe lijn"),
            P(0, 0, 1, 3, 4, 1, "Software-update"), P(0, 1, 2, 3, 1, 0, "Lagers vervangen"), P(0, 3, 2, 3, 5, 0, "Jaarlijks onderhoud"),
            P(0, 0, 3, 4, 6, 0, "Ombouw snijtafel"), P(0, 3, 2, 4, 0, 0, "Opleiding operator"),
            P(1, 0, 4, 0, 3, 0, "Installatie matrijs"), P(1, 0, 2, 1, 2, 1, "Onderhoud bandzaag"), P(1, 2, 3, 1, 4, 0, "Revisie"),
            P(1, 0, 1, 2, 5, 1, "Draad vervangen"), P(1, 1, 4, 2, 0, 0, "Jaarlijks onderhoud"), P(1, 0, 5, 3, 1, 0, "Retrofit besturing"), P(1, 1, 2, 4, 6, 1, "Onderhoud")
        ];
        if (settings && settings.techNaam && TECH.indexOf(settings.techNaam) < 0) {
            planning.push(Object.assign(P(0, 0, 5, 0, 0, 0, "Demo: jouw planning deze week"), { id: "demo-eigen", tech: settings.techNaam }));
        }
        const V = (ti, soort, w, dag, lengte, status, opm, reden) => {
            const van = plusDagen(ma, w * 7 + dag);
            return { id: "demo-v" + ti + w + dag, tech: TECH[ti], soort, van, tot: plusDagen(van, lengte - 1), opm, status, reden: reden || "", aangevraagd: plusDagen(ma, -10) + "T09:00:00.000Z" };
        };
        const verlof = [
            V(3, "Verlof", 1, 3, 2, "wacht", "Verlengd weekend"), V(1, "Recup", 2, 4, 1, "wacht", "Vrijdag vrij"), V(4, "Verlof", 7, 0, 5, "wacht", "Kerstvakantie"),
            V(0, "Verlof", 0, 4, 1, "ok", "Familiefeest"), V(2, "Klein verlet", 1, 2, 1, "ok", "Huwelijk broer"), V(4, "Verlof", 2, 0, 5, "ok", "Herfstvakantie"),
            V(1, "Verlof", 1, 0, 3, "nee", "Citytrip", "Te druk die week: installatie Kempen Plastics")
        ];
        return { bonnen, klanten, planning, verlof, goedkeurders: [settings && settings.techNaam ? settings.techNaam : TECH[0]], techniekers: TECH, gebruikt: bonnen.map(b => b.nr) };
    };
})();
