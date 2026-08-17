/** Bibliothèque commune aux sondes adversariales P0.1. */
const path = require("path");
const { chromium } = require("playwright");

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ROOT = path.resolve(__dirname, "..", "..", "..");
const url = t => "file://" + path.resolve(ROOT, t);
const SHOTS = path.resolve(__dirname, "shots");

const VIEWPORTS = [
  { nom: "360x800", width: 360, height: 800 },
  { nom: "390x844", width: 390, height: 844 },
  { nom: "412x915", width: 412, height: 915 },
  { nom: "768x1024", width: 768, height: 1024 },
  { nom: "1280x800", width: 1280, height: 800 }
];

async function launch() {
  return chromium.launch({ executablePath: EXE });
}

/** Ouvre la page ET franchit l'onboarding comme un utilisateur réel. */
async function openApp(browser, target, vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", e => jsErrors.push(e.message));
  await page.goto(url(target), { waitUntil: "load" });
  await page.waitForTimeout(400);
  if (opts.skipOnboarding !== true) {
    await page.fill("#obName", "Testeur");
    await page.click("#obStart", { timeout: 4000 });
    await page.waitForTimeout(400);
  }
  return { ctx, page, jsErrors };
}

module.exports = { launch, openApp, VIEWPORTS, SHOTS, url, ROOT, EXE };
