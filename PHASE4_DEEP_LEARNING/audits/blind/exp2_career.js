/**
 * EXPÉRIENCE 2 — La carrière : combien de DÉCISIONS (= de clics) faut-il pour
 * satisfaire les objectifs de palier, selon la stratégie ?
 *
 * Reproduit fidèlement la boucle de session d'App.newHand (l.7200-7231) :
 * palier -> niveau imposé, roster, stackRange, 34 % de mains « ciblées ».
 *
 * Usage : node exp2_career.js <strat> <handsMax> [sessionLen]
 */
const fs = require("fs");
const L = require("./lib_af.js");

const STRAT = process.argv[2] || "fold";
const HANDS_MAX = +(process.argv[3] || 2500);
const LEN = process.argv[4] || "long";      // 50 / 200 / 500 mains

const { M, sandbox } = L.boot();
L.seedRandom(sandbox, 424242);
const strat = L.STRATS[STRAT];
const st = {};

M.Progress.data = M.Progress.blank();
M.Player.data = M.Player.blank();
M.Career.data = M.Career.blank();

const trace = [];
let totalDecisions = 0, totalHands = 0, sessions = 0, promoted = null;
let guardChecks = 0;

while (totalHands < HANDS_MAX) {
  const tier = M.Career.tier();
  const levelKey = M.Career.levelForTier(tier);        // clé TEXTE, comme le produit
  const roster = new M.Roster(tier, 8);
  const S = M.Session.create(tier, LEN, roster);

  while (S.hands < S.target && totalHands < HANDS_MAX) {
    // --- reconstitution exacte de la config de main (App.newHand, l.7203-7218)
    const cfg = {
      stake: tier.stake, roster: S.roster, stackRange: M.Roster.stackRange(),
      profiles: [], level: levelKey, mode: "libre", players: 0
    };
    const leak = M.Career.sessionLeak(S);
    if (leak && Math.random() < 0.34) cfg.mode = M.Progress.focusFor(leak).mode;
    const modeKey = cfg.mode;

    if (S.roster) S.roster.newHand();
    let t = null;
    for (let i = 0; i < 25 && !t; i++) {
      const tt = M.Spot.generate(cfg);
      L.guardLevel(M, tt, levelKey);                   // garde impérative
      L.guardMode(M, tt, modeKey);
      guardChecks++;
      if (!tt.finished && M.Spot.options(tt).length) t = tt;
    }
    if (!t) continue;

    let done = false, guard = 0;
    while (!done && guard++ < 12) {
      const opts = M.Spot.options(t);
      if (!opts.length) break;
      let a, decision;
      if (strat.oracle) {
        a = M.Judge.evaluate(t, { action: "fold", amount: 0 });
        decision = { action: a.best.action, amount: a.best.amount };
        a.picked = a.best; a.loss = 0; a.lossBB = 0; a.verdict = "correct";
      } else {
        decision = strat.choose(t, opts, M, st) || opts[0];
        a = M.Judge.evaluate(t, decision);
      }
      totalDecisions++;
      const entry = M.Progress.record(t, a, decision);
      M.Session.recordDecision(S, t, a, decision);
      for (const tag of (entry.tags || [])) {
        if (!tag.startsWith("leak:")) continue;
        const k = tag.slice(5);
        S.leakCounts[k] = (S.leakCounts[k] || 0) + 1;
        M.Player.recordMastery(k, a.verdict !== "erreur");
      }
      const r = M.Play.step(t, decision);
      if (r.done) { done = true; M.Session.recordHand(S, t, r.result); totalHands++; }
    }
  }

  const report = M.Session.report(S, M.Career.data);
  M.Career.closeSession(report, S.leakCounts);
  sessions++;

  const status = M.Career.promotionStatus();
  const goals = {};
  for (const g of status.goals) goals[g.id] = { cur: g.cur === null ? null : +(+g.cur).toFixed(2), target: g.target, pct: +g.pct.toFixed(1), locked: !!g.locked };
  trace.push({
    session: sessions, tier: tier.key, totalHands, totalDecisions,
    handsPerDecision: +(totalHands / totalDecisions).toFixed(3),
    accuracy: +report.accuracy.toFixed(2), bb100: +report.bb100.toFixed(2),
    netBB: +report.netBB.toFixed(1),
    bankroll: M.Career.data.bankroll,
    buyinsNext: M.Career.nextTier() ? +M.Bankroll.buyins(M.Career.data.bankroll, M.Career.nextTier().stake).toFixed(2) : null,
    tierIndex: M.Career.data.tierIndex,
    badges: M.Career.data.badges.map(b => b.id),
    canPromote: status.can, reason: status.reason, goals,
    xp: M.Progress.summary().xp, niveau: M.Progress.summary().level,
    rating: M.Rating.compute().rating
  });
  if (status.can && !promoted) { M.Career.promote(); promoted = { session: sessions, totalDecisions, totalHands }; }
  process.stderr.write(`${STRAT} s${sessions} ${tier.key} mains=${totalHands} déc=${totalDecisions} acc=${report.accuracy.toFixed(1)}% bb100=${report.bb100.toFixed(1)} br=${M.Career.data.bankroll} promo=${status.can}\n`);
}

const out = {
  strat: STRAT, sessionLength: LEN, handsMax: HANDS_MAX,
  totalHands, totalDecisions, sessions, promoted, guardChecks,
  handsPerDecision: +(totalHands / totalDecisions).toFixed(3),
  finalCareer: {
    tierIndex: M.Career.data.tierIndex, bankroll: M.Career.data.bankroll,
    totalHands: M.Career.data.totalHands, badges: M.Career.data.badges.map(b => b.id),
    tierStats: M.Career.data.tierStats
  },
  finalMeasure: L.measure(M, { at: totalDecisions, hands: totalHands, evLossTrue: 0 }),
  trace
};
fs.writeFileSync(`${__dirname}/exp2_${STRAT}.json`, JSON.stringify(out, null, 1));
console.log("écrit exp2_" + STRAT + ".json");
