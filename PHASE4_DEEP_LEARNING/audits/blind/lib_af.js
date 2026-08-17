/**
 * Bibliothèque commune de la contre-expérience anti-farm (audit indépendant).
 * Aucun fichier applicatif n'est modifié : on ne fait que piloter le moteur.
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..", "..");
function boot() {
  const out = require(path.join(ROOT, "tests", "harness"))("VERSION_PRODUCTION/herolab.html");
  // `Opponent` est une classe de haut niveau : elle n'est pas globale dans le
  // contexte vm et n'est donc pas exportée par le harness. On la récupère.
  const vm = require("vm");
  try { out.M.Opponent = vm.runInContext("Opponent", out.sandbox); } catch (e) {}
  return out;
}

/* ---- PRNG déterministe, pour que chaque stratégie voie la MÊME séquence
   de situations : sans ça, on compare des tirages différents. ---- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedRandom(sandbox, seed) {
  const r = mulberry32(seed);
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = r;
  // Le code du moteur tourne dans le contexte vm et référence `Math` global.
  return r;
}

/* ---- Garde-fou impératif : Spot.generate résout LEVELS[opt.level].
   Si on passe autre chose qu'une clé texte, il retombe sur "intermediaire"
   en silence. On vérifie l'identité de l'objet niveau à chaque main. ---- */
function guardLevel(M, t, key) {
  if (t.level !== M.LEVELS[key]) {
    throw new Error(`GARDE NIVEAU: attendu LEVELS["${key}"] (${M.LEVELS[key] && M.LEVELS[key].name}), obtenu ${t.level && t.level.name}`);
  }
  return t;
}
function guardMode(M, t, key) {
  if (t.mode !== M.MODES[key]) {
    throw new Error(`GARDE MODE: attendu MODES["${key}"], obtenu ${t.mode && t.mode.name}`);
  }
  return t;
}

/** Génère un spot jouable (même boucle de retry que App.newHand). */
function freshSpot(M, cfg, levelKey, modeKey) {
  for (let i = 0; i < 40; i++) {
    const t = M.Spot.generate(cfg);
    guardLevel(M, t, levelKey);
    if (modeKey) guardMode(M, t, modeKey);
    if (!t.finished && M.Spot.options(t).length) return t;
  }
  return null;
}

/* ==========================================================================
   STRATÉGIES
   Chacune prend (t, options, M) et renvoie une option de la liste.
   ========================================================================== */
const pickBy = (opts, pred, fallback) => opts.find(pred) || fallback(opts);
const last = a => a[a.length - 1];

const STRATS = {
  /* --- Référence compétente : joue l'option de meilleure EV selon le juge.
     C'est une BORNE SUPÉRIEURE de compétence (oracle), pas un humain. --- */
  oracle: {
    name: "Oracle (EV max)", competent: true, oracle: true,
    choose: () => null   // traité à part : nécessite l'analyse
  },

  /* --- Référence compétente heuristique, sans accès au juge : sélection
     préflop par force de main, c-bet en position, fold des mains faibles. --- */
  heuristique: {
    name: "Compétent heuristique", competent: true,
    choose(t, opts, M) {
      const hero = t.hero;
      const toCall = t.toCall(hero);
      const made = t.board.length ? M.BoardTex.madeHand(hero.hole, t.board) : null;
      const str = made ? made.strength : M.Opponent.labelStrength(M.Ranges.label(hero.hole)) / 100;
      const potOdds = toCall > 0 ? toCall / (t.pot + toCall) : 0;
      const bet = opts.filter(o => o.action === "bet" || o.action === "raise");
      const mid = bet.length ? bet[Math.min(1, bet.length - 1)] : null;   // ~1/2 pot / 3bb
      if (t.street === "preflop") {
        if (toCall === 0) return mid || opts[0];
        if (str > 0.72 && mid) return mid;
        if (str > 0.55) return pickBy(opts, o => o.action === "call", o => o[0]);
        return pickBy(opts, o => o.action === "fold", o => o[0]);
      }
      if (str > 0.62 && mid) return mid;                       // value
      if (toCall === 0) {
        if (made && made.draw && mid) return mid;              // semi-bluff
        return pickBy(opts, o => o.action === "check", o => o[0]);
      }
      if (str > potOdds + 0.12) return pickBy(opts, o => o.action === "call", o => o[0]);
      return pickBy(opts, o => o.action === "fold", o => o[0]);
    }
  },

  /* --- 1. Le fold-bot : passe dès que possible, checke sinon. --- */
  fold: {
    name: "Fold-bot (passe toujours)",
    choose(t, opts) {
      return pickBy(opts, o => o.action === "fold",
        o => pickBy(o, x => x.action === "check", y => y[0]));
    }
  },

  /* --- 2. La station : suit toujours, ne passe ni ne relance jamais. --- */
  station: {
    name: "Station (suit toujours)",
    choose(t, opts) {
      return pickBy(opts, o => o.action === "call",
        o => pickBy(o, x => x.action === "check", y => y[0]));
    }
  },

  /* --- 3. Le maniaque : mise le maximum (tapis) dès que c'est légal. --- */
  allin: {
    name: "Maniaque (tapis systématique)",
    choose(t, opts) {
      const agg = opts.filter(o => o.action === "bet" || o.action === "raise");
      if (agg.length) return last(agg);
      return pickBy(opts, o => o.action === "call", o => o[0]);
    }
  },

  /* --- 4. Le singe : tirage uniforme parmi les options légales. --- */
  aleatoire: {
    name: "Aléatoire uniforme",
    choose(t, opts) { return opts[(Math.random() * opts.length) | 0]; }
  },

  /* --- 5. Le robot mécanique : rotation sur l'index d'option, zéro poker.
     C'est le farm « le pouce sur le bouton » sans même regarder l'écran. --- */
  rotation: {
    name: "Rotation mécanique (i % n)",
    stateful: true,
    choose(t, opts, M, st) { st.i = (st.i || 0) + 1; return opts[st.i % opts.length]; }
  },

  /* --- 6. Le mini-mise : la plus petite mise légale, toujours.
     Cible le fait que la fold equity et la polarisation dépendent du sizing. --- */
  minbet: {
    name: "Mini-mise systématique",
    choose(t, opts) {
      const agg = opts.filter(o => o.action === "bet" || o.action === "raise");
      if (agg.length) return agg[0];
      return pickBy(opts, o => o.action === "check", o => pickBy(o, x => x.action === "call", y => y[0]));
    }
  }
};

