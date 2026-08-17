/* AGENT I — sonde UX. N'écrit que dans PHASE4_DEEP_LEARNING/audits/. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const OUT = path.resolve(__dirname, "screens");
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { w: 360, h: 800, tag: "360" },
  { w: 390, h: 844, tag: "390" },
  { w: 412, h: 915, tag: "412" }
];

async function shot(page, name, tag) {
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, `${name}@${tag}.png`), fullPage: true });
}

async function onboard(page) {
  const visible = await page.evaluate(() => {
    const o = document.getElementById("onboard");
    return o && o.classList.contains("on");
  });
  if (!visible) return false;
  await page.fill("#obName", "Melchior");
  await page.click("#obStart");
  await page.waitForTimeout(300);
  return true;
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const report = {};

  for (const s of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
    await page.goto(APP);
    await page.waitForTimeout(700);

    // 0. onboarding brut
    await shot(page, "00-onboard", s.tag);
    const obInfo = await page.evaluate(() => {
      const p = document.querySelector(".ob-panel");
      if (!p) return null;
      return {
        h: p.scrollHeight,
        vh: window.innerHeight,
        fields: [...p.querySelectorAll("input,button")].length,
        text: p.innerText.slice(0, 400)
      };
    });
    report[`ob@${s.tag}`] = obInfo;

    await onboard(page);
    await shot(page, "01-home", s.tag);

    const views = ["play", "career", "stats", "hr", "pr", "bl", "daily", "leaks", "tracker", "journey", "profiles", "theory", "profile"];
    for (const v of views) {
      await page.evaluate(vv => App.go(vv), v);
      await page.waitForTimeout(350);
      await shot(page, `02-${v}`, s.tag);
    }

    // Retour play + jouer une main
    await page.evaluate(() => { App.go("play"); App.newHand(); });
    await page.waitForTimeout(400);
    await shot(page, "03-play-hand", s.tag);

    report[`errors@${s.tag}`] = errors;
    await ctx.close();
  }

  fs.writeFileSync(path.join(__dirname, "probe-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2).slice(0, 4000));
  await browser.close();
})();
