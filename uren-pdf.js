/* Werkbon MT Service: CDB-, Prest- en Fact-pagina's in de opmaak van het Excel-bestand. */
(function (root) {
    const C = root.UrenCalc;
    const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const getal = (v, dec) => (v === null || v === undefined || v === "" || isNaN(v)) ? "" : Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const nul = (v, dec) => (v === null || v === undefined || v === 0) ? "" : getal(v, dec);
    const umin = d => { if (d === "" || d === null || d === undefined) return ""; const v = C.uurNaarDec(d); return v === null ? "" : C.decNaarUmin(v); };
    const dagLabel = datum => { const d = new Date(datum + "T12:00:00"); return d.getDate() + "-" + MND[d.getMonth()]; };
    const maandLabel = (j, m) => MND[m - 1] + "-" + String(j).slice(2);

    const basisCss = `
.pg{width:794px;height:1123px;background:#fff;color:#000;font-family:Arial,"Liberation Sans",Helvetica,sans-serif;box-sizing:border-box;padding:46px 0 0 0;position:relative;overflow:hidden}
.pg table{border-collapse:collapse;table-layout:fixed}
.pg td{border:1px solid #000;padding:0 2px;height:16px;font-size:11px;line-height:13px;white-space:nowrap;overflow:hidden;vertical-align:bottom}
.pg .c{text-align:center}.pg .r{text-align:right}.pg .b{font-weight:bold}
.pg .klein{font-size:8px;line-height:9px;white-space:normal;vertical-align:middle}
.pg .mid{vertical-align:middle;white-space:normal}
.pg .rood{color:#e00000}.pg .za{background:#c0c0c0}.pg .zo{background:#f8cbad}
.pg .geen{border:none}
`;

    function cdb(md, naam, params) {
        const verg = Number(params.dagvergoeding) || 0;
        let rijen = "";
        let cumVerlof = md.verlof.voor;
        md.rijen.forEach(r => {
            const b = r.b, d = r.dag;
            const lbl = C.label(d, "cdb");
            const gew = d && d.soort === "werk";
            const ks = gew && d.kmStart !== "" && d.kmStart !== undefined ? Number(d.kmStart) : null;
            const ke = gew && d.kmEind !== "" && d.kmEind !== undefined ? Number(d.kmEind) : null;
            const kmEur = (Number(params.kmVergoeding) > 0 && ks !== null && ke !== null && ke > ks) ? (ke - ks) * Number(params.kmVergoeding) : null;
            const mt = b.vergoeding ? b.vergoeding : null;
            const tot = (kmEur || 0) + (mt || 0);
            const vl = d && (d.soort === "V" || d.soort === "C") ? 1 : "";
            rijen += `<tr><td class="r ${r.wd === 6 ? "za" : r.wd === 7 ? "zo" : ""}" style="border-left:2px solid #000">${dagLabel(r.datum)}</td><td>${esc(lbl)}</td>
<td class="r">${ks !== null ? getal(ks, 0) : ""}</td><td class="r">${ke !== null ? getal(ke, 0) : ""}</td><td class="r">${kmEur ? getal(kmEur, 2) : ""}</td>
<td class="r ${b.dubbel && mt ? "rood b" : ""}">${mt ? getal(mt, 2) : ""}</td><td class="r">${tot ? getal(tot, 2) : ""}</td><td class="c" style="border-right:2px solid #000">${vl}</td></tr>`;
        });
        const leeg = 31 - md.rijen.length;
        for (let i = 0; i < leeg; i++) rijen += `<tr><td style="border-left:2px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="border-right:2px solid #000"></td></tr>`;
        const kmTot = md.kmVerg;
        const voet = [];
        if (kmTot !== null) voet.push(["KM-Vergoeding / Indemnité kilométrique", kmTot]);
        if (md.carwash !== null) voet.push(["Forfait Car-wash", md.carwash]);
        if (md.kledij !== null) voet.push(["Reiniging werkkledij / Nettoyage vetements", md.kledij]);
        if (verg) voet.push(["Maaltijd / Repas", md.tot.vergoeding]);
        while (voet.length < 4) voet.unshift(["", null]);
        const css = basisCss + `.cdb{margin-left:52px;width:690px}`;
        return `<style>${css}</style><div class="pg"><table class="cdb">
<colgroup><col style="width:58px"><col style="width:220px"><col style="width:64px"><col style="width:64px"><col style="width:62px"><col style="width:68px"><col style="width:64px"><col style="width:46px"></colgroup>
<tr style="height:38px"><td colspan="2" class="c b mid" style="font-size:14px;border-width:2px 1px 2px 2px">Carnet de bord - Indimnité</td>
<td class="r b klein" style="border-top-width:2px">Naam:<br>Nom:</td><td colspan="2" class="c b mid" style="font-size:10px;border-top-width:2px">${esc(naam)}</td>
<td class="r klein" style="border-top-width:2px">Maand-jaar:<br>Mois-<br>année:</td><td class="c b mid" style="font-size:12px;border-top-width:2px">${maandLabel(md.jaar, md.maand)}</td>
<td rowspan="2" class="rood klein" style="vertical-align:top;border:2px solid #e00000">Vakantie-dagen &nbsp; Jours de congé ${md.jaar}</td></tr>
<tr style="height:38px"><td rowspan="2" class="c b mid" style="border-left-width:2px">Datum<br>Date</td><td rowspan="2" class="c b mid" style="font-size:12px">Klant / Client</td>
<td colspan="3" class="c b mid" style="font-size:13px">Wagen / Voiture</td><td class="c klein">Maaltijd / Repas = ${getal(verg, 0)} € /dag/jours</td><td class="c b mid" style="font-size:10px">Totaal<br>Total</td></tr>
<tr><td class="c b">KM⟶</td><td class="c b">→KM</td><td class="c b">€</td><td class="c b">€</td><td class="c b">€</td><td class="c b" style="border-right:2px solid #000">${getal(md.verlof.voor, 0)}</td></tr>
${rijen}
<tr><td class="geen" style="border-top:1px solid #000"></td><td class="geen" style="border-top:1px solid #000"></td><td class="geen" style="border-top:1px solid #000"></td><td class="geen" style="border-top:1px solid #000"></td>
<td class="r">${kmTot ? getal(kmTot, 2) : ""}</td><td class="r">${getal(md.tot.vergoeding, 2)}</td><td class="r">${getal(md.tot.vergoeding + (kmTot || 0), 2)}</td><td class="c b">${getal(md.verlof.voor + md.tot.verlof, 0)}</td></tr>
<tr><td colspan="2" class="c klein">Voor akkoord de dienstverantwoordelijke</td><td colspan="5" class="geen"></td></tr>
<tr><td colspan="2" class="c klein">Pour accord le responsable de service</td><td colspan="5" class="geen"></td></tr>
${voet.map((v, i) => `<tr><td colspan="2" ${i === voet.length - 1 ? 'style="border-bottom:1px solid #000"' : 'style="border-bottom:none;border-top:none"'}></td><td colspan="4" class="r ${v[0] ? "" : "geen"}" style="${v[0] ? "" : ""}">${esc(v[0])}</td><td class="r ${v[0] ? "" : "geen"}">${v[1] !== null ? getal(v[1], 2) : ""}</td></tr>`).join("")}
<tr><td colspan="2" style="border-top:none"></td><td colspan="4" class="r" style="font-size:12px">Total/Totaal</td><td class="r">${getal(md.cdbTotaal, 2)}</td></tr>
</table></div>`;
    }

    function prest(md, naam) {
        let rijen = "";
        let eerste = true;
        md.rijen.forEach(r => {
            const b = r.b, d = r.dag;
            const gew = d && d.soort === "werk";
            const wk = C.weeknum(r.datum);
            const kw = (eerste || new Date(r.datum + "T12:00:00").getDay() === 0) ? wk : "";
            eerste = false;
            const kwKleur = wk % 2 === 0 ? "#a9d79b" : "#ffffcc";
            const lbl = C.label(d, "prest");
            let lblStijl = "";
            if (d && d.soort === "F") lblStijl = "background:#ff7c80";
            else if (d && (d.soort === "V" || d.soort === "C")) lblStijl = "color:#e00000;font-weight:bold";
            else if (d && d.soort === "R") lblStijl = "background:#92d050";
            else if (gew && b.dubbel) lblStijl = "background:#8ddcf5";
            const t = k => gew ? umin(d[k]) : "";
            const rec = b.recup !== null ? getal(b.recup, 2) : "";
            const reis = b.reisExtra !== null ? getal(b.reisExtra, 2) : "";
            const werk = b.werkExtra !== null ? getal(b.werkExtra, 2) : "";
            const vl = d && (d.soort === "V" || d.soort === "C") ? 1 : "";
            const rd = d && d.soort === "R" ? 1 : "";
            rijen += `<tr><td class="c" style="background:${kwKleur};font-size:8px;border-left:2px solid #000">${kw}</td><td class="r ${r.wd === 6 ? "za" : r.wd === 7 ? "zo" : ""}">${dagLabel(r.datum)}</td>
<td style="${lblStijl}">${esc(lbl)}</td><td class="r">${t("vertrekThuis")}</td><td class="r">${t("aankomstKlant")}</td><td class="r">${t("vertrekKlant")}</td><td class="r">${t("aankomstThuis")}</td>
<td class="r">${rec}</td><td class="r" style="font-size:8px">${reis}</td><td class="r" style="font-size:8px">${werk}</td><td class="c" style="border-left:2px solid #000">${vl}</td><td class="c" style="border-right:2px solid #000">${rd}</td>
<td class="geen"></td><td class="r" style="font-size:8px;border-left:2px solid #000">${b.km ? getal(b.km, 0) : ""}</td><td class="r" style="font-size:8px">${b.km ? getal(b.reistijd, 2) : ""}</td><td class="r" style="font-size:8px;border-right:2px solid #000">${b.km && b.snelheid ? getal(b.snelheid, 0) : ""}</td></tr>`;
        });
        for (let i = md.rijen.length; i < 31; i++) rijen += `<tr><td style="border-left:2px solid #000"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="border-left:2px solid #000"></td><td style="border-right:2px solid #000"></td><td class="geen"></td><td style="border-left:2px solid #000"></td><td></td><td style="border-right:2px solid #000"></td></tr>`;
        const T = md.tot;
        const gemS = T.reistijd ? T.km / T.reistijd : null;
        const v = md.verlof;
        const css = basisCss + `.pr{margin-left:62px;width:676px}.pr td{font-size:10px}.vb td{font-size:8px;height:15px}`;
        const vorig = md.maand === 1 ? "Overdracht uren recup van vorig jaar / Transfert d'heures de récup de l'année précedente" : "Overdracht uren recup van vorige maand / Transfert d'heures de récup du mois précédent";
        return `<style>${css}</style><div class="pg"><table class="pr">
<colgroup><col style="width:16px"><col style="width:44px"><col style="width:178px"><col style="width:36px"><col style="width:36px"><col style="width:36px"><col style="width:36px"><col style="width:38px"><col style="width:36px"><col style="width:38px"><col style="width:36px"><col style="width:36px"><col style="width:8px"><col style="width:30px"><col style="width:30px"><col style="width:30px"></colgroup>
<tr style="height:30px"><td rowspan="3" class="c klein" style="border-width:2px 1px 1px 2px">K<br>W<br><br>S<br>V</td><td colspan="2" class="c b mid" style="font-size:9px;border-top-width:2px">Overzicht prestaties / Résumé des prestations</td>
<td class="klein" style="border-top-width:2px">Naam:<br>Nom:</td><td colspan="4" class="c b mid" style="font-size:12px;border-top-width:2px">${esc(naam)}</td>
<td class="klein" style="border-top-width:2px">Maand:<br>Mois:</td><td class="c b mid" style="font-size:11px;border-top-width:2px">${maandLabel(md.jaar, md.maand)}</td>
<td rowspan="2" class="c klein rood" style="border-width:2px 1px 1px 2px">Vakantie-dagen &nbsp; Jours de congé ${md.jaar}</td><td rowspan="2" class="c klein" style="border-width:2px 2px 1px 1px">Recup dag / Jour de récup</td>
<td class="geen"></td><td colspan="3" class="c klein" style="border-width:2px 2px 1px 2px">Reisinfo &nbsp;/ Info voyage</td></tr>
<tr style="height:38px"><td rowspan="2" class="c b klein">Datum<br>Date</td><td rowspan="2" class="c b mid" style="font-size:12px">Klant / Client</td>
<td class="c klein">Thuis Maison ------></td><td class="c klein">------> Klant Client</td><td class="c klein">Klant Client ------></td><td class="c klein">------> Thuis Maison</td>
<td class="c klein">Recup</td><td class="c klein">Reis Voyage extra</td><td class="c klein">Werk Travail extra</td><td class="geen"></td>
<td class="klein" style="border-left-width:2px">Afst. Dist.</td><td class="klein">Duur Temps</td><td class="klein" style="border-right-width:2px">S gem V moy</td></tr>
<tr><td class="c klein">h,min</td><td class="c klein">h,min</td><td class="c klein">h,min</td><td class="c klein">h,min</td><td class="c klein">h,hh</td><td class="c klein">h,hh</td><td class="c klein">h,hh</td>
<td class="c klein" style="border-left-width:2px">d / j</td><td class="c klein" style="border-right-width:2px">d / j</td><td class="geen"></td><td class="c klein" style="border-left-width:2px">km</td><td class="c klein">h,hh</td><td class="c klein" style="border-right-width:2px">km/h</td></tr>
${rijen}
<tr><td colspan="5" class="geen" style="border-top:2px solid #000"></td><td class="r">Tot.</td><td class="c b">${maandLabel(md.jaar, md.maand)}</td><td class="r">${getal(T.recup, 2)}</td><td class="r">${getal(T.reisExtra, 2)}</td><td class="r">${getal(T.werkExtra, 2)}</td>
<td class="c b" style="border-left-width:2px">${T.verlof}</td><td class="c b" style="border-right-width:2px">${T.recupDagen}</td><td class="geen"></td><td class="r" style="font-size:8px;border-left-width:2px">${getal(T.km, 0)}</td><td class="r" style="font-size:8px">${getal(T.reistijd, 0)}</td><td class="r b" style="font-size:8px;border-right-width:2px">${gemS ? getal(gemS, 0) : ""}</td></tr>
<tr><td colspan="7" class="klein" style="font-size:7px">${esc(vorig)}</td><td class="r">${getal(md.recupVoor, 2)}</td><td colspan="8" class="geen"></td></tr>
<tr><td colspan="7" class="b" style="font-size:9px">Nieuw aantal uren recup / Nouveau nombre d'heures de récup</td><td class="r b">${getal(md.nieuwRecup, 2)}</td><td class="geen"></td><td colspan="2" class="r" style="font-size:9px">${T.maxKm !== null ? getal(T.maxKm, 0) : ""}</td><td class="geen" style="font-size:9px">km</td><td colspan="4" class="geen"></td></tr>
</table>
<table class="vb" style="margin:14px 0 0 62px;width:676px"><colgroup><col style="width:250px"><col style="width:90px"><col style="width:40px"><col style="width:46px"><col style="width:150px"><col style="width:100px"></colgroup>
<tr><td>Te nemen verlofdagen / Nombre de jours de congé</td><td class="c">${md.jaar - 1} : ${esc(v.overdracht)} &nbsp;/&nbsp; ${md.jaar} : ${esc(v.dagen)}</td><td class="c" style="font-size:11px">${v.teNemen}</td><td class="geen"></td><td class="geen"></td><td class="geen"></td></tr>
<tr><td colspan="2">Reeds opgenomen verlofdagen / Jours de congé déjà pris</td><td class="c" style="font-size:11px">${v.opgenomen}</td><td class="geen"></td><td colspan="2" rowspan="2" class="c mid" style="font-size:9px;border-width:1px">Voor akkoord de dienstverantwoordelijke</td></tr>
<tr><td colspan="2">Toekomstige vastgelegde verlofdagen/ Jours de congé déjà fixés dans le futur:</td><td class="c" style="font-size:11px">${v.toekomst}</td><td class="geen"></td></tr>
<tr><td colspan="2">Resterende vrije verlofdagen/ Jours de congé restants, libres:</td><td class="c" style="font-size:11px">${v.rest}</td><td class="geen"></td><td colspan="2" rowspan="2" class="c mid" style="font-size:9px">Pour accord le responsable de service</td></tr>
<tr><td colspan="2">Opgenomen recupdagen / Jours de recup pris</td><td class="c" style="font-size:11px">${T.recupDagen}</td><td class="geen"></td></tr>
<tr><td colspan="2">Resterende R dagen / Jours de récup restants:</td><td class="c" style="font-size:11px">${getal(md.restRdagen, 0)}</td><td colspan="3" class="geen"></td></tr>
<tr><td colspan="2">Resterende vrije weken / Semaines libres restantes:</td><td class="c" style="font-size:11px">${getal(md.restWeken, 1)}</td><td colspan="3" class="geen"></td></tr>
</table></div>`;
    }

    function fact(aankopen, jaar, recupNu, euroPerUur, naam) {
        const lijst = aankopen.filter(a => !a.datum || a.datum.slice(0, 4) === String(jaar));
        const totIncl = lijst.reduce((s, a) => s + (Number(a.incl) || 0), 0);
        const totExcl = lijst.reduce((s, a) => s + (Number(a.excl) || 0), 0);
        const uren = euroPerUur ? -totExcl / euroPerUur : 0;
        let rijen = lijst.map(a => `<tr><td>${esc(a.leverancier)}</td><td class="c">${a.datum ? esc(a.datum.split("-").reverse().join("/")) : ""}</td><td class="r">${nul(Number(a.incl), 2)}</td><td class="r">${nul(Number(a.excl), 2)}</td><td class="geen"></td></tr>`).join("");
        for (let i = lijst.length; i < 29; i++) rijen += `<tr><td></td><td></td><td></td><td></td><td class="geen"></td></tr>`;
        const css = basisCss + `.fa{margin-left:70px;width:520px}`;
        return `<style>${css}</style><div class="pg"><div style="margin:0 0 10px 70px;font-size:12px"><b>Aankopen / Achats ${jaar}</b> &nbsp; ${esc(naam)}</div><table class="fa">
<colgroup><col style="width:180px"><col style="width:70px"><col style="width:85px"><col style="width:85px"><col style="width:100px"></colgroup>
<tr style="height:42px"><td rowspan="2" class="c mid">Leverancier<br>Fourniseur</td><td rowspan="2" class="c mid">Datum<br>Date</td><td class="c mid klein" style="font-size:10px">Bedrag Montant incl. btw-tva</td><td class="c mid klein" style="font-size:10px">Bedrag Montant excl. btw-tva</td><td class="geen"></td></tr>
<tr><td class="c">Facultatif</td><td class="c">IMPERATIF</td><td class="geen"></td></tr>
${rijen}
<tr><td colspan="2" class="r" style="border-width:2px 1px 2px 2px">Totaal</td><td class="r" style="border-width:2px 1px">${getal(totIncl, 2)}</td><td class="r" style="border-width:2px 1px">${getal(totExcl, 2)}</td><td style="border-width:2px 2px 2px 1px">${getal(uren, 2)} uren/heures</td></tr>
<tr><td colspan="5" class="geen" style="height:10px"></td></tr>
<tr><td colspan="2">Recup in / Récup en</td><td class="r">${jaar}</td><td class="r">${getal(recupNu, 2)}</td><td>uren/heures</td></tr>
<tr><td colspan="2">Resterende recup op / Récup restante à</td><td class="r">${jaar + 1}</td><td class="r">${getal(recupNu + uren, 2)}</td><td>uren/heures</td></tr>
</table></div>`;
    }

    root.UrenPdf = { cdb, prest, fact, maandLabel, MND };
})(window);
