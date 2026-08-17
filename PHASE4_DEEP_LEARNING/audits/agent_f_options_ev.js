/**
 * AGENT F — distinction EV des tailles, par rue, TAPIS EXCLU.
 * Question : « 2.5 / 3 / 4 bb » et « 1/3 / 1/2 / 2/3 / pot » sont-elles des
 * branches pédagogiquement distinctes, ou du bruit sous la tolérance ?
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;
const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";
const N = +(process.argv[2] || 500);

function stats(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: +s[0].toFixed(3), median: +q(.5).toFixed(3), p75: +q(.75).toFixed(3),
           p90: +q(.9).toFixed(3), max: +s[s.length - 1].toFixed(3),
           mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(3) };
}
function inc(m, k) { m.set(k, (m.get(k) || 0) + 1); }

const out = {};
for (const mode of ["preflop", "flop", "turn", "river"]) {
  const cfg = { ...M.App.cfg, mode };
  const spreadNoAllIn = [], bucketsNoAllIn = [], indistinct = [];
  const bestLbl = new Map(), rank = new Map();
  let spots = 0, allTied = 0;

  for (let i = 0; i < N; i++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    const t = r.t;
    const opts = M.Spot.options(t);
    const aggr = opts.filter(o => (o.action === "bet" || o.action === "raise") && o.sizeLabel !== "Tapis");
    if (aggr.length < 2) continue;
    let a;
    try { a = M.Judge.evaluate(t, { action: aggr[0].action, amount: aggr[0].amount }); } catch (e) { continue; }
    const rows = aggr.map(o => a.options.find(x => x.action === o.action && Math.abs(x.amount - o.amount) < 0.005))
                     .filter(Boolean);
    if (rows.length < 2) continue;
    spots++;
    const evs = rows.map(x => x.ev);
    const spread = (Math.max(...evs) - Math.min(...evs)) / t.bb;
    spreadNoAllIn.push(spread);
    const tol = (1.0 * t.bb + t.pot * 0.03) * ((t.level.tolerance || 0.1) / 0.1);
    if ((Math.max(...evs) - Math.min(...evs)) <= tol) { allTied++; indistinct.push(1); } else indistinct.push(0);
    const s = [...evs].sort((x, y) => y - x);
    let b = 1; for (let k = 1; k < s.length; k++) if (s[k - 1] - s[k] > tol) b++;
    bucketsNoAllIn.push(b);
    const bi = evs.indexOf(Math.max(...evs));
    inc(bestLbl, aggr[bi].sizeLabel);
    // rang moyen de chaque taille
    const order = evs.map((e, i2) => [e, aggr[i2].sizeLabel]).sort((x, y) => y[0] - x[0]);
    order.forEach(([, lbl], idx) => rank.set(lbl, (rank.get(lbl) || []).concat(idx + 1)));
  }
  out[mode] = {
    spots,
    spreadBB: stats(spreadNoAllIn),
    pctAllSizesWithinTolerance: +(100 * allTied / spots).toFixed(1),
    bucketHisto: bucketsNoAllIn.reduce((m, b) => (m[b] = (m[b] || 0) + 1, m), {}),
    meanBuckets: +(bucketsNoAllIn.reduce((x, y) => x + y, 0) / bucketsNoAllIn.length).toFixed(2),
    bestSizePct: [...bestLbl.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, v, +(100 * v / spots).toFixed(1)]),
    meanRank: [...rank.entries()].map(([k, v]) =>
      [k, +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(2), v.length]).sort((a, b) => a[1] - b[1])
  };
  process.stderr.write(mode + " ok (" + spots + ")\n");
}
fs.writeFileSync(SCRATCH + "/agent_f_options_ev.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
