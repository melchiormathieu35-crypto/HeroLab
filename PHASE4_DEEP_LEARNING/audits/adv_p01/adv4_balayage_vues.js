/**
 * SONDE 4 — Balayage systématique : d'AUTRES vues sont-elles inatteignables ?
 *
 * Pour chaque géométrie, uniquement par clics :
 *   - ouvrir le menu de l'hôte, vérifier que CHACUN des 15 onglets du rail est
 *     réellement cliquable (actionnabilité Playwright + test de recouvrement),
 *   - vérifier que le clic change bien App.view,
 *   - dans chaque vue atteinte, recenser les contrôles interactifs hors champ
 *     ou recouverts (le motif « tiroir hors champ » ailleurs),
 *   - repérer tout élément dont le transform le sort du viewport.
 */
const fs = require("fs");
const path = require("path");
const { launch, openApp, SHOTS } = require("./adv_lib");

const target = process.argv[2] || "PHASE4_DEEP_LEARNING/herolab-p4.html";
const tag = process.argv[3] || "p4";

const GEOS = [
  { nom: "320x568", width: 320, height: 568 },
  { nom: "360x800", width: 360, height: 800 },
  { nom: "412x915", width: 412, height: 915 },
  { nom: "768x1024", width: 768, height: 1024 },
  { nom: "800x360-paysage", width: 800, height: 360 },
  { nom: "1280x800", width: 1280, height: 800 }
];

(async () => {
  const browser = await launch();
  const rapport = {};

  for (const g of GEOS) {
    const { ctx, page, jsErrors } = await openApp(browser, target, g);
    const d = rapport[g.nom] = { onglets: [], vuesVides: [], horsChamp: [] };

    const tabs = await page.$$eval(".rail nav .tab", e => e.map(x => x.dataset.v));
    d.nbTabs = tabs.length;

    for (const v of tabs) {
      const o = { v };
      // ouvrir le menu si nécessaire (drawer sous 820px)
      const burgerVisible = await page.evaluate(() =>
        getComputedStyle(document.getElementById("burger")).display !== "none");
      o.burger = burgerVisible;
      if (burgerVisible) {
        try { await page.click("#burger", { timeout: 1500 }); await page.waitForTimeout(350); }
        catch (e) { o.burgerClic = "echec"; }
      }
      // recouvrement / hors champ
      o.hit = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return "absent";
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return "taille nulle";
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight)
          return `hors viewport (x=${Math.round(r.x)},y=${Math.round(r.y)})`;
        const top = document.elementFromPoint(cx, cy);
        return top && (el.contains(top) || top.contains(el)) ? "ok"
          : "recouvert par ." + (top ? top.className : "?");
      }, `.rail nav .tab[data-v="${v}"]`);
      try {
        await page.click(`.rail nav .tab[data-v="${v}"]`, { timeout: 2000 });
        o.clic = "ok";
      } catch (e) { o.clic = "echec"; }
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => {
        const on = [...document.querySelectorAll(".pane > .view.on")].map(e => e.id);
        const p = document.querySelector(".pane > .view.on");
        return {
          appView: App.view, on,
          chars: p ? (p.innerText || "").trim().length : -1,
          debord: document.documentElement.scrollWidth > innerWidth + 1,
          scrollW: document.documentElement.scrollWidth
        };
      });
      o.appView = st.appView;
      o.viewOn = st.on.join(",");
      o.correspond = st.appView === v;
      o.chars = st.chars;
      o.debordement = st.debord ? st.scrollW : false;
      if (o.clic === "ok" && st.chars < 40) d.vuesVides.push(`${v}(${st.chars}c)`);

      // contrôles interactifs hors champ dans la vue courante
      o.controlesHorsChamp = await page.evaluate(() => {
        const out = [];
        const cible = document.querySelector(".pane > .view.on");
        if (!cible) return out;
        for (const el of cible.querySelectorAll("button,a,input,select,[role=button]")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // hors champ HORIZONTALEMENT (le motif du tiroir) — le scroll vertical
          // est légitime, le décalage latéral ne l'est pas.
          if (r.right <= 0 || r.left >= innerWidth) {
            out.push({
              t: (el.textContent || el.value || el.id || el.className).slice(0, 40),
              x: Math.round(r.x), transform: cs.transform
            });
          }
          if (out.length > 8) break;
        }
        return out;
      });
      if (o.controlesHorsChamp.length) d.horsChamp.push({ vue: v, n: o.controlesHorsChamp.length, ex: o.controlesHorsChamp.slice(0, 3) });
      d.onglets.push(o);
    }

    // Le rail lui-même est-il entièrement parcourable dans cette géométrie ?
    d.rail = await page.evaluate(() => {
      App.openMenu();
      const nav = document.querySelector(".rail nav");
      const tabs = [...nav.querySelectorAll(".tab")];
      const last = tabs[tabs.length - 1];
      const r = last.getBoundingClientRect(), nr = nav.getBoundingClientRect();
      return {
        navH: Math.round(nr.height), navScrollH: nav.scrollHeight,
        scrollable: nav.scrollHeight > nr.height + 1,
        overflowY: getComputedStyle(nav).overflowY,
        dernierOngletY: Math.round(r.y), dernierVisible: r.y >= 0 && r.bottom <= innerHeight
      };
    });

    d.jsErrors = jsErrors.slice(0, 4);
    await page.screenshot({ path: path.join(SHOTS, `adv4_${tag}_${g.nom}.png`) });
    await ctx.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(__dirname, `adv4_${tag}.json`), JSON.stringify(rapport, null, 2));
  for (const g of GEOS) {
    const d = rapport[g.nom];
    const nonClic = d.onglets.filter(o => o.clic !== "ok").map(o => o.v);
    const nonCorr = d.onglets.filter(o => !o.correspond).map(o => `${o.v}->${o.appView}`);
    const deb = d.onglets.filter(o => o.debordement).map(o => `${o.v}(${o.debordement}px)`);
    console.log(`\n== ${g.nom} (${d.nbTabs} onglets du rail)`);
    console.log(`   onglets non cliquables : ${nonClic.length ? nonClic.join(", ") : "aucun"}`);
    console.log(`   vue obtenue ≠ demandée : ${nonCorr.length ? nonCorr.join(", ") : "aucune"}`);
    console.log(`   vues quasi vides       : ${d.vuesVides.length ? d.vuesVides.join(", ") : "aucune"}`);
    console.log(`   débordement horizontal : ${deb.length ? deb.join(", ") : "aucun"}`);
    console.log(`   contrôles hors champ   : ${d.horsChamp.length ? JSON.stringify(d.horsChamp).slice(0, 300) : "aucun"}`);
    console.log(`   rail scrollable=${d.rail.scrollable} overflowY=${d.rail.overflowY} dernier onglet visible=${d.rail.dernierVisible}`);
    console.log(`   erreurs JS : ${d.jsErrors.length ? d.jsErrors.join(" | ").slice(0, 200) : "aucune"}`);
  }
})();
