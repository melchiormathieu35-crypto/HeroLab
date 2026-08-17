/**
 * SONDE 2 — Parcours d'un utilisateur RÉEL avec de VRAIES données, à 360×800.
 *
 * Onboarding -> Tracker (par clics) -> Import de 80 mains -> Dashboard ->
 * Analyse des leaks -> lancement d'un drill depuis une fuite -> retour.
 *
 * Le test officiel ne franchit jamais l'import : ses 9 vues sont toutes des
 * états vides d'environ 70 caractères. On mesure ici si le Tracker sert à
 * quelque chose une fois qu'il a des données.
 */
const fs = require("fs");
const path = require("path");
const { launch, openApp, SHOTS } = require("./adv_lib");

const target = process.argv[2] || "PHASE4_DEEP_LEARNING/herolab-p4.html";
const tag = process.argv[3] || "p4";
const VP = { nom: "360x800", width: 360, height: 800 };
const HISTO = path.join(__dirname, "histo_test.txt");

const R = [];
const rec = (n, p, d) => { R.push({ n, p, d: d || "" }); console.log(`  ${p ? "PASS" : "FAIL"}  ${n}${p ? "" : "\n        " + (d || "")}`); };

(async () => {
  const browser = await launch();
  const { ctx, page, jsErrors } = await openApp(browser, target, VP, { touch: true });
  const journal = { viewport: VP.nom, cible: target };

  // 1. Rejoindre le Tracker par clics
  await page.click("#burger", { timeout: 3000 });
  await page.waitForTimeout(350);
  await page.click('.rail .tab[data-v="tracker"]', { timeout: 3000 });
  await page.waitForTimeout(800);
  rec("Tracker atteint par clics", await page.evaluate(() => App.view === "tracker"));
  await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_1_tracker_vide.png`) });

  // 2. Aller sur Import & sessions et déposer le fichier
  let ongletImportCliquable = true;
  try { await page.click('#v-tracker .ft-nav-item[data-view="import"]', { timeout: 3000 }); }
  catch (e) { ongletImportCliquable = false; }
  journal.ongletImportCliquable = ongletImportCliquable;
  rec("l'onglet « Import & sessions » est cliquable", ongletImportCliquable);
  await page.waitForTimeout(400);
  const inputs = await page.$$('#v-tracker input[type="file"]');
  journal.nbInputsFichier = inputs.length;
  rec("un champ de fichier existe dans la vue Import", inputs.length > 0);
  await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_2_import.png`) });

  let importOk = false;
  if (inputs.length) {
    await inputs[0].setInputFiles(HISTO);
    await page.waitForTimeout(2500);
    const etat = await page.evaluate(() => {
      const log = document.getElementById("importLog");
      const nav = document.getElementById("navHands");
      return { log: (log ? log.innerText : "").trim().slice(0, 300), navHands: nav ? nav.textContent : null };
    });
    journal.import = etat;
    importOk = etat.navHands && parseInt(etat.navHands, 10) > 0;
    rec(`import de 80 mains pris en compte (compteur = ${etat.navHands})`, !!importOk, etat.log);
  }
  await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_3_apres_import.png`) });

  // 3. Chaque vue affiche-t-elle des données réelles, et la bonne ?
  const vues = await page.$$eval("#v-tracker .ft-nav-item", e => e.map(x => x.dataset.view));
  const detail = [];
  for (const v of vues) {
    try { await page.click(`#v-tracker .ft-nav-item[data-view="${v}"]`, { timeout: 2000 }); }
    catch (e) { detail.push({ v, err: "clic impossible" }); continue; }
    await page.waitForTimeout(350);
    const st = await page.evaluate(() => {
      const a = [...document.querySelectorAll("#v-tracker .ft-view.active")];
      const p = a[0];
      const r = p ? p.getBoundingClientRect() : null;
      // débordement horizontal de la page ?
      const deb = document.documentElement.scrollWidth > innerWidth + 1;
      return {
        id: a.map(x => x.id).join(","),
        chars: p ? (p.innerText || "").trim().length : -1,
        hauteur: r ? Math.round(r.height) : 0,
        debordement: deb,
        scrollW: document.documentElement.scrollWidth
      };
    });
    detail.push({ v, ...st, ok: st.id === "v-" + v });
    await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_vue_${v}.png`) });
  }
  journal.vues = detail;
  rec("chaque onglet active la bonne vue (avec données)",
    detail.every(d => d.ok), detail.filter(d => !d.ok).map(d => `${d.v}->${d.id || d.err}`).join(", "));
  rec("aucun débordement horizontal à 360px",
    detail.every(d => !d.debordement), detail.filter(d => d.debordement).map(d => `${d.v}(scrollW=${d.scrollW})`).join(", "));
  rec("les vues montrent plus qu'un état vide (>200 car.)",
    detail.filter(d => d.chars > 200).length >= 5,
    detail.map(d => `${d.v}:${d.chars}`).join(" "));

  // 4. Consulter les fuites et lancer un exercice
  let analyseAtteinte = true;
  try { await page.click('#v-tracker .ft-nav-item[data-view="analyse"]', { timeout: 3000 }); }
  catch (e) { analyseAtteinte = false; }
  journal.analyseAtteinte = analyseAtteinte;
  rec("l'onglet « Analyse des leaks » est atteignable", analyseAtteinte);
  await page.waitForTimeout(600);
  const nbLeaks = await page.$$eval("#v-tracker .leak", e => e.length).catch(() => 0);
  const nbDrill = await page.$$eval("#v-tracker .leak-drill", e => e.length).catch(() => 0);
  journal.leaks = { nbLeaks, nbDrill };
  rec(`la vue Analyse liste des fuites (${nbLeaks}) avec bouton d'exercice (${nbDrill})`, nbLeaks > 0);
  await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_4_analyse.png`) });

  let drillOk = null;
  if (nbDrill > 0) {
    try {
      await page.click("#v-tracker .leak-drill", { timeout: 2500 });
      await page.waitForTimeout(1200);
      const st = await page.evaluate(() => ({ view: App.view, phase: App.phase, drill: !!App.drillRun }));
      journal.drill = st;
      drillOk = st.view === "play";
      rec(`lancer un exercice depuis une fuite mène à la table (view=${st.view})`, !!drillOk);
    } catch (e) {
      rec("lancer un exercice depuis une fuite", false, e.message.split("\n")[0]);
    }
    await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_5_drill.png`) });
  } else {
    rec("un bouton d'exercice est proposé sur au moins une fuite", false, "aucun .leak-drill rendu");
  }

  // 5. Revenir au Tracker par clics
  try {
    await page.click("#burger", { timeout: 2500 });
    await page.waitForTimeout(350);
    await page.click('.rail .tab[data-v="tracker"]', { timeout: 2500 });
    await page.waitForTimeout(700);
    rec("retour au Tracker par clics après l'exercice", await page.evaluate(() => App.view === "tracker"));
  } catch (e) { rec("retour au Tracker par clics après l'exercice", false, e.message.split("\n")[0]); }
  await page.screenshot({ path: path.join(SHOTS, `adv2_${tag}_6_retour.png`) });

  journal.jsErrors = jsErrors;
  rec("aucune erreur JS sur tout le parcours", jsErrors.length === 0, jsErrors.slice(0, 3).join(" | "));

  fs.writeFileSync(path.join(__dirname, `adv2_${tag}.json`), JSON.stringify(journal, null, 2));
  await ctx.close(); await browser.close();
  const f = R.filter(r => !r.p).length;
  console.log(`\n[${tag}] ${R.length - f} PASS, ${f} FAIL`);
})();
