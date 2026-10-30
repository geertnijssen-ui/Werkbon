/* Werkbon MT Service: berekeningen, weergave en PDF van de werkbon */
/* ---------- rekenwerk ---------- */
function minutenVan(t) {
    if (!t || t.indexOf(":") < 0)
        return null;
    const p = t.split(":");
    const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m))
        return null;
    return h * 60 + m;
}
function dagMinuten(d) {
    const b = minutenVan(d.begin), e = minutenVan(d.einde);
    if (b === null || e === null)
        return 0;
    let v = e - b;
    if (v < 0)
        v += 24 * 60;
    v -= (parseInt(d.pauze, 10) || 0);
    return v > 0 ? v : 0;
}
function hhmm(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h + ":" + (m < 10 ? "0" + m : m);
}
function totalen(dagen) {
    let min = 0, vb = 0, km = 0;
    (dagen || []).forEach(d => {
        min += dagMinuten(d);
        vb += parseFloat(String(d.supplUren || "").replace(",", ".")) || 0;
        km += parseFloat(String(d.supplKm || "").replace(",", ".")) || 0;
    });
    return { min: min, vb: vb, km: km };
}
function dagNaam(datum, taal) {
    if (!datum)
        return "";
    const d = new Date(datum + "T00:00:00");
    if (isNaN(d.getTime()))
        return "";
    return LBL[taal].dagen[d.getDay()];
}
function datumNL(datum) {
    if (!datum)
        return "";
    const p = datum.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : datum;
}
function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
/* ---------- PDF / preview: stijlen ---------- */
const pdfStyles = `
*{box-sizing:border-box}
.bonRoot{background:#fff;color:#000;color-scheme:light;-webkit-text-size-adjust:100%;text-size-adjust:100%}
.page{width:196mm;height:283mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:15px;-webkit-text-size-adjust:100%;text-size-adjust:100%;line-height:1.35;overflow:hidden;position:relative;margin:0 auto 6mm auto}
.frame{height:100%;display:flex;flex-direction:column;border:1px solid #000;padding:2.5mm;background:#fff}
.kop{display:flex;border-bottom:1px solid #000;min-height:22mm;background:${KOP_GRIJS}}
.kop .c1{width:33%;border-right:1px solid #000;display:flex;align-items:center;justify-content:center;padding:2mm}
.kop .c1 img{max-width:88%;max-height:17mm}
.kop .c2{width:36%;border-right:1px solid #000;padding:1.5mm 2mm}
.kop .c3{width:31%;padding:1.5mm 2mm}
.kop .lbl{font-size:12.5px}
.regel{height:6mm;margin-top:1mm;display:flex;align-items:flex-end;gap:2mm}
.regel .nr{font-size:12px;color:#555}
.regel .val{font-size:13.5px}
.wbTitel{color:${ACC_BON};font-weight:bold;font-size:14px;margin-top:2mm}
.wbNr{font-size:27px;font-weight:bold;letter-spacing:1px}
.adresbalk{text-align:center;font-size:12.5px;padding:1mm 0;border-bottom:1px solid #000}
.klantblok{display:flex;border-bottom:1px solid #000}
.klantblok .l{width:58%;border-right:1px solid #000;padding:1.5mm 2mm}
.klantblok .r{width:42%;padding:1.5mm 2mm}
.rij{display:flex;font-size:14.5px;min-height:6mm;align-items:flex-end}
.rij .k{width:26mm;flex:none;color:#000}
.rij .v{flex:1;min-height:5mm;font-weight:500}
.rij.r2 .k{width:34mm}
.machinerij{display:flex;border-bottom:1px solid #000;font-size:16px;padding:1.5mm 2mm;gap:3mm}
.machinerij .m{flex:1;display:flex;align-items:flex-end;gap:2mm}
.machinerij .m .v{flex:1;min-height:5mm;font-weight:500}
.blok{padding:1.5mm 2mm;border-bottom:1px solid #000;background:#fff}
.blokTitel{font-size:14.5px;margin-bottom:1mm;color:#333}
.desc{flex:1 1 auto;min-height:30mm;display:flex;flex-direction:column;overflow:hidden}
.descTxt{white-space:pre-wrap;word-wrap:break-word}
.fotos{display:flex;flex-wrap:wrap;gap:2mm;margin-top:2mm}
.fotos img{width:calc(50% - 1mm);max-height:45mm;object-fit:contain;border:1px solid #999}
.opm{min-height:14mm}
.onder{display:flex;border-bottom:1px solid #000}
.onder .uren{width:58%;border-right:1px solid #000;padding:0}
.onder .mat{width:42%;padding:1.5mm 2mm}
table.ut{width:100%;border-collapse:collapse;font-size:14px;background:#fff}
table.ut th,table.ut td{border:1px solid #000;padding:0.8mm 1mm;text-align:center;height:7mm;color:#000}
table.ut th{font-weight:normal;color:${ACC_BON};font-size:13px}
table.ut td.dag{text-align:left;font-size:12.5px}
table.ut tr.totaal td{font-weight:bold;color:#000}
.matRij{display:flex;justify-content:space-between;align-items:center;font-size:13px}
.vinkjes{display:flex;gap:4mm}
.vink{display:flex;align-items:center;gap:1.5mm;font-size:12px}
.vak{width:5mm;height:4mm;border:1px solid ${ACC_BON};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#000}
.matTxt{min-height:16mm;white-space:pre-wrap;font-size:13px;margin:1mm 0 2mm 0}
.interv{display:flex;align-items:center;justify-content:space-between;padding:1.5mm 2mm;border-bottom:1px solid #000;color:${ACC_BON};font-size:13px}
.sigs{display:flex;border-top:1px solid #000}
.sigs .s{border-right:1px solid #000;padding:1.5mm 2mm;min-height:24mm;display:flex;flex-direction:column}
.sigs .s:last-child{border-right:none}
.sigs .s1{width:40%}.sigs .s2{width:30%}.sigs .s3{width:30%}
.sigs .cap{font-size:12px;margin-bottom:1mm;color:#333}
.sigs .sigImg{flex:1;display:flex;align-items:center;justify-content:center}
.sigs .sigImg img{max-height:18mm;max-width:100%}
.sigs .klantnaam{font-weight:bold;font-size:14px;display:flex;flex-direction:column;justify-content:center;flex:1}
.sigs .klantmail{font-weight:normal;font-size:11.5px;color:#333}
.foot{text-align:center;color:${ACC_BON};font-weight:bold;font-size:12.5px;padding-top:1.5mm}
.vervolgKop{display:flex;justify-content:space-between;border-bottom:1px solid #000;padding-bottom:1.5mm;font-size:14px}
`;
/* ---------- PDF / preview: bouwstenen ---------- */
function pdfHeaderHtml(b, s, L) {
    const logo = s.logo || STD_LOGO;
    return `<div class="kop">
    <div class="c1"><img src="${logo}" alt=""></div>
    <div class="c2"><div class="lbl">${esc(L.techn)} :</div>
      <div class="regel"><span class="nr">1</span><span class="val">${esc(b.tech1 || "")}</span></div>
      <div class="regel"><span class="nr">2</span><span class="val">${esc(b.tech2 || "")}</span></div>
    </div>
    <div class="c3"><div class="lbl">${esc(L.contract)}</div>
      <div class="regel"><span class="val">${esc(b.contractnr || "")}</span></div>
      <div class="wbTitel">${esc(L.werkbon)} :</div>
      <div class="wbNr">N° ${esc(b.nr || "")}</div>
    </div>
  </div>
  <div class="adresbalk">${esc(s.adres)} &nbsp; Tel. ${esc(s.telefoon)} - Fax ${esc(s.fax)}</div>
  <div class="klantblok">
    <div class="l">
      <div class="rij"><span class="k">${esc(L.klant)} :</span><span class="v">${esc(b.klantNaam || "")}</span></div>
      <div class="rij"><span class="k">${esc(L.adres)} :</span><span class="v">${esc(b.klantStraat || "")}</span></div>
      <div class="rij"><span class="k"></span><span class="v">${esc(b.klantStad || "")}</span></div>
    </div>
    <div class="r">
      <div class="rij r2"><span class="k">${esc(L.bestelnr)} :</span><span class="v">${esc(b.bestelnr || "")}</span></div>
      <div class="rij r2"><span class="k">${esc(L.contact)} :</span><span class="v">${esc(b.contact || "")}</span></div>
    </div>
  </div>
  <div class="machinerij">
    <div class="m"><span>${esc(L.machine)} :</span><span class="v">${esc(b.machineNaam || "")}</span></div>
    <div class="m"><span>${esc(L.merk)} :</span><span class="v">${esc(b.machineMerk || "")}</span></div>
    <div class="m"><span>${esc(L.sernr)} :</span><span class="v">${esc(b.machineSerie || "")}</span></div>
  </div>`;
}
function pdfUrenHtml(dagen, taal, L, metTotaal) {
    const t = totalen(dagen);
    let rows = "";
    (dagen || []).forEach(d => {
        rows += `<tr>
      <td class="dag">${esc(dagNaam(d.datum, taal))}</td>
      <td class="dag">${esc(datumNL(d.datum))}</td>
      <td>${esc(d.begin || "")}</td>
      <td>${esc(d.einde || "")}</td>
      <td>${esc(d.supplUren || "")}</td>
      <td>${esc(d.supplKm || "")}</td>
    </tr>`;
    });
    if (metTotaal) {
        rows += `<tr class="totaal"><td class="dag" colspan="2">${esc(L.tot)}</td>
      <td colspan="2">${hhmm(t.min)}</td><td>${t.vb ? t.vb : ""}</td><td>${t.km ? t.km : ""}</td></tr>`;
    }
    return `<table class="ut">
    <tr><th rowspan="2"></th><th rowspan="2">${esc(L.datum)}</th><th colspan="2">${esc(L.werkuren)}</th><th colspan="2">${esc(L.voorb)}</th></tr>
    <tr><th>${esc(L.begin)}</th><th>${esc(L.einde)}</th><th>${esc(L.urenK)}</th><th>${esc(L.km)}</th></tr>
    ${rows}</table>`;
}
function vinkHtml(waarde, L) {
    return `<span class="vinkjes">
    <span class="vink">${esc(L.ja)}<span class="vak">${waarde === true ? "X" : ""}</span></span>
    <span class="vink">${esc(L.nee)}<span class="vak">${waarde === false ? "X" : ""}</span></span></span>`;
}
function pdfMatIntervHtml(b, L) {
    return `<div class="matRij"><span>${esc(L.matB)} :</span>${vinkHtml(b.matBestelJa, L)}</div>
    <div class="matTxt">${nl2br(b.matBestelTxt || "")}</div>
    <div class="matRij"><span>${esc(L.matG)} :</span>${vinkHtml(b.matGelevJa, L)}</div>
    <div class="matTxt">${nl2br(b.matGelevTxt || "")}</div>`;
}
function pdfSigsHtml(b, s, L) {
    return `<div class="sigs">
    <div class="s s1"><div class="cap">${esc(L.sigT)}</div>
      <div class="sigImg">${s.techSig ? `<img src="${s.techSig}" alt="">` : ""}</div></div>
    <div class="s s2"><div class="cap">${esc(L.sigKn)}</div>
      <div class="klantnaam">${esc(b.klantTekenNaam || "")}
        ${b.klantEmail ? `<span class="klantmail">${esc(b.klantEmail)}</span>` : ""}</div></div>
    <div class="s s3"><div class="cap">${esc(L.sigKh)}</div>
      <div class="sigImg">${b.klantSig ? `<img src="${b.klantSig}" alt="">` : ""}</div></div>
  </div>`;
}
/* verdeling over pagina's: vaste schatting, geen DOM-meting */
function verdeel(b) {
    const tekst = b.beschrijving || "";
    const fotos = b.fotos || [];
    const dagen = b.dagen || [];
    const maxDagen1 = tekst.length > 900 ? 5 : (tekst.length > 500 ? 7 : 9);
    const dagen1 = dagen.slice(0, maxDagen1);
    const dagenRest = dagen.slice(maxDagen1);
    const fotosOpP1 = fotos.length > 0 && tekst.length <= 700;
    const maxChars = fotosOpP1 ? 700 : 1300;
    let deel1 = tekst, deel2 = "";
    if (tekst.length > maxChars) {
        let snij = tekst.lastIndexOf(" ", maxChars);
        if (snij < maxChars * 0.6)
            snij = maxChars;
        deel1 = tekst.slice(0, snij);
        deel2 = tekst.slice(snij).replace(/^\s+/, "");
    }
    return {
        deel1: deel1, deel2: deel2,
        fotos1: fotosOpP1 ? fotos : [],
        fotos2: fotosOpP1 ? [] : fotos,
        dagen1: dagen1, dagenRest: dagenRest,
        extra: !!(deel2 || (!fotosOpP1 && fotos.length) || dagenRest.length)
    };
}
function descFont(len) {
    if (len > 1100)
        return 11;
    if (len > 800)
        return 12;
    if (len > 500)
        return 13;
    return 14;
}
function pdfPaginaHtml(b, s, L, v) {
    const fotoHtml = v.fotos1.length ? `<div class="fotos">${v.fotos1.map(f => `<img src="${f}" alt="">`).join("")}</div>` : "";
    return `<div class="page"><div class="frame">
    ${pdfHeaderHtml(b, s, L)}
    <div class="blok desc">
      <div class="blokTitel">${esc(L.besch)} :</div>
      <div class="descTxt" style="font-size:${descFont(v.deel1.length)}px">${nl2br(v.deel1)}</div>
      ${fotoHtml}
    </div>
    <div class="blok opm">
      <div class="blokTitel">${esc(L.opm)} :</div>
      <div class="descTxt" style="font-size:${descFont((b.opmerkingen || "").length)}px">${nl2br(b.opmerkingen || "")}</div>
    </div>
    <div class="onder">
      <div class="uren">${pdfUrenHtml(v.dagen1, b.taal, L, !v.dagenRest.length)}</div>
      <div class="mat">${pdfMatIntervHtml(b, L)}</div>
    </div>
    <div class="interv"><span>${esc(L.interv)}</span>${vinkHtml(b.beeindigd, L)}</div>
    ${pdfSigsHtml(b, s, L)}
    <div class="foot">${esc(s.website)}</div>
  </div></div>`;
}
function pdfVervolgHtml(b, s, L, v) {
    const fotoHtml = v.fotos2.length ? `<div class="fotos">${v.fotos2.map(f => `<img src="${f}" alt="">`).join("")}</div>` : "";
    const urenHtml = v.dagenRest.length ? `<div class="blok">${pdfUrenHtml(v.dagenRest, b.taal, L, true)}</div>` : "";
    return `<div class="page"><div class="frame">
    <div class="vervolgKop"><span>${esc(L.vervolg)} N° ${esc(b.nr)}</span><span>${esc(b.klantNaam || "")}</span></div>
    ${v.deel2 ? `<div class="blok desc"><div class="descTxt" style="font-size:14px">${nl2br(v.deel2)}</div>${fotoHtml}</div>`
        : (fotoHtml ? `<div class="blok desc">${fotoHtml}</div>` : "")}
    ${urenHtml}
    <div class="foot" style="margin-top:auto">${esc(s.website)}</div>
  </div></div>`;
}
function buildPdfInner(b, s) {
    const L = LBL[b.taal || "nl"];
    const v = verdeel(b);
    return pdfPaginaHtml(b, s, L, v) + (v.extra ? pdfVervolgHtml(b, s, L, v) : "");
}
function buildPdfHtml(b, s) {
    return `<style>${pdfStyles}</style><div class="bonRoot">${buildPdfInner(b, s)}</div>`;
}
/* ---------- externe libs ---------- */
function laadScript(src) {
    return new Promise((res, rej) => {
        if (document.querySelector('script[src="' + src + '"]'))
            return res();
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error("laden mislukt"));
        document.head.appendChild(s);
    });
}
async function laadPdfLibs() {
    await laadScript("libs/html2canvas.min.js");
    await laadScript("libs/jspdf.umd.min.js");
}
async function maakPdfBlob(bon, settings) {
    await laadPdfLibs();
    const houder = document.createElement("div");
    houder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
    houder.innerHTML = buildPdfHtml(bon, settings);
    document.body.appendChild(houder);
    try {
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const paginas = houder.querySelectorAll(".page");
        for (let i = 0; i < paginas.length; i++) {
            const canvas = await window.html2canvas(paginas[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
            const img = canvas.toDataURL("image/jpeg", 0.8);
            if (i > 0)
                doc.addPage();
            doc.addImage(img, "JPEG", 7, 7, 196, 283);
        }
        return doc.output("blob");
    }
    finally {
        document.body.removeChild(houder);
    }
}
function pdfNaam(bon) {
    return "Werkbon " + bon.nr + ".pdf";
}
