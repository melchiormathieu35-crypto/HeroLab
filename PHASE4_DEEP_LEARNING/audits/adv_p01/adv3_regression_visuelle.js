/**
 * SONDE 3 — Régression visuelle et fonctionnelle de transform:none!important.
 *
 * a) Captures baseline vs corrigé sur 7 géométries (5 imposées + 2 rotations)
 *    et aux bornes de la media query (760 / 761 px), sur 3 vues de l'hôte.
 * b) Le menu de l'application hôte reste-t-il opérant DEPUIS le Tracker ?
 * c) La barre latérale du Tracker a-t-elle un transform autre que none dans
 *    l'état corrigé (donc une animation cassée) ?
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { launch, openApp, SHOTS } = require("./adv_lib");

const GEOS = [
  { nom: "360x800", width: 360, height: 800 },
  { nom: "390x844", width: 390, height: 844 },
  { nom: "412x915", width: 412, height: 915 },
  { nom: "768x1024", width: 768, height: 1024 },
  { nom: "1280x800", width: 1280, height: 800 },
  { nom: "800x360-paysage", width: 800, height: 360 },
  { nom: "844x390-paysage", width: 844, height: 390 },
  { nom: "760x900-borne", width: 760, height: 900 },
  { nom: "761x900-borne", width: 761, height: 900 }
];

const CIBLES = [
  { tag: "base", f: "VERSION_PRODUCTION/herolab.html" },
  { tag: "p4", f: "PHASE4_DEEP_LEARNING/herolab-p4.html" }
];

const sha = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 12);

(async () => {
  const browser = await launch();
  const rapport = {};

  for (const c of CIBLES) {
    for (const g of GEOS) {
      const { ctx, page } = await openApp(browser, c.f, g);
      const k = `${g.nom}`;
      rapport[k] = rapport[k] || {};
      const d = rapport[k][c.tag] = {};

      // --- vue d'accueil (hors Tracker) : la correction ne doit RIEN y changer
      await page.evaluate(() => App.go("home"));
      await page.waitForTimeout(500);
      const fHome = path.join(SHOTS, `adv3_${c.tag}_${g.nom}_home.png`);
      await page.screenshot({ path: fHome });
      d.homeSha = sha(fHome);

      // --- Tracker
      await page.evaluate(() => { App.go("tracker"); if (window.Feutre) Feutre.open(); });
      await page.waitForTimeout(800);
      const fTr = path.join(SHOTS, `adv3_${c.tag}_${g.nom}_tracker.png`);
      await page.screenshot({ path: fTr });
      d.trackerSha = sha(fTr);
      d.sidebar = await page.evaluate(() => {
        const s = document.querySelector("#v-tracker .sidebar");
        const cs = getComputedStyle(s); const r = s.getBoundingClientRect();
        return { transform: cs.transform, transition: cs.transition,
          x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
      });
      // fraction du 1er écran occupée par la navigation avant tout contenu
      d.contenuY = await page.evaluate(() => {
        const p = document.querySelector("#v-tracker .ft-view.active");
        return p ? Math.round(p.getBoundingClientRect().y) : null;
      });
      d.partNav = d.contenuY == null ? null : +(d.contenuY / g.height).toFixed(2);

      // --- menu de l'application hôte OUVERT DEPUIS le Tracker
      const menu = await page.evaluate(() => {
        const burgerVisible = getComputedStyle(document.getElementById("burger")).display !== "none";
        App.openMenu();
        const rail = document.getElementById("rail");
        const cs = getComputedStyle(rail); const r = rail.getBoundingClientRect();
        const scrim = document.getElementById("scrim");
        return {
          burgerVisible,
          railTransform: cs.transform,
          railX: Math.round(r.x), railW: Math.round(r.width),
          railZ: cs.zIndex,
          scrimOn: scrim.classList.contains("on"),
          // l'onglet Accueil du rail est-il réellement cliquable au 1er plan ?
          hit: (() => {
            const t = document.querySelector('.rail .tab[data-v="home"]');
            const rr = t.getBoundingClientRect();
            const cx = rr.x + rr.width / 2, cy = rr.y + rr.height / 2;
            if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return "hors viewport";
            const top = document.elementFromPoint(cx, cy);
            return top && (t.contains(top) || top.contains(t)) ? "ok" : "recouvert:" + (top && top.className);
          })()
        };
      });
      d.menuHote = menu;
      const fMenu = path.join(SHOTS, `adv3_${c.tag}_${g.nom}_menu-hote.png`);
      await page.screenshot({ path: fMenu });
      d.menuSha = sha(fMenu);

      // le menu hôte permet-il de quitter le Tracker par un vrai clic ?
      let sortie = "echec";
      try {
        await page.click('.rail .tab[data-v="home"]', { timeout: 2000 });
        await page.waitForTimeout(400);
        sortie = await page.evaluate(() => App.view);
      } catch (e) { sortie = "clic impossible"; }
      d.sortieParMenu = sortie;

      await ctx.close();
    }
  }
  await browser.close();

  // Synthèse
  console.log("géométrie          | home identique | tracker identique | menu identique | sidebar.transform (p4) | part nav (p4) | sortie menu (p4)");
  for (const g of GEOS) {
    const r = rapport[g.nom];
    const line = [
      g.nom.padEnd(18),
      (r.base.homeSha === r.p4.homeSha ? "OUI" : "NON").padEnd(14),
      (r.base.trackerSha === r.p4.trackerSha ? "OUI" : "NON").padEnd(17),
      (r.base.menuSha === r.p4.menuSha ? "OUI" : "NON").padEnd(14),
      r.p4.sidebar.transform.padEnd(22),
      String(r.p4.partNav).padEnd(13),
      r.p4.sortieParMenu
    ].join(" | ");
    console.log(line);
  }
  fs.writeFileSync(path.join(__dirname, "adv3_regression.json"), JSON.stringify(rapport, null, 2));
})();
