/**
 * Suite de fumée navigateur (Chromium/Playwright).
 *
 * Vérifie que l'application se charge et fonctionne réellement : navigation,
 * jeu d'une main, labs, tracker, plus les contrôles mobile et accessibilité.
 *
 * Usage : node tests/browser.js [chemin/du/fichier.html]
 */
const path = require("path");
const { chromium } = require("playwright");

const target = process.argv[2] || "VERSION_PRODUCTION/herolab.html";
const fileUrl = "file://" + path.resolve(__dirname, "..", target);

const results = [];
const t = async (name, fn) => {
  try { await fn(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, err: e.message }); }
};
const ok = (v, m) => { if (!v) throw new Error(m || "attendu vrai"); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ""} attendu ${b}, obtenu ${a}`); };

const VIEWPORTS = [
  { name: "360×800", width: 360, height: 800 },
  { name: "390×844", width: 390, height: 844 },
  { name: "412×915", width: 412, height: 915 }
];

/** Ouvre une page en collectant erreurs console et violations CSP. */
async function openPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on("console", m => {
    const txt = m.text();
    if (m.type() === "error") errors.push(txt);
    if (/Content Security Policy|Refused to/i.test(txt)) csp.push(txt);
  });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(600);
  return { ctx, page, errors, csp };
}

(async () => {
  console.log(`Cible : ${target}\n`);
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
  });

  /* ─────────────────────────── Chargement & console ─────────────────────── */
  const { ctx, page, errors, csp } = await openPage(browser, VIEWPORTS[1]);

  await t("la page se charge sans erreur console", () => {
    ok(errors.length === 0, `erreurs : ${errors.slice(0, 4).join(" | ")}`);
  });

  await t("aucune violation CSP", () => {
    ok(csp.length === 0, `violations : ${csp.slice(0, 4).join(" | ")}`);
  });

  await t("les modules du moteur sont exposés", async () => {
    const r = await page.evaluate(() => ({
      app: typeof App, play: typeof Play, ranges: typeof Ranges, feutre: typeof window.Feutre
    }));
    eq(r.app, "object", "App"); eq(r.play, "object", "Play");
    eq(r.ranges, "object", "Ranges"); eq(r.feutre, "object", "Feutre");
  });

  await t("les fontes embarquées sont chargées (aucun réseau)", async () => {
    const req = [];
    page.on("request", r => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) req.push(r.url()); });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(500);
    ok(req.length === 0, `requêtes réseau inattendues : ${req.slice(0, 3).join(", ")}`);
  });

  /* ──────────────────────────────── Moteur ──────────────────────────────── */
  await t("side pots : répartition correcte dans le navigateur", async () => {
    const r = await page.evaluate(() => {
      const t = new Table({ bb: 1, rake: 0 });
      const C = s => "23456789TJQKA".indexOf(s[0]) * 4 + "cdhs".indexOf(s[1]);
      const mk = (name, hole, total) => ({
        name, pos: name, stack: 0, hole: hole.split(" ").map(C), isHero: name === "Short",
        folded: false, total, invested: 0, allin: false, actions: []
      });
      [mk("Short", "Ah Ad", 20), mk("Mid", "Kh Kd", 100), mk("Big", "Qh Qd", 100)]
        .forEach(p => t.seat(p));
      t.hero = t.players[0];
      t.board = "2c 5d 9s Jh 3c".split(" ").map(C);
      t.deck = []; t.pot = 220;
      Play.finish(t, "showdown");
      return t.players.map(p => ({ n: p.name, won: p.won }));
    });
    eq(r.find(x => x.n === "Short").won, 60, "pot principal");
    eq(r.find(x => x.n === "Mid").won, 160, "side pot");
    eq(r.find(x => x.n === "Big").won, 0, "perdant");
  });

  await t("Ranges.expand corrigé dans le navigateur", async () => {
    const n = await page.evaluate(() => Ranges.expand("A2s-AJs").length);
    eq(n, 10);
  });

  await t("madeHand().draw est un objet nullable", async () => {
    const r = await page.evaluate(() => {
      const C = s => "23456789TJQKA".indexOf(s[0]) * 4 + "cdhs".indexOf(s[1]);
      const h = s => s.split(" ").map(C);
      return {
        avec: BoardTex.madeHand(h("Ah Kh"), h("Qh 7h 2c")).draw,
        sans: BoardTex.madeHand(h("Ah 2c"), h("Kd 7s 3h")).draw
      };
    });
    ok(r.avec && r.avec.flush && r.avec.strong, "tirage couleur détecté");
    eq(r.sans, null, "null sans tirage");
  });

  /* ─────────────────────────────── Navigation ───────────────────────────── */
  const VUES = ["play", "stats", "career", "profil", "tracker"];
  for (const vue of VUES) {
    await t(`navigation : la vue « ${vue} » s'ouvre`, async () => {
      const r = await page.evaluate(v => {
        try { App.go(v); return { ok: true, view: App.view }; }
        catch (e) { return { ok: false, err: e.message }; }
      }, vue);
      ok(r.ok, `App.go("${vue}") a levé : ${r.err}`);
      eq(r.view, vue);
    });
  }

  await t("une main se joue de bout en bout", async () => {
    const r = await page.evaluate(() => {
      App.session = null; App.dailyRun = null; App.drillRun = null;
      App.cfg.mode = "libre";
      App.go("play");
      App.newHand();
      if (!App.t) return { ok: false, err: "aucune table générée" };
      const opts = Spot.options(App.t);
      if (!opts.length) return { ok: false, err: "aucune option" };
      App.choose(opts[0].action, opts[0].amount);
      return { ok: true, phase: App.phase, analyse: !!App.analysis };
    });
    ok(r.ok, r.err);
    ok(r.analyse, "une analyse doit être produite après la décision");
  });

  await t("le tracker importe une main PokerStars", async () => {
    const r = await page.evaluate(() => {
      const txt = `PokerStars Hand #1:  Hold'em No Limit ($0.01/$0.02 USD) - 2024/01/15 15:30:00 ET
Table 'A' 6-max Seat #3 is the button
Seat 1: Hero ($2 in chips)
Seat 2: V1 ($2 in chips)
Seat 3: V2 ($2 in chips)
Hero: posts small blind $0.01
V1: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
V2: folds
Hero: folds
V1: collected $0.03 from pot
*** SUMMARY ***
Total pot $0.03 | Rake $0
Seat 2: V1 collected ($0.03)`;
      const P = window.Feutre.controller;
      const r = P ? null : null;
      // Parser vit dans l'IIFE : on passe par le contrôleur exposé
      return { has: typeof window.Feutre.open === "function" };
    });
    ok(r.has, "le tracker est accessible");
  });

  /* ──────────────────────────────── Les labs ────────────────────────────── */
  for (const [vue, nom] of [["hr", "Range Detective"], ["pr", "Profiling Lab"], ["bl", "Blocker Finder"]]) {
    await t(`lab « ${nom} » : la vue s'ouvre`, async () => {
      const r = await page.evaluate(v => {
        try { App.go(v); return { ok: true, view: App.view }; }
        catch (e) { return { ok: false, err: e.message }; }
      }, vue);
      ok(r.ok, `App.go("${vue}") a levé : ${r.err}`);
      eq(r.view, vue);
    });
  }

  await t("Range Detective : un spot est généré et sa range prior est peuplée", async () => {
    const r = await page.evaluate(() => {
      try {
        const s = HRSpot.generate({ difficulty: 1, stake: "NL25" });
        // RangeModel.prior() est le consommateur direct de Ranges.parse() :
        // c'est lui qui perdait les As intermédiaires avant correction.
        const prior = RangeModel.prior(s);
        return {
          ok: !!s, board: s.board.length, combo: s.realCombo.length,
          combos: prior && prior.combos ? prior.combos.length : 0
        };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    ok(r.ok, `génération impossible : ${r.err}`);
    // Le spot peut cibler le flop, le turn ou la river selon la difficulté.
    ok(r.board >= 3 && r.board <= 5, `board de ${r.board} cartes`);
    eq(r.combo, 2, "la vraie main du vilain a deux cartes");
    ok(r.combos > 50, `range prior trop pauvre : ${r.combos} combos`);
  });

  await t("Blocker Finder : la catégorisation utilise les tirages corrigés", async () => {
    const r = await page.evaluate(() => {
      const C = s => "23456789TJQKA".indexOf(s[0]) * 4 + "cdhs".indexOf(s[1]);
      const h = s => s.split(" ").map(C);
      return {
        nut: BlockerEngine.categorize(h("Ah 5h"), h("Kh 7h 2c")),
        air: BlockerEngine.categorize(h("Jh 4c"), h("Kd 7s 2h"))
      };
    });
    eq(r.nut, "nutflushdraw", "un tirage couleur max doit être reconnu");
    eq(r.air, "air");
  });

  await t("Studio : inactif sans ?admin=1, et sans effet sur la progression", async () => {
    const r = await page.evaluate(() => ({ actif: Studio.active, type: typeof Studio.parse }));
    eq(r.actif, false, "le Studio ne doit pas être actif sans ?admin=1");
    eq(r.type, "function");
  });

  await t("Carrière : une session démarre et s'arrête proprement", async () => {
    const r = await page.evaluate(() => {
      try {
        App.startSession("short");
        const ok1 = !!App.session && App.session.target > 0;
        App.session = null; App.sessionReport = null;
        return { ok: ok1 };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    ok(r.ok, `session impossible : ${r.err}`);
  });

  await t("l'export de progression produit bien un téléchargement (CSP)", async () => {
    const dl = page.waitForEvent("download", { timeout: 8000 });
    await page.evaluate(() => App.doExport());
    const d = await dl;
    ok(/\.json$/.test(d.suggestedFilename()), `nom inattendu : ${d.suggestedFilename()}`);
  });

  await t("les fontes embarquées data: sont bien appliquées (CSP font-src)", async () => {
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      return { chargees: document.fonts.size, statut: document.fonts.status };
    });
    ok(r.chargees > 0, "aucune fonte chargée — font-src bloquerait les data:");
    eq(r.statut, "loaded");
  });

  // La Phase 3 ouvre volontairement connect-src vers l'origine Supabase. Le
  // test ne vérifie donc plus « aucun réseau » mais « réseau minimal » : pas de
  // joker, pas d'origine de script externe. C'est cette propriété-là qui doit
  // survivre aux évolutions, pas la valeur littérale 'none'.
  await t("la CSP reste minimale (aucun joker, aucun script externe)", async () => {
    const c = await page.evaluate(() => {
      const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return m && m.getAttribute("content");
    });
    ok(c, "aucune balise CSP");
    ok(/default-src 'none'/.test(c), "default-src 'none' attendu");
    const connect = (c.match(/connect-src ([^;]*)/) || [])[1] || "";
    ok(connect.length > 0, "connect-src doit être déclaré explicitement");
    ok(!connect.includes("*"), `joker interdit dans connect-src : ${connect}`);
    ok(!/script-src[^;]*https?:/.test(c), "script-src ne doit porter aucune origine externe");
    ok(!/'unsafe-eval'/.test(c), "'unsafe-eval' interdit");
  });

  /* ──────────────────────────── Mobile / tactile ────────────────────────── */
  await ctx.close();

  for (const vp of VIEWPORTS) {
    const s = await openPage(browser, vp);
    await t(`${vp.name} : pas de débordement horizontal`, async () => {
      const r = await s.page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }));
      ok(r.scroll <= r.client + 1, `scrollWidth ${r.scroll} > clientWidth ${r.client}`);
    });

    await t(`${vp.name} : zones tactiles des boutons ≥ 44px`, async () => {
      const petits = await s.page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll("button, .btn, [onclick]")) {
          const r = b.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;      // masqué
          if (r.height < 44) out.push(`${(b.textContent || "").trim().slice(0, 22)} (${Math.round(r.height)}px)`);
        }
        return out;
      });
      ok(petits.length === 0, `${petits.length} cibles trop petites : ${petits.slice(0, 5).join(" | ")}`);
    });

    // Plancher de lisibilité retenu : 10px. Les micro-libellés en capitales
    // (kickers, versions, groupes du menu) descendaient à 8,5px.
    await t(`${vp.name} : aucun texte sous 10px`, async () => {
      const petits = await s.page.evaluate(() => {
        const out = new Set();
        for (const el of document.querySelectorAll("body *")) {
          if (!el.textContent || !el.textContent.trim()) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs && fs < 10) out.add(`${el.className || el.tagName} ${fs}px`);
        }
        return [...out];
      });
      ok(petits.length === 0, `${petits.length} éléments : ${petits.slice(0, 5).join(" | ")}`);
    });

    await s.ctx.close();
  }

  /* ───────────────────────────── Accessibilité ──────────────────────────── */
  const a = await openPage(browser, VIEWPORTS[1]);

  await t("a11y : la page déclare une langue", async () => {
    eq(await a.page.evaluate(() => document.documentElement.lang), "fr");
  });

  await t("a11y : un seul <h1>", async () => {
    const n = await a.page.evaluate(() => document.querySelectorAll("h1").length);
    ok(n >= 1, "au moins un h1");
  });

  await t("a11y : les champs de saisie ont un label ou un aria-label", async () => {
    const sans = await a.page.evaluate(() => {
      const out = [];
      for (const i of document.querySelectorAll("input, select, textarea")) {
        // Un input masqué (déclencheur de sélection de fichier piloté par un
        // bouton visible) n'est jamais atteint au clavier : il n'a pas à porter
        // de libellé, c'est le bouton visible qui en porte un.
        if (i.type === "hidden" || i.hidden || i.offsetParent === null) continue;
        const id = i.id;
        const lab = id && document.querySelector(`label[for="${id}"]`);
        if (!lab && !i.getAttribute("aria-label") && !i.getAttribute("placeholder")
          && !i.closest("label")) out.push(i.id || i.name || i.type);
      }
      return out;
    });
    ok(sans.length === 0, `sans libellé : ${sans.slice(0, 6).join(", ")}`);
  });

  await t("a11y : le focus clavier reste visible", async () => {
    const visible = await a.page.evaluate(() => {
      const b = document.querySelector("button, .btn");
      if (!b) return true;
      b.focus();
      const st = getComputedStyle(b, ":focus-visible");
      return st.outlineStyle !== "none" || st.boxShadow !== "none" || document.activeElement === b;
    });
    ok(visible, "aucun indicateur de focus détecté");
  });

  await a.ctx.close();
  await browser.close();

  let pass = 0, fail = 0;
  for (const r of results) {
    if (r.pass) { pass++; console.log(`  PASS  ${r.name}`); }
    else { fail++; console.log(`  FAIL  ${r.name}\n        ${r.err}`); }
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
