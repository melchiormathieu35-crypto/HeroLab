/**
 * SONDE 8 — « Aucune régression : 37 tests navigateur au vert » est un artefact.
 *
 * tests/browser.js applique son assertion « zones tactiles ≥ 44px » à
 * `document.querySelectorAll("button, .btn, [onclick]")` mais ignore les
 * éléments de taille nulle. Comme la suite n'ouvre jamais le Tracker,
 * #v-tracker reste display:none et ses 9 onglets sont exclus du décompte.
 *
 * On rejoue ICI la MÊME assertion, mot pour mot, une fois le Tracker ouvert.
 */
const { launch, openApp } = require("./adv_lib");

const ASSERTION_BROWSER_JS = () => {
  const out = [];
  for (const b of document.querySelectorAll("button, .btn, [onclick]")) {
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 44) out.push(`${(b.textContent || "").trim().slice(0, 22)} (${Math.round(r.height)}px)`);
  }
  return out;
};

const CIBLES = [
  { tag: "base", f: "VERSION_PRODUCTION/herolab.html" },
  { tag: "p4", f: "PHASE4_DEEP_LEARNING/herolab-p4.html" }
];
const VPS = [{ nom: "360x800", width: 360, height: 800 }, { nom: "390x844", width: 390, height: 844 }];

(async () => {
  const browser = await launch();
  for (const c of CIBLES) {
    for (const vp of VPS) {
      const { ctx, page } = await openApp(browser, c.f, vp);
      const avant = await page.evaluate(ASSERTION_BROWSER_JS);
      await page.evaluate(() => { App.go("tracker"); if (window.Feutre) Feutre.open(); });
      await page.waitForTimeout(700);
      const apres = await page.evaluate(ASSERTION_BROWSER_JS);
      console.log(`[${c.tag}] ${vp.nom}  Tracker fermé : ${avant.length} cible(s) < 44px | Tracker ouvert : ${apres.length}`);
      if (apres.length) console.log(`        ex. : ${apres.slice(0, 6).join(" | ")}`);
      await ctx.close();
    }
  }
  await browser.close();
})();
