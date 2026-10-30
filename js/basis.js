/* Werkbon MT Service: basis (React-hooks, opslag-hulp, constanten, standaardinstellingen) */
const { useState, useRef, useEffect, useMemo } = React;
/* ---------- opslag ---------- */
const LS = {
    get(k, d) { const v = WBStore.cache["wb_" + k]; return v === undefined ? d : v; },
    set(k, v) { WBStore.zet("wb_" + k, v); return true; },
    del(k) { WBStore.wis("wb_" + k); }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ACC = "#f68f1e";
const ACC_BON = "#c9700f";
const KOP_GRIJS = "#e8e9eb";
const GRIJS = "#91969d";
const ACC_DONKER = "#c26a12";
const DEFAULT_SETTINGS = {
    bedrijfsnaam: "MT Service",
    adres: "Rue de l'Île Saint-Hélène 5, B-1070 Anderlecht",
    telefoon: "0032 (0)2 555 11 55",
    fax: "0032 (0)2 555 11 51",
    website: "www.mtservice.be",
    appTaal: "nl",
    bonTaal: "nl",
    nrVan: 15000,
    nrTot: 15999,
    techNaam: "",
    techEmail: "",
    techSig: "",
    pauzeMin: 30,
    oneDriveUrl: "",
    logo: "",
    dienstEmail: "",
    dienstEmailAan: true,
    onderwerp: { nl: "Werkbon", fr: "Bon de travail", de: "Arbeitsschein", en: "Work order", cs: "Pracovní list" },
    mail: { nl: "In bijlage de werkbon.", fr: "Veuillez trouver le bon de travail en annexe.", de: "Anbei der Arbeitsschein.", en: "Please find the work order attached.", cs: "V příloze zasíláme pracovní list." }
};
/* versie: samen verhogen met VERSIE in sw.js */
const VERSIE = "1.17";
const APP_CODE = "MT2026";
