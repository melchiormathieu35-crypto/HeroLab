/* AGENT I — parcours interactifs. Écrit uniquement dans audits/. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const OUT = path.resolve(__dirname, "screens");
fs.mkdirSync(OUT, { recursive: true });
const LOG = [];
const log = (...a) => { LOG.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); console.log(...a); };

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
}
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);

async function boot(page) {
  await page.goto(APP);
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.getElementById("onboard").classList.contains("on"))) {
    await page.fill("#obName", "Melchior");
    await page.click("#obStart");
    await page.waitForTimeout(300);
  }
}

// Joue une décision au hasard, renvoie l'état
async function decide(page) {
  return page.evaluate(() => {
    const o = Spot.options(App.t);
    const pick = o[Math.floor(Math.random() * o.length)];
    App.choose(pick.action, pick.amount);
    return { picked: pick.label, phase: App.phase };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => log("PAGEERROR", e.message));

  /* ---------------- 1. ONBOARDING : compter les écrans avant 1re main ------ */
  await page.goto(APP);
  await page.waitForTimeout(600);
  const obScroll = await page.evaluate(() => {
    const p = document.querySelector(".ob-panel");
    const btn = document.getElementById("obStart");
    const r = btn.getBoundingClientRect();
    return { panelH: p.scrollHeight, vh: window.innerHeight, ctaTop: r.top, ctaVisibleWithoutScroll: r.top < window.innerHeight };
  });
  log("ONBOARDING", obScroll);
  await page.fill("#obName", "Melchior");
  await page.click("#obStart");
  await page.waitForTimeout(400);
  // écran 2 : accueil. Mesurer la distance jusqu'au 1er CTA "jouer"
  const homeMetrics = await page.evaluate(() => {
    const doc = document.getElementById("v-home");
    const btns = [...doc.querySelectorAll("button,[onclick]")].map(b => ({ t: (b.innerText || "").trim().slice(0, 40), y: Math.round(b.getBoundingClientRect().top + window.scrollY), on: b.getAttribute("onclick") }));
    return { docH: doc.scrollHeight, vh: window.innerHeight, btns: btns.filter(b => b.t) };
  });
  log("HOME", JSON.stringify(homeMetrics, null, 1));
  // clic sur "Table / commence ici"
  await page.evaluate(() => { App.go("play"); });
  await page.waitForTimeout(300);
  const playIdle = await txt(page, "#v-play");
  log("PLAY-IDLE >>>", (playIdle || "").slice(0, 700));
  await shot(page, "10-play-idle");

  /* ---------------- 2. Feedback après décision ---------------------------- */
  await page.evaluate(() => App.newHand());
  await page.waitForTimeout(300);
  const d = await decide(page);
  log("DECIDE", d);
  await shot(page, "11-review");
  const rev = await page.evaluate(() => {
    const v = document.querySelector("#v-play .verdict");
    const all = document.getElementById("v-play");
    return {
      verdictText: v ? v.innerText : null,
      totalChars: all.innerText.length,
      totalH: all.scrollHeight,
      cards: all.querySelectorAll(".card").length,
      nOptions: all.querySelectorAll(".opt-row").length,
      firstCtaY: (() => { const b = [...all.querySelectorAll("button")].find(x => /Continuer|Spot suivant/.test(x.innerText)); return b ? Math.round(b.getBoundingClientRect().top + window.scrollY) : null; })()
    };
  });
  log("REVIEW", JSON.stringify(rev, null, 1));

  // continuer jusqu'à la fin de la main
  for (let i = 0; i < 12; i++) {
    const ph = await page.evaluate(() => App.phase);
    if (ph === "result" || ph === "idle") break;
    if (ph === "review") { await page.evaluate(() => App.continueHand()); await page.waitForTimeout(200); }
    else if (ph === "decide") { await decide(page); await page.waitForTimeout(200); }
    else break;
  }
  await shot(page, "12-result");
  const res = await page.evaluate(() => {
    const all = document.getElementById("v-play");
    return { phase: App.phase, text: all.innerText.slice(0, 500), btns: [...all.querySelectorAll("button")].map(b => b.innerText.trim()) };
  });
  log("RESULT", JSON.stringify(res, null, 1));

  /* ---------------- 3. DÉFI DU JOUR : début → fin ------------------------- */
  await page.evaluate(() => App.go("daily"));
  await page.waitForTimeout(300);
  await shot(page, "20-daily-intro");
  log("DAILY-INTRO >>>", ((await txt(page, "#v-daily")) || "").slice(0, 600));
  await page.evaluate(() => App.startDaily());
  await page.waitForTimeout(400);
  await shot(page, "21-daily-run");
  let guard = 0;
  while (guard++ < 60) {
    const st = await page.evaluate(() => ({ phase: App.phase, run: App.dailyRun ? { i: App.dailyRun.i, total: App.dailyRun.total, fin: App.dailyRun.finishing } : null, view: App.view }));
    if (!st.run || st.view !== "play") break;
    if (st.phase === "decide") await decide(page);
    else if (st.phase === "review") await page.evaluate(() => App.continueHand());
    else if (st.phase === "result") await page.evaluate(() => App.newHand());
    else break;
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await shot(page, "22-daily-end");
  log("DAILY-END view=", await page.evaluate(() => App.view));
  log("DAILY-END >>>", ((await txt(page, "#v-daily")) || (await txt(page, "#v-play")) || "").slice(0, 900));

  /* ---------------- 4. LABS : HR / PR / BL fin de drill ------------------- */
  for (const lab of ["hr", "pr", "bl"]) {
    await page.evaluate(v => App.go(v), lab);
    await page.waitForTimeout(400);
    await shot(page, `30-${lab}-entry`);
    log(`${lab.toUpperCase()}-ENTRY >>>`, ((await txt(page, `#v-${lab}`)) || "").slice(0, 700));
  }

  await ctx.close();
  fs.writeFileSync(path.join(__dirname, "flow-log.txt"), LOG.join("\n"));
  await browser.close();
})();
