/**
 * EXPÉRIENCE 1 — Coût réel vs progression affichée, par stratégie et par volume.
 *
 * Chaque stratégie joue la MÊME graine (même séquence de spots) sur 500
 * décisions ; on photographie tous les indicateurs de progression à 50, 200
 * et 500 décisions.
 *
 * Usage : node exp1_strategies.js [niveau] > exp1_<niveau>.json
 */
const fs = require("fs");
const L = require("./lib_af.js");

const LEVEL = process.argv[2] || "intermediaire";
const N = +(process.argv[3] || 500);
const SEED = +(process.argv[4] || 20260817);
const SNAPS = [50, 200, 500].filter(x => x <= N);
const ORDER = ["oracle", "heuristique", "fold", "station", "allin", "aleatoire", "rotation", "minbet"];

const out = [];
for (const k of ORDER) {
  const { M, sandbox } = L.boot();          // moteur neuf : aucun état résiduel
  const t0 = Date.now();
  const r = L.runStrategy(M, sandbox, {
    stratKey: k, decisions: N, levelKey: LEVEL, modeKey: "libre",
    seed: SEED, snapshots: SNAPS
  });
  r.ms = Date.now() - t0;
  out.push(r);
  process.stderr.write(`${LEVEL} ${k}: ${r.decisions} déc / ${r.hands} mains · xp=${r.final.xp} niv=${r.final.niveau} rating=${r.final.rating} evReel=${r.final.evLossReelle} (${(r.ms / 1000).toFixed(0)}s)\n`);
}
fs.writeFileSync(`${__dirname}/exp1_${LEVEL}.json`, JSON.stringify(out, null, 1));
console.log(`écrit exp1_${LEVEL}.json`);
