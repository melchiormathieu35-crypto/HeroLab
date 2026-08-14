/**
 * Tests de contrat et de workflow, exécutés dans la page.
 *
 * Couvre : Progress.summary() (contrat interne stable), Player, Career, la
 * couche de stockage, les ponts Feutre↔App, la navigation UI, l'onboarding, le
 * daily, les labs, Studio et l'import/export.
 *
 * Chaque test retourne {name, pass, detail}. Aucun test ne doit être neutralisé.
 */
export function contractSuite() {
  const tests = [];
  const t = (name, fn) => {
    try {
      const r = fn();
      if (r === true || r === undefined) tests.push({ name, pass: true });
      else if (r && r.pass !== undefined) tests.push({ name, pass: !!r.pass, detail: r.detail || "" });
      else tests.push({ name, pass: false, detail: "retour inattendu: " + JSON.stringify(r) });
    } catch (e) {
      tests.push({ name, pass: false, detail: "throw: " + e.message });
    }
  };
  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
  const G = (n) => { try { return eval(n); } catch (e) { return undefined; } };

  // ------------------------------------------------ CONTRAT Progress.summary
  const SUMMARY_CONTRACT = {
    n: "number", correctRate: "number", leaks: "object",
  };
  t("contract:Progress.summary shape", () => {
    const s = Progress.summary();
    const missing = Object.keys(SUMMARY_CONTRACT).filter(k => !has(s, k));
    if (missing.length) return { pass: false, detail: "champs manquants: " + missing.join(",") };
    const wrong = Object.entries(SUMMARY_CONTRACT)
      .filter(([k, ty]) => typeof s[k] !== ty)
      .map(([k, ty]) => `${k}:${typeof s[k]}≠${ty}`);
    if (wrong.length) return { pass: false, detail: wrong.join(",") };
    return { pass: true, detail: `n=${s.n} champs=${Object.keys(s).length}` };
  });
  t("contract:Progress.summary leaks[] shape", () => {
    const s = Progress.summary();
    if (!Array.isArray(s.leaks)) return { pass: false, detail: "leaks n'est pas un tableau" };
    if (!s.leaks.length) return { pass: true, detail: "0 leak (état neuf) — forme non contraignable" };
    const l = s.leaks[0];
    const need = ["key", "n"];
    const miss = need.filter(k => !has(l, k));
    return miss.length ? { pass: false, detail: "leak sans " + miss.join(",") } : true;
  });
  t("contract:Progress.summary est stable sur 2 appels", () => {
    const a = JSON.stringify(Progress.summary());
    const b = JSON.stringify(Progress.summary());
    return a === b ? true : { pass: false, detail: "appels successifs divergents" };
  });

  // ------------------------------------------------------------- PERSISTENCE
  const KEYS = [
    "pivot.v1", "pivot.career.v1", "pivot.player.v1", "pivot.rating.v1",
    "pivot.journey.v1", "pivot.hr.v1", "pivot.pr.v1", "pivot.bl.v1", "feutre.v1",
  ];
  t("storage:les 8 clés Pivot sont déclarées", () => {
    // feutre.v1 appartient à Store, privé dans l'IIFE Feutre — non observable
    // depuis ici par construction, et c'est le comportement voulu (§13).
    const declared = [
      Progress.KEY, Career.KEY, Player.KEY, Rating.KEY, Journey.KEY,
      HRStats.KEY, PRStats.KEY, BLStats.KEY,
    ].filter(Boolean);
    const missing = KEYS.filter(k => k !== "feutre.v1" && !declared.includes(k));
    return missing.length
      ? { pass: false, detail: "clés absentes: " + missing.join(",") }
      : { pass: true, detail: declared.length + " clés Pivot + feutre.v1 encapsulée" };
  });
  t("storage:aucune clé n'a été renommée", () => {
    const expected = {
      "pivot.v1": Progress.KEY, "pivot.career.v1": Career.KEY,
      "pivot.player.v1": Player.KEY, "pivot.rating.v1": Rating.KEY,
      "pivot.journey.v1": Journey.KEY, "pivot.hr.v1": HRStats.KEY,
      "pivot.pr.v1": PRStats.KEY, "pivot.bl.v1": BLStats.KEY,
    };
    const bad = Object.entries(expected).filter(([want, got]) => want !== got)
      .map(([w, g]) => `${w}→${g}`);
    return bad.length ? { pass: false, detail: "RENOMMAGE: " + bad.join(",") } : true;
  });
  t("storage:écriture puis relecture (round-trip Player)", () => {
    const before = localStorage.getItem(Player.KEY);
    try {
      Player.load && Player.load();
      Player.save && Player.save();
      const raw = localStorage.getItem(Player.KEY);
      if (raw == null) return { pass: false, detail: "rien écrit sous " + Player.KEY };
      JSON.parse(raw);
      return true;
    } finally {
      if (before == null) localStorage.removeItem(Player.KEY);
      else localStorage.setItem(Player.KEY, before);
    }
  });
  t("storage:JSON corrompu ne fait pas planter le chargement", () => {
    const saved = {};
    for (const k of KEYS) saved[k] = localStorage.getItem(k);
    try {
      for (const k of KEYS) localStorage.setItem(k, "{ ceci n'est pas du JSON");
      const loaders = [
        () => Progress.summary(), () => Career.load && Career.load(),
        () => Player.load && Player.load(), () => Rating.load && Rating.load(),
      ];
      for (const fn of loaders) fn();
      return true;
    } catch (e) {
      return { pass: false, detail: "throw sur JSON corrompu: " + e.message };
    } finally {
      for (const k of KEYS) {
        if (saved[k] == null) localStorage.removeItem(k);
        else localStorage.setItem(k, saved[k]);
      }
    }
  });
  t("storage:clé absente est tolérée", () => {
    const saved = localStorage.getItem(Progress.KEY);
    try {
      localStorage.removeItem(Progress.KEY);
      const s = Progress.summary();
      return typeof s.n === "number" ? true : { pass: false, detail: "summary cassé sans données" };
    } finally { if (saved != null) localStorage.setItem(Progress.KEY, saved); }
  });
  t("storage:StorageGuard existe et ne persiste rien lui-même", () => {
    const SG = G("StorageGuard");
    if (!SG) return { pass: false, detail: "StorageGuard absent" };
    const src = Object.keys(SG).map(k => typeof SG[k] === "function" ? SG[k].toString() : "").join("");
    const persists = /localStorage\.setItem|localStorage\.getItem/.test(src);
    return persists
      ? { pass: false, detail: "StorageGuard lit/écrit localStorage — responsabilités mélangées" }
      : { pass: true, detail: "gestion d'erreur uniquement" };
  });

  // ------------------------------------------------------------------ PONTS
  t("bridge:window.Feutre expose drillConfig et leakTitle", () => {
    if (!window.Feutre) return { pass: false, detail: "window.Feutre absent" };
    const miss = ["drillConfig", "leakTitle", "open"].filter(f => typeof window.Feutre[f] !== "function");
    return miss.length ? { pass: false, detail: "manque: " + miss.join(",") } : true;
  });
  // LEAK_DRILL est privé dans l'IIFE Feutre : on passe par le pont public, avec
  // des identifiants réels lus dans la table (échantillon représentatif).
  const DRILL_IDS = ["utg-loose", "sb-loose", "loose", "fold-3bet", "bb-underdefend",
    "call-station", "no-value", "cbet-low", "giveup-turn", "river-callstation"];
  t("bridge:drillConfig renvoie une config pour chaque leak connu", () => {
    const bad = [];
    for (const id of DRILL_IDS) {
      const cfg = window.Feutre.drillConfig(id);
      if (!cfg) { bad.push(id + ":null"); continue; }
      if (!has(cfg, "mode")) bad.push(id + ":sans mode");
    }
    return bad.length ? { pass: false, detail: bad.join(",") }
      : { pass: true, detail: DRILL_IDS.length + " leaks résolus" };
  });
  t("bridge:leakTitle renvoie un libellé lisible", () => {
    const bad = DRILL_IDS.filter(id => {
      const s = window.Feutre.leakTitle(id);
      return typeof s !== "string" || !s.length;
    });
    return bad.length ? { pass: false, detail: bad.join(",") } : true;
  });
  t("bridge:drillConfig(inconnu) renvoie null", () =>
    window.Feutre.drillConfig("__inexistant__") === null ? true
      : { pass: false, detail: "devrait être null" });
  t("bridge:leakTitle retombe sur l'id si inconnu", () =>
    window.Feutre.leakTitle("__inexistant__") === "__inexistant__" ? true
      : { pass: false, detail: "fallback cassé" });
  t("bridge:App.drillLeak arme un drillRun (workflow tracker→simulateur)", () => {
    const savedView = App.view, savedDrill = App.drillRun,
      savedSession = App.session, savedDaily = App.dailyRun;
    try {
      App.drillLeak("utg-loose");
      const d = App.drillRun;
      if (!d) return { pass: false, detail: "drillRun non armé" };
      const need = ["leak", "title", "cfg", "total"];
      const miss = need.filter(k => !has(d, k));
      if (miss.length) return { pass: false, detail: "manque " + miss.join(",") };
      if (d.cfg.mode !== "preflop") return { pass: false, detail: "mode non propagé: " + d.cfg.mode };
      if (d.cfg.forcePos !== "UTG") return { pass: false, detail: "forcePos non propagé" };
      return { pass: true, detail: `leak=${d.leak} total=${d.total} mode=${d.cfg.mode}` };
    } finally {
      App.drillRun = savedDrill; App.view = savedView;
      App.session = savedSession; App.dailyRun = savedDaily;
    }
  });

  // ----------------------------------------------------------------- MOTEUR
  t("engine:Studio n'écrit pas dans la progression réelle", () => {
    const S = G("Studio");
    if (!S) return { pass: false, detail: "Studio absent" };
    const src = Object.keys(S).map(k => typeof S[k] === "function" ? S[k].toString() : "").join("");
    const writes = /Progress\.(record|push|add|save)|Career\.(record|save|add)/.test(src);
    return writes ? { pass: false, detail: "Studio écrit dans Progress/Career" } : true;
  });
  t("engine:le garde _studio existe dans App.choose", () => {
    const src = App.choose.toString();
    return /_studio/.test(src) ? true
      : { pass: false, detail: "App.choose ne teste plus t._studio" };
  });

  // -------------------------------------------------------------------- UI
  const VIEWS = ["home", "play", "setup", "stats", "leaks", "journey", "profile", "theory", "profiles"];
  t("ui:navigation sur toutes les vues sans erreur", () => {
    const saved = App.view;
    const broken = [];
    for (const v of VIEWS) {
      try { App.go(v); } catch (e) { broken.push(`${v}:${e.message}`); }
    }
    try { App.go(saved); } catch (e) { /* retour best-effort */ }
    return broken.length ? { pass: false, detail: broken.join(" | ") }
      : { pass: true, detail: VIEWS.length + " vues" };
  });
  t("ui:le conteneur racine reçoit du contenu", () => {
    App.go("home");
    const root = document.getElementById("app") || document.body;
    return root && root.innerHTML.length > 200
      ? { pass: true, detail: root.innerHTML.length + " chars" }
      : { pass: false, detail: "rendu vide" };
  });
  t("ui:les labs s'ouvrent", () => {
    const broken = [];
    for (const [name, mod] of [["HRUI", G("HRUI")], ["PRUI", G("PRUI")], ["BLUI", G("BLUI")]]) {
      if (!mod) { broken.push(name + ":absent"); continue; }
      const entry = mod.open || mod.render || mod.start;
      if (typeof entry !== "function") { broken.push(name + ":pas de point d'entrée"); continue; }
      try { entry.call(mod); } catch (e) { broken.push(`${name}:${e.message}`); }
    }
    return broken.length ? { pass: false, detail: broken.join(" | ") } : true;
  });
  t("ui:Modal est une primitive partagée (pas dupliquée)", () => {
    const M = G("Modal");
    if (!M) return { pass: false, detail: "Modal absent" };
    const api = ["confirm", "alert", "prompt"].filter(f => typeof M[f] === "function");
    return api.length >= 1 ? { pass: true, detail: "api: " + api.join(",") }
      : { pass: false, detail: "aucune méthode de dialogue" };
  });
  t("ui:sparkline générique accessible", () => {
    const U = G("UI"), H = G("HRUI");
    const onUI = U && typeof U.sparkline === "function";
    const onHR = H && typeof H.sparkline === "function";
    if (!onUI && !onHR) return { pass: false, detail: "sparkline introuvable" };
    return { pass: true, detail: onUI ? "UI.sparkline (correct)" : "HRUI.sparkline (à déplacer)" };
  });

  // ------------------------------------------------------------ BOUCLE JEU
  t("game:newHand produit une table jouable", () => {
    const saved = { t: App.t, view: App.view, phase: App.phase };
    try {
      App.go("play"); App.newHand();
      const tb = App.t;
      if (!tb) return { pass: false, detail: "App.t null après newHand" };
      const need = ["hero", "board"];
      const miss = need.filter(k => !has(tb, k));
      return miss.length ? { pass: false, detail: "table sans " + miss.join(",") }
        : { pass: true, detail: `hero=${JSON.stringify(tb.hero.hole)} board=${tb.board.length}` };
    } finally { App.t = saved.t; App.view = saved.view; App.phase = saved.phase; }
  });
  t("game:Judge.evaluate(t, decision) rend un verdict structuré", () => {
    const saved = { t: App.t, view: App.view, phase: App.phase };
    try {
      App.go("play"); App.newHand();
      const a = Judge.evaluate(App.t, { action: "fold", amount: 0 });
      if (!a) return { pass: false, detail: "verdict null" };
      const keys = Object.keys(a);
      return (has(a, "verdict") || has(a, "options"))
        ? { pass: true, detail: keys.slice(0, 6).join(",") }
        : { pass: false, detail: "forme inattendue: " + keys.join(",") };
    } finally { App.t = saved.t; App.view = saved.view; App.phase = saved.phase; }
  });
  t("game:Judge.evaluate est déterministe pour un même état", () => {
    const saved = { t: App.t, view: App.view, phase: App.phase };
    try {
      App.go("play"); App.newHand();
      const d = { action: "fold", amount: 0 };
      const a = JSON.stringify(Judge.evaluate(App.t, d));
      const b = JSON.stringify(Judge.evaluate(App.t, d));
      return a === b ? true : { pass: false, detail: "deux évaluations divergentes" };
    } finally { App.t = saved.t; App.view = saved.view; App.phase = saved.phase; }
  });

  // ----------------------------------------------------------- EXPORT/IMPORT
  // L'export/import vit dans Player.exportAll / Player.importAll (pas dans App).
  // Après extraction DataPort, on accepte l'un ou l'autre point d'entrée.
  const exporter = () => {
    const DP = G("DataPort");
    if (DP && typeof DP.exportAll === "function") return () => DP.exportAll();
    return () => Player.exportAll();
  };
  const importer = () => {
    const DP = G("DataPort");
    if (DP && typeof DP.importAll === "function") return (j) => DP.importAll(j);
    return (j) => Player.importAll(j);
  };

  t("dataport:l'export produit un payload versionné", () => {
    const dump = JSON.parse(exporter()());
    if (dump._format !== "pivot-save") return { pass: false, detail: "_format=" + dump._format };
    if (!dump._appVersion) return { pass: false, detail: "_appVersion manquant" };
    const slots = ["player", "progress", "career", "hr", "pr", "bl", "rating", "journey"];
    const miss = slots.filter(s => !has(dump, s));
    return miss.length ? { pass: false, detail: "slots manquants: " + miss.join(",") }
      : { pass: true, detail: `v${dump._version} · ${slots.length} slots` };
  });
  t("dataport:round-trip export→import sans perte", () => {
    const saved = {};
    for (const k of KEYS) saved[k] = localStorage.getItem(k);
    try {
      const before = exporter()();
      const res = importer()(before);
      if (!res || res.ok !== true) return { pass: false, detail: "import refusé: " + JSON.stringify(res) };
      const after = JSON.parse(exporter()());
      const b = JSON.parse(before);
      const diff = ["player", "progress", "career", "hr", "pr", "bl", "rating", "journey"]
        .filter(s => JSON.stringify(b[s]) !== JSON.stringify(after[s]));
      return diff.length ? { pass: false, detail: "slots altérés: " + diff.join(",") } : true;
    } finally {
      for (const k of KEYS) {
        if (saved[k] == null) localStorage.removeItem(k);
        else localStorage.setItem(k, saved[k]);
      }
    }
  });
  t("dataport:un fichier étranger est rejeté proprement", () => {
    const r = importer()(JSON.stringify({ _format: "autre-chose", data: 1 }));
    return r && r.ok === false && r.error
      ? true : { pass: false, detail: "devrait refuser: " + JSON.stringify(r) };
  });
  t("dataport:un fichier illisible est rejeté proprement", () => {
    const r = importer()("{{{pas du json");
    return r && r.ok === false ? true : { pass: false, detail: "devrait refuser" };
  });

  return { tests };
}
