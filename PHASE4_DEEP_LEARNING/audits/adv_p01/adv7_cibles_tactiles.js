/**
 * SONDE 7 — La navigation rendue visible par P0.1 respecte-t-elle le seuil
 * tactile que l'application s'impose elle-même (44 px sous 820 px de large,
 * cf. commentaire du bloc @media (max-width:820px)) ?
 */
const { launch, openApp } = require("./adv_lib");
const VPS = [
  { nom: "360x800", width: 360, height: 800 },
  { nom: "412x915", width: 412, height: 915 },
  { nom: "768x1024", width: 768, height: 1024 }
];
(async () => {
  const browser = await launch();
  for (const vp of VPS) {
    const { ctx, page } = await openApp(browser, "PHASE4_DEEP_LEARNING/herolab-p4.html", vp, { touch: true });
    await page.evaluate(() => { App.go("tracker"); if (window.Feutre) Feutre.open(); });
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const nav = [...document.querySelectorAll("#v-tracker .ft-nav-item")].map(e => {
        const r = e.getBoundingClientRect();
        return { t: e.dataset.view, w: Math.round(r.width), h: Math.round(r.height) };
      });
      const rail = [...document.querySelectorAll(".rail nav .tab")].map(e => {
        const r = e.getBoundingClientRect();
        return { t: e.dataset.v, h: Math.round(r.height) };
      });
      return { nav, railMinH: Math.min(...rail.map(x => x.h)) };
    });
    const sous44 = m.nav.filter(n => n.h < 44);
    console.log(`\n${vp.nom} — onglets Tracker : hauteurs ${m.nav.map(n => n.h).join(",")}`);
    console.log(`  sous le seuil de 44 px : ${sous44.length}/${m.nav.length} (${sous44.map(n => n.t + ":" + n.h + "px").join(", ")})`);
    console.log(`  référence : onglets du rail de l'hôte, hauteur minimale = ${m.railMinH}px`);
    await ctx.close();
  }
  await browser.close();
})();
