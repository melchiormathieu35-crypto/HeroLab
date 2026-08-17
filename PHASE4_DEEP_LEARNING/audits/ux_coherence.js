/* AGENT I — cohérence : vocabulaire des composants, zones vides, typographie. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const LOG = [];
const log = (...a) => { LOG.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x, null, 1)).join(" ")); console.log(...a); };

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(APP); await page.waitForTimeout(600);
  await page.fill("#obName", "M"); await page.click("#obStart"); await page.waitForTimeout(300);

  /* 1. Zone vide en tête du Tracker */
  await page.evaluate(() => App.go("tracker")); await page.waitForTimeout(800);
  const tk = await page.evaluate(() => {
    const box = document.getElementById("v-tracker");
    const kids = [...box.children].map(c => { const r = c.getBoundingClientRect(); return { tag: c.tagName, cls: (c.className || "").toString().slice(0, 40), h: Math.round(r.height), textLen: (c.innerText || "").trim().length }; });
    // 1er pixel où du texte apparaît
    const first = [...box.querySelectorAll("*")].filter(e => e.offsetParent && (e.innerText || "").trim() && e.children.length === 0)
      .map(e => Math.round(e.getBoundingClientRect().top + window.scrollY)).sort((a, b) => a - b)[0];
    return { kids, premierTexteY: first, hauteurTotale: box.scrollHeight };
  });
  log("TRACKER structure", tk);

  /* 2. Vocabulaire de sortie : le bouton de fin dans chaque parcours */
  const exits = {};
  const grab = async (v, sel) => page.evaluate(s => {
    const e = document.querySelector(s); if (!e) return null;
    return [...e.querySelectorAll("button,.btn")].map(b => ({ t: (b.innerText || "").trim().split("\n")[0].slice(0, 34), cls: (b.className || "").toString() })).filter(b => b.t);
  }, sel);
  for (const [v, sel] of [["home", "#v-home"], ["play", "#v-play"], ["career", "#v-career"], ["stats", "#v-stats"], ["leaks", "#v-leaks"], ["journey", "#v-journey"], ["daily", "#v-daily"], ["hr", "#v-hr"], ["pr", "#v-pr"], ["bl", "#v-bl"], ["profiles", "#v-profiles"], ["theory", "#v-theory"], ["setup", "#v-setup"]]) {
    await page.evaluate(vv => App.go(vv), v); await page.waitForTimeout(300);
    exits[v] = await grab(v, sel);
  }
  log("BOUTONS PAR VUE", exits);

  /* 3. Vues « chiffres » sans aucune action */
  const deadends = Object.entries(exits).filter(([k, b]) => !b || b.length === 0).map(([k]) => k);
  log("VUES SANS AUCUN BOUTON", deadends);

  /* 4. Hauteur de chaque vue en nombre d'écrans */
  const heights = {};
  for (const v of ["home", "career", "stats", "leaks", "journey", "hr", "pr", "bl", "profiles", "theory", "setup", "daily"]) {
    await page.evaluate(vv => App.go(vv), v); await page.waitForTimeout(250);
    heights[v] = await page.evaluate(vv => { const e = document.getElementById("v-" + vv); return { px: e.scrollHeight, ecrans: +(e.scrollHeight / window.innerHeight).toFixed(1) }; }, v);
  }
  log("HAUTEUR DES VUES", heights);

  /* 5. Familles de classes de boutons (cohérence du design system) */
  const cls = await page.evaluate(() => {
    const s = new Set();
    document.querySelectorAll("button").forEach(b => s.add((b.className || "").toString().trim()));
    return [...s].sort();
  });
  log("CLASSES DE BOUTONS PRESENTES (vue courante)", cls);

  /* 6. Familles de sélecteurs de difficulté (3 labs) */
  const diffCls = await page.evaluate(() => {
    const out = {};
    ["hr", "pr", "bl"].forEach(v => {
      const box = document.getElementById("v-" + v);
      out[v] = [...new Set([...box.querySelectorAll("button")].map(b => (b.className || "").toString().trim()))].filter(Boolean);
    });
    return out;
  });
  log("CLASSES DES 3 LABS", diffCls);

  fs.writeFileSync(path.join(__dirname, "coherence-log.txt"), LOG.join("\n"));
  await ctx.close(); await browser.close();
})();
