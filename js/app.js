/* Werkbon MT Service: hoofdscherm (App) en opstart */
/* ---------- app ---------- */
function App() {
    const [settings, setSettings] = useState(() => {
        const st = Object.assign({}, DEFAULT_SETTINGS, LS.get("settings", {}));
        /* Engels is vervangen door Tsjechisch */
        if (st.appTaal === "en") st.appTaal = "nl";
        if (st.bonTaal === "en") st.bonTaal = "nl";
        st.onderwerp = Object.assign({}, DEFAULT_SETTINGS.onderwerp, st.onderwerp);
        st.mail = Object.assign({}, DEFAULT_SETTINGS.mail, st.mail);
        return st;
    });
    const [klanten, setKlanten] = useState(() => (LS.get("klanten", []) || []).map(k => Object.assign({}, k, { emails: k.emails || (k.email ? [k.email] : []) })));
    const [bonnen, setBonnen] = useState(() => LS.get("bonnen", []));
    const [gebruikt, setGebruikt] = useState(() => LS.get("gebruikt", []));
    const [view, setView] = useState("dash");
    /* desktop-indeling: menu links en breed werkvlak vanaf 1000 px breed */
    const dq = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : null;
    const [desk, setDesk] = useState(!!(dq && dq.matches));
    useEffect(() => {
        if (!dq) return;
        const f = e => setDesk(e.matches);
        dq.addEventListener ? dq.addEventListener("change", f) : dq.addListener(f);
        return () => dq.removeEventListener ? dq.removeEventListener("change", f) : dq.removeListener(f);
    }, []);
    const [stap, setStap] = useState(1);
    const [bon, setBon] = useState(null);
    const [melding, setMelding] = useState("");
    const zoekUpdate = () => {
        setMelding(T.updZoek);
        window.zoekUpdate().then(r => setMelding(r === "nieuw" ? T.updNieuw : r === "laatste" ? T.updLaatste + " (v" + VERSIE + ")" : r === "offline" ? T.updOffline : T.updFout));
    };
    const [popup, setPopup] = useState(null);
    const [meerVelden, setMeerVelden] = useState(false);
    const [introOpen, setIntroOpen] = useState(() => !LS.get("introGezien", false));
    const [setupTab, setSetupTab] = useState("bedrijf");
    const [filter, setFilter] = useState("alle");
    const [zf, setZf] = useState({ q: "", klant: "", machine: "", tech: "", van: "", tot: "", open: false });
    const zetZf = v => setZf(o => Object.assign({}, o, v));
    const [zoek, setZoek] = useState("");
    const [kEdit, setKEdit] = useState(null);
    const [ontgrendeld, setOntgrendeld] = useState(() => LS.get("toegang", "") === APP_CODE);
    const [codeIn, setCodeIn] = useState("");
    const [codeFout, setCodeFout] = useState(false);
    const [bezig, setBezig] = useState("");
    const top = useRef(null);
    const T = UI[settings.appTaal] || UI.nl;
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const aan = () => setOnline(true), uit = () => setOnline(false);
        window.addEventListener("online", aan);
        window.addEventListener("offline", uit);
        WBStore.opFout = () => setMelding(T.opslagFout);
        return () => { window.removeEventListener("online", aan); window.removeEventListener("offline", uit); };
    }, [T]);
    const zetWacht = (id, wacht) => {
        const velden = wacht ? { teVerzenden: true } : { teVerzenden: false, verzondenOp: new Date().toISOString() };
        setBonnen(l => l.map(x => x.id === id ? Object.assign({}, x, velden) : x));
        setBon(x => x && x.id === id ? Object.assign({}, x, velden) : x);
    };
    const L = LBL[(bon && bon.taal) || settings.bonTaal] || LBL.nl;
    useEffect(() => { LS.set("settings", settings); }, [settings]);
    useEffect(() => { LS.set("klanten", klanten); }, [klanten]);
    useEffect(() => { LS.set("bonnen", bonnen); }, [bonnen]);
    useEffect(() => { LS.set("gebruikt", gebruikt); }, [gebruikt]);
    useEffect(() => { if (top.current)
        top.current.scrollTop = 0; window.scrollTo(0, 0); }, [stap, view]);
    useEffect(() => { if (!melding)
        return; const t = setTimeout(() => setMelding(""), 3000); return () => clearTimeout(t); }, [melding]);
    const vrijNummer = () => {
        for (let n = parseInt(settings.nrVan, 10); n <= parseInt(settings.nrTot, 10); n++) {
            if (gebruikt.indexOf(n) < 0)
                return n;
        }
        return null;
    };
    const nieuweBon = (taal) => {
        const nr = vrijNummer();
        if (nr === null) {
            setMelding(T.nrOp);
            return;
        }
        setBon({
            id: uid(), nr: nr, taal: taal, contractnr: "", bestelnr: "", contact: "", email: "",
            klantId: "", klantNaam: "", klantStraat: "", klantStad: "",
            machineNaam: "", machineMerk: "", machineSerie: "",
            beschrijving: "", opmerkingen: "", fotos: [],
            dagen: [{ datum: new Date().toISOString().slice(0, 10), begin: "", einde: "", pauze: settings.pauzeMin, supplUren: "", supplKm: "" }],
            matBestelJa: null, matBestelTxt: "", matGelevJa: null, matGelevTxt: "", beeindigd: null,
            tech1: settings.techNaam, tech2: "", klantTekenNaam: "", klantEmail: "", klantSig: "",
            afgetekend: false, gemaakt: new Date().toISOString()
        });
        setStap(1);
        setView("wizard");
    };
    const zetBon = (velden) => setBon(b => Object.assign({}, b, velden));
    const bewaar = (b, getekend) => {
        const nieuw = Object.assign({}, b, { afgetekend: !!getekend, getekendOp: getekend ? new Date().toISOString() : b.getekendOp });
        setBonnen(list => {
            const i = list.findIndex(x => x.id === nieuw.id);
            if (i < 0)
                return [nieuw].concat(list);
            const kopie = list.slice();
            kopie[i] = nieuw;
            return kopie;
        });
        setGebruikt(g => g.indexOf(nieuw.nr) < 0 ? g.concat([nieuw.nr]) : g);
        setBon(nieuw);
        return nieuw;
    };
    const bewaarKlantEmail = (klantId, adres) => {
        if (!klantId || !adres)
            return;
        setKlanten(l => l.map(k => {
            if (k.id !== klantId)
                return k;
            const lijst = k.emails || [];
            return lijst.indexOf(adres) >= 0 ? k : Object.assign({}, k, { emails: lijst.concat([adres]) });
        }));
    };
    const verwijderBon = (b) => {
        setBonnen(list => list.filter(x => x.id !== b.id));
        if (!b.afgetekend)
            setGebruikt(g => g.filter(n => n !== b.nr));
        setView("lijst");
        setBon(null);
    };
    const kopieerBon = (b) => {
        const nr = vrijNummer();
        if (nr === null) {
            setMelding(T.nrOp);
            return;
        }
        const k = Object.assign({}, b, {
            id: uid(), nr: nr, dagen: [{ datum: new Date().toISOString().slice(0, 10), begin: "", einde: "", pauze: settings.pauzeMin, supplUren: "", supplKm: "" }],
            klantSig: "", klantTekenNaam: "", afgetekend: false, getekendOp: null, gemaakt: new Date().toISOString()
        });
        setBon(k);
        setStap(1);
        setView("wizard");
    };
    /* delen / afdrukken */
    const kopieerNaarKlembord = async (tekst) => {
        if (!tekst)
            return false;
        try {
            await navigator.clipboard.writeText(tekst);
            return true;
        }
        catch (e) {
            try {
                const ta = document.createElement("textarea");
                ta.value = tekst;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                return true;
            }
            catch (err) {
                return false;
            }
        }
    };
    const deelBon = async (b) => {
        if (!navigator.onLine) {
            zetWacht(b.id, true);
            setMelding(T.inWachtrij);
            return;
        }
        setBezig(T.pdfBezig);
        const adres = [b.klantEmail || b.email || ""]
            .concat(settings.dienstEmailAan && settings.dienstEmail ? [settings.dienstEmail] : [])
            .filter(a => a).join("; ");
        const gekopieerd = await kopieerNaarKlembord(adres);
        try {
            const blob = await maakPdfBlob(b, settings);
            const naam = pdfNaam(b);
            const onderwerp = (settings.onderwerp[b.taal] || "Werkbon") + " " + b.nr;
            const file = new File([blob], naam, { type: "application/pdf" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: onderwerp, text: (settings.mail[b.taal] || "") });
                zetWacht(b.id, false);
                if (gekopieerd && adres)
                    setMelding(T.gekopieerd);
            }
            else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = naam;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
            }
        }
        catch (e) {
            setMelding(String(e.message || e));
        }
        setBezig("");
    };
    const printBon = async (b) => {
        const w = window.open("", "_blank");
        if (!w) {
            setMelding("Pop-up geblokkeerd");
            return;
        }
        w.document.write("<html><head><meta charset='utf-8'><title>" + b.nr + "<\/title><\/head><body style='margin:0'>" + buildPdfHtml(b, settings) + "<\/body><\/html>");
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 500);
    };
    /* import / export */
    const bestandDownload = (obj, naam) => {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = naam;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
    const leesBestand = (e, cb) => {
        const f = e.target.files && e.target.files[0];
        if (!f)
            return;
        const r = new FileReader();
        r.onload = () => { try {
            cb(JSON.parse(r.result));
        }
        catch (err) {
            setMelding("Ongeldig bestand");
        } };
        r.readAsText(f);
        e.target.value = "";
    };
    const importKlanten = (data) => {
        const lijst = Array.isArray(data) ? data : (data.klanten || []);
        setKlanten(huidig => {
            const kopie = huidig.slice();
            lijst.forEach(nk => {
                const best = kopie.find(k => k.naam.toLowerCase() === String(nk.naam || "").toLowerCase());
                if (!best) {
                    kopie.push(Object.assign({ id: uid(), machines: [] }, nk));
                    return;
                }
                (nk.machines || []).forEach(nm => {
                    const m = (best.machines || []).find(x => x.naam === nm.naam && x.serienr === nm.serienr);
                    if (!m)
                        best.machines = (best.machines || []).concat([Object.assign({ id: uid() }, nm)]);
                });
            });
            return kopie;
        });
        setMelding("OK");
    };
    const maakBackup = () => bestandDownload({ versie: VERSIE, settings, klanten, bonnen, gebruikt }, "werkbon-backup-" + new Date().toISOString().slice(0, 10) + ".json");
    const herstelBackup = (data) => {
        if (!window.confirm(T.backupVraag))
            return;
        if (data.settings)
            setSettings(Object.assign({}, DEFAULT_SETTINGS, data.settings));
        if (data.klanten)
            setKlanten(data.klanten);
        if (data.bonnen)
            setBonnen(data.bonnen);
        if (data.gebruikt)
            setGebruikt(data.gebruikt);
        setMelding("OK");
    };
    /* ---------- schermen ---------- */
    const klant = klanten.find(k => k.id === (bon && bon.klantId));
    /* zoeken in alle werkbonnen: vrije tekst plus filters op klant, machine, technieker en datum */
    const bevat = (tekst, q) => String(tekst || "").toLowerCase().indexOf(q.trim().toLowerCase()) >= 0;
    const bonDatums = b => (b.dagen || []).map(d => d.datum).filter(Boolean).concat(b.dagen && b.dagen.some(d => d.datum) ? [] : [String(b.gemaakt || "").slice(0, 10)]).filter(Boolean);
    const bonDatum = b => bonDatums(b).sort().slice(-1)[0] || "";
    const techs = Array.from(new Set(bonnen.reduce((a, b) => a.concat([b.tech1, b.tech2]), []).map(t => (t || "").trim()).filter(Boolean))).sort();
    const gefilterd = bonnen.filter(b => filter === "alle" || (filter === "open" ? !b.afgetekend : b.afgetekend))
        .filter(b => !zf.q.trim() || [b.nr, b.klantNaam, b.klantStad, b.klantStraat, b.machineNaam, b.machineMerk, b.machineSerie, b.tech1, b.tech2, b.contractnr, b.bestelnr].some(x => bevat(x, zf.q)))
        .filter(b => !zf.klant.trim() || [b.klantNaam, b.klantStad, b.klantStraat].some(x => bevat(x, zf.klant)))
        .filter(b => !zf.machine.trim() || [b.machineNaam, b.machineMerk, b.machineSerie].some(x => bevat(x, zf.machine)))
        .filter(b => !zf.tech || [b.tech1, b.tech2].some(x => (x || "").trim() === zf.tech))
        .filter(b => (!zf.van && !zf.tot) || bonDatums(b).some(d => (!zf.van || d >= zf.van) && (!zf.tot || d <= zf.tot)))
        .slice().sort((a, b) => bonDatum(b).localeCompare(bonDatum(a)) || (b.nr || 0) - (a.nr || 0));
    const zoekActief = !!(zf.q.trim() || zf.klant.trim() || zf.machine.trim() || zf.tech || zf.van || zf.tot);
    const taalKeuze = React.createElement("label", { className: "taalmenu", title: T.appTaal },
        Ic("globe"),
        React.createElement("select", { value: settings.appTaal, "aria-label": T.appTaal, onChange: e => setSettings(s => Object.assign({}, s, { appTaal: e.target.value })) },
            ["nl", "fr", "cs"].map(t => React.createElement("option", { key: t, value: t }, t.toUpperCase()))));
    const Kop = (titel, terugNaar) => (React.createElement("div", { className: "appkop" + (view === "dash" ? " home" : "") },
        terugNaar ? React.createElement("button", { className: "terug", "aria-label": "Terug", onClick: () => setView(terugNaar) }, Ic("terug")) : null,
        view === "dash" && !desk ? React.createElement("img", { className: "koplogo", src: "icons/logo-mt.png", alt: "MT Service" }) : React.createElement("h1", null, titel),
        view === "dash" && !desk ? taalKeuze : null));
    const nu = new Date();
    const groet = nu.getHours() < 12 ? T.goedemorgen : nu.getHours() < 18 ? T.goedemiddag : T.goedenavond;
    const vandaagIso = nu.getFullYear() + "-" + String(nu.getMonth() + 1).padStart(2, "0") + "-" + String(nu.getDate()).padStart(2, "0");
    const urenVandaag = ((window.WBStore && window.WBStore.cache.wb_uren) || {})[vandaagIso];
    const dezeMaand = bonnen.filter(b => String(b.gemaakt || "").slice(0, 7) === vandaagIso.slice(0, 7) || (b.dagen || []).some(d => (d.datum || "").slice(0, 7) === vandaagIso.slice(0, 7))).length;
    const teVerzenden = bonnen.filter(x => x.teVerzenden).length;
    const Kpi = (getal, label, accent, klik) => React.createElement(klik ? "button" : "div", { className: "kpi" + (accent ? " accent" : ""), onClick: klik || undefined },
        React.createElement("span", null, label),
        React.createElement("b", null, getal));
    const BonRij = b => React.createElement("button", { key: b.id, className: "bonrij", onClick: () => { setBon(b); setView("acties"); } },
        React.createElement("span", { className: "nr" }, b.nr),
        React.createElement("span", { className: "wie" },
            b.klantNaam || "—",
            React.createElement("small", null, [bonDatum(b) ? bonDatum(b).split("-").reverse().join("/") : "", b.machineNaam].filter(Boolean).join(" · "))),
        React.createElement("span", { className: "pil " + (b.afgetekend ? "groen" : "oranje") }, b.afgetekend ? T.getekend : T.open),
        Ic("pijl", "pijl"));
    const dashboard = (React.createElement("div", { className: "scherm" },
        desk ? null : Kop(settings.bedrijfsnaam, null),
        React.createElement("div", { className: "groet" },
            React.createElement("h2", null, groet + (settings.techNaam ? ", " + settings.techNaam.split(" ")[0] : "")),
            React.createElement("span", null, nu.toLocaleDateString({ nl: "nl-BE", fr: "fr-BE", en: "en-GB", cs: "cs-CZ" }[settings.appTaal] || "nl-BE", { weekday: "long", day: "numeric", month: "long" }))),
        React.createElement("div", { className: "kpis" },
            Kpi(bonnen.filter(b => !b.afgetekend).length, T.openBonnen, false, () => { setFilter("open"); setView("lijst"); }),
            Kpi(teVerzenden, T.teVerzenden, teVerzenden > 0, null),
            Kpi(dezeMaand, T.dezeMaand, false, null)),
        teVerzenden > 0 ? React.createElement("div", { className: "wachtblok" },
            React.createElement("b", null, T.wachtTitel + " (" + bonnen.filter(x => x.teVerzenden).length + ")"),
            online ? bonnen.filter(x => x.teVerzenden).map(x => React.createElement("button", { key: x.id, className: "btn", onClick: () => deelBon(x) }, T.verzendNu + " N° " + x.nr + (x.klantNaam ? " · " + x.klantNaam : "")))
                : React.createElement("span", { className: "klein" }, T.wachtOffline)) : null,
        React.createElement("button", { className: "btn groot", onClick: () => setView("taal") }, Ic("plus"), T.nieuw),
        React.createElement("div", { className: "kaart vandaag" },
            React.createElement("div", { className: "kaartIc" }, Ic("klok")),
            React.createElement("div", { className: "kaartTekst" },
                React.createElement("b", null, T.vandaag),
                React.createElement("span", null, urenVandaag && (urenVandaag.vertrekThuis || urenVandaag.klant)
                    ? [urenVandaag.klant, urenVandaag.vertrekThuis && urenVandaag.aankomstThuis ? urenVandaag.vertrekThuis + " – " + urenVandaag.aankomstThuis : urenVandaag.vertrekThuis].filter(Boolean).join(" · ")
                    : T.geenUren)),
            React.createElement("button", { className: "btn klein grijs", onClick: () => setView("uren") }, urenVandaag ? T.urenAanpassen : T.urenInvullen)),
        React.createElement("div", { className: "sectiekop" },
            React.createElement("h2", null, T.recent),
            bonnen.length ? React.createElement("button", { className: "linkknop", onClick: () => setView("lijst") }, T.allesBekijken) : null),
        bonnen.length === 0 ? React.createElement("div", { className: "leegkaart" }, Ic("bon"), React.createElement("p", null, T.leeg)) : React.createElement("div", { className: "bonraster" }, bonnen.slice().sort((x, y) => bonDatum(y).localeCompare(bonDatum(x)) || (y.nr || 0) - (x.nr || 0)).slice(0, desk ? 8 : 5).map(BonRij))));
    const lijst = (React.createElement("div", { className: "scherm" },
        Kop(T.bonnen, "dash"),
        React.createElement("div", { className: "zoekbalk" },
            React.createElement("input", { type: "search", placeholder: T.zoekAlles, value: zf.q, onChange: e => zetZf({ q: e.target.value }) }),
            React.createElement("button", { className: "tog" + (zf.open ? " aan" : ""), onClick: () => zetZf({ open: !zf.open }) }, Ic("filter"), T.meerFilters)),
        zf.open ? React.createElement("div", { className: "zoekfilters" },
            React.createElement(Veld, { label: T.fKlant, waarde: zf.klant, onChange: v => zetZf({ klant: v }) }),
            React.createElement(Veld, { label: T.fMachine, waarde: zf.machine, onChange: v => zetZf({ machine: v }) }),
            React.createElement("label", { className: "veld" },
                React.createElement("span", null, T.fTech),
                React.createElement("select", { value: zf.tech, onChange: e => zetZf({ tech: e.target.value }) },
                    React.createElement("option", { value: "" }, T.alleTech),
                    techs.map(t => React.createElement("option", { key: t, value: t }, t)))),
            React.createElement(Veld, { label: T.fVan, type: "date", waarde: zf.van, onChange: v => zetZf({ van: v }) }),
            React.createElement(Veld, { label: T.fTot, type: "date", waarde: zf.tot, onChange: v => zetZf({ tot: v }) })) : null,
        zoekActief ? React.createElement("div", { className: "zoekinfo" },
            React.createElement("span", null, gefilterd.length + " " + T.gevonden),
            React.createElement("button", { className: "btn klein grijs", onClick: () => setZf({ q: "", klant: "", machine: "", tech: "", van: "", tot: "", open: zf.open }) }, T.wisFilters)) : null,
        React.createElement("div", { className: "tabs" }, ["alle", "open", "getekend"].map(f => (React.createElement("button", { key: f, className: "tab" + (filter === f ? " aan" : ""), onClick: () => setFilter(f) }, T[f === "alle" ? "alle" : f])))),
        gefilterd.length === 0 ? React.createElement("p", { className: "leegtekst" }, T.leeg) : React.createElement("div", { className: "bonraster" }, gefilterd.map(b => (React.createElement("div", { key: b.id, className: "bonrij plat" },
            React.createElement("button", { className: "open", onClick: () => { setBon(b); setView("acties"); } },
                React.createElement("span", { className: "nr" }, b.nr),
                React.createElement("span", { className: "wie" },
                    b.klantNaam || "—",
                    React.createElement("small", null, [bonDatum(b) ? bonDatum(b).split("-").reverse().join("/") : "", b.machineNaam, b.machineSerie ? "SN " + b.machineSerie : "", [b.tech1, b.tech2].filter(Boolean).join(" & ")].filter(Boolean).join(" · "))),
                React.createElement("span", { className: "pil " + (b.afgetekend ? "groen" : "oranje") }, b.afgetekend ? T.getekend : T.open)),
            React.createElement("button", { className: "wis", onClick: () => { if (window.confirm(T.verwijderVraag))
                    verwijderBon(b); } }, "\u00D7")))))));
    const taalkeuze = (React.createElement("div", { className: "scherm" },
        Kop(T.taalkeuze, "dash"),
        React.createElement("div", { className: "taalgrid" }, ["nl", "fr", "de", "cs"].map(t => (React.createElement("button", { key: t, className: "taalknop", onClick: () => nieuweBon(t) },
            React.createElement("span", { className: "gr" }, VLAG[t]),
            React.createElement("span", null, TAALNAAM[t])))))));
    const vorige = bon ? bonnen.filter(x => x.id !== bon.id && ((bon.klantId && x.klantId === bon.klantId) || (bon.klantNaam && (x.klantNaam || "").trim().toLowerCase() === bon.klantNaam.trim().toLowerCase()))).sort((a, b) => bonDatum(b).localeCompare(bonDatum(a)) || (b.nr || 0) - (a.nr || 0))[0] : null;
    const toonMeer = meerVelden || !!(bon && (bon.contractnr || bon.bestelnr || bon.contact));
    /* machine van de bon bij de klant bewaren als ze er nog niet bij staat (ook na scannen of typen) */
    const bonMachine = () => {
        const naam = (bon.machineNaam || "").trim(), sn = (bon.machineSerie || "").trim();
        if (!naam && !sn) return null;
        return { id: uid(), naam: naam || (bon.machineMerk || "").trim() || "Machine", merk: (bon.machineMerk || "").trim(), serienr: sn };
    };
    const machineBijKlant = (k) => {
        const m = bonMachine();
        if (!m) return;
        const bestaat = (k.machines || []).some(x => (m.serienr && (x.serienr || "").trim() === m.serienr) || ((x.naam || "").trim() === m.naam && (x.serienr || "").trim() === m.serienr));
        if (!bestaat) setKlanten(l => l.map(x => x.id === k.id ? Object.assign({}, x, { machines: (x.machines || []).concat([m]) }) : x));
    };
    const volgendeStap = () => {
        if (stap === 1 && bon) {
            const naam = (bon.klantNaam || "").trim();
            let k = klant;
            if (!k && naam) {
                k = klanten.find(x => (x.naam || "").trim().toLowerCase() === naam.toLowerCase()) || null;
                if (k) zetBon({ klantId: k.id });
                else if (!bon.klantNietBewaren) { setPopup("klantBewaren"); return; }
            }
            if (k) machineBijKlant(k);
        }
        setStap(s => s + 1);
    };
    const stap1 = () => (React.createElement("div", null,
        React.createElement("div", { className: "zoekblok" },
            React.createElement("input", { placeholder: T.zoekKlant, value: zoek, onChange: e => setZoek(e.target.value) }),
            zoek && klanten.filter(k => k.naam.toLowerCase().indexOf(zoek.toLowerCase()) >= 0).slice(0, 6).map(k => (React.createElement("button", { key: k.id, className: "suggestie", onClick: () => {
                    const enige = (k.machines || []).length === 1 ? k.machines[0] : null;
                    zetBon({ klantId: k.id, klantNaam: k.naam, klantStraat: k.straat, klantStad: k.stad,
                        email: (k.emails && k.emails[0]) || k.email || "", klantEmail: (k.emails && k.emails[0]) || k.email || "",
                        machineNaam: enige ? enige.naam : "", machineMerk: enige ? enige.merk || "" : "", machineSerie: enige ? enige.serienr || "" : "" });
                    setZoek("");
                } },
                k.naam,
                React.createElement("small", null, k.stad))))),
        React.createElement("button", { className: "btn grijs", onClick: () => setPopup("klant") },
            "+ ",
            T.nieuweKlant),
        React.createElement(Veld, { label: T.klant, waarde: bon.klantNaam, onChange: v => zetBon({ klantNaam: v }) }),
        React.createElement(Veld, { label: T.straat, waarde: bon.klantStraat, onChange: v => zetBon({ klantStraat: v }) }),
        React.createElement(Veld, { label: T.stad, waarde: bon.klantStad, onChange: v => zetBon({ klantStad: v }) }),
        vorige ? React.createElement("button", { className: "btn grijs vorigeknop", onClick: () => {
                zetBon({ klantStraat: bon.klantStraat || vorige.klantStraat, klantStad: bon.klantStad || vorige.klantStad, machineNaam: vorige.machineNaam || "", machineMerk: vorige.machineMerk || "", machineSerie: vorige.machineSerie || "", contact: vorige.contact || "", email: vorige.email || bon.email || "", klantEmail: vorige.klantEmail || bon.klantEmail || "", contractnr: vorige.contractnr || "" });
                setMelding(T.vorigeBon + ": N\u00B0 " + vorige.nr);
            } }, Ic("kopie"), React.createElement("span", null, T.vorigeBon, React.createElement("small", null, "N\u00B0 " + vorige.nr + (vorige.machineNaam ? " \u00B7 " + vorige.machineNaam : "")))) : null,
        React.createElement("label", { className: "veld" },
            React.createElement("span", null, T.machine),
            React.createElement("select", { value: bon.machineNaam, onChange: e => {
                    const m = klant && (klant.machines || []).find(x => x.naam === e.target.value);
                    zetBon({ machineNaam: e.target.value, machineMerk: m ? m.merk : bon.machineMerk, machineSerie: m ? m.serienr : bon.machineSerie });
                } },
                React.createElement("option", { value: "" }, "\u2014"),
                klant && (klant.machines || []).map(m => React.createElement("option", { key: m.id, value: m.naam }, m.naam)),
                bon.machineNaam && !(klant && (klant.machines || []).some(m => m.naam === bon.machineNaam)) ? React.createElement("option", { value: bon.machineNaam }, bon.machineNaam) : null)),
        React.createElement("button", { className: "btn grijs", disabled: !klant, onClick: () => setPopup("machine") }, Ic("plus"), T.nieuweMachine),
        React.createElement(Veld, { label: T.merk, waarde: bon.machineMerk, onChange: v => zetBon({ machineMerk: v }) }),
        React.createElement(Veld, { label: T.serienr, waarde: bon.machineSerie, onChange: v => zetBon({ machineSerie: v }) }),
        React.createElement(Veld, { label: T.email, type: "email", waarde: bon.email, onChange: v => zetBon({ email: v }) }),
        React.createElement("button", { className: "linkknop meer", onClick: () => setMeerVelden(!toonMeer) }, (toonMeer ? "\u2212 " + T.minderVelden : "+ " + T.meerVelden)),
        toonMeer ? React.createElement(React.Fragment, null,
            React.createElement(Veld, { label: T.bonnr, waarde: bon.nr, onChange: () => { }, uit: true }),
            React.createElement(Veld, { label: T.contractnr, waarde: bon.contractnr, onChange: v => zetBon({ contractnr: v }) }),
            React.createElement(Veld, { label: T.bestelnr, waarde: bon.bestelnr, onChange: v => zetBon({ bestelnr: v }) }),
            React.createElement(Veld, { label: T.contact, waarde: bon.contact, onChange: v => zetBon({ contact: v }) })) : null));
    const stap2 = () => (React.createElement("div", null,
        React.createElement(Veld, { label: T.beschrijving, multi: true, rows: 10, waarde: bon.beschrijving, onChange: v => zetBon({ beschrijving: v }) }),
        React.createElement(Dicteer, { T, taal: settings.appTaal, setMelding, onTekst: t => setBon(b => Object.assign({}, b, { beschrijving: (b.beschrijving ? b.beschrijving.replace(/\s+$/, "") + (/[.!?]$/.test(b.beschrijving.trim()) ? " " : ". ") : "") + t.charAt(0).toUpperCase() + t.slice(1) })) }),
        React.createElement(Vertaler, { T, tekst: bon.beschrijving, onZet: v => zetBon({ beschrijving: v }), van: settings.appTaal, email: settings.techEmail, setMelding }),
        React.createElement(Veld, { label: T.opmerkingen, multi: true, rows: 4, waarde: bon.opmerkingen, onChange: v => zetBon({ opmerkingen: v }) }),
        React.createElement(Vertaler, { T, tekst: bon.opmerkingen, onZet: v => zetBon({ opmerkingen: v }), van: settings.appTaal, email: settings.techEmail, setMelding }),
        React.createElement("div", { className: "veld" },
            React.createElement("span", null,
                T.fotos,
                " (",
                (bon.fotos || []).length,
                "/4)"),
            React.createElement("div", { className: "fotorij" }, (bon.fotos || []).map((f, i) => (React.createElement("div", { key: i, className: "thumb" },
                React.createElement("img", { src: f, alt: "" }),
                React.createElement("button", { onClick: () => zetBon({ fotos: bon.fotos.filter((x, j) => j !== i) }) }, "\u00D7"))))),
            React.createElement("label", { className: "btn grijs bestand" },
                T.fotoAdd,
                React.createElement("input", { type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: async (e) => {
                        const f = e.target.files && e.target.files[0];
                        e.target.value = "";
                        if (!f)
                            return;
                        if ((bon.fotos || []).length >= 4) {
                            setMelding(T.fotoMax);
                            return;
                        }
                        try {
                            const d = await verkleinFoto(f, 1280);
                            zetBon({ fotos: (bon.fotos || []).concat([d]) });
                        }
                        catch (err) {
                            setMelding("Foto mislukt");
                        }
                    } })))));
    const stap3 = () => (React.createElement("div", null,
        (bon.dagen || []).map((d, i) => {
            const zet = (veld, w) => {
                const kopie = bon.dagen.slice();
                kopie[i] = Object.assign({}, kopie[i], { [veld]: w });
                zetBon({ dagen: kopie });
            };
            return (React.createElement("div", { key: i, className: "dagkaart" },
                React.createElement("div", { className: "dagkop" },
                    React.createElement("b", null, dagNaam(d.datum, bon.taal) || T.datum),
                    React.createElement("button", { className: "wis", onClick: () => zetBon({ dagen: bon.dagen.filter((x, j) => j !== i) }) }, "\u00D7")),
                React.createElement("div", { className: "dagvelden" },
                    React.createElement("label", null,
                        React.createElement("span", null, T.datum),
                        React.createElement("input", { type: "date", value: d.datum || "", onChange: e => zet("datum", e.target.value) })),
                    React.createElement("label", null,
                        React.createElement("span", null, T.begin),
                        React.createElement(TijdNu, { T, waarde: d.begin, onChange: v => zet("begin", v) })),
                    React.createElement("label", null,
                        React.createElement("span", null, T.einde),
                        React.createElement(TijdNu, { T, waarde: d.einde, onChange: v => zet("einde", v) })),
                    React.createElement("label", null,
                        React.createElement("span", null, T.pauze),
                        React.createElement("input", { type: "number", inputMode: "numeric", value: d.pauze, onChange: e => zet("pauze", e.target.value) })),
                    React.createElement("label", null,
                        React.createElement("span", null, T.supplUren),
                        React.createElement("input", { type: "text", inputMode: "decimal", value: d.supplUren || "", onChange: e => zet("supplUren", e.target.value) })),
                    React.createElement("label", null,
                        React.createElement("span", null, T.supplKm),
                        React.createElement("input", { type: "text", inputMode: "decimal", value: d.supplKm || "", onChange: e => zet("supplKm", e.target.value) }))),
                React.createElement("div", { className: "dagtotaal" }, hhmm(dagMinuten(d)))));
        }),
        React.createElement("button", { className: "btn grijs", disabled: (bon.dagen || []).length >= 15, onClick: () => zetBon({ dagen: (bon.dagen || []).concat([{ datum: new Date().toISOString().slice(0, 10), begin: "", einde: "", pauze: settings.pauzeMin, supplUren: "", supplKm: "" }]) }) },
            "+ ",
            T.dagAdd),
        React.createElement("div", { className: "totaalbalk" },
            React.createElement("span", null,
                T.totaalUren,
                ": ",
                React.createElement("b", null, hhmm(totalen(bon.dagen).min))),
            React.createElement("span", null,
                T.totaalVb,
                ": ",
                React.createElement("b", null, totalen(bon.dagen).vb || 0)),
            React.createElement("span", null,
                T.totaalKm,
                ": ",
                React.createElement("b", null, totalen(bon.dagen).km || 0))),
        React.createElement("div", { className: "veld" },
            React.createElement("span", null, T.matBestel),
            React.createElement(JaNee, { waarde: bon.matBestelJa, T: T, onChange: v => zetBon({ matBestelJa: v }) }),
            React.createElement("textarea", { rows: 3, value: bon.matBestelTxt, onChange: e => zetBon({ matBestelTxt: e.target.value }) })),
        React.createElement("div", { className: "veld" },
            React.createElement("span", null, T.matGelev),
            React.createElement(JaNee, { waarde: bon.matGelevJa, T: T, onChange: v => zetBon({ matGelevJa: v }) }),
            React.createElement("textarea", { rows: 3, value: bon.matGelevTxt, onChange: e => zetBon({ matGelevTxt: e.target.value }) })),
        React.createElement("div", { className: "veld" },
            React.createElement("span", null, T.beeindigd),
            React.createElement(JaNee, { waarde: bon.beeindigd, T: T, onChange: v => zetBon({ beeindigd: v }) }))));
    const bonTaalKeuze = () => React.createElement("div", { className: "veld" },
        React.createElement("span", null, T.dezeTaal),
        React.createElement("div", { className: "taalrij" }, ["nl", "fr", "de", "cs"].map(t => React.createElement("button", { key: t, type: "button", className: "tog" + (bon.taal === t ? " aan" : ""), onClick: () => zetBon({ taal: t }) }, VLAG[t]))));
    const stap4 = () => (React.createElement("div", null,
        React.createElement("div", { className: "infoblok" },
            React.createElement("div", null,
                T.tech,
                ": ",
                React.createElement("b", null, settings.techNaam || "—")),
            settings.techSig ? React.createElement("img", { className: "sigMini", src: settings.techSig, alt: "" }) : React.createElement("span", { className: "waarschuwing" }, T.geenTech)),
        React.createElement(Veld, { label: T.tech2, waarde: bon.tech2, onChange: v => zetBon({ tech2: v }) }),
        bonTaalKeuze(),
        React.createElement("button", { className: "btn groot", onClick: () => {
                if (!bon.klantNaam || !bon.machineNaam || !bon.beschrijving) {
                    setMelding(T.verplicht);
                    return;
                }
                zetBon({ klantTekenNaam: bon.klantTekenNaam || bon.contact || "" });
                setView("preview");
            } }, T.preview),
        React.createElement("button", { className: "btn grijs", onClick: () => { bewaar(bon, false); setView("acties"); } }, T.zonderHt)));
    const wizard = bon ? (React.createElement("div", { className: "scherm" },
        Kop(T.stap + " " + stap + "/4 · " + VLAG[bon ? bon.taal : "nl"], "dash"),
        React.createElement("div", { className: "stapbalk" }, [1, 2, 3, 4].map(n => React.createElement("span", { key: n, className: "bol" + (n <= stap ? " aan" : "") }))),
        React.createElement("h2", null, [T.klant, T.werken, T.uren, T.tekenen][stap - 1]),
        stap === 1 ? stap1() : stap === 2 ? stap2() : stap === 3 ? stap3() : stap4(),
        React.createElement("div", { className: "navbalk" },
            stap > 1 ? React.createElement("button", { className: "btn grijs", onClick: () => setStap(s => s - 1) }, T.vorige) : null,
            stap < 4 ? React.createElement("button", { className: "btn", onClick: volgendeStap }, T.volgende) : null))) : null;
    const preview = bon ? (React.createElement("div", { className: "scherm preview" },
        React.createElement("p", { className: "draaihint" }, L.pDraai),
        bonTaalKeuze(),
        React.createElement(BonReplica, { bon: bon, settings: settings }),
        React.createElement("div", { className: "tekenzone" },
            React.createElement("label", { className: "veld" },
                React.createElement("span", null, L.pNaam),
                React.createElement("input", { value: bon.klantTekenNaam || "", onChange: e => zetBon({ klantTekenNaam: e.target.value }) })),
            klant && (klant.emails || []).length > 1 ? (React.createElement("label", { className: "veld" },
                React.createElement("span", null, T.emailKlant),
                React.createElement("select", { value: bon.klantEmail || "", onChange: e => zetBon({ klantEmail: e.target.value }) },
                    (klant.emails || []).map(a => React.createElement("option", { key: a, value: a }, a)),
                    (klant.emails || []).indexOf(bon.klantEmail || "") < 0 ? React.createElement("option", { value: bon.klantEmail || "" }, bon.klantEmail || "—") : null))) : null,
            React.createElement("label", { className: "veld" },
                React.createElement("span", null, L.pEmail),
                React.createElement("input", { type: "email", inputMode: "email", autoCapitalize: "off", value: bon.klantEmail || "", onChange: e => zetBon({ klantEmail: e.target.value }) })),
            bon.klantSig ? React.createElement("img", { className: "sigVoorbeeld", src: bon.klantSig, alt: "" }) : null,
            React.createElement("button", { className: "btn groot", onClick: () => setView("tekenvol") }, bon.klantSig ? T.opnieuwTekenen : L.pTeken)),
        React.createElement("div", { className: "navbalk" },
            React.createElement("button", { className: "btn grijs", onClick: () => setView("wizard") }, T.terug),
            React.createElement("button", { className: "btn", disabled: !bon.klantSig, onClick: () => {
                    bewaarKlantEmail(bon.klantId, bon.klantEmail);
                    bewaar(bon, true);
                    setView("acties");
                } }, T.bevestigen)))) : null;
    const tekenVol = bon ? (React.createElement(TekenVol, { waarde: bon.klantSig, L: L, onTerug: () => setView("preview"), onKlaar: d => { zetBon({ klantSig: d }); setView("preview"); } })) : null;
    const acties = bon ? (React.createElement("div", { className: "scherm" },
        Kop("N° " + bon.nr, "dash"),
        bon.afgetekend ? React.createElement("p", { className: "slot" }, T.vergrendeld) : null,
        React.createElement(BonReplica, { bon: bon, settings: settings }),
        React.createElement("button", { className: "btn groot", onClick: () => deelBon(bon) }, T.verzenden),
        React.createElement("div", { className: "rijtje" },
            React.createElement("button", { className: "btn grijs", onClick: () => printBon(bon) }, T.afdrukken),
            settings.oneDriveUrl ? React.createElement("button", { className: "btn grijs", onClick: () => window.open(settings.oneDriveUrl, "_blank") }, T.onedrive) : null),
        React.createElement("div", { className: "rijtje" },
            React.createElement("button", { className: "btn grijs", disabled: bon.afgetekend, onClick: () => { setStap(1); setView("wizard"); } }, T.bewerken),
            React.createElement("button", { className: "btn grijs", onClick: () => kopieerBon(bon) }, T.kopieren)),
        React.createElement("button", { className: "btn rood", onClick: () => { if (window.confirm(T.verwijderVraag))
                verwijderBon(bon); } }, T.verwijderen))) : null;
    const zetS = (v) => setSettings(s => Object.assign({}, s, v));
    const setup = (React.createElement("div", { className: "scherm" },
        Kop(T.setup, "dash"),
        React.createElement("div", { className: "tabs" }, [["bedrijf", T.bedrijf], ["tech", T.tech], ["klanten", T.klantenTab], ["bonnen", T.bonnen], ["delen", T.delenTab]].map(t => (React.createElement("button", { key: t[0], className: "tab" + (setupTab === t[0] ? " aan" : ""), onClick: () => setSetupTab(t[0]) }, t[1])))),
        setupTab === "bedrijf" && (React.createElement("div", null,
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.appTaal),
                React.createElement("div", { className: "taalrij" }, ["nl", "fr", "cs"].map(t => (React.createElement("button", { key: t, className: "tog" + (settings.appTaal === t ? " aan" : ""), onClick: () => zetS({ appTaal: t }) },
                    VLAG[t],
                    " ",
                    TAALNAAM[t]))))),
            React.createElement(Veld, { label: T.naam, waarde: settings.bedrijfsnaam, onChange: v => zetS({ bedrijfsnaam: v }) }),
            React.createElement(Veld, { label: "Adres", waarde: settings.adres, onChange: v => zetS({ adres: v }) }),
            React.createElement(Veld, { label: "Tel.", waarde: settings.telefoon, onChange: v => zetS({ telefoon: v }) }),
            React.createElement(Veld, { label: "Fax", waarde: settings.fax, onChange: v => zetS({ fax: v }) }),
            React.createElement(Veld, { label: "Website", waarde: settings.website, onChange: v => zetS({ website: v }) }),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.logo),
                React.createElement("div", { className: "logoVak" },
                    React.createElement("img", { src: settings.logo || STD_LOGO, alt: "" })),
                React.createElement("div", { className: "rijtje" },
                    React.createElement("label", { className: "btn grijs bestand" },
                        T.logoKies,
                        React.createElement("input", { type: "file", accept: "image/png,image/jpeg,image/svg+xml", style: { display: "none" }, onChange: async (e) => {
                                const f = e.target.files && e.target.files[0];
                                e.target.value = "";
                                if (!f)
                                    return;
                                try {
                                    const d = await logoNaarPng(f);
                                    zetS({ logo: d });
                                }
                                catch (err) {
                                    setMelding("Logo mislukt");
                                }
                            } })),
                    React.createElement("button", { className: "btn grijs", disabled: !settings.logo, onClick: () => zetS({ logo: "" }) }, T.logoStd))),
            React.createElement("p", { className: "klein" },
                T.toegangscode,
                ": ",
                APP_CODE),
            React.createElement("p", { className: "klein" },
                T.versie,
                " ",
                VERSIE),
            React.createElement("button", { className: "btn grijs", onClick: zoekUpdate }, "↻ " + T.updKnop))),
        setupTab === "tech" && (React.createElement("div", null,
            React.createElement(Veld, { label: T.naam, waarde: settings.techNaam, onChange: v => zetS({ techNaam: v }) }),
            React.createElement(Veld, { label: T.email, type: "email", waarde: settings.techEmail, onChange: v => zetS({ techEmail: v }) }),
            React.createElement(Veld, { label: T.pauzeStd, type: "number", waarde: settings.pauzeMin, onChange: v => zetS({ pauzeMin: v }) }),
            React.createElement("label", { className: "schakel" + (settings.groot ? " aan" : "") },
                React.createElement("input", { type: "checkbox", checked: !!settings.groot, onChange: e => zetS({ groot: e.target.checked }) }),
                React.createElement("span", { className: "schakelBol" }), T.grootLetters),
            React.createElement("button", { className: "btn grijs", onClick: () => setIntroOpen(true) }, T.uitleg),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.handtekening),
                React.createElement(Handtekening, { waarde: settings.techSig, T: T, hoogte: 150, onOk: d => zetS({ techSig: d }) })))),
        setupTab === "klanten" && (React.createElement("div", null,
            React.createElement("button", { className: "btn", onClick: () => setKEdit({ id: uid(), naam: "", straat: "", stad: "", emails: [], machines: [], nieuw: true }) },
                "+ ",
                T.nieuweKlant),
            klanten.length === 0 ? React.createElement("p", { className: "leegtekst" }, T.geenKlanten) : klanten.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map(k => (React.createElement("button", { key: k.id, className: "bonrij", onClick: () => setKEdit(JSON.parse(JSON.stringify(k))) },
                React.createElement("span", { className: "wie" },
                    k.naam,
                    React.createElement("small", null,
                        k.stad,
                        " \u00B7 ",
                        (k.machines || []).length,
                        " ",
                        (k.machines || []).length === 1 ? "machine" : T.machines.toLowerCase())),
                React.createElement("span", { className: "pijl" }, "\u203A")))))),
        setupTab === "bonnen" && (React.createElement("div", null,
            React.createElement(Veld, { label: T.van, type: "number", waarde: settings.nrVan, onChange: v => zetS({ nrVan: v }) }),
            React.createElement(Veld, { label: T.tot, type: "number", waarde: settings.nrTot, onChange: v => zetS({ nrTot: v }) }),
            React.createElement("p", { className: "klein" },
                T.volgendVrij,
                ": ",
                React.createElement("b", null, vrijNummer() === null ? "—" : vrijNummer())),
            React.createElement("button", { className: "btn grijs", onClick: () => setPopup("nummers") }, T.lijstNrs),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.bonTaalStd),
                React.createElement("div", { className: "taalrij" }, ["nl", "fr", "de", "cs"].map(t => (React.createElement("button", { key: t, className: "tog" + (settings.bonTaal === t ? " aan" : ""), onClick: () => zetS({ bonTaal: t }) }, VLAG[t]))))))),
        setupTab === "delen" && (React.createElement("div", null,
            React.createElement(Veld, { label: T.onedriveUrl, waarde: settings.oneDriveUrl, onChange: v => zetS({ oneDriveUrl: v }) }),
            React.createElement(Veld, { label: T.dienstEmail, type: "email", waarde: settings.dienstEmail, onChange: v => zetS({ dienstEmail: v }) }),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.dienstAan),
                React.createElement(JaNee, { waarde: settings.dienstEmailAan !== false, T: T, onChange: v => zetS({ dienstEmailAan: v !== false }) })),
            ["nl", "fr", "de", "cs"].map(t => (React.createElement("div", { key: t, className: "mailblok" },
                React.createElement("div", { className: "mailkop" },
                    VLAG[t],
                    " ",
                    TAALNAAM[t]),
                React.createElement(Veld, { label: T.onderwerp, waarde: settings.onderwerp[t], onChange: v => zetS({ onderwerp: Object.assign({}, settings.onderwerp, { [t]: v }) }) }),
                React.createElement(Veld, { label: T.mailTekst, multi: true, rows: 3, waarde: settings.mail[t], onChange: v => zetS({ mail: Object.assign({}, settings.mail, { [t]: v }) }) })))),
            React.createElement("div", { className: "rijtje" },
                React.createElement("button", { className: "btn grijs", onClick: () => bestandDownload(klanten, "klanten.json") }, T.klantExport),
                React.createElement("label", { className: "btn grijs bestand" },
                    T.klantImport,
                    React.createElement("input", { type: "file", accept: "application/json", style: { display: "none" }, onChange: e => leesBestand(e, importKlanten) }))),
            React.createElement("div", { className: "rijtje" },
                React.createElement("button", { className: "btn grijs", onClick: maakBackup }, T.backup),
                React.createElement("label", { className: "btn grijs bestand" },
                    T.herstel,
                    React.createElement("input", { type: "file", accept: "application/json", style: { display: "none" }, onChange: e => leesBestand(e, herstelBackup) })))))));
    /* ---------- popups ---------- */
    const [nk, setNk] = useState({ naam: "", straat: "", stad: "", email: "" });
    const [nm, setNm] = useState({ naam: "", merk: "", serienr: "" });
    const popups = (React.createElement("div", null,
        popup === "klantBewaren" && bon && React.createElement(Popup, { titel: T.kbTitel, onSluit: () => setPopup(null) },
            React.createElement("p", null, React.createElement("b", null, "\u201C" + bon.klantNaam.trim() + "\u201D"), " " + T.kbVraag),
            React.createElement("div", { className: "infoblok klein" },
                [bon.klantStraat, bon.klantStad].filter(Boolean).join(", ") || "\u2014",
                bonMachine() ? React.createElement("div", null, T.kbMet + ": " + [bon.machineNaam, bon.machineMerk, bon.machineSerie ? "SN " + bon.machineSerie : ""].filter(Boolean).join(" \u00B7 ")) : null),
            React.createElement("button", { className: "btn", onClick: () => {
                    const m = bonMachine();
                    const k = { id: uid(), naam: bon.klantNaam.trim(), straat: bon.klantStraat || "", stad: bon.klantStad || "", email: bon.email || "", emails: bon.email ? [bon.email] : [], machines: m ? [m] : [] };
                    setKlanten(l => l.concat([k]));
                    zetBon({ klantId: k.id });
                    setPopup(null); setMelding(T.kbOk); setStap(s => s + 1);
                } }, T.kbJa),
            React.createElement("button", { className: "btn grijs", onClick: () => { zetBon({ klantNietBewaren: true }); setPopup(null); setStap(s => s + 1); } }, T.kbNee)),
        popup === "klant" && (React.createElement(Popup, { titel: T.nieuweKlant, onSluit: () => setPopup(null) },
            React.createElement(Veld, { label: T.naam, waarde: nk.naam, onChange: v => setNk(Object.assign({}, nk, { naam: v })) }),
            React.createElement(Veld, { label: T.straat, waarde: nk.straat, onChange: v => setNk(Object.assign({}, nk, { straat: v })) }),
            React.createElement(Veld, { label: T.stad, waarde: nk.stad, onChange: v => setNk(Object.assign({}, nk, { stad: v })) }),
            React.createElement(Veld, { label: T.email, waarde: nk.email, onChange: v => setNk(Object.assign({}, nk, { email: v })) }),
            React.createElement("div", { className: "rijtje" },
                React.createElement("button", { className: "btn grijs", onClick: () => setPopup(null) }, T.annuleren),
                React.createElement("button", { className: "btn", onClick: () => {
                        if (!nk.naam)
                            return;
                        const k = Object.assign({ id: uid(), machines: [] }, nk, { emails: nk.email ? [nk.email] : [] });
                        setKlanten(l => l.concat([k]));
                        zetBon({ klantId: k.id, klantNaam: k.naam, klantStraat: k.straat, klantStad: k.stad, email: k.email, klantEmail: k.email || "" });
                        setNk({ naam: "", straat: "", stad: "", email: "" });
                        setPopup(null);
                    } }, T.opslaan)))),
        popup === "machine" && (React.createElement(Popup, { titel: T.nieuweMachine + (klant ? " · " + klant.naam : ""), onSluit: () => setPopup(null) },
            React.createElement(Veld, { label: T.naam, waarde: nm.naam, onChange: v => setNm(Object.assign({}, nm, { naam: v })) }),
            React.createElement(Veld, { label: T.merk, waarde: nm.merk, onChange: v => setNm(Object.assign({}, nm, { merk: v })) }),
            React.createElement(Veld, { label: T.serienr, waarde: nm.serienr, onChange: v => setNm(Object.assign({}, nm, { serienr: v })) }),
            React.createElement("div", { className: "rijtje" },
                React.createElement("button", { className: "btn grijs", onClick: () => setPopup(null) }, T.annuleren),
                React.createElement("button", { className: "btn", onClick: () => {
                        if (!nm.naam || !klant)
                            return;
                        const m = Object.assign({ id: uid() }, nm);
                        setKlanten(l => l.map(k => k.id === klant.id ? Object.assign({}, k, { machines: (k.machines || []).concat([m]) }) : k));
                        zetBon({ machineNaam: m.naam, machineMerk: m.merk, machineSerie: m.serienr });
                        setNm({ naam: "", merk: "", serienr: "" });
                        setPopup(null);
                    } }, T.opslaan)))),
        kEdit && (React.createElement(Popup, { titel: kEdit.nieuw ? T.nieuweKlant : T.bewerken2, onSluit: () => setKEdit(null) },
            React.createElement(Veld, { label: T.naam, waarde: kEdit.naam, onChange: v => setKEdit(Object.assign({}, kEdit, { naam: v })) }),
            React.createElement(Veld, { label: T.straat, waarde: kEdit.straat, onChange: v => setKEdit(Object.assign({}, kEdit, { straat: v })) }),
            React.createElement(Veld, { label: T.stad, waarde: kEdit.stad, onChange: v => setKEdit(Object.assign({}, kEdit, { stad: v })) }),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.email),
                (kEdit.emails || []).map((a, i) => (React.createElement("div", { key: i, className: "regelRij" },
                    React.createElement("input", { value: a, onChange: e => {
                            const kopie = (kEdit.emails || []).slice();
                            kopie[i] = e.target.value;
                            setKEdit(Object.assign({}, kEdit, { emails: kopie }));
                        } }),
                    React.createElement("button", { className: "wis", onClick: () => setKEdit(Object.assign({}, kEdit, { emails: kEdit.emails.filter((x, j) => j !== i) })) }, "\u00D7")))),
                React.createElement("button", { className: "btn grijs klein", onClick: () => setKEdit(Object.assign({}, kEdit, { emails: (kEdit.emails || []).concat([""]) })) },
                    "+ ",
                    T.nieuwEmail)),
            React.createElement("div", { className: "veld" },
                React.createElement("span", null, T.machines),
                (kEdit.machines || []).map((m, i) => {
                    const zetM = (veld, w) => {
                        const kopie = kEdit.machines.slice();
                        kopie[i] = Object.assign({}, kopie[i], { [veld]: w });
                        setKEdit(Object.assign({}, kEdit, { machines: kopie }));
                    };
                    return (React.createElement("div", { key: i, className: "machineKaart" },
                        React.createElement("div", { className: "regelRij" },
                            React.createElement("input", { placeholder: T.naam, value: m.naam || "", onChange: e => zetM("naam", e.target.value) }),
                            React.createElement("button", { className: "wis", onClick: () => setKEdit(Object.assign({}, kEdit, { machines: kEdit.machines.filter((x, j) => j !== i) })) }, "\u00D7")),
                        React.createElement("input", { placeholder: T.merk, value: m.merk || "", onChange: e => zetM("merk", e.target.value) }),
                        React.createElement("input", { placeholder: T.serienr, value: m.serienr || "", onChange: e => zetM("serienr", e.target.value) })));
                }),
                React.createElement("button", { className: "btn grijs klein", onClick: () => setKEdit(Object.assign({}, kEdit, { machines: (kEdit.machines || []).concat([{ id: uid(), naam: "", merk: "", serienr: "" }]) })) },
                    "+ ",
                    T.nieuweMachine)),
            React.createElement("div", { className: "rijtje" },
                React.createElement("button", { className: "btn grijs", onClick: () => setKEdit(null) }, T.annuleren),
                React.createElement("button", { className: "btn", onClick: () => {
                        if (!kEdit.naam)
                            return;
                        const schoon = Object.assign({}, kEdit, { emails: (kEdit.emails || []).filter(a => a), machines: (kEdit.machines || []).filter(m => m.naam) });
                        delete schoon.nieuw;
                        setKlanten(l => l.findIndex(x => x.id === schoon.id) < 0 ? l.concat([schoon]) : l.map(x => x.id === schoon.id ? schoon : x));
                        setKEdit(null);
                    } }, T.opslaan)),
            !kEdit.nieuw ? (React.createElement("button", { className: "btn rood", onClick: () => {
                    if (!window.confirm(T.klantVerwijderen))
                        return;
                    setKlanten(l => l.filter(x => x.id !== kEdit.id));
                    setKEdit(null);
                } }, T.klantVerwijderen.replace("?", ""))) : null)),
        popup === "nummers" && (React.createElement(Popup, { titel: T.gebruikteNrs, onSluit: () => setPopup(null) },
            React.createElement("div", { className: "nrlijst" }, gebruikt.length === 0 ? React.createElement("p", { className: "leegtekst" }, "\u2014") : gebruikt.slice().sort((a, b) => a - b).map(n => (React.createElement("div", { key: n, className: "nrrij" },
                React.createElement("span", null, n),
                React.createElement("button", { className: "btn klein", onClick: () => setGebruikt(g => g.filter(x => x !== n)) }, T.vrijgeven))))),
            React.createElement("button", { className: "btn", onClick: () => setPopup(null) }, T.sluiten)))));
    if (!ontgrendeld) {
        return (React.createElement("div", { className: "app slotScherm" },
            React.createElement("img", { className: "slotLogo", src: settings.logo || STD_LOGO, alt: "" }),
            React.createElement("h1", null, T.codeTitel),
            React.createElement("p", { className: "klein" }, T.codeVraag),
            React.createElement("input", { className: "slotVeld", type: "password", inputMode: "text", autoCapitalize: "off", autoCorrect: "off", value: codeIn, onChange: e => { setCodeIn(e.target.value); setCodeFout(false); } }),
            codeFout ? React.createElement("p", { className: "slotFout" }, T.codeFout) : null,
            React.createElement("button", { className: "btn groot", onClick: () => {
                    if (codeIn.trim() === APP_CODE) {
                        LS.set("toegang", APP_CODE);
                        setOntgrendeld(true);
                    }
                    else
                        setCodeFout(true);
                } }, T.codeKnop)));
    }
    const MENU = [["dash", "huis", T.dash, ["dash"]], ["taal", "plus", T.nieuw, ["taal", "wizard"]], ["lijst", "bon", T.bonnen, ["lijst", "acties", "preview", "tekenvol"]], ["uren", "klok", T.uren2, ["uren"]], ["setup", "instel", T.setup, ["setup"]]];
    const MOBMENU = [["dash", "huis", T.dash, ["dash"]], ["lijst", "bon", T.bonnen, ["lijst", "acties"]], ["taal", "plus", T.nieuwKort, []], ["uren", "klok", T.urenKort, ["uren"]], ["setup", "instel", T.setup, ["setup"]]];
    const metTabbalk = !desk && ["dash", "lijst", "uren", "setup", "acties"].indexOf(view) >= 0;
    const tabbalk = metTabbalk ? React.createElement("nav", { className: "tabbalk" + (settings.groot ? " groot" : "") }, MOBMENU.map(([v, ic, lbl, actief]) => React.createElement("button", { key: v, className: "tbItem" + (v === "taal" ? " nieuw" : "") + (actief.indexOf(view) >= 0 ? " aan" : ""), onClick: () => setView(v) },
        Ic(ic), React.createElement("span", null, lbl)))) : null;
    const zijbalk = desk ? React.createElement("aside", { className: "zijbalk" },
        React.createElement("div", { className: "zbMerk" }, React.createElement("img", { src: "icons/logo-mt.png", alt: "MT Service" }), React.createElement("span", null, "Werkbon")),
        React.createElement("nav", null, MENU.map(([v, ic, lbl, actief]) => React.createElement("button", { key: v, className: "zbItem" + (actief.indexOf(view) >= 0 ? " aan" : ""), onClick: () => setView(v) },
            Ic(ic, "zbIc"), lbl))),
        React.createElement("div", { className: "zbOnder" },
            taalKeuze,
            React.createElement("div", { className: "zbNet" + (online ? " aan" : "") }, React.createElement("i", null), online ? "Online" : "Offline"),
            React.createElement("button", { className: "zbUpd", onClick: zoekUpdate }, Ic("update"), "v" + VERSIE + " · " + T.updKnop))) : null;
    return (React.createElement("div", { className: desk ? "desk" : "" }, zijbalk, React.createElement("div", { className: "app v-" + view + (metTabbalk ? " metTabbalk" : "") + (settings.groot ? " groot" : ""), ref: top },
        introOpen ? React.createElement(Intro, { T, onKlaar: () => { LS.set("introGezien", true); setIntroOpen(false); } }) : null,
        !online ? React.createElement("div", { className: "netbalk" }, T.offline) : null,
        view === "dash" && dashboard,
        view === "lijst" && lijst,
        view === "taal" && taalkeuze,
        view === "wizard" && bon && wizard,
        view === "preview" && preview,
        view === "tekenvol" && tekenVol,
        view === "acties" && acties,
        view === "setup" && setup,
        view === "uren" && window.UrenModule ? React.createElement(window.UrenModule, { onTerug: () => setView("dash"), bonnen, klanten, settings, setMelding, setBezig }) : null,
        popups,
        melding ? React.createElement("div", { className: "toast" }, melding) : null,
        bezig ? React.createElement("div", { className: "overlay bezig" },
            React.createElement("div", { className: "popup" }, bezig)) : null), tabbalk));
}
window.startApp = function () {
    ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
};
/* toetsenbord open = tekstveld actief: onderste balk verbergen, anders duwt iOS hem mee omhoog */
const isTypveld = el => el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|file|range|color)$/i.test(el.type)) || el.isContentEditable);
document.addEventListener("focusin", e => { if (isTypveld(e.target)) document.body.classList.add("typen"); });
document.addEventListener("focusout", () => setTimeout(() => { if (!isTypveld(document.activeElement)) document.body.classList.remove("typen"); }, 50));

