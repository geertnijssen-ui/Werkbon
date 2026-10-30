/* Werkbon MT Service: urenberekening, zelfde logica als het Excel-blad "Input" (CDB). */
(function (root) {
    const DAGCODES = { V: "Verlof", C: "Congé", Z: "Ziekteverlof", M: "Arrêt maladie", R: "Recup", F: "Feestdag/Jour férier" };

    const STD_PARAMS = {
        /* index 1 = maandag ... 5 = vrijdag; weekend heeft geen normaal rooster */
        rooster: {
            1: { uren: 8, reisHeen: 45, pauze: 30, reisTerug: 45, vertrekThuis: "07:15", aankomstKlant: "08:00", vertrekKlant: "16:30", thuis: "17:15" },
            2: { uren: 8, reisHeen: 45, pauze: 30, reisTerug: 45, vertrekThuis: "07:15", aankomstKlant: "08:00", vertrekKlant: "16:30", thuis: "17:15" },
            3: { uren: 8, reisHeen: 45, pauze: 30, reisTerug: 45, vertrekThuis: "07:15", aankomstKlant: "08:00", vertrekKlant: "16:30", thuis: "17:15" },
            4: { uren: 8, reisHeen: 45, pauze: 30, reisTerug: 45, vertrekThuis: "07:15", aankomstKlant: "08:00", vertrekKlant: "16:30", thuis: "17:15" },
            5: { uren: 7, reisHeen: 45, pauze: 30, reisTerug: 45, vertrekThuis: "07:15", aankomstKlant: "08:00", vertrekKlant: "15:30", thuis: "16:15" }
        },
        dagvergoeding: 18,
        dubbelVanafWeg: "12:45",
        dubbelThuisNa: "",
        carwash: 15, carwashTonen: false,
        kledij: 35, kledijModus: 0,
        kmVergoeding: 0,
        recupEuroPerUur: 25
    };

    const STD_JAAR = { jaar: new Date().getFullYear(), overdrachtVerlof: 0, verlofdagen: 26, overdrachtRecup: 0 };

    /* "07:45" -> 7.75 */
    function uurNaarDec(t) {
        if (t === undefined || t === null || t === "") return null;
        const m = String(t).match(/^(\d{1,2})[:.,h](\d{2})$/) || String(t).match(/^(\d{1,2})$/);
        if (!m) return null;
        /* zelfde afronding als Excel: INT(u,mm)+(u,mm-INT(u,mm))/0,6 */
        const umm = Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
        return Math.trunc(umm) + (umm - Math.trunc(umm)) / 0.6;
    }
    /* 7.75 -> "7.45" zoals in Excel (u,min) */
    function decNaarUmin(d) {
        if (d === null || d === undefined || d === "") return "";
        const neg = d < 0; d = Math.abs(d);
        let u = Math.floor(d + 1e-9), m = Math.round((d - u) * 60);
        if (m === 60) { u += 1; m = 0; }
        return (neg ? "-" : "") + u + "." + String(m).padStart(2, "0");
    }
    const r2 = x => Math.round(x * 100) / 100;

    function isoWeekdag(datum) { const d = new Date(datum + "T12:00:00"); return ((d.getDay() + 6) % 7) + 1; }

    function normaal(params, datum) {
        const wd = isoWeekdag(datum);
        const p = params.rooster[wd];
        if (!p || wd > 5) return { AB: 0, AC: 0, AD: 0, AE: 0, AF: 0, AG: 0, AH: 0, uren: 0 };
        return {
            AB: uurNaarDec(p.vertrekThuis) || 0, AC: (Number(p.reisHeen) || 0) / 60, AD: uurNaarDec(p.aankomstKlant) || 0,
            AE: (Number(p.pauze) || 0) / 60, AF: uurNaarDec(p.vertrekKlant) || 0, AG: (Number(p.reisTerug) || 0) / 60,
            AH: uurNaarDec(p.thuis) || 0, uren: Number(p.uren) || 0
        };
    }

    function heeftEigenPauze(dag) { return !!dag && dag.pauzeMin !== undefined && dag.pauzeMin !== null && dag.pauzeMin !== "" && !isNaN(Number(dag.pauzeMin)); }
    function isGewerkt(dag) { return !!dag && dag.soort === "werk"; }
    function heeftInhoud(dag) { return !!dag && (dag.soort && dag.soort !== "werk" || !!(dag.klant && String(dag.klant).trim())); }

    /* Berekening van één dag. Geeft de waarden van de kolommen K, L, M en de dagvergoeding. */
    function berekenDag(dag, datum, params) {
        const res = { recup: null, reisExtra: null, werkExtra: null, vergoeding: null, dubbel: false, km: null, reistijd: null, snelheid: null, wegVanHuis: null };
        if (!heeftInhoud(dag)) return res;
        const n = normaal(params, datum);
        const code = dag.soort !== "werk" ? dag.soort : "";
        const BQ = ["V", "C", "Z", "M", "R", "F"].indexOf(code) >= 0 ? 1 : 0;
        const R = code === "R";
        const D = true;
        const hotel = !!dag.hotel && !BQ;
        /* eigen pauze in minuten (sinds 1.18) vervangt de keuze normaal / geen pauze */
        const eigen = heeftEigenPauze(dag);
        const X = eigen ? Number(dag.pauzeMin) / 60 : n.AE;
        const pz = eigen ? "normaal" : (dag.pauze || "normaal");
        const P = !hotel && pz === "p", PT = !hotel && pz === "pt", HP = hotel && pz === "p", HPT = hotel && pz === "pt";
        const H = hotel && pz === "normaal";
        const AJ = BQ ? 0 : (uurNaarDec(dag.vertrekThuis) || 0);
        const AK = BQ ? 0 : (uurNaarDec(dag.aankomstKlant) || 0);
        const AL = BQ ? 0 : (uurNaarDec(dag.vertrekKlant) || 0);
        const AM = BQ ? 0 : (uurNaarDec(dag.aankomstThuis) || 0);

        const AQ = D && !BQ && AK > 12;
        const AS = D && !BQ && (AK - AJ) > n.AC;
        const AT = AS ? (AQ ? AK - AJ - n.AC - X : AK - AJ - n.AC) : 0;
        const AU = AL <= 12 && AL > 0, AV = AM <= 12 && AM > 0, AX = (AM - AL) > n.AG;
        let AY = 0;
        if (AX) {
            if (AU && AV) AY = AM - AL - n.AG;
            else if (AU && !AV) AY = AM - AL - n.AG - X;
            else if (!AU && !AV) AY = AM - AL - n.AG;
        }
        const AZ = (!PT && !HPT) ? r2(AT + AY) : r2(AT + AY) + n.AE;
        const BC = D && !BQ && AK < 12, BD = AU;
        let BE;
        if (BC && BD) BE = AL - AK;
        else if (BC && !BD) BE = AL - AK - X;
        else BE = AL - AK;
        const norm = n.AF - n.AD - n.AE;
        let BF;
        if (R) BF = -norm;
        else if (BQ) BF = 0;
        else if (!P && !HP) BF = r2(BE - norm);
        else BF = r2(BE - norm) + n.AE;
        const BG = R ? -norm : r2(AZ + BF);

        res.recup = R ? BG : (AL === 0 ? null : BG);
        res.werkExtra = R ? BG : (AL === 0 ? null : BF);
        res.reisExtra = AZ > 0 ? AZ : null;

        /* dagvergoeding (CDB kolom H) */
        const klantNaam = String(dag.klant || "").trim().toLowerCase();
        const geenVergoeding = ["tijdskrediet", "crédit temps", "ouderschapsverlof", "congé parental"].indexOf(klantNaam) >= 0;
        const dubbelWeg = uurNaarDec(params.dubbelVanafWeg);
        const dubbelThuis = uurNaarDec(params.dubbelThuisNa);
        if (hotel || geenVergoeding) res.vergoeding = null;
        else if (BQ) res.vergoeding = 0;
        else {
            const weg = AM - AJ;
            const laat = dubbelThuis !== null && dubbelThuis < 24 && AM >= dubbelThuis;
            const lang = dubbelWeg !== null && dubbelWeg < 24 && weg >= dubbelWeg;
            res.dubbel = laat || lang;
            res.vergoeding = (Number(params.dagvergoeding) || 0) * (res.dubbel ? 2 : 1);
        }
        if (!BQ) {
            const ks = Number(dag.kmStart), ke = Number(dag.kmEind);
            if (dag.kmStart !== "" && dag.kmEind !== "" && !isNaN(ks) && !isNaN(ke) && ke - ks !== 0) {
                res.km = ke - ks;
                res.reistijd = (AK - AJ) + (AM - AL);
                res.snelheid = res.reistijd ? res.km / res.reistijd : null;
            }
            if (AJ && AM) res.wegVanHuis = AM - AJ;
        }
        res.H = H; res.P = P; res.PT = PT; res.HP = HP; res.HPT = HPT; res.hotel = hotel; res.code = code;
        return res;
    }

    /* Omschrijving zoals op de CDB- en Prest-pagina */
    function label(dag, blad) {
        if (!heeftInhoud(dag)) return "";
        const opm = String(dag.opm || "").trim();
        const met = (basis) => opm ? basis + " (" + opm + ")" : basis;
        switch (dag.soort) {
            case "V": return met("Verlof");
            case "C": return met("Congé");
            case "Z": return "Ziekteverlof";
            case "M": return "Arrêt maladie";
            case "R": return blad === "prest" ? met("Recup") : "Recup";
            case "F": return opm ? opm : "Feestdag/Jour férier";
        }
        const k = String(dag.klant || "").trim();
        const pz = heeftEigenPauze(dag) ? Number(dag.pauzeMin) + "p" : dag.pauze || "normaal";
        if (blad === "cdb") return dag.hotel ? k + " (H)" : k;
        const extra = pz === "p" ? "0p" : pz === "pt" ? "0pT" : pz === "normaal" ? "" : pz;
        if (dag.hotel) return k + " (H" + (extra ? " " + extra : "") + ")";
        return k + (extra ? " (" + extra + ")" : "");
    }

    function pad(n) { return String(n).padStart(2, "0"); }
    function isoDatum(j, m, d) { return j + "-" + pad(m) + "-" + pad(d); }
    function dagenInMaand(j, m) { return new Date(j, m, 0).getDate(); }
    /* Excel WEEKNUM(datum;1): week begint op zondag, 1 januari zit in week 1 */
    function weeknum(datum) {
        const d = new Date(datum + "T12:00:00");
        const jan1 = new Date(d.getFullYear(), 0, 1, 12);
        const doy = Math.round((d - jan1) / 86400000);
        return Math.floor((doy + jan1.getDay()) / 7) + 1;
    }

    function isVerlof(dag) { return !!dag && (dag.soort === "V" || dag.soort === "C"); }

    /* Alles voor één maand, inclusief overdrachten uit de vorige maanden van het jaar */
    function maand(dagen, j, m, params, jaarP) {
        const rijen = [];
        const tot = { recup: 0, reisExtra: 0, werkExtra: 0, verlof: 0, recupDagen: 0, km: 0, reistijd: 0, vergoeding: 0, kmVergoeding: 0, gewerkteDagen: 0, weekdagen: 0, maxKm: null };
        for (let d = 1; d <= dagenInMaand(j, m); d++) {
            const datum = isoDatum(j, m, d);
            const dag = dagen[datum] || null;
            const b = berekenDag(dag, datum, params);
            const wd = isoWeekdag(datum);
            rijen.push({ datum, dag, b, wd });
            if (b.recup !== null) tot.recup += b.recup;
            if (b.reisExtra !== null && b.reisExtra > 0) tot.reisExtra += b.reisExtra;
            if (b.werkExtra !== null) tot.werkExtra += b.werkExtra;
            if (isVerlof(dag)) tot.verlof++;
            if (dag && dag.soort === "R") tot.recupDagen++;
            if (b.km) { tot.km += b.km; tot.reistijd += b.reistijd || 0; }
            if (b.vergoeding) tot.vergoeding += b.vergoeding;
            if (wd <= 5) tot.weekdagen++;
            if (wd <= 5 && !(dag && ["V", "C", "Z", "M", "R", "F"].indexOf(dag.soort) >= 0)) tot.gewerkteDagen++;
            if (dag && !["V", "C", "Z", "M", "R", "F"].includes(dag.soort)) {
                [dag.kmStart, dag.kmEind].forEach(k => { const v = Number(k); if (k !== "" && k !== undefined && !isNaN(v) && (tot.maxKm === null || v > tot.maxKm)) tot.maxKm = v; });
            }
            if (b.km && Number(params.kmVergoeding) > 0) tot.kmVergoeding += b.km * Number(params.kmVergoeding);
        }
        ["recup", "reisExtra", "werkExtra", "km", "reistijd", "vergoeding"].forEach(k => tot[k] = r2(tot[k]));

        /* overdracht recup: jaaroverdracht + alle vorige maanden */
        let recupVoor = Number(jaarP.overdrachtRecup) || 0;
        let verlofVoor = 0;
        for (let mm = 1; mm < m; mm++) {
            for (let d = 1; d <= dagenInMaand(j, mm); d++) {
                const datum = isoDatum(j, mm, d), dag = dagen[datum];
                const b = berekenDag(dag, datum, params);
                if (b.recup !== null) recupVoor += b.recup;
                if (isVerlof(dag)) verlofVoor++;
            }
        }
        recupVoor = r2(recupVoor);
        let verlofNa = 0;
        Object.keys(dagen).forEach(k => {
            if (k.slice(0, 4) === String(j) && k > isoDatum(j, m, dagenInMaand(j, m)) && isVerlof(dagen[k])) verlofNa++;
        });
        const teNemen = (Number(jaarP.verlofdagen) || 0) + (Number(jaarP.overdrachtVerlof) || 0);
        const opgenomen = verlofVoor + tot.verlof;
        const wkUren = [1, 2, 3, 4, 5].reduce((s, i) => s + (Number(params.rooster[i] && params.rooster[i].uren) || 0), 0);
        const nieuwRecup = r2(recupVoor + tot.recup);
        const restRdagen = wkUren ? nieuwRecup / (wkUren / 5) : 0;
        let kledij = null;
        if (Number(params.kledijModus) === 1) kledij = Number(params.kledij) || 0;
        else if (Number(params.kledijModus) === 2) kledij = tot.weekdagen ? Math.floor((Number(params.kledij) || 0) * tot.gewerkteDagen / tot.weekdagen / 0.05 + 1e-9) * 0.05 : 0;
        const carwash = params.carwashTonen && Number(params.carwash) ? Number(params.carwash) : null;
        const kmVerg = Number(params.kmVergoeding) > 0 ? r2(tot.kmVergoeding) : null;
        const cdbTotaal = r2((kmVerg || 0) + (carwash || 0) + (kledij || 0) + (Number(params.dagvergoeding) ? tot.vergoeding : 0));
        return {
            jaar: j, maand: m, rijen, tot,
            recupVoor, nieuwRecup,
            verlof: { overdracht: Number(jaarP.overdrachtVerlof) || 0, dagen: Number(jaarP.verlofdagen) || 0, voor: verlofVoor - (Number(jaarP.overdrachtVerlof) || 0), teNemen, opgenomen, toekomst: verlofNa, rest: teNemen - opgenomen - verlofNa },
            restRdagen, restWeken: (tot.recupDagen + restRdagen) / 5,
            kledij, carwash, kmVerg, cdbTotaal
        };
    }

    /* Statistiek over het hele jaar (blad STAT) */
    function stat(dagen, j, params) {
        const lijst = { V: [], R: [], F: [], Z: [], H: [] };
        const kmDag = [], vertrek = [], thuis = [], weg = [];
        let kmMin = null, kmMax = null;
        Object.keys(dagen).sort().forEach(k => {
            if (k.slice(0, 4) !== String(j)) return;
            const d = dagen[k];
            if (!heeftInhoud(d)) return;
            if (d.soort === "V" || d.soort === "C") lijst.V.push(k);
            else if (d.soort === "R") lijst.R.push(k);
            else if (d.soort === "F") lijst.F.push(k);
            else if (d.soort === "Z" || d.soort === "M") lijst.Z.push(k);
            if (d.soort === "werk") {
                if (d.hotel) lijst.H.push(k);
                [d.kmStart, d.kmEind].forEach(x => { const v = Number(x); if (x !== "" && x !== undefined && !isNaN(v)) { if (kmMin === null || v < kmMin) kmMin = v; if (kmMax === null || v > kmMax) kmMax = v; } });
                const ks = Number(d.kmStart), ke = Number(d.kmEind);
                if (d.kmStart !== "" && d.kmEind !== "" && !isNaN(ks) && !isNaN(ke) && ke > ks) kmDag.push(ke - ks);
                const a = uurNaarDec(d.vertrekThuis), b = uurNaarDec(d.aankomstThuis);
                if (a) vertrek.push(a);
                if (b) thuis.push(b);
                if (a && b) weg.push(b - a);
            }
        });
        const gem = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
        const totaal = kmMin !== null ? kmMax - kmMin : 0;
        const werk = kmDag.reduce((s, x) => s + x, 0);
        return {
            lijst, km: { totaal, werk, prive: totaal - werk, min: kmDag.length ? Math.min.apply(null, kmDag) : null, gem: gem(kmDag), max: kmDag.length ? Math.max.apply(null, kmDag) : null },
            vertrek: { min: vertrek.length ? Math.min.apply(null, vertrek) : null, gem: gem(vertrek), max: vertrek.length ? Math.max.apply(null, vertrek) : null },
            thuis: { min: thuis.length ? Math.min.apply(null, thuis) : null, gem: gem(thuis), max: thuis.length ? Math.max.apply(null, thuis) : null },
            weg: gem(weg)
        };
    }

    function interventies(dagen, j, zoek) {
        const z = String(zoek || "").trim().toLowerCase();
        if (!z) return [];
        return Object.keys(dagen).sort().filter(k => k.slice(0, 4) === String(j) && dagen[k] && dagen[k].soort === "werk" && String(dagen[k].klant || "").toLowerCase().indexOf(z) >= 0)
            .map(k => ({ datum: k, klant: dagen[k].klant, hotel: !!dagen[k].hotel }));
    }

    root.UrenCalc = { STD_PARAMS, STD_JAAR, DAGCODES, uurNaarDec, decNaarUmin, berekenDag, label, maand, stat, interventies, weeknum, isoWeekdag, dagenInMaand, isoDatum, heeftInhoud, heeftEigenPauze, r2 };
})(typeof window !== "undefined" ? window : globalThis);
