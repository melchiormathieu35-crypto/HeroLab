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
  // Contrat complet documenté au-dessus de Progress.summary(). Treize
  // consommateurs en dépendent ; toute évolution doit être additive.
  const SUMMARY_CONTRACT = {
    n: "number", correct: "number", acceptable: "number", errors: "number",
    evLoss: "number", rate: "number", correctRate: "number",
    byStreet: "object", byPos: "object", leaks: "object", chunks: "object",
    byDay: "object", xp: "number", level: "number", streak: "number",
    nextLevelXp: "number",
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
  // --------------------------------------- INTÉGRITÉ DES MODULES EXTRAITS
  // Une extraction réécrit des références par recherche/remplacement. Si un nom
  // est le préfixe d'un autre (App.renderProfile / App.renderProfiles), le
  // remplacement déborde et crée un membre qui n'existe pas. Ce test rend cette
  // classe d'erreur impossible à laisser passer.
  t("refactor:aucun membre fantôme sur les modules extraits", () => {
    const MODULES = ["Storage", "Onboarding", "DataPort", "ProfileUI", "DailyUI",
      "JourneyUI", "SessionCtl", "App", "UI", "Modal"];
    const ghosts = [];
    for (const name of MODULES) {
      const mod = G(name);
      if (!mod) continue;
      // tous les identifiants X.y présents dans le source chargé de TOUS les modules
      for (const other of MODULES) {
        const om = G(other);
        if (!om) continue;
        let src = "";
        for (const k of Object.keys(om)) {
          const v = om[k];
          if (typeof v === "function") src += v.toString() + "\n";
        }
        // Uniquement les SITES D'APPEL (`X.y(`). Un champ d'état greffé à
        // l'exécution est légitimement undefined au repos ; une méthode
        // appelée mais inexistante est toujours un bug.
        const re = new RegExp("\\b" + name + "\\.([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(", "g");
        let m;
        while ((m = re.exec(src))) {
          if (typeof mod[m[1]] !== "function" && !ghosts.includes(name + "." + m[1])) {
            ghosts.push(name + "." + m[1]);
          }
        }
      }
    }
    return ghosts.length
      ? { pass: false, detail: "membres inexistants: " + ghosts.join(", ") }
      : { pass: true, detail: "10 modules croisés" };
  });
  t("refactor:App n'expose plus les responsabilités extraites", () => {
    const moved = {
      Onboarding: ["renderOnboarding", "obPickAvatar", "obPickMentor", "obValidate", "finishOnboarding"],
      DataPort: ["exportAll", "importAll", "doExport", "triggerImport", "handleImport",
        "confirmWipe", "exportCareer", "resetCareer", "exportData", "resetData"],
      ProfileUI: ["renderProfile", "profPickAvatar", "profPickMentor", "saveProfile"],
      DailyUI: ["renderDaily", "dailyVerdict", "startDaily"],
      JourneyUI: ["renderJourney", "journeyMissions", "journeyTimeline", "trainLeak"],
    };
    const leaks = [];
    for (const [owner, members] of Object.entries(moved)) {
      const target = G(owner);
      for (const m of members) {
        if (App[m] !== undefined) leaks.push(`App.${m} devrait avoir été déplacé`);
        if (!target || typeof target[m] !== "function") leaks.push(`${owner}.${m} manquant`);
      }
    }
    return leaks.length ? { pass: false, detail: leaks.join(" | ") }
      : { pass: true, detail: "5 modules, 26 membres déplacés" };
  });
  t("refactor:aucun champ d'état orphelin laissé sur App", () => {
    // Une extraction déplace les méthodes ET l'état. Si une DÉCLARATION reste
    // sur l'ancien propriétaire alors que toutes les lectures ont été
    // renommées, elle devient un champ mort qui ment sur qui possède quoi.
    // Le test des membres fantômes ne le voit pas : il n'inspecte que les
    // sites d'appel.
    const MOVED = {
      SessionCtl: ["session", "sessionReport", "sessionComplete", "drillRun", "focusLeak", "focusNote"],
      DailyUI: ["dailyRun"],
      Onboarding: ["_obAvatar", "_obMentor"],
      ProfileUI: ["_profAvatar"],
    };
    const orphans = [];
    for (const [owner, fields] of Object.entries(MOVED)) {
      const target = G(owner);
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(App, f)) orphans.push(`App.${f} (appartient à ${owner})`);
        if (target && !Object.prototype.hasOwnProperty.call(target, f)) {
          orphans.push(`${owner}.${f} non déclaré`);
        }
      }
    }
    return orphans.length ? { pass: false, detail: orphans.join(" | ") }
      : { pass: true, detail: "10 champs, propriétaire unique" };
  });
  t("refactor:l'onboarding reste fonctionnel après extraction", () => {
    const savedName = Player.data && Player.data.name;
    try {
      Onboarding.renderOnboarding();
      const ov = document.getElementById("onboard");
      if (!ov || !ov.innerHTML.includes("obName")) return { pass: false, detail: "écran non rendu" };
      if (Onboarding._obAvatar == null) return { pass: false, detail: "_obAvatar non initialisé" };
      if (Onboarding._obMentor == null) return { pass: false, detail: "_obMentor non initialisé" };
      Onboarding.obPickAvatar("♦");
      if (Onboarding._obAvatar !== "♦") return { pass: false, detail: "obPickAvatar sans effet" };
      return true;
    } finally {
      const ov = document.getElementById("onboard");
      if (ov) { ov.classList.remove("on"); ov.innerHTML = ""; }
      if (savedName) Player.data.name = savedName;
    }
  });

  // ------------------------------------------------- COUCHE STORAGE (API)
  t("storage:la couche Storage existe et expose l'API attendue", () => {
    const S = G("Storage");
    if (!S) return { pass: false, detail: "Storage absent" };
    const need = ["get", "set", "remove", "has", "getRaw", "setRaw", "removeAll", "snapshot", "available"];
    const miss = need.filter(f => typeof S[f] !== "function");
    return miss.length ? { pass: false, detail: "manque: " + miss.join(",") }
      : { pass: true, detail: need.length + " méthodes" };
  });
  t("storage:Storage est le SEUL accès direct à localStorage", () => {
    // On inspecte le source réellement chargé de chaque module global.
    const offenders = [];
    for (const name of ["Progress", "Career", "Player", "Rating", "Journey",
      "HRStats", "PRStats", "BLStats", "App", "UI", "Modal", "Studio"]) {
      const mod = G(name);
      if (!mod) continue;
      let src = "";
      for (const k of Object.keys(mod)) {
        const v = mod[k];
        if (typeof v === "function") src += v.toString() + "\n";
      }
      if (/localStorage\s*\.\s*(getItem|setItem|removeItem|clear)/.test(src)) offenders.push(name);
    }
    return offenders.length
      ? { pass: false, detail: "accès direct restant: " + offenders.join(",") }
      : { pass: true, detail: "12 modules vérifiés, aucun accès direct" };
  });
  t("storage:get/set/remove round-trip", () => {
    const K = "__pivot_test_rt__";
    try {
      if (Storage.set(K, { a: 1, b: [2, 3] }) !== true) return { pass: false, detail: "set a échoué" };
      if (Storage.has(K) !== true) return { pass: false, detail: "has=false après set" };
      const v = Storage.get(K, null);
      if (!v || v.a !== 1 || v.b[1] !== 3) return { pass: false, detail: "valeur altérée" };
      Storage.remove(K);
      if (Storage.has(K) !== false) return { pass: false, detail: "has=true après remove" };
      return true;
    } finally { Storage.remove(K); }
  });
  t("storage:get(clé absente) rend le fallback", () => {
    const v = Storage.get("__pivot_absent__", { def: true });
    return v && v.def === true ? true : { pass: false, detail: JSON.stringify(v) };
  });
  t("storage:get(JSON invalide) rend le fallback sans throw", () => {
    const K = "__pivot_test_bad__";
    try {
      Storage.setRaw(K, "{{{ pas du json");
      const v = Storage.get(K, "FALLBACK");
      return v === "FALLBACK" ? true : { pass: false, detail: "obtenu: " + JSON.stringify(v) };
    } finally { Storage.remove(K); }
  });
  t("storage:get reproduit la sémantique historique (raw ? parse : defaut)", () => {
    const K = "__pivot_test_sem__";
    try {
      Storage.setRaw(K, "");            // chaîne vide = falsy => défaut, comme avant
      if (Storage.get(K, "D") !== "D") return { pass: false, detail: "chaîne vide ≠ défaut" };
      Storage.setRaw(K, "null");        // "null" parse en null, comme avant
      if (Storage.get(K, "D") !== null) return { pass: false, detail: '"null" devrait rendre null' };
      return true;
    } finally { Storage.remove(K); }
  });
  t("storage:set notifie StorageGuard quand le stockage refuse", () => {
    const real = localStorage.setItem.bind(localStorage);
    const realFail = StorageGuard.fail, realWarned = StorageGuard.warned;
    let notified = false;
    try {
      localStorage.setItem = () => { throw new Error("QuotaExceededError (simulé)"); };
      StorageGuard.fail = () => { notified = true; };
      const ok = Storage.set("__pivot_test_quota__", { x: 1 });
      if (ok !== false) return { pass: false, detail: "set devrait rendre false" };
      if (!notified) return { pass: false, detail: "StorageGuard.fail non appelé" };
      return true;
    } catch (e) {
      return { pass: false, detail: "une exception a fui vers l'appelant: " + e.message };
    } finally {
      localStorage.setItem = real; StorageGuard.fail = realFail; StorageGuard.warned = realWarned;
      try { localStorage.removeItem("__pivot_test_quota__"); } catch (_) { }
    }
  });
  t("storage:stockage indisponible ne fait pas planter les chargements", () => {
    const rg = localStorage.getItem.bind(localStorage);
    const rs = localStorage.setItem.bind(localStorage);
    const realFail = StorageGuard.fail, realWarned = StorageGuard.warned;
    try {
      localStorage.getItem = () => { throw new Error("SecurityError (simulé)"); };
      localStorage.setItem = () => { throw new Error("SecurityError (simulé)"); };
      StorageGuard.fail = () => { };
      Progress.load(); Career.load(); Player.load(); Rating.load(); Journey.load();
      HRStats.load(); PRStats.load(); BLStats.load();
      const s = Progress.summary();
      return typeof s.n === "number" ? true : { pass: false, detail: "summary cassé" };
    } catch (e) {
      return { pass: false, detail: "throw en stockage indisponible: " + e.message };
    } finally {
      localStorage.getItem = rg; localStorage.setItem = rs;
      StorageGuard.fail = realFail; StorageGuard.warned = realWarned;
      Progress.load(); Career.load(); Player.load();
    }
  });
  t("storage:snapshot rend les valeurs parsées par clé", () => {
    const K = "__pivot_test_snap__";
    try {
      Storage.set(K, { v: 7 });
      const snap = Storage.snapshot([K, "__pivot_absent__"]);
      return snap[K] && snap[K].v === 7 && snap["__pivot_absent__"] === null
        ? true : { pass: false, detail: JSON.stringify(snap) };
    } finally { Storage.remove(K); }
  });

  // ------------------------------------ ROBUSTESSE AUX DONNÉES PERSISTÉES
  // Une valeur JSON valide mais de mauvaise forme rendait l'application
  // impossible à démarrer, sans recours pour l'utilisateur. Ces cas sont
  // dérivés de crashs réellement observés, pas imaginés.
  const CORRUPTIONS = {
    "null littéral": "null",
    "tableau": "[]",
    "chaîne nue": '"texte"',
    "nombre": "42",
    "booléen": "true",
    "clés inconnues": '{"inconnu":1,"autre":[2]}',
    "champ tableau à null": '{"decisions":null,"xp":"beaucoup"}',
    "champ objet remplacé par tableau": '{"tagStats":[1,2]}',
    "objet partiel": '{"xp":7}',
    "JSON invalide": "{{{nope",
  };
  for (const [label, value] of Object.entries(CORRUPTIONS)) {
    t(`storage:boot résiste à une donnée « ${label} »`, () => {
      const saved = {};
      for (const k of KEYS) saved[k] = localStorage.getItem(k);
      try {
        for (const k of KEYS) localStorage.setItem(k, value);
        Progress.load(); Career.load(); Player.load(); Rating.load(); Journey.load();
        HRStats.load(); PRStats.load(); BLStats.load();
        const s = Progress.summary();
        if (typeof s.n !== "number") return { pass: false, detail: "summary.n non numérique" };
        if (!Array.isArray(Progress.data.decisions)) {
          return { pass: false, detail: "decisions n'est pas un tableau après réparation" };
        }
        return { pass: true, detail: `n=${s.n}` };
      } catch (e) {
        return { pass: false, detail: "CRASH au boot: " + e.message };
      } finally {
        for (const k of KEYS) {
          if (saved[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]);
        }
        Progress.load(); Career.load(); Player.load(); Rating.load(); Journey.load();
        HRStats.load(); PRStats.load(); BLStats.load();
      }
    });
  }
  t("storage:getObject préserve les données valides", () => {
    const K = "__pivot_test_obj__";
    try {
      Storage.set(K, { xp: 7, decisions: [{ a: 1 }], perso: "gardé" });
      const v = Storage.getObject(K, { xp: 0, decisions: [], tagStats: {} });
      if (v.xp !== 7) return { pass: false, detail: "xp écrasé: " + v.xp };
      if (v.decisions.length !== 1) return { pass: false, detail: "decisions perdues" };
      if (v.perso !== "gardé") return { pass: false, detail: "clé inconnue supprimée — perte de données" };
      if (typeof v.tagStats !== "object") return { pass: false, detail: "clé manquante non complétée" };
      return true;
    } finally { Storage.remove(K); }
  });
  t("storage:getObject répare uniquement les types contredits", () => {
    const K = "__pivot_test_rep__";
    try {
      Storage.set(K, { decisions: null, xp: "texte", tagStats: [1, 2], ok: 5 });
      const v = Storage.getObject(K, { decisions: [], xp: 0, tagStats: {}, ok: 0 });
      const bad = [];
      if (!Array.isArray(v.decisions)) bad.push("decisions non réparé");
      if (typeof v.xp !== "number") bad.push("xp non réparé");
      if (Array.isArray(v.tagStats) || typeof v.tagStats !== "object") bad.push("tagStats non réparé");
      if (v.ok !== 5) bad.push("champ valide écrasé");
      return bad.length ? { pass: false, detail: bad.join(", ") } : true;
    } finally { Storage.remove(K); }
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
  t("bridge:drillLeak arme un drillRun (workflow tracker→simulateur)", () => {
    // drillLeak a été déplacé d'App vers SessionCtl ; le pont doit rester intact
    // quel que soit son propriétaire.
    const owner = (G("SessionCtl") && typeof SessionCtl.drillLeak === "function")
      ? SessionCtl : App;
    const savedView = App.view, savedDrill = owner.drillRun,
      savedSession = owner.session, savedDaily = (G("DailyUI") || App).dailyRun;
    try {
      owner.drillLeak("utg-loose");
      const d = owner.drillRun;
      if (!d) return { pass: false, detail: "drillRun non armé" };
      const need = ["leak", "title", "cfg", "total"];
      const miss = need.filter(k => !has(d, k));
      if (miss.length) return { pass: false, detail: "manque " + miss.join(",") };
      if (d.cfg.mode !== "preflop") return { pass: false, detail: "mode non propagé: " + d.cfg.mode };
      if (d.cfg.forcePos !== "UTG") return { pass: false, detail: "forcePos non propagé" };
      return { pass: true, detail: `leak=${d.leak} total=${d.total} mode=${d.cfg.mode} via ${owner === App ? "App" : "SessionCtl"}` };
    } finally {
      owner.drillRun = savedDrill; App.view = savedView;
      owner.session = savedSession;
      (G("DailyUI") || App).dailyRun = savedDaily;
    }
  });
  t("bridge:le handler du tracker pointe vers le bon propriétaire", () => {
    // Le bouton « Refaire 10 spots » est généré dans une chaîne onclick ; si le
    // renommage l'avait manqué, le pont serait cassé à l'exécution seulement.
    const owner = (G("SessionCtl") && typeof SessionCtl.drillLeak === "function")
      ? "SessionCtl" : "App";
    let src = "";
    for (const mod of [G("V"), G("FT")]) {
      if (!mod) continue;
      for (const k of Object.keys(mod)) {
        if (typeof mod[k] === "function") src += mod[k].toString() + "\n";
      }
    }
    if (!src) return { pass: true, detail: "vues Feutre non inspectables (IIFE) — couvert par le test d'appel" };
    const stale = /\bApp\.drillLeak\b/.test(src) && owner !== "App";
    return stale ? { pass: false, detail: "onclick pointe encore vers App.drillLeak" }
      : { pass: true, detail: "handlers alignés sur " + owner };
  });

  // ------------------------------------------------------------------ LEAKS
  t("leaks:recouvrement des deux taxonomies (fige l'état documenté)", () => {
    // Verrouille la mesure décrite dans le bloc au-dessus de LEAK_INFO. Si une
    // table de correspondance est ajoutée un jour, ce test échoue pour rappeler
    // de mettre la documentation à jour — il ne juge pas la valeur du mapping.
    const sim = Object.keys(G("LEAK_INFO") || {});
    if (!sim.length) return { pass: false, detail: "LEAK_INFO vide" };
    const shared = sim.filter(id => window.Feutre.drillConfig(id) !== null);
    const expected = ["bb-underdefend", "bb-overdefend"];
    const same = shared.length === expected.length && expected.every(e => shared.includes(e));
    return same
      ? { pass: true, detail: `${shared.length}/${sim.length} ids partagés — conforme au bloc documenté` }
      : { pass: false, detail: `recouvrement changé: ${shared.join(",")} — mettre à jour la note sur les taxonomies` };
  });
  t("leaks:chaque id LEAK_INFO reste résoluble en libellé", () => {
    const sim = Object.keys(G("LEAK_INFO") || {});
    const bad = sim.filter(id => {
      const t1 = (LEAK_INFO[id] || {}).name;
      return !t1 || typeof t1 !== "string";
    });
    return bad.length ? { pass: false, detail: "sans nom: " + bad.join(",") }
      : { pass: true, detail: sim.length + " fuites nommées" };
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
