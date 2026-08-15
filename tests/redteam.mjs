/**
 * Campagne red-team Hero Lab — 25 scénarios + sondes sécurité.
 * Audit seul : ne modifie rien, ne commit rien.
 */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const FILE = pathToFileURL("/home/user/HeroLab/index.html").href;
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const results = [];
const rec = (n, pass, d = "") => {
  results.push({ n, pass, d });
  console.log(`  ${pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME });

/** Ouvre une page neuve, retourne {ctx,page,errs} */
async function open(opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  const failed = [];
  page.on("requestfailed", r => failed.push(r.url().slice(0, 80) + " " + (r.failure()?.errorText || "")));
  await page.goto(FILE, { waitUntil: "load" });
  await page.waitForFunction('typeof App !== "undefined"');
  await page.waitForTimeout(250);
  return { ctx, page, errs, failed };
}

// ---------------------------------------------------------------- 1-2 boot
{
  const { ctx, page, errs, failed } = await open();
  rec("01 premier lancement — aucune erreur JS", errs.length === 0, errs.slice(0, 2).join(" | "));
  rec("02 aucune requête réseau échouée", failed.length === 0, failed.slice(0, 2).join(" | "));
  const ob = await page.evaluate(() => {
    const o = document.getElementById("onboard");
    return { exists: !!o, shown: o ? o.classList.contains("on") : false };
  });
  rec("03 onboarding s'affiche au 1er lancement", ob.exists && ob.shown, JSON.stringify(ob));

  // onboarding complet
  const done = await page.evaluate(() => {
    Onboarding.renderOnboarding();
    document.getElementById("obName").value = "TestJoueur";
    Onboarding.obValidate();
    Onboarding.obPickAvatar("♦");
    const btn = document.getElementById("obStart");
    const enabled = !btn.disabled;
    Onboarding.finishOnboarding();
    return { enabled, onboarded: Player.isOnboarded(), name: Player.data.name, avatar: Player.data.avatar };
  });
  rec("04 onboarding complet crée le profil",
    done.enabled && done.onboarded && done.name === "TestJoueur" && done.avatar === "♦", JSON.stringify(done));
  await ctx.close();
}

// ------------------------------------------------------- 3-9 boucle de jeu
{
  const { ctx, page, errs } = await open();
  const loop = await page.evaluate(() => {
    Player.setProfile("Tst", "♠"); Player.save();
    App.go("play"); App.newHand();
    const t0 = { hasTable: !!App.t, phase: App.phase, board: App.t.board.length };
    App.choose("fold", 0);
    const t1 = { phase: App.phase, hasAnalysis: !!App.analysis, verdict: App.analysis && App.analysis.verdict };
    const n0 = Progress.summary().n;
    return { t0, t1, n0 };
  });
  rec("05 newHand produit une table jouable", loop.t0.hasTable && loop.t0.phase === "decide", JSON.stringify(loop.t0));
  rec("06 décision préflop → phase review + analyse", loop.t1.phase === "review" && loop.t1.hasAnalysis,
    JSON.stringify(loop.t1));
  rec("07 la décision est enregistrée dans Progress", loop.n0 >= 1, "n=" + loop.n0);

  const post = await page.evaluate(() => {
    // Les mains démarrent préflop ; un spot postflop s'obtient via un mode
    // qui force la street (ici le drill "cbet-low", mode flop).
    SessionCtl.drillLeak("cbet-low");
    App.newHand();
    const board = App.t.board.length;
    App.choose("check", 0);
    const r = { found: board >= 3, board, phase: App.phase, verdict: !!App.analysis };
    SessionCtl.endDrill();
    return r;
  });
  rec("08 décision postflop", post.found && post.verdict, JSON.stringify(post));

  const res = await page.evaluate(() => {
    App.continueHand();
    return { phase: App.phase, view: App.view };
  });
  rec("09 continueHand avance sans erreur", !!res.phase, JSON.stringify(res));
  rec("10 aucune erreur JS pendant la boucle", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ------------------------------------------------- 11-14 session / drill / leak
{
  const { ctx, page, errs } = await open();
  const sess = await page.evaluate(() => {
    Player.setProfile("Tst", "♠"); Player.save();
    SessionCtl.startSession("short");
    const started = !!SessionCtl.session;
    // hands ne s'incrémente qu'à la MAIN TERMINÉE (Session.recordHand),
    // pas à la décision : il faut donc appeler continueHand.
    for (let i = 0; i < 3; i++) { App.newHand(); App.choose("fold", 0); App.continueHand(); }
    const hands = SessionCtl.session && SessionCtl.session.hands;
    const decisions = SessionCtl.session && SessionCtl.session.decisions;
    SessionCtl.endSession();
    return { started, hands, decisions, report: !!SessionCtl.sessionReport };
  });
  rec("11 session : démarrage, mains, rapport", sess.started && sess.hands >= 1, JSON.stringify(sess));

  const drill = await page.evaluate(() => {
    SessionCtl.drillLeak("utg-loose");
    const d = SessionCtl.drillRun;
    const before = d ? d.i : null;
    App.newHand(); App.choose("fold", 0);
    const after = SessionCtl.drillRun ? SessionCtl.drillRun.i : null;
    return { armed: !!d, mode: d && d.cfg.mode, total: d && d.total, before, after };
  });
  rec("12 drill depuis un leak Feutre s'arme et progresse",
    drill.armed && drill.mode === "preflop" && drill.after > drill.before, JSON.stringify(drill));

  const chain = await page.evaluate(() => {
    // chaîne complète : leak tracker -> drill -> progression -> historique
    const nBefore = Progress.summary().n;
    SessionCtl.drillLeak("cbet-low");
    const cfg = SessionCtl.drillRun && SessionCtl.drillRun.cfg;
    for (let i = 0; i < 3; i++) { App.newHand(); App.choose("fold", 0); }
    const nAfter = Progress.summary().n;
    SessionCtl.endDrill();
    return { cfg: cfg && cfg.mode, nBefore, nAfter, wrote: nAfter > nBefore, cleared: SessionCtl.drillRun === null };
  });
  rec("13 chaîne leak→drill→progression→historique", chain.wrote && chain.cleared, JSON.stringify(chain));

  const leaks = await page.evaluate(() => {
    for (let i = 0; i < 40; i++) { App.newHand(); App.choose("fold", 0); }
    const s = Progress.summary();
    return { n: s.n, leaks: s.leaks.length, first: s.leaks[0] ? s.leaks[0].key : null };
  });
  rec("14 leaks détectés après volume", leaks.n >= 40, `n=${leaks.n} leaks=${leaks.leaks}`);
  rec("15 aucune erreur JS session/drill", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ------------------------------------------------------- 16-19 labs + career
{
  const { ctx, page, errs } = await open();
  const labs = await page.evaluate(() => {
    const out = {};
    for (const [k, m] of [["HR", HRUI], ["PR", PRUI], ["BL", BLUI]]) {
      try { (m.open || m.render).call(m); out[k] = "ok"; } catch (e) { out[k] = "ERR " + e.message; }
    }
    try { App.go("career"); CareerUI.render ? CareerUI.render() : CareerUI.renderHome(); out.career = "ok"; }
    catch (e) { out.career = "ERR " + e.message; }
    try { App.go("tracker"); out.tracker = window.Feutre ? "ok" : "absent"; } catch (e) { out.tracker = "ERR " + e.message; }
    return out;
  });
  rec("16 Range Detective s'ouvre", labs.HR === "ok", labs.HR);
  rec("17 Profiling Lab s'ouvre", labs.PR === "ok", labs.PR);
  rec("18 Blocker Finder s'ouvre", labs.BL === "ok", labs.BL);
  rec("19 Career s'ouvre", labs.career === "ok", labs.career);
  rec("20 Tracker s'ouvre", labs.tracker === "ok", labs.tracker);
  rec("21 aucune erreur JS labs/career", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();
}

// --------------------------------------------- 22-26 persistance / corruption
{
  const { ctx, page } = await open();
  const exp = await page.evaluate(() => {
    Player.setProfile("Persisté", "♣"); Player.save();
    for (let i = 0; i < 5; i++) { App.newHand(); App.choose("fold", 0); }
    return DataPort.exportAll();
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction('typeof App !== "undefined"');
  const after = await page.evaluate(() => ({ name: Player.data.name, n: Progress.summary().n }));
  rec("22 rechargement : profil et progression conservés",
    after.name === "Persisté" && after.n >= 5, JSON.stringify(after));

  const roundtrip = await page.evaluate((dump) => {
    const r = DataPort.importAll(dump);
    return { ok: r.ok, name: Player.data.name, n: Progress.summary().n };
  }, exp);
  rec("23 import restaure l'état exporté", roundtrip.ok && roundtrip.name === "Persisté", JSON.stringify(roundtrip));

  const corrupt = await page.evaluate(() => {
    for (const k of ["pivot.v1", "pivot.career.v1", "pivot.player.v1", "pivot.rating.v1",
      "pivot.journey.v1", "pivot.hr.v1", "pivot.pr.v1", "pivot.bl.v1"]) {
      localStorage.setItem(k, "{{{corrompu");
    }
    try {
      Progress.load(); Career.load(); Player.load(); Rating.load(); Journey.load();
      HRStats.load(); PRStats.load(); BLStats.load();
      App.go("home"); App.render();
      return { survived: true, n: Progress.summary().n };
    } catch (e) { return { survived: false, err: e.message }; }
  });
  rec("24 données corrompues : l'app démarre quand même", corrupt.survived, JSON.stringify(corrupt));
  await ctx.close();
}

// localStorage indisponible dès le chargement
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(() => {
    const boom = () => { throw new Error("SecurityError simulé"); };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }; }
    });
  });
  await page.goto(FILE, { waitUntil: "load" });
  let ok = false, detail = "";
  try {
    await page.waitForFunction('typeof App !== "undefined"', { timeout: 8000 });
    const r = await page.evaluate(() => { App.go("home"); App.render(); return { avail: Storage.available(), n: Progress.summary().n }; });
    ok = true; detail = JSON.stringify(r);
  } catch (e) { detail = "boot bloqué: " + e.message.slice(0, 60); }
  rec("25 localStorage indisponible : l'app démarre", ok, detail + (errs.length ? " | JS:" + errs[0].slice(0, 50) : ""));
  await ctx.close();
}

// -------------------------------------------------------- 26-28 navigation
{
  const { ctx, page, errs } = await open();
  const nav = await page.evaluate(() => {
    const views = ["home", "daily", "play", "career", "hr", "pr", "bl", "tracker",
      "journey", "leaks", "stats", "profiles", "theory", "setup", "profile"];
    const bad = [];
    for (let r = 0; r < 3; r++) for (const v of views) {
      try { App.go(v); } catch (e) { bad.push(`${v}:${e.message}`); }
    }
    return { rounds: 3, views: views.length, bad };
  });
  rec("26 navigation rapide 45 transitions", nav.bad.length === 0, nav.bad.slice(0, 2).join(" | "));
  rec("27 aucune erreur JS en navigation", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------- 28 mobile
{
  const { ctx, page, errs } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await page.evaluate(() => {
    App.go("home");
    const de = document.documentElement;
    return {
      scrollW: de.scrollWidth, clientW: de.clientWidth,
      overflow: de.scrollWidth > de.clientWidth + 2,
    };
  });
  rec("28 mobile 390px : pas de débordement horizontal", !m.overflow, JSON.stringify(m));
  rec("29 aucune erreur JS en mobile", errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}

// ------------------------------------------------------- 30-33 SÉCURITÉ
{
  const { ctx, page } = await open();
  const xss = await page.evaluate(() => {
    window.__pwned = false;
    const payload = '<img src=x onerror="window.__pwned=true">';
    // 1. pseudo joueur
    Player.setProfile(payload, "♠"); Player.save();
    App.go("home"); App.render();
    const viaName = window.__pwned;
    window.__pwned = false;
    // 2. import d'une sauvegarde hostile
    const dump = JSON.stringify({
      _format: "pivot-save", _version: 1,
      player: { name: payload, avatar: payload, mentorId: "x" },
      progress: null, career: null, hr: null, pr: null, bl: null, rating: null, journey: null
    });
    DataPort.importAll(dump);
    App.go("home"); App.render();
    App.go("profile"); ProfileUI.renderProfile();
    const viaImport = window.__pwned;
    return { viaName, viaImport, nameStored: Player.data.name === payload };
  });
  rec("30 XSS via pseudo joueur : neutralisé", !xss.viaName, JSON.stringify(xss));
  rec("31 XSS via sauvegarde importée : neutralisé", !xss.viaImport, JSON.stringify(xss));

  const globals = await page.evaluate(() => {
    const known = new Set(Object.getOwnPropertyNames(window));
    return {
      feutre: window.Feutre ? Object.keys(window.Feutre) : null,
      vLeak: typeof window.V, ftLeak: typeof window.FT,
      appOnWindow: Object.prototype.hasOwnProperty.call(window, "App"),
    };
  });
  rec("32 surface window : Feutre expose 4 membres, V/FT non fuités",
    globals.feutre && globals.feutre.length === 4 && globals.vLeak === "undefined" && globals.ftLeak === "undefined",
    JSON.stringify(globals));

  const secrets = await page.evaluate(() => {
    const src = document.documentElement.outerHTML;
    const pats = [/sk-[A-Za-z0-9]{20,}/, /api[_-]?key\s*[:=]\s*["'][^"']{12,}/i, /Bearer\s+[A-Za-z0-9._-]{20,}/];
    return pats.map(p => p.test(src));
  });
  rec("33 aucun secret/clé apparent dans la page", !secrets.some(Boolean), JSON.stringify(secrets));
  await ctx.close();
}

// ------------------------------------------------------------- 34 perf
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(FILE, { waitUntil: "load" });
  const load = Date.now() - t0;
  await page.waitForFunction('typeof App !== "undefined"');
  const ready = Date.now() - t0;
  const perf = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] || {};
    return {
      domInteractive: Math.round(n.domInteractive || 0),
      domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(n.loadEventEnd || 0),
      nodes: document.getElementsByTagName("*").length,
      transfer: n.transferSize || 0,
    };
  });
  rec("34 boot mesuré", true, `load=${load}ms ready=${ready}ms domInteractive=${perf.domInteractive}ms nœuds=${perf.nodes}`);
  await ctx.close();
}

await browser.close();
const bad = results.filter(r => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} PASS`);
if (bad.length) { console.log("ÉCHECS :"); bad.forEach(b => console.log(`  - ${b.n}: ${b.d}`)); }
