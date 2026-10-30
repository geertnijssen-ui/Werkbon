/* Werkbon MT Service: herbruikbare schermonderdelen (foto, logo, handtekening, vertaler, inspreken, popups) */
/* ---------- foto's ---------- */
function verkleinFoto(file, max) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > max || h > max) {
                    const f = max / Math.max(w, h);
                    w = Math.round(w * f);
                    h = Math.round(h * f);
                }
                const c = document.createElement("canvas");
                c.width = w;
                c.height = h;
                c.getContext("2d").drawImage(img, 0, 0, w, h);
                res(c.toDataURL("image/jpeg", 0.7));
            };
            img.onerror = rej;
            img.src = r.result;
        };
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}
/* ---------- logo ---------- */
function logoNaarPng(file) {
    return new Promise((res, rej) => {
        const teken = (bron) => {
            const img = new Image();
            img.onload = () => {
                const max = 640;
                const bw = img.width || 640, bh = img.height || 384;
                const f = Math.min(max / bw, max / bh, 6);
                const c = document.createElement("canvas");
                c.width = Math.max(1, Math.round(bw * f));
                c.height = Math.max(1, Math.round(bh * f));
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL("image/png"));
            };
            img.onerror = () => rej(new Error("logo"));
            img.src = bron;
        };
        const r = new FileReader();
        r.onerror = rej;
        if (file.type === "image/svg+xml") {
            r.onload = () => {
                let tekst = String(r.result);
                if (tekst.indexOf("width=") < 0) {
                    let bw = 640, bh = 384;
                    const vb = tekst.match(/viewBox="([-\d.\s]+)"/);
                    if (vb) {
                        const d = vb[1].trim().split(/\s+/).map(Number);
                        if (d.length === 4 && d[2] && d[3]) {
                            bw = d[2] * 4;
                            bh = d[3] * 4;
                        }
                    }
                    tekst = tekst.replace("<svg", '<svg width="' + Math.round(bw) + '" height="' + Math.round(bh) + '"');
                }
                teken("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(tekst))));
            };
            r.readAsText(file);
        }
        else {
            r.onload = () => teken(r.result);
            r.readAsDataURL(file);
        }
    });
}
/* ---------- handtekening ---------- */
function Handtekening(props) {
    const { waarde, onOk, hoogte, T } = props;
    const canvasRef = useRef(null);
    const [vast, setVast] = useState(!!waarde);
    const [leeg, setLeeg] = useState(!waarde);
    const bezig = useRef(false);
    useEffect(() => {
        const c = canvasRef.current;
        if (!c)
            return;
        const rect = c.getBoundingClientRect();
        c.width = Math.max(300, Math.round(rect.width));
        c.height = hoogte;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        if (waarde) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
            img.src = waarde;
        }
    }, [hoogte, waarde]);
    useEffect(() => {
        const c = canvasRef.current;
        if (!c)
            return;
        const punt = (ev) => {
            const r = c.getBoundingClientRect();
            const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
            return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
        };
        const start = (ev) => {
            if (vast)
                return;
            ev.preventDefault();
            bezig.current = true;
            const ctx = c.getContext("2d");
            const p = punt(ev);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
        };
        const beweeg = (ev) => {
            if (!bezig.current || vast)
                return;
            ev.preventDefault();
            const ctx = c.getContext("2d");
            const p = punt(ev);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            if (leeg)
                setLeeg(false);
        };
        const stop = () => { bezig.current = false; };
        c.addEventListener("touchstart", start, { passive: false });
        c.addEventListener("touchmove", beweeg, { passive: false });
        c.addEventListener("touchend", stop, { passive: false });
        c.addEventListener("mousedown", start);
        c.addEventListener("mousemove", beweeg);
        window.addEventListener("mouseup", stop);
        return () => {
            c.removeEventListener("touchstart", start);
            c.removeEventListener("touchmove", beweeg);
            c.removeEventListener("touchend", stop);
            c.removeEventListener("mousedown", start);
            c.removeEventListener("mousemove", beweeg);
            window.removeEventListener("mouseup", stop);
        };
    }, [vast, leeg]);
    const wis = () => {
        const c = canvasRef.current;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        setVast(false);
        setLeeg(true);
        onOk("");
    };
    const ok = () => {
        if (leeg)
            return;
        setVast(true);
        onOk(canvasRef.current.toDataURL("image/png"));
    };
    return (React.createElement("div", null,
        React.createElement("canvas", { ref: canvasRef, className: "sigCanvas" + (vast ? " vast" : ""), style: { height: hoogte + "px" } }),
        React.createElement("div", { className: "sigBtns" },
            React.createElement("button", { className: "btn klein grijs", onClick: wis }, T.wissen),
            vast ? React.createElement("span", { className: "vastTag" },
                "\u2713 ",
                T.vast)
                : React.createElement("button", { className: "btn klein", onClick: ok, disabled: leeg }, "\u2713 OK"))));
}
/* ---------- tekenen over het volledige scherm ---------- */
function TekenVol(props) {
    const { waarde, onKlaar, onTerug, L } = props;
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const bezig = useRef(false);
    const bewaard = useRef(waarde || "");
    const [maten, setMaten] = useState(() => {
        const draai = window.innerWidth < window.innerHeight;
        return { draai: draai, w: draai ? window.innerHeight : window.innerWidth, h: draai ? window.innerWidth : window.innerHeight };
    });
    const [leeg, setLeeg] = useState(!waarde);
    useEffect(() => {
        const meet = () => {
            const c = canvasRef.current;
            if (c) {
                try {
                    bewaard.current = c.toDataURL("image/png");
                }
                catch (e) { }
            }
            const draai = window.innerWidth < window.innerHeight;
            setMaten({ draai: draai, w: draai ? window.innerHeight : window.innerWidth, h: draai ? window.innerWidth : window.innerHeight });
        };
        window.addEventListener("resize", meet);
        window.addEventListener("orientationchange", () => setTimeout(meet, 300));
        return () => window.removeEventListener("resize", meet);
    }, []);
    useEffect(() => {
        const c = canvasRef.current;
        if (!c)
            return;
        c.width = maten.w;
        c.height = maten.h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        if (bewaard.current) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
            img.src = bewaard.current;
        }
    }, [maten]);
    useEffect(() => {
        const c = canvasRef.current;
        if (!c)
            return;
        const punt = (ev) => {
            const r = wrapRef.current.getBoundingClientRect();
            const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
            if (maten.draai)
                return { x: t.clientY - r.top, y: maten.h - (t.clientX - r.left) };
            return { x: t.clientX - r.left, y: t.clientY - r.top };
        };
        const start = (ev) => { ev.preventDefault(); bezig.current = true; const ctx = c.getContext("2d"); const p = punt(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const beweeg = (ev) => { if (!bezig.current)
            return; ev.preventDefault(); const ctx = c.getContext("2d"); const p = punt(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); if (leeg)
            setLeeg(false); };
        const stop = () => { bezig.current = false; };
        c.addEventListener("touchstart", start, { passive: false });
        c.addEventListener("touchmove", beweeg, { passive: false });
        c.addEventListener("touchend", stop, { passive: false });
        c.addEventListener("mousedown", start);
        c.addEventListener("mousemove", beweeg);
        window.addEventListener("mouseup", stop);
        return () => {
            c.removeEventListener("touchstart", start);
            c.removeEventListener("touchmove", beweeg);
            c.removeEventListener("touchend", stop);
            c.removeEventListener("mousedown", start);
            c.removeEventListener("mousemove", beweeg);
            window.removeEventListener("mouseup", stop);
        };
    }, [maten, leeg]);
    const wis = () => {
        const c = canvasRef.current;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111";
        bewaard.current = "";
        setLeeg(true);
    };
    return (React.createElement("div", { className: "tekenVol" },
        React.createElement("div", { ref: wrapRef, className: "tekenWrap", style: { width: maten.w + "px", height: maten.h + "px", transform: "translate(-50%,-50%)" + (maten.draai ? " rotate(90deg)" : "") } },
            React.createElement("canvas", { ref: canvasRef, className: "tekenCanvas" }),
            React.createElement("button", { className: "tvBtn tvTerug", onClick: onTerug }, "\u2039"),
            React.createElement("button", { className: "tvBtn tvWis", onClick: wis }, "\u2715"),
            React.createElement("button", { className: "tvBtn tvKlaar", disabled: leeg, onClick: () => onKlaar(canvasRef.current.toDataURL("image/png")) },
                L.pKlaar,
                " \u2713"),
            leeg ? React.createElement("span", { className: "tvHint" }, L.pHint) : null)));
}
/* ---------- bon-weergave ---------- */
function BonReplica(props) {
    const { bon, settings } = props;
    const houder = useRef(null);
    const [schaal, setSchaal] = useState(1);
    const sleutel = JSON.stringify([
        bon.nr, bon.taal, bon.tech1, bon.tech2, bon.contractnr, bon.klantNaam, bon.klantStraat, bon.klantStad,
        bon.bestelnr, bon.contact, bon.machineNaam, bon.machineMerk, bon.machineSerie, bon.beschrijving,
        bon.opmerkingen, bon.dagen, bon.matBestelJa, bon.matBestelTxt, bon.matGelevJa, bon.matGelevTxt,
        bon.beeindigd, bon.klantTekenNaam, bon.klantEmail, bon.klantSig ? 1 : 0, (bon.fotos || []).length,
        settings.techSig ? 1 : 0, settings.adres, settings.website, settings.logo ? 1 : 0
    ]);
    const html = useMemo(() => buildPdfHtml(bon, settings), [sleutel]);
    useEffect(() => {
        const meet = () => {
            if (!houder.current)
                return;
            const b = houder.current.clientWidth;
            setSchaal(Math.min(1, b / 741));
        };
        meet();
        let ro = null;
        if (window.ResizeObserver && houder.current) {
            ro = new ResizeObserver(meet);
            ro.observe(houder.current);
        }
        const draai = () => setTimeout(meet, 250);
        window.addEventListener("orientationchange", draai);
        window.addEventListener("resize", meet);
        return () => { if (ro)
            ro.disconnect(); window.removeEventListener("orientationchange", draai); window.removeEventListener("resize", meet); };
    }, []);
    return (React.createElement("div", { ref: houder, className: "replicaHouder" },
        React.createElement("div", { style: { width: 741 * schaal + "px", height: (1069 * schaal * (html.split('class="page"').length - 1)) + "px", overflow: "hidden" } },
            React.createElement("div", { style: { transform: "scale(" + schaal + ")", transformOrigin: "top left", width: "741px" }, dangerouslySetInnerHTML: { __html: html } }))));
}
/* ---------- kleine bouwstenen ---------- */
/* lijn-iconen (24x24, stijl zoals Lucide); "c:x,y,r" is een cirkel */
const ICONEN = {
    huis: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"],
    plus: ["M12 5v14", "M5 12h14"],
    bon: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h6"],
    klok: ["c:12,12,9", "M12 7v5l3 2"],
    instel: ["M4 7h9", "M17 7h3", "c:15,7,2", "M4 17h3", "M11 17h9", "c:9,17,2"],
    globe: ["c:12,12,9", "M3 12h18", "M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"],
    update: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"],
    terug: ["m15 18-6-6 6-6"],
    verder: ["m9 18 6-6-6-6"],
    pijl: ["M7 17 17 7", "M8 7h9v9"],
    mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M19 11a7 7 0 0 1-14 0", "M12 18v3"],
    camera: ["M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z", "c:12,13,4"],
    kopie: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
    zoek: ["c:11,11,7", "m20 20-3.5-3.5"],
    filter: ["M3 5h18l-7 8v6l-4-2v-4z"],
    verzend: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
    agenda: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"]
};
window.Ic = Ic;
function Ic(naam, cls) {
    return React.createElement("svg", { className: "ic" + (cls ? " " + cls : ""), viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
        (ICONEN[naam] || []).map((d, i) => d.indexOf("c:") === 0
            ? React.createElement("circle", { key: i, cx: d.slice(2).split(",")[0], cy: d.slice(2).split(",")[1], r: d.slice(2).split(",")[2] })
            : React.createElement("path", { key: i, d })));
}
function Veld(props) {
    return (React.createElement("label", { className: "veld" },
        React.createElement("span", null, props.label),
        props.multi
            ? React.createElement("textarea", { rows: props.rows || 6, value: props.waarde || "", disabled: props.uit, onChange: e => props.onChange(e.target.value), placeholder: props.plh || "" })
            : React.createElement("input", { type: props.type || "text", value: props.waarde || "", disabled: props.uit, onChange: e => props.onChange(e.target.value), placeholder: props.plh || "" })));
}
/* ---------- vertaler (gratis MyMemory-dienst, vraagt netwerk) ---------- */
function vertaalStukken(regel) {
    /* MyMemory aanvaardt max. 500 bytes per vraag: lange regels per zin opdelen */
    if (new Blob([regel]).size <= 450) return [regel];
    const uit = []; let buf = "";
    (regel.match(/[^.!?]+[.!?]*\s*/g) || [regel]).forEach(z => {
        if (buf && new Blob([buf + z]).size > 450) { uit.push(buf); buf = ""; }
        buf += z;
    });
    if (buf) uit.push(buf);
    return uit;
}
async function vertaal(tekst, van, naar, email) {
    /* eerst DeepL via de eigen Netlify-functie (technische woorden), anders de gratis MyMemory-dienst */
    try {
        const regelsIn = tekst.split("\n");
        const teVertalen = regelsIn.filter(r => r.trim());
        const r = await fetch("/.netlify/functions/vertaal", { method: "POST", headers: { "Content-Type": "application/json", "x-app": "werkbon-mt" }, body: JSON.stringify({ teksten: teVertalen, van, naar }) });
        if (r.status === 429) throw new Error("limiet");
        if (r.ok) {
            const j = await r.json();
            let i = 0;
            return regelsIn.map(rg => rg.trim() ? j.vertaald[i++] : rg).join("\n");
        }
    } catch (e) {
        if (e.message === "limiet") throw e;
    }
    return vertaalMyMemory(tekst, van, naar, email);
}
async function vertaalMyMemory(tekst, van, naar, email) {
    const ontleed = s => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
    const regels = [];
    for (const regel of tekst.split("\n")) {
        if (!regel.trim()) { regels.push(regel); continue; }
        const delen = [];
        for (const st of vertaalStukken(regel)) {
            const u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(st) + "&langpair=" + van + "|" + naar + (email ? "&de=" + encodeURIComponent(email) : "");
            const j = await (await fetch(u)).json();
            const v = j && j.responseData && j.responseData.translatedText;
            if (j && (j.responseStatus == 429 || (v && /MYMEMORY WARNING/.test(v)))) throw new Error("limiet");
            if (!v || (j.responseStatus && j.responseStatus != 200)) throw new Error("fout");
            delen.push(ontleed(v).trim());
        }
        regels.push(delen.join(" "));
    }
    return regels.join("\n");
}
function Vertaler(props) {
    const { T, tekst, onZet, setMelding, email } = props;
    const [van, setVan] = React.useState(props.van || "nl");
    const [orig, setOrig] = React.useState(null);
    const [bezig, setBezig] = React.useState("");
    const doe = async naar => {
        if (!tekst || !tekst.trim()) { setMelding(T.vertaalLeeg); return; }
        if (naar === van) return;
        if (!navigator.onLine) { setMelding(T.vertaalNet); return; }
        setBezig(naar);
        try {
            const v = await vertaal(tekst, van, naar, email);
            setOrig({ tekst, van });
            onZet(v);
            setVan(naar);
        } catch (e) {
            setMelding(e.message === "limiet" ? T.vertaalLimiet : navigator.onLine ? T.vertaalFout : T.vertaalNet);
        }
        setBezig("");
    };
    return React.createElement("div", { className: "vertaler" },
        React.createElement("span", null, T.vertaalNaar),
        ["nl", "fr", "de", "cs"].filter(t => t !== van).map(t => React.createElement("button", { key: t, type: "button", className: "tog", disabled: !!bezig, onClick: () => doe(t) }, bezig === t ? T.vertaalBezig : VLAG[t] + " " + t.toUpperCase())),
        React.createElement("span", { className: "klein" }, T.vertaalVan),
        React.createElement("select", { value: van, onChange: e => setVan(e.target.value) }, ["nl", "fr", "de", "cs"].map(t => React.createElement("option", { key: t, value: t }, VLAG[t] + " " + t.toUpperCase()))),
        orig ? React.createElement("button", { type: "button", className: "tog", onClick: () => { onZet(orig.tekst); setVan(orig.van); setOrig(null); } }, "↶ " + T.ongedaan) : null);
}
/* ---------- hulpmiddelen voor wie niet graag typt ---------- */
function nuTijd() { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
window.nuTijd = nuTijd;
/* tijd per kwartier: uur- en minutenlijst (iPhone negeert "step" op een tijdveld) */
function kwartierNu() {
    const d = new Date(); let m = Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
    if (m >= 24 * 60) m = 24 * 60 - 15;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function TijdNu(props) {
    const w = /^\d{1,2}:\d{2}$/.test(props.waarde || "") ? props.waarde.padStart(5, "0") : "";
    const uur = w ? w.slice(0, 2) : "", min = w ? w.slice(3, 5) : "";
    const minuten = ["00", "15", "30", "45"];
    if (min && minuten.indexOf(min) < 0) minuten.push(min); /* oude bon met bv. 08:05 blijft zichtbaar */
    const zet = (u, m) => props.onChange(u === "" ? "" : u + ":" + (m || "00"));
    return React.createElement("div", { className: "tijdrij kwartier" },
        React.createElement("select", { value: uur, "aria-label": "Uur", onChange: e => zet(e.target.value, min) },
            React.createElement("option", { value: "" }, "--"),
            Array.from({ length: 24 }, (x, i) => String(i).padStart(2, "0")).map(u => React.createElement("option", { key: u, value: u }, u))),
        React.createElement("span", { className: "dubbelp" }, ":"),
        React.createElement("select", { value: min, "aria-label": "Minuten", disabled: !uur, onChange: e => zet(uur, e.target.value) },
            !uur ? React.createElement("option", { value: "" }, "--") : null,
            minuten.map(m => React.createElement("option", { key: m, value: m }, m))),
        React.createElement("button", { type: "button", className: "nuknop", onClick: () => props.onChange(kwartierNu()) }, props.T.nu));
}
/* inspreken via de spraakherkenning van de browser (Safari/Chrome) */
function Dicteer(props) {
    const { T, taal, onTekst, setMelding } = props;
    const [aan, setAan] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => () => { try { ref.current && ref.current.stop(); } catch (e) { } }, []);
    const start = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { setMelding(T.dicteerNiet); return; }
        try {
            const r = new SR();
            r.lang = { nl: "nl-BE", fr: "fr-BE", de: "de-DE", en: "en-GB", cs: "cs-CZ" }[taal] || "nl-BE";
            r.continuous = true; r.interimResults = false;
            r.onresult = e => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript; if (t.trim()) onTekst(t.trim()); };
            r.onerror = e => { setAan(false); if (e.error === "not-allowed" || e.error === "service-not-allowed") setMelding(T.dicteerToestemming); };
            r.onend = () => setAan(false);
            r.start(); ref.current = r; setAan(true);
        } catch (e) { setMelding(T.dicteerNiet); }
    };
    const stop = () => { try { ref.current && ref.current.stop(); } catch (e) { } setAan(false); };
    return React.createElement("button", { type: "button", className: "btn grijs dicteer" + (aan ? " aan" : ""), onClick: aan ? stop : start }, Ic("mic"), aan ? T.dicteerStop : T.dicteer);
}
/* korte uitleg bij de eerste start */
function Intro(props) {
    const { T, onKlaar } = props;
    const [i, setI] = React.useState(0);
    const st = [[T.intro1t, T.intro1, "bon"], [T.intro2t, T.intro2, "plus"], [T.intro3t, T.intro3, "verzend"]];
    return React.createElement("div", { className: "overlay intro" },
        React.createElement("div", { className: "introkaart" },
            i === 0 ? React.createElement("img", { className: "introlog", src: "icons/logo-mt.png", alt: "MT Service" }) : React.createElement("div", { className: "introIc" }, Ic(st[i][2])),
            React.createElement("h3", null, st[i][0]),
            React.createElement("p", null, st[i][1]),
            React.createElement("div", { className: "introbollen" }, st.map((x, j) => React.createElement("span", { key: j, className: j === i ? "aan" : "" }))),
            React.createElement("button", { className: "btn groot", onClick: () => i < st.length - 1 ? setI(i + 1) : onKlaar() }, i < st.length - 1 ? T.volgende : T.klaar),
            i < st.length - 1 ? React.createElement("button", { className: "linkknop", onClick: onKlaar }, T.overslaan) : null));
}
function Popup(props) {
    return (React.createElement("div", { className: "overlay", onClick: props.onSluit },
        React.createElement("div", { className: "popup", onClick: e => e.stopPropagation() },
            React.createElement("h3", null, props.titel),
            props.children)));
}
function JaNee(props) {
    const { waarde, onChange, T } = props;
    return (React.createElement("div", { className: "janee" },
        React.createElement("button", { className: "tog" + (waarde === true ? " aan" : ""), onClick: () => onChange(waarde === true ? null : true) }, T.ja),
        React.createElement("button", { className: "tog" + (waarde === false ? " aan" : ""), onClick: () => onChange(waarde === false ? null : false) }, T.nee)));
}
