/**
 * EXPÉRIENCE 4 — Le Poker Rating (0-3000) est alimenté à 3 axes sur 5 par les
 * labs. Ces axes sont-ils farmables sans compétence ?
 *
 * Points testés :
 *  - HRStats/BLStats/PRStats.summary() moyennent `pct`/`score` SANS pondérer
 *    par `difficulty` (l.9979, l.13228, l.11915) : jouer la difficulté la plus
 *    basse maximise l'axe.
 *  - BLScore.grade en mode "choice" est binaire sur 2 options -> 50 % au hasard.
 *  - HRScore.grade accorde 90 % au bon label : répondre le label le plus
 *    probable du modèle (affiché trié) est une règle mécanique.
 *  - PRScore.grade : le terme de calibration (l.6112-6616) rapporte +10 sur
 *    une réponse FAUSSE si la confiance est mise à 0.
 */
const fs = require("fs");
const L = require("./lib_af.js");
const N = +(process.argv[2] || 120);
const out = {};

/* ---- HR : Range Detective ------------------------------------------- */
function runHR(diff, policy, n, seed) {
  const { M, sandbox } = L.boot();
  L.seedRandom(sandbox, seed);
  M.HRStats.data = M.HRStats.blank();
  for (let i = 0; i < n; i++) {
    const spot = M.HRSpot.generate({ difficulty: diff, stake: "NL25" });
    if (spot.difficulty !== diff) throw new Error("GARDE HR: difficulté " + spot.difficulty + " != " + diff);
    const sol = M.HRLab.solve(spot);
    let answer;
    if (policy === "top") answer = sol.labels[0] && sol.labels[0].label;
    else if (policy === "fixe") answer = "AA";
    else answer = (sol.labels[(Math.random() * sol.labels.length) | 0] || {}).label;
    if (!answer) { i--; continue; }
    const g = M.HRScore.grade(answer, spot, sol);
    M.HRStats.record(spot, g, 3);
  }
  const s = M.HRStats.summary();
  return { diff, policy, spots: s.spots, avgPct: +s.avg.toFixed(1),
    axeRange: M.Rating.skillScore(s.avg, s.spots, 120) };
}

/* ---- BL : Blocker Finder -------------------------------------------- */
function runBL(diff, policy, n, seed) {
  const { M, sandbox } = L.boot();
  L.seedRandom(sandbox, seed);
  M.BLStats.data = M.BLStats.blank();
  const types = {};
  for (let i = 0; i < n; i++) {
    const spot = M.BLSpot.generate({ difficulty: diff });
    if (spot.difficulty !== diff) throw new Error("GARDE BL: difficulté " + spot.difficulty + " != " + diff);
    types[spot.type] = (types[spot.type] || 0) + 1;
    let answer;
    if (spot.mode === "multi") {
      const keys = (spot.options || []).map(o => o.key);
      answer = policy === "premier" ? keys.slice(0, 1)
        : policy === "tout" ? keys
        : keys.filter(() => Math.random() < 0.5);
    } else {
      const keys = (spot.options || []).map(o => o.key);
      answer = policy === "premier" ? keys[0] : keys[(Math.random() * keys.length) | 0];
    }
    const g = M.BLScore.grade(spot, answer);
    M.BLStats.record(spot, g, 3);
  }
  const s = M.BLStats.summary();
  return { diff, policy, spots: s.spots, avgPct: +s.avg.toFixed(1), types,
    axeBlockers: M.Rating.skillScore(s.avg, s.spots, 120) };
}

/* ---- PR : exploit de calibration ------------------------------------ */
function runPRcalib() {
  const { M } = L.boot();
  const mk = (exact, family, pAnswer) => ({
    dist: [{ key: "reg", p: pAnswer }, { key: "fish", p: 0.5 }]
  });
  const rows = {};
  for (const c of [0, 25, 50, 75, 100]) {
    // 4 issues possibles de PRScore.grade, notées à cette confiance
    const cases = {
      exact: Math.max(0, Math.min(100, 100 + Math.round((c / 100 - 0.5) * 20))),
      memeFamille: Math.max(0, Math.min(100, 60 + Math.round(-(c / 100 - 0.5) * 20))),
      plausible: Math.max(0, Math.min(100, 35 + Math.round(-(c / 100 - 0.5) * 20))),
      faux: Math.max(0, Math.min(100, 0 + Math.round(-(c / 100 - 0.5) * 20)))
    };
    rows[c] = cases;
  }
  // Vérification par appel réel de la fonction du produit
  const check = {};
  for (const c of [0, 50, 100]) {
    const g = M.PRScore.grade("reg", c, { trueProfile: "fish" }, { dist: [{ key: "reg", p: 0.01 }, { key: "fish", p: 0.9 }] });
    check[c] = { score: g.score, base: g.base, calib: g.calib, tier: g.tier };
  }
  return { table: rows, verificationReelle_reponseFausse: check };
}

out.HR = [];
for (const d of ["debutant", "expert"]) for (const p of ["top", "fixe", "aleatoire"]) out.HR.push(runHR(d, p, N, 4242));
out.BL = [];
for (const d of ["debutant", "expert"]) for (const p of ["premier", "aleatoire"]) out.BL.push(runBL(d, p, N, 4242));
out.PR_calibration = runPRcalib();

/* ---- Rating global atteignable sans compétence ----------------------- */
{
  const { M } = L.boot();
  const bestHR = out.HR.filter(x => x.policy !== "fixe").sort((a, b) => b.axeRange - a.axeRange)[0];
  const bestBL = out.BL.sort((a, b) => b.axeBlockers - a.axeBlockers)[0];
  // axes table/discipline : valeurs mesurées du fold-bot à 500 décisions (exp1 débutant)
  const foldTable = 81, foldDisc = 91;
  const w = { table: 1.6, range: 1, profiling: 1, blockers: 1, discipline: 1.1 };
  const mix = (table, range, prof, bl, disc) => {
    const s = table * w.table + range * w.range + prof * w.profiling + bl * w.blockers + disc * w.discipline;
    return Math.round(s / (w.table + w.range + w.profiling + w.blockers + w.discipline) * 30);
  };
  out.rating_simule = {
    note: "axes table/discipline = fold-bot mesuré (exp1 débutant 500 déc.) ; range/blockers = meilleures politiques triviales mesurées ici ; profiling laissé à 0",
    axes: { table: foldTable, range: bestHR.axeRange, profiling: 0, blockers: bestBL.axeBlockers, discipline: foldDisc },
    rating: mix(foldTable, bestHR.axeRange, 0, bestBL.axeBlockers, foldDisc),
    palier: M.Rating.tier(mix(foldTable, bestHR.axeRange, 0, bestBL.axeBlockers, foldDisc)).name
  };
}

fs.writeFileSync(`${__dirname}/exp4_labs.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
