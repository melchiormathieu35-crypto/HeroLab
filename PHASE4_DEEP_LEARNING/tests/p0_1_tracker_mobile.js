/**
 * P0.1 — Le Tracker doit être utilisable sur mobile.
 *
 * Ce test vérifie un PARCOURS, pas une propriété de rendu. Les suites de
 * Phase 2 contrôlaient l'absence de débordement et la taille des cibles
 * tactiles, et ont laissé passer une vue entièrement inatteignable : elles
 * mesuraient des propriétés du rendu, jamais la possibilité d'accomplir
 * quelque chose. Ici, la question posée est « l'utilisateur peut-il ouvrir
 * chacune des 9 vues du Tracker et revenir ? ».
 *
 * Usage : node PHASE4_DEEP_LEARNING/tests/p0_1_tracker_mobile.js [artefact.html]
 */
const path = require("path");
const { chromium } = require("playwright");

const target = process.argv[2] || "PHASE4_DEEP_LEARNING/herolab-p4.html";
const fileUrl = "file://" + path.resolve(__dirname, "..", "..", target);

const VIEWPORTS = [
  { nom: "360×800", width: 360, height: 800, mobile: true },
  { nom: "390×844", width: 390, height: 844, mobile: true },
  { nom: "412×915", width: 412, height: 915, mobile: true },
  { nom: "768×1024", width: 768, height: 1024, mobile: false },
  { nom: "1280×800", width: 1280, height: 800, mobile: false }
];

const results = [];
const t = async (nom, fn) => {
  try { await fn(); results.push({ nom, pass: true }); }
  catch (e) { results.push({ nom, pass: false, err: e.message }); }
};
const ok = (v, m) => { if (!v) throw new Error(m || "attendu vrai"); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ""} attendu ${b}, obtenu ${a}`); };

(async () => {
  console.log(`Cible : ${target}\n`);
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
  });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", e => erreurs.push(e.message));
    await page.goto(fileUrl, { waitUntil: "load" });
    await page.waitForTimeout(500);

    // ── Onboarding : un utilisateur réel le franchit AVANT tout le reste.
    //    Le contourner par App.go() laisserait l'écran #onboard superposé et
    //    rendrait toute l'application non cliquable — ce que ce test a
    //    précisément révélé lors de sa mise au point.
    await t(`${vp.nom} · l'onboarding se termine et libère l'interface`, async () => {
      await page.fill("#obName", "Testeur");
      await page.click("#obStart", { timeout: 3000 });
      await page.waitForTimeout(400);
      const ouvert = await page.evaluate(() => {
        const o = document.getElementById("onboard");
        return !!o && o.classList.contains("on");
      });
      ok(!ouvert, "l'écran d'onboarding est resté affiché");
    });

    // ── Parcours : Accueil → Tracker
    await t(`${vp.nom} · le Tracker s'ouvre depuis l'accueil`, async () => {
      const r = await page.evaluate(() => {
        App.go("home");
        App.go("tracker");
        if (window.Feutre) Feutre.open();
        return App.view;
      });
      eq(r, "tracker");
    });

    await page.waitForTimeout(600);

    // ── Les 9 onglets doivent être CLIQUABLES PAR UN UTILISATEUR.
    //    On utilise le clic de Playwright, qui respecte l'actionnabilité :
    //    il fait défiler jusqu'à l'élément et échoue si celui-ci est masqué,
    //    hors champ ou recouvert. Un `.click()` programmatique, lui, réussit
    //    même sur un élément invisible — il ne prouverait rien.
    const vues = await page.$$eval(".ft-nav-item", els => els.map(e => e.dataset.view));

    await t(`${vp.nom} · les 9 onglets sont cliquables par l'utilisateur`, async () => {
      eq(vues.length, 9, "9 onglets attendus dans le DOM —");
      const echecs = [];
      for (const v of vues) {
        try {
          await page.click(`.ft-nav-item[data-view="${v}"]`, { timeout: 1500 });
        } catch (e) {
          echecs.push(v);
        }
      }
      ok(echecs.length === 0,
        `onglets non cliquables (${echecs.length}/9) : ${echecs.join(", ")}`);
    });

    // ── Chaque vue affiche réellement du contenu après le clic utilisateur
    await t(`${vp.nom} · chaque vue affiche du contenu après clic`, async () => {
      const echecs = [];
      for (const v of vues) {
        try {
          await page.click(`.ft-nav-item[data-view="${v}"]`, { timeout: 1500 });
        } catch (e) { echecs.push(v + " (inatteignable)"); continue; }
        await page.waitForTimeout(120);
        const n = await page.evaluate(() => {
          const p = document.querySelector("#v-tracker .ft-view.active");
          return p ? (p.innerText || "").trim().length : -1;
        });
        // -1 = aucune vue active (défaut de navigation) ; 0 = vue vide.
        if (n < 20) echecs.push(`${v} (contenu ${n} car.)`);
      }
      ok(echecs.length === 0, `vues défaillantes : ${echecs.join(", ")}`);
    });

    // ── Retour à l'accueil
    await t(`${vp.nom} · retour à l'accueil possible`, async () => {
      const v = await page.evaluate(() => { App.go("home"); return App.view; });
      eq(v, "home");
    });

    await t(`${vp.nom} · aucune erreur JavaScript pendant le parcours`, async () => {
      ok(erreurs.length === 0, `erreurs : ${erreurs.slice(0, 2).join(" | ")}`);
    });

    await ctx.close();
  }

  await browser.close();

  let pass = 0, fail = 0;
  for (const r of results) {
    if (r.pass) { pass++; console.log(`  PASS  ${r.nom}`); }
    else { fail++; console.log(`  FAIL  ${r.nom}\n        ${r.err}`); }
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
