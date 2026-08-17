/**
 * SONDE 5 — Détecteur générique de la signature P0.1.
 *
 * Le défaut P0.1 a une signature mesurable : un conteneur porteur d'éléments
 * focusables, dont le transform (ou la position) le place entièrement hors du
 * champ horizontal, sans qu'aucun contrôle visible ne permette de le ramener.
 * On balaye TOUTES les vues de l'hôte, à chaque géométrie, et on signale :
 *   A. tout conteneur hors champ horizontal contenant des focusables ;
 *   B. tout contrôle interactif de second niveau (sous-onglets internes aux
 *      vues) non cliquable par un utilisateur.
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
  { nom: "760x900", width: 760, height: 900 },
  { nom: "1280x800", width: 1280, height: 800 }
];

const SCAN = () => {
  const res = [];
  const focusSel = "button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])";
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    // « hors champ » = plus de 90% de la largeur en dehors du viewport.
    const dedans = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const dehors = dedans / r.width < 0.10;
    if (!dehors) continue;
    const foc = [...el.querySelectorAll(focusSel)].filter(f => {
      const c = getComputedStyle(f);
      return c.display !== "none" && c.visibility !== "hidden";
    });
    if (!foc.length) continue;
    // ignorer les descendants d'un conteneur déjà signalé
    if (res.some(x => x._el && x._el.contains(el))) continue;
    res.push({
      _el: el,
      sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.className).slice(0, 50),
      x: Math.round(r.x), w: Math.round(r.width),
      transform: cs.transform, position: cs.position,
      nbFocusables: foc.length,
      exemples: foc.slice(0, 3).map(f => (f.textContent || f.id || "").trim().slice(0, 28))
    });
  }
  return res.map(({ _el, ...o }) => o);
};

(async () => {
  const browser = await launch();
  const rapport = {};
  for (const g of GEOS) {
    const { ctx, page } = await openApp(browser, target, g);
    const d = rapport[g.nom] = { signatures: {}, secondNiveau: {} };
    const vues = await page.$$eval(".rail nav .tab", e => e.map(x => x.dataset.v));

    for (const v of vues) {
      await page.evaluate(vv => { App.go(vv); if (vv === "tracker" && window.Feutre) Feutre.open(); }, v);
      await page.waitForTimeout(600);
      const sig = await page.evaluate(SCAN);
      if (sig.length) d.signatures[v] = sig;

      // Second niveau : contrôles internes à la vue, réellement cliquables ?
      const ctrls = await page.evaluate(() => {
        const p = document.querySelector(".pane > .view.on");
        if (!p) return [];
        const out = [];
        const els = [...p.querySelectorAll("button, [role=tab], .tabbtn, .seg, .subtab")];
        for (const el of els.slice(0, 60)) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          let etat = "ok";
          if (cx < 0 || cx > innerWidth) etat = `hors champ horizontal (x=${Math.round(r.x)})`;
          else if (cy >= 0 && cy <= innerHeight) {
            const top = document.elementFromPoint(cx, cy);
            if (top && !el.contains(top) && !top.contains(el)) etat = "recouvert par ." + String(top.className).slice(0, 30);
          }
          if (etat !== "ok") out.push({ t: (el.textContent || el.id || "").trim().slice(0, 30), etat, transform: cs.transform });
        }
        return out;
      });
      if (ctrls.length) d.secondNiveau[v] = ctrls;
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, `adv5_${tag}.json`), JSON.stringify(rapport, null, 2));

  for (const g of GEOS) {
    const d = rapport[g.nom];
    console.log(`\n== ${g.nom}`);
    const s = Object.keys(d.signatures);
    console.log(`  signature P0.1 (conteneur focusable hors champ) : ${s.length ? "" : "AUCUNE"}`);
    for (const v of s) for (const x of d.signatures[v])
      console.log(`     vue ${v} : ${x.sel} x=${x.x} w=${x.w} transform=${x.transform} pos=${x.position} focusables=${x.nbFocusables} [${x.exemples.join(" | ")}]`);
    const n = Object.keys(d.secondNiveau);
    console.log(`  contrôles de second niveau inatteignables : ${n.length ? "" : "AUCUN"}`);
    for (const v of n) console.log(`     vue ${v} : ${JSON.stringify(d.secondNiveau[v]).slice(0, 400)}`);
  }
})();
