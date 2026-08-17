/**
 * SONDE 6 — Le discriminant : un tiroir hors champ n'est un défaut que si
 * AUCUN contrôle visible ne permet de le ramener.
 *
 * On compare les deux tiroirs de l'application dans la vue Tracker à 360×800 :
 *   - le rail de l'hôte (#rail), ouvert par #burger ;
 *   - la barre latérale du Tracker (#v-tracker #sidebar).
 */
const { launch, openApp } = require("./adv_lib");

const CIBLES = [
  { tag: "base", f: "VERSION_PRODUCTION/herolab.html" },
  { tag: "p4", f: "PHASE4_DEEP_LEARNING/herolab-p4.html" }
];
const VP = { nom: "360x800", width: 360, height: 800 };

(async () => {
  const browser = await launch();
  for (const c of CIBLES) {
    const { ctx, page } = await openApp(browser, c.f, VP);
    await page.evaluate(() => { App.go("tracker"); if (window.Feutre) Feutre.open(); });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const vis = el => el && getComputedStyle(el).display !== "none" &&
        getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0;
      const railBurger = document.getElementById("burger");            // 1er du doc = hôte
      const tr = document.getElementById("v-tracker");
      const ftBurger = tr.querySelector("#burger");
      const ftScrim = tr.querySelector("#scrim");
      const sb = tr.querySelector("#sidebar");
      const csSb = getComputedStyle(sb);
      // FT.openMenu a-t-il un effet ?
      const avant = sb.className;
      try { if (window.Feutre && Feutre.controller) Feutre.controller.openMenu(); } catch (e) {}
      const apres = sb.className;
      return {
        railBurgerVisible: vis(railBurger),
        ftBurgerVisible: vis(ftBurger),
        ftBurgerDisplay: ftBurger ? getComputedStyle(ftBurger).display : null,
        ftScrimVisible: vis(ftScrim),
        sidebarTransform: csSb.transform,
        sidebarX: Math.round(sb.getBoundingClientRect().x),
        openMenuChangeClasse: avant !== apres,
        classeApresOpenMenu: apres,
        // toute autre commande visible qui ouvrirait le tiroir ?
        autresCommandes: [...tr.querySelectorAll("button")]
          .filter(b => vis(b) && /menu|☰|nav/i.test((b.textContent || "") + b.className + b.id)).length
      };
    });
    console.log(`\n[${c.tag}]`, JSON.stringify(r, null, 2));
    await ctx.close();
  }
  await browser.close();
})();
