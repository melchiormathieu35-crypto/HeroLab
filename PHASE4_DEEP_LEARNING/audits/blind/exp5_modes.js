/**
 * EXPÉRIENCE 5 — Le MODE d'entraînement est-il un levier de farm ?
 * Même stratégie (fold-bot et rotation), même niveau, modes différents.
 * Le mode contraint la street : il change donc la taille du pot au moment du
 * jugement, or la tolérance vaut (1 bb + 3 % du pot) × (level.tolerance/0.1).
 */
const fs = require("fs");
const L = require("./lib_af.js");
const N = +(process.argv[2] || 300);
const MODES = ["preflop", "libre", "flop", "turn", "river", "short", "deep", "multiway"];
const out = [];

for (const strat of ["fold", "rotation"]) {
  for (const mode of MODES) {
    const { M, sandbox } = L.boot();
    const r = L.runStrategy(M, sandbox, {
      stratKey: strat, decisions: N, levelKey: "debutant", modeKey: mode,
      seed: 6060, snapshots: [N]
    });
    const f = r.final;
    out.push({
      strat, mode, decisions: r.decisions, hands: r.hands,
      mainsParDecision: +(r.hands / r.decisions).toFixed(3),
      xp: f.xp, xpParDecision: +(f.xp / r.decisions).toFixed(2), niveau: f.niveau,
      justessePct: f.accuracyPct, correctPct: f.correctPct,
      rating: f.rating, discipline: f.disciplineScore,
      evReellePardecision: +(f.evLossReelle / r.decisions).toFixed(3),
      evComptee: +f.evLossCompte.toFixed(1), evReelle: +f.evLossReelle.toFixed(1),
      occultePct: f.evLossReelle > 0 ? +((1 - f.evLossCompte / f.evLossReelle) * 100).toFixed(1) : 0
    });
    process.stderr.write(`${strat} ${mode}: xp/déc=${(f.xp / r.decisions).toFixed(2)} just=${f.accuracyPct}% rating=${f.rating} evréel/déc=${(f.evLossReelle / r.decisions).toFixed(2)}\n`);
  }
}
fs.writeFileSync(`${__dirname}/exp5_modes.json`, JSON.stringify(out, null, 1));
const pad = (s, n) => String(s).padEnd(n), padl = (s, n) => String(s).padStart(n);
console.log(pad("strat", 10) + pad("mode", 11) + padl("xp/déc", 8) + padl("just%", 8) + padl("corr%", 8) + padl("rating", 8) + padl("disc", 6) + padl("bb/déc", 9) + padl("occulté%", 10) + padl("mains/déc", 11));
for (const r of out) console.log(pad(r.strat, 10) + pad(r.mode, 11) + padl(r.xpParDecision, 8) + padl(r.justessePct, 8) + padl(r.correctPct, 8) + padl(r.rating, 8) + padl(r.discipline, 6) + padl(r.evReellePardecision, 9) + padl(r.occultePct, 10) + padl(r.mainsParDecision, 11));
