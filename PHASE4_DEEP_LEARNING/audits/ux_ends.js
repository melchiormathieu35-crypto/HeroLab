/* AGENT I — fins de parcours (labs, session carrière, drill leak, tracker). */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const APP = "file://" + path.resolve(__dirname, "../../VERSION_PRODUCTION/herolab.html");
const OUT = path.resolve(__dirname, "screens");
const LOG = [];
const log = (...a) => { LOG.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x, null, 1)).join(" ")); console.log(...a); };
const shot = async (p, n) => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(OUT, n + ".png"), fullPage: true }); };
const view = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? { text: e.innerText, btns: [...e.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean), h: e.scrollHeight } : null; }, sel);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => log("PAGEERROR", e.message));
  await page.goto(APP); await page.waitForTimeout(600);
  await page.fill("#obName", "Melchior"); await page.click("#obStart"); await page.waitForTimeout(300);

  /* ---- LAB HR : un spot puis "Terminer" ---- */
  await page.evaluate(() => { App.go("hr"); HRUI.begin(); });
  await page.waitForTimeout(500);
  await shot(page, "40-hr-spot");
  log("HR-SPOT", await view(page, "#v-hr"));
  // répondre : prendre la 1re option proposée
  await page.evaluate(() => {
    if (HRUI.mode === "range") { const b = document.querySelector("#v-hr .hr-rng-opt, #v-hr .hr-range-opt, #v-hr [onclick^='HRUI.pickRange']"); if (b) b.click(); }
    else { const cs = document.querySelectorAll("#v-hr [onclick^='HRUI.pickExact']"); cs[0] && cs[0].click(); cs[1] && cs[1].click(); }
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => { if (HRUI.canValidate()) HRUI.validate(); });
  await page.waitForTimeout(400);
  await shot(page, "41-hr-reveal");
  log("HR-REVEAL", await view(page, "#v-hr"));
  await page.evaluate(() => HRUI.quit());
  await page.waitForTimeout(400);
  await shot(page, "42-hr-after-terminer");
  const hrAfter = await view(page, "#v-hr");
  log("HR-APRES-TERMINER (300 car.)", hrAfter && hrAfter.text.slice(0, 300), "| boutons:", hrAfter && hrAfter.btns);
  log("HR-STATS existe ? vue hrstats:", await page.evaluate(() => !!document.getElementById("v-hrstats")));

  /* ---- LAB BL ---- */
  await page.evaluate(() => { App.go("bl"); BLUI.begin(); });
  await page.waitForTimeout(500);
  await shot(page, "43-bl-spot");
  await page.evaluate(() => { const b = document.querySelector("#v-bl .bl-opt"); if (b) b.click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { if (BLUI.canValidate()) BLUI.validate(); });
  await page.waitForTimeout(400);
  await shot(page, "44-bl-reveal");
  log("BL-REVEAL btns", (await view(page, "#v-bl")).btns);
  await page.evaluate(() => BLUI.quit());
  await page.waitForTimeout(300);
  const blAfter = await view(page, "#v-bl");
  log("BL-APRES-TERMINER (200 car.)", blAfter.text.slice(0, 200), "| boutons:", blAfter.btns);

  /* ---- LAB PR ---- */
  await page.evaluate(() => { App.go("pr"); PRUI.newSession(); });
  await page.waitForTimeout(500);
  await shot(page, "45-pr-spot");
  log("PR-SPOT btns", (await view(page, "#v-pr")).btns.slice(0, 12));

  /* ---- SESSION CARRIÈRE : lancer + terminer ---- */
  await page.evaluate(() => App.go("career"));
  await page.waitForTimeout(400);
  await shot(page, "50-career-entry");
  log("CAREER-ENTRY", (await view(page, "#v-career")).text.slice(0, 700));
  log("CAREER-BTNS", (await view(page, "#v-career")).btns);
  await page.evaluate(() => App.startSession(Object.keys(SESSION_LENGTHS)[0]));
  await page.waitForTimeout(500);
  await shot(page, "51-session-play");
  log("SESSION target", await page.evaluate(() => App.session && App.session.target));
  // jouer jusqu'au bout (target mains)
  let g = 0;
  while (g++ < 4000) {
    const st = await page.evaluate(() => ({ ph: App.phase, done: !!App.sessionComplete, rep: !!App.sessionReport, hands: App.session ? App.session.hands : -1 }));
    if (st.rep) break;
    if (st.ph === "decide") await page.evaluate(() => { const o = Spot.options(App.t); const p = o[Math.floor(Math.random() * o.length)]; App.choose(p.action, p.amount); });
    else if (st.ph === "review") await page.evaluate(() => App.continueHand());
    else if (st.ph === "result") { if (st.done) { await page.evaluate(() => App.endSession()); break; } await page.evaluate(() => App.newHand()); }
    else break;
  }
  await page.waitForTimeout(600);
  await shot(page, "52-session-report");
  const rep = await view(page, "#v-career");
  log("SESSION-REPORT h=", rep.h, "btns:", rep.btns);
  log("SESSION-REPORT texte (900 car.)", rep.text.slice(0, 900));

  /* ---- TRACKER / LEAKS ---- */
  await page.evaluate(() => App.go("leaks")); await page.waitForTimeout(400);
  await shot(page, "60-leaks");
  const lk = await view(page, "#v-leaks"); log("LEAKS", lk.text.slice(0, 500), "| btns:", lk.btns);
  await page.evaluate(() => App.go("tracker")); await page.waitForTimeout(700);
  await shot(page, "61-tracker");
  const tk = await view(page, "#v-tracker"); log("TRACKER", tk ? tk.text.slice(0, 500) : "(vide)", "| btns:", tk ? tk.btns.slice(0, 15) : []);

  /* ---- STATS ---- */
  await page.evaluate(() => App.go("stats")); await page.waitForTimeout(400);
  await shot(page, "62-stats");
  const stv = await view(page, "#v-stats"); log("STATS h=", stv.h, "| btns:", stv.btns);

  fs.writeFileSync(path.join(__dirname, "ends-log.txt"), LOG.join("\n"));
  await ctx.close(); await browser.close();
})();
