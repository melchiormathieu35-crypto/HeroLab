/**
 * AGENT F — branches de décision : les tailles proposées sont-elles distinctes ?
 * 1) distinctes en MONTANT (après la déduplication du moteur)
 * 2) distinctes en EV (Judge.evaluate) — donc pédagogiquement porteuses
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;
const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";

const N_SHAPE = 20000;   // analyse de forme (rapide)
const N_EV = 700;        // analyse EV (Judge = coûteux)

function inc(m, k, n = 1) { m.set(k, (m.get(k) || 0) + n); }

/* ---------- 1) forme des options ---------- */
const shape = {
  bySet: new Map(), byStreet: new Map(), nAggr: new Map(),
  collapsedToAllIn: 0, spots: 0, aggrSpots: 0,
  gapPctPot: [], allInIsDuplicate: 0, minRaiseClamp: 0
};

const cfg = { ...M.App.cfg, mode: "libre" };
for (let i = 0; i < N_SHAPE; i++) {
  const r = L.newHand(cfg);
  if (!r.t) continue;
  const t = r.t;
  const opts = M.Spot.options(t);
  shape.spots++;
  inc(shape.bySet, opts.map(o => o.sizeLabel || o.action).join(","));
  inc(shape.byStreet, t.street + ":" + opts.length);
  const aggr = opts.filter(o => o.action === "bet" || o.action === "raise");
  inc(shape.nAggr, String(aggr.length));
  if (!aggr.length) continue;
  shape.aggrSpots++;

  // nombre de sizings « théoriques » proposés par le moteur avant dédup
  const theoretical = t.street === "preflop" ? 4 : 5;
  if (aggr.length < theoretical) shape.minRaiseClamp++;
  // tapis en doublon d'une autre taille ?
  const amounts = aggr.map(o => +o.amount.toFixed(2));
  const allin = t.hero.stack + t.hero.invested;
  if (amounts.filter(a => Math.abs(a - allin) < 0.005).length > 1) shape.allInIsDuplicate++;
  if (aggr.length === 1 && Math.abs(amounts[0] - allin) < 0.005) shape.collapsedToAllIn++;

  // écart entre tailles consécutives, en % du pot au moment de la décision
  const sorted = [...new Set(amounts)].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) {
    shape.gapPctPot.push(+(100 * (sorted[k] - sorted[k - 1]) / t.pot).toFixed(1));
  }
}

/* ---------- 2) distinction en EV ---------- */
const ev = {
  spots: 0, byStreet: {},
  spreadAggr: [],            // écart EV entre la meilleure et la pire taille agressive
  tiedTop: 0,                // ≥2 tailles à moins de 0.05 bb de la meilleure
  withinTolerance: 0,        // toutes les tailles agressives dans la tolérance du verdict
  bestSizeLabel: new Map(),  // quelle taille gagne le plus souvent
  worstSizeLabel: new Map(),
  distinctBuckets: []        // nb de tailles agressives séparées par >1 tolérance
};

for (let i = 0; i < N_EV; i++) {
  const r = L.newHand(cfg);
  if (!r.t) continue;
  const t = r.t;
  const opts = M.Spot.options(t);
  const aggr = opts.filter(o => o.action === "bet" || o.action === "raise");
  if (aggr.length < 2) continue;
  let a;
  try { a = M.Judge.evaluate(t, { action: aggr[0].action, amount: aggr[0].amount }); }
  catch (e) { continue; }
  ev.spots++;
  const rows = a.options.filter(o => o.action === "bet" || o.action === "raise");
  if (rows.length < 2) continue;
  const evs = rows.map(o => o.ev);
  const spread = (Math.max(...evs) - Math.min(...evs)) / t.bb;
  ev.spreadAggr.push(+spread.toFixed(3));
  const tol = (1.0 * t.bb + t.pot * 0.03) * ((t.level.tolerance || 0.1) / 0.1);
  const best = Math.max(...evs);
  const near = evs.filter(e => (best - e) < 0.05 * t.bb).length;
  if (near >= 2) ev.tiedTop++;
  if ((Math.max(...evs) - Math.min(...evs)) <= tol) ev.withinTolerance++;
  // nb de « paliers » réellement séparés (> tolérance entre eux)
  const s = [...evs].sort((x, y) => y - x);
  let buckets = 1;
  for (let k = 1; k < s.length; k++) if (s[k - 1] - s[k] > tol) buckets++;
  ev.distinctBuckets.push(buckets);
  const bestRow = rows.reduce((p, q) => q.ev > p.ev ? q : p);
  const worstRow = rows.reduce((p, q) => q.ev < p.ev ? q : p);
  const lbl = o => (opts.find(x => Math.abs(x.amount - o.amount) < 0.005 && x.action === o.action) || {}).sizeLabel || "?";
  inc(ev.bestSizeLabel, t.street + " " + lbl(bestRow));
  inc(ev.worstSizeLabel, t.street + " " + lbl(worstRow));
  ev.byStreet[t.street] = (ev.byStreet[t.street] || 0) + 1;
}

function stats(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length, min: s[0], p25: q(.25), median: q(.5), p75: q(.75), p90: q(.9), max: s[s.length - 1],
    mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(3)
  };
}

const res = {
  shape: {
    spots: shape.spots, aggrSpots: shape.aggrSpots,
    collapsedToAllIn: shape.collapsedToAllIn,
    allInDuplicateAmount: shape.allInIsDuplicate,
    fewerThanTheoretical: shape.minRaiseClamp,
    nAggr: [...shape.nAggr.entries()].sort((a, b) => b[1] - a[1]),
    topSets: [...shape.bySet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    byStreetNOpts: [...shape.byStreet.entries()].sort(),
    gapPctPot: stats(shape.gapPctPot)
  },
  ev: {
    spots: ev.spots, byStreet: ev.byStreet,
    spreadBB: stats(ev.spreadAggr),
    tiedTopPct: +(100 * ev.tiedTop / ev.spots).toFixed(1),
    allWithinTolerancePct: +(100 * ev.withinTolerance / ev.spots).toFixed(1),
    distinctBuckets: stats(ev.distinctBuckets),
    bucketHisto: ev.distinctBuckets.reduce((m, b) => (m[b] = (m[b] || 0) + 1, m), {}),
    bestSizeLabel: [...ev.bestSizeLabel.entries()].sort((a, b) => b[1] - a[1]),
    worstSizeLabel: [...ev.worstSizeLabel.entries()].sort((a, b) => b[1] - a[1])
  }
};
fs.writeFileSync(SCRATCH + "/agent_f_options.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
