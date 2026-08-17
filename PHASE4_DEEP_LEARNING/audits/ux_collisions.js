/* AGENT I — collisions visuelles sur la table + profondeur de la review. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const OUT = path.resolve(__dirname, "screens");

const overlap = (a, b) => {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
};

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const res = {};
  for (const W of [360, 390, 412]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(APP); await page.waitForTimeout(500);
    await page.fill("#obName", "M"); await page.click("#obStart"); await page.waitForTimeout(250);

    let collisions = [], reviewDepth = [], seats = 0;
    for (let n = 0; n < 25; n++) {
      await page.evaluate(() => { App.go("play"); App.newHand(); });
      await page.waitForTimeout(90);
      const c = await page.evaluate(() => {
        const root = document.querySelector("#v-play .table, #v-play .tbl, #v-play [class*='table']") || document.getElementById("v-play");
        // éléments textuels flottants de la table
        const sel = ".seat, .seat .nm, .seat .st, .bet, .pot, .potbox, .act, .badge, .chip";
        const els = [...root.querySelectorAll(sel)].filter(e => e.offsetParent && (e.innerText || "").trim());
        const boxes = els.map(e => { const r = e.getBoundingClientRect(); return { cls: e.className, t: e.innerText.trim().slice(0, 24), left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; })
          .filter(b => b.w > 0 && b.h > 0);
        return boxes;
      });
      seats = Math.max(seats, c.length);
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
        // ignorer conteneur/enfant
        const a = c[i], b = c[j];
        const contained = (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) ||
                          (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom);
        if (contained) continue;
        const o = overlap(a, b);
        if (o > 60) collisions.push({ a: a.t, b: b.t, px: Math.round(o), ca: a.cls, cb: b.cls });
      }
      // profondeur de la review
      const opts = await page.evaluate(() => Spot.options(App.t).length);
      if (opts) {
        await page.evaluate(() => { const o = Spot.options(App.t)[0]; App.choose(o.action, o.amount); });
        await page.waitForTimeout(90);
        const d = await page.evaluate(() => {
          const all = document.getElementById("v-play");
          const cta = [...all.querySelectorAll("button")].find(b => /Continuer la main|Spot suivant/.test(b.innerText));
          return { h: all.scrollHeight, chars: all.innerText.length, ctaY: cta ? Math.round(cta.getBoundingClientRect().top + window.scrollY) : null, vh: window.innerHeight };
        });
        reviewDepth.push(d);
      }
    }
    const agg = k => reviewDepth.map(r => r[k]).filter(v => v != null);
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    res[W] = {
      collisionsTotales: collisions.length,
      mainsAvecCollision: new Set(collisions.map(c => c.a + c.b)).size,
      exemples: collisions.slice(0, 8),
      review: { hMoy: avg(agg("h")), hMax: Math.max(...agg("h")), charsMoy: avg(agg("chars")), ctaYMoy: avg(agg("ctaY")), ctaSousLaLigneDeFlottaison: agg("ctaY").filter(y => y > 844).length + "/" + agg("ctaY").length }
    };
    console.log(W, JSON.stringify(res[W], null, 1));
    await ctx.close();
  }
  fs.writeFileSync(path.join(__dirname, "collisions.json"), JSON.stringify(res, null, 2));
  await browser.close();
})();
