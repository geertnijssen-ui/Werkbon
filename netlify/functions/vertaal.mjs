/* Vertaler voor de werkbon-app: stuurt de tekst door naar DeepL.
   De DeepL-sleutel staat als omgevingsvariabele DEEPL_KEY in Netlify (Site configuration > Environment variables),
   zodat ze niet in de app zelf zit. */
const TALEN = { nl: "NL", fr: "FR", de: "DE", en: "EN-GB", cs: "CS" };

const antwoord = (status, data) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return antwoord(405, { fout: "methode" });
  if (req.headers.get("x-app") !== "werkbon-mt") return antwoord(403, { fout: "toegang" });
  const sleutel = process.env.DEEPL_KEY;
  if (!sleutel) return antwoord(501, { fout: "geen-sleutel" });
  let body;
  try { body = await req.json(); } catch (e) { return antwoord(400, { fout: "json" }); }
  const { teksten, van, naar } = body || {};
  if (!Array.isArray(teksten) || !teksten.length || !TALEN[naar] || teksten.join("").length > 20000) return antwoord(400, { fout: "invoer" });
  /* gratis sleutels eindigen op ":fx" en gebruiken een ander adres */
  const url = sleutel.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const params = { text: teksten, target_lang: TALEN[naar], preserve_formatting: true };
  if (TALEN[van]) params.source_lang = TALEN[van].slice(0, 2);
  const r = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "DeepL-Auth-Key " + sleutel, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (r.status === 456) return antwoord(429, { fout: "limiet" });
  if (!r.ok) return antwoord(502, { fout: "deepl-" + r.status });
  const j = await r.json();
  return antwoord(200, { vertaald: j.translations.map(t => t.text) });
};