/* ==========================================================================
   RUNNER — joue N décisions en reproduisant la chaîne d'écriture d'App.choose
   ========================================================================== */
function runStrategy(M, sandbox, opt) {
  const { stratKey, decisions, levelKey, modeKey = "libre", seed, cfgExtra } = opt;
  const strat = STRATS[stratKey];
  const st = {};
  M.Progress.data = M.Progress.blank();
  M.Player.data = M.Player.blank();
  seedRandom(sandbox, seed);

  const cfg = Object.assign({
    level: levelKey, mode: modeKey, stake: "NL10",
    players: 0, stackRange: [40, 150]
  }, cfgExtra || {});

  const snapAt = opt.snapshots || [];
  const snaps = [];
  let nDec = 0, nHands = 0, netBB = 0, handsFinished = 0;
  let evLossTrue = 0;          // perte d'EV RÉELLE, tous verdicts confondus
  const verdicts = { correct: 0, acceptable: 0, erreur: 0 };
  const chosenActs = {};

  while (nDec < decisions) {
    const t = freshSpot(M, cfg, levelKey, modeKey);
    if (!t) continue;
    nHands++;
    let guard = 0;
    let done = false;
    while (!done && guard++ < 12 && nDec < decisions) {
      const opts = M.Spot.options(t);
      if (!opts.length) break;
      let a, decision;
      if (strat.oracle) {
        // Une seule évaluation : on lit le classement puis on déclare avoir
        // joué le meilleur. loss = 0 par construction -> borne supérieure.
        a = M.Judge.evaluate(t, { action: "fold", amount: 0 });
        decision = { action: a.best.action, amount: a.best.amount };
        a.picked = a.best;
        a.loss = 0; a.lossBB = 0;
        a.verdict = "correct";
      } else {
        decision = strat.choose(t, opts, M, st) || opts[0];
        a = M.Judge.evaluate(t, decision);
      }
      nDec++;
      chosenActs[decision.action] = (chosenActs[decision.action] || 0) + 1;
      verdicts[a.verdict]++;
      evLossTrue += a.lossBB;

      // --- chaîne d'écriture identique à App.choose (l.7264+)
      const entry = M.Progress.record(t, a, decision);
      const wasOk = a.verdict !== "erreur";
      for (const tag of (entry.tags || [])) {
        if (tag.startsWith("leak:")) M.Player.recordMastery(tag.slice(5), wasOk);
      }

      const r = M.Play.step(t, decision);
      if (r.done) { done = true; handsFinished++; netBB += r.result.netBB; }

      if (snapAt.includes(nDec)) snaps.push(measure(M, {
        at: nDec, hands: nHands, handsFinished, netBB, evLossTrue,
        verdicts: { ...verdicts }
      }));
    }
  }
  return {
    strat: stratKey, name: strat.name, levelKey, modeKey, seed,
    decisions: nDec, hands: nHands, handsFinished, netBB, evLossTrue,
    verdicts, chosenActs,
    snaps,
    final: measure(M, { at: nDec, hands: nHands, handsFinished, netBB, evLossTrue, verdicts: { ...verdicts } })
  };
}

/** Photographie de TOUS les indicateurs de progression exposés par le produit. */
function measure(M, extra) {
  const s = M.Progress.summary();
  const rat = M.Rating.compute();
  const skills = M.Career.skills();
  const mast = {};
  for (const [k, v] of Object.entries(M.Player.data.mastery || {})) {
    const lv = M.Player.masteryLevel(k);
    mast[k] = { seen: v.seen, ok: v.ok, tier: lv.tier, name: lv.name, rate: +lv.rate.toFixed(3) };
  }
  return {
    ...extra,
    xp: s.xp, niveau: s.level, nextLevelXp: s.nextLevelXp,
    accuracyPct: +s.rate.toFixed(2),          // correct + acceptable
    correctPct: +s.correctRate.toFixed(2),
    evLossCompte: +s.evLoss.toFixed(2),        // ce que le produit affiche
    evLossReelle: +((extra.evLossTrue) || 0).toFixed(2),
    rating: rat.rating,
    ratingTier: M.Rating.tier(rat.rating).name,
    ratingSkills: Object.fromEntries(rat.skills.map(x => [x.key, x.score])),
    disciplineScore: rat.skills.find(x => x.key === "discipline").score,
    careerSkills: Object.fromEntries(skills.map(x => [x.name, x.score === null ? null : +x.score.toFixed(1)])),
    leaks: (s.leaks || []).map(l => ({ k: l.key, n: l.n, err: l.err, loss: +l.loss.toFixed(1) })),
    mastery: mast
  };
}

module.exports = { boot, STRATS, runStrategy, measure, seedRandom, mulberry32, guardLevel, guardMode, freshSpot, ROOT };
