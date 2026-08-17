/* AGENT I — comptage réel des écrans/gestes avant la 1re décision jouée.
   Uniquement des clics et des scrolls, comme un vrai utilisateur. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const OUT = path.resolve(__dirname, "screens");

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const results = {};
  for (const W of [360, 390, 412]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: W === 360 ? 800 : W === 390 ? 844 : 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const steps = [];
    const note = (s, extra) => steps.push({ etape: steps.length + 1, ecran: s, ...extra });

    await page.goto(APP); await page.waitForTimeout(600);

    // Écran 1 — onboarding
    let m = await page.evaluate(() => {
      const p = document.querySelector(".ob-panel"), b = document.getElementById("obStart");
      return { hauteurContenu: p.scrollHeight, hauteurEcran: window.innerHeight, ctaY: Math.round(b.getBoundingClientRect().top), champsObligatoires: 1, champsOptionnels: 2 };
    });
    note("1 · Onboarding (pseudo + 12 symboles + 3 mentors)", { ...m, scrollNecessaire: m.ctaY > m.hauteurEcran, gestes: "1 saisie + 1 scroll + 1 tap" });
    await page.fill("#obName", "Melchior");
    await page.click("#obStart"); await page.waitForTimeout(400);

    // Écran 2 — accueil
    m = await page.evaluate(() => {
      const h = document.getElementById("v-home");
      const table = [...h.querySelectorAll(".mode-card")].find(b => /Table/.test(b.innerText));
      return { hauteurContenu: h.scrollHeight, hauteurEcran: window.innerHeight, ctaTableY: Math.round(table.getBoundingClientRect().top + window.scrollY), autresCTA: h.querySelectorAll("button").length };
    });
    note("2 · Accueil", { ...m, scrollNecessaire: m.ctaTableY > m.hauteurEcran, gestes: "1 scroll + 1 tap" });
    await page.evaluate(() => { const t = [...document.querySelectorAll("#v-home .mode-card")].find(b => /Table/.test(b.innerText)); t.scrollIntoView(); t.click(); });
    await page.waitForTimeout(400);

    // Écran 3 — interstitiel "Distribuer une main"
    m = await page.evaluate(() => {
      const v = document.getElementById("v-play");
      return { texte: v.innerText.split("\n")[0], mots: v.innerText.split(/\s+/).length, hauteurContenu: v.scrollHeight };
    });
    note("3 · Interstitiel « Chaque main est nouvelle »", { ...m, gestes: "1 tap" });
    await page.click("#v-play .btn.pri"); await page.waitForTimeout(500);

    // Écran 4 — la main
    m = await page.evaluate(() => {
      const v = document.getElementById("v-play");
      const acts = v.querySelectorAll(".act");
      const first = acts[0] ? Math.round(acts[0].getBoundingClientRect().top + window.scrollY) : null;
      return { hauteurContenu: v.scrollHeight, hauteurEcran: window.innerHeight, premierBoutonActionY: first, nbOptions: acts.length, niveauParDefaut: App.cfg.level, modeParDefaut: App.cfg.mode, hud: !!v.querySelector(".sess-hud,.daily-hud") };
    });
    note("4 · Table — première décision", { ...m, scrollNecessaire: m.premierBoutonActionY > m.hauteurEcran, gestes: "1 tap" });

    results[W] = steps;
    console.log("=== " + W + "px ===");
    console.log(JSON.stringify(steps, null, 1));
    await page.screenshot({ path: path.join(OUT, `70-first-decision@${W}.png`), fullPage: false });
    await ctx.close();
  }
  fs.writeFileSync(path.join(__dirname, "onboarding.json"), JSON.stringify(results, null, 2));
  await browser.close();
})();
