/**
 * SONDE 1 — Parcours utilisateur STRICT, sans aucun appel programmatique.
 *
 * Différences avec p0_1_tracker_mobile.js :
 *  - le Tracker est atteint par des CLICS (burger -> onglet du rail), jamais
 *    par App.go() ;
 *  - après chaque clic d'onglet, on vérifie que la vue ACTIVE est bien celle
 *    demandée (le test d'origine se contente de compter les caractères de
 *    « la » vue active, quelle qu'elle soit) ;
 *  - on vérifie la géométrie : la vue rendue est-elle dans le viewport ?
 *  - on vérifie que l'élément au centre de l'onglet est bien l'onglet
 *    (rien ne le recouvre).
 */
const fs = require("fs");
const path = require("path");
const { launch, openApp, VIEWPORTS, SHOTS } = require("./adv_lib");

const target = process.argv[2] || "PHASE4_DEEP_LEARNING/herolab-p4.html";
const tag = process.argv[3] || "p4";

const R = [];
const rec = (vp, nom, pass, det) => R.push({ vp, nom, pass, det: det || "" });

(async () => {
  const browser = await launch();
  const rapport = {};

  for (const vp of VIEWPORTS) {
    const { ctx, page, jsErrors } = await openApp(browser, target, vp);
    const d = { viewport: vp.nom };

    // 1. Atteindre le Tracker uniquement par des clics.
    let atteint = false;
    try {
      const burgerVisible = await page.isVisible("#burger");
      d.burgerVisible = burgerVisible;
      if (burgerVisible) await page.click("#burger", { timeout: 2000 });
      await page.waitForTimeout(400);
      await page.click('.rail .tab[data-v="tracker"]', { timeout: 2500 });
      await page.waitForTimeout(700);
      atteint = await page.evaluate(() => App.view === "tracker");
    } catch (e) {
      d.erreurNav = e.message.split("\n")[0];
    }
    rec(vp.nom, "Tracker atteint par clics seuls (burger + onglet rail)", atteint, d.erreurNav);

    if (!atteint) {
      // On force pour continuer à mesurer le reste.
      await page.evaluate(() => { App.go("tracker"); if (window.Feutre) Feutre.open(); });
      await page.waitForTimeout(600);
      d.forcage = true;
    }

    // 2. Géométrie de la sidebar du Tracker.
    d.sidebar = await page.evaluate(() => {
      const s = document.querySelector("#v-tracker .sidebar");
      if (!s) return null;
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        transform: cs.transform, position: cs.position, zIndex: cs.zIndex
      };
    });

    // 3. Les 9 onglets : clic réel + vérification STRICTE de la vue obtenue.
    const vues = await page.$$eval("#v-tracker .ft-nav-item", els => els.map(e => e.dataset.view));
    d.nbOnglets = vues.length;
    const detailOnglets = [];
    for (const v of vues) {
      const sel = `#v-tracker .ft-nav-item[data-view="${v}"]`;
      const o = { vue: v };
      // recouvrement : quel élément est réellement au centre de l'onglet ?
      o.hitTest = await page.evaluate(s => {
        const el = document.querySelector(s);
        if (!el) return "absent";
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return "taille nulle";
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return "hors viewport";
        const top = document.elementFromPoint(cx, cy);
        if (!top) return "rien";
        return el.contains(top) || top.contains(el) ? "ok" : "recouvert par " + top.tagName + "." + top.className;
      }, sel);
      try {
        await page.click(sel, { timeout: 1500 });
        o.clic = "ok";
      } catch (e) { o.clic = "echec"; }
      await page.waitForTimeout(150);
      const etat = await page.evaluate(() => {
        const actives = [...document.querySelectorAll("#v-tracker .ft-view.active")].map(e => e.id);
        const p = document.querySelector("#v-tracker .ft-view.active");
        let geo = null;
        if (p) {
          const r = p.getBoundingClientRect();
          geo = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        return {
          ftView: window.FT ? FT.view : (window.Feutre ? undefined : null),
          actives,
          chars: p ? (p.innerText || "").trim().length : -1,
          geo
        };
      });
      o.vueActive = etat.actives.join(",");
      o.correspond = etat.actives.length === 1 && etat.actives[0] === "v-" + v;
      o.chars = etat.chars;
      o.geo = etat.geo;
      // La vue est-elle réellement visible dans le viewport ?
      o.dansViewport = !!etat.geo && etat.geo.w > 0 && etat.geo.h > 0 &&
        etat.geo.x + etat.geo.w > 0 && etat.geo.x < vp.width;
      detailOnglets.push(o);
    }
    d.onglets = detailOnglets;

    const nonClic = detailOnglets.filter(o => o.clic !== "ok").map(o => o.vue);
    const nonCorr = detailOnglets.filter(o => !o.correspond).map(o => `${o.vue}->${o.vueActive || "aucune"}`);
    const horsVp = detailOnglets.filter(o => !o.dansViewport).map(o => o.vue);
    rec(vp.nom, "les 9 onglets sont cliquables", nonClic.length === 0, nonClic.join(", "));
    rec(vp.nom, "chaque clic active EXACTEMENT la vue demandée", nonCorr.length === 0, nonCorr.join(", "));
    rec(vp.nom, "la vue rendue est dans le viewport", horsVp.length === 0, horsVp.join(", "));

    await page.screenshot({ path: path.join(SHOTS, `adv1_${tag}_${vp.nom}_tracker.png`), fullPage: false });

    d.jsErrors = jsErrors.slice(0, 3);
    rec(vp.nom, "aucune erreur JS", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));
    rapport[vp.nom] = d;
    await ctx.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(__dirname, `adv1_${tag}.json`), JSON.stringify(rapport, null, 2));
  let p = 0, f = 0;
  for (const r of R) {
    if (r.pass) { p++; console.log(`  PASS  ${r.vp} · ${r.nom}`); }
    else { f++; console.log(`  FAIL  ${r.vp} · ${r.nom}\n        ${r.det}`); }
  }
  console.log(`\n[${tag}] ${p} PASS, ${f} FAIL`);
})();
