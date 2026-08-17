/**
 * AGENT F — mesure empirique de couverture des situations.
 * Sortie : JSON dans le scratchpad + résumé console.
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;

const N = +(process.argv[2] || 5000);
const MODES = Object.keys(M.MODES);
// LEVELS n'est pas exporté par le harness : clés lues dans le source (l.3709+)
const LEVELS = ["debutant", "intermediaire", "avance", "pro", "gto", "exploit"];

function inc(map, k, n = 1) { map.set(k, (map.get(k) || 0) + n); }

function tally(rows) {
  const m = new Map();
  for (const r of rows) inc(m, r);
  return m;
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* ------------------------------------------------------------------ RUN */
const out = { N, perMode: {}, global: {} };

const gSig = new Map();          // signature -> count (tous modes confondus)
const gFull = new Map();
const gDim = {                   // distributions marginales
  pos: new Map(), street: new Map(), pot: new Map(), players: new Map(),
  depth: new Map(), tex: new Map(), facing: new Map(), profile: new Map(),
  nOpts: new Map(), optSet: new Map(), texFull: new Map(), texAxis: new Map()
};
const gPairs = new Map();        // street|potType
const gPosStreet = new Map();
const optionAmounts = [];        // pour l'analyse des sizings
let totalSpots = 0, totalRejected = 0, totalFailed = 0;

const t0 = Date.now();

for (const mode of MODES) {
  const cfg = { ...M.App.cfg, mode };
  const sig = new Map(), full = new Map();
  const dim = {
    pos: new Map(), street: new Map(), pot: new Map(), players: new Map(),
    depth: new Map(), tex: new Map(), facing: new Map()
  };
  let rejected = 0, failed = 0, n = 0;

  for (let i = 0; i < N; i++) {
    const r = L.newHand(cfg);
    rejected += r.rejected;
    if (!r.t) { failed++; continue; }
    const t = r.t;
    n++; totalSpots++;

    const s = L.signature(t);
    inc(sig, s); inc(gSig, s);
    const f = L.fullSignature(t);
    inc(full, f); inc(gFull, f);

    const live = t.players.filter(p => !p.folded).length;
    const d = {
      pos: t.hero.pos, street: t.street, pot: L.potType(t), players: live + "w",
      depth: L.depthBucket(L.effDepthBB(t)), tex: L.texBucket(t), facing: L.facing(t)
    };
    for (const k of Object.keys(d)) { inc(dim[k], d[k]); inc(gDim[k], d[k]); }
    L.oppProfiles(t).forEach(p => inc(gDim.profile, p));
    inc(gPairs, d.street + " / " + d.pot);
    inc(gPosStreet, d.pos + " / " + d.street);

    const tf = L.texFull(t);
    if (tf) {
      inc(gDim.texFull, [tf.suit, tf.pair, tf.conn, tf.high].join("-"));
      inc(gDim.texAxis, "suit:" + tf.suit);
      inc(gDim.texAxis, "pair:" + tf.pair);
      inc(gDim.texAxis, "conn:" + tf.conn);
      inc(gDim.texAxis, "high:" + tf.high);
    }

    const opts = M.Spot.options(t);
    inc(gDim.nOpts, String(opts.length));
    inc(gDim.optSet, opts.map(o => o.action + (o.sizeLabel ? ":" + o.sizeLabel : "")).join(","));
    if (totalSpots % 7 === 0) {
      optionAmounts.push({
        street: t.street, pot: +t.pot.toFixed(2), bb: t.bb,
        heroStack: +(t.hero.stack + t.hero.invested).toFixed(2),
        toCall: +t.toCall(t.hero).toFixed(2),
        opts: opts.map(o => ({ a: o.action, l: o.sizeLabel || null, v: +o.amount.toFixed(2) }))
      });
    }
  }
  totalRejected += rejected; totalFailed += failed;

  out.perMode[mode] = {
    generated: n, failed, rejected,
    uniqueSig: sig.size, uniqueFull: full.size,
    entropySig: +L.entropy([...sig.values()]).toFixed(3),
    maxEntropy: +Math.log2(sig.size).toFixed(3),
    top10: topN(sig, 10).map(([k, v]) => [k, v, +(100 * v / n).toFixed(2)]),
    singletons: [...sig.values()].filter(v => v === 1).length,
    dim: Object.fromEntries(Object.entries(dim).map(([k, m]) =>
      [k, [...m.entries()].sort((a, b) => b[1] - a[1]).map(([kk, vv]) => [kk, vv, +(100 * vv / n).toFixed(2)])]))
  };
  process.stderr.write(`${mode}: n=${n} uniq=${sig.size} fail=${failed}\n`);
}

/* ---- Sur les niveaux (pools de profils différents) */
const perLevel = {};
for (const level of LEVELS) {
  const cfg = { ...M.App.cfg, mode: "libre", level };
  const sig = new Map();
  let n = 0;
  for (let i = 0; i < 2000; i++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    n++; inc(sig, L.signature(r.t)); inc(gSig, L.signature(r.t));
  }
  perLevel[level] = { n, uniqueSig: sig.size, entropy: +L.entropy([...sig.values()]).toFixed(3) };
  process.stderr.write(`level ${level}: n=${n} uniq=${sig.size}\n`);
}

out.perLevel = perLevel;
out.global = {
  totalSpots, totalRejected, totalFailed,
  uniqueSig: gSig.size, uniqueFull: gFull.size,
  entropySig: +L.entropy([...gSig.values()]).toFixed(3),
  singletons: [...gSig.values()].filter(v => v === 1).length,
  top30: topN(gSig, 30).map(([k, v]) => [k, v, +(100 * v / totalSpots).toFixed(3)]),
  dim: Object.fromEntries(Object.entries(gDim).map(([k, m]) =>
    [k, [...m.entries()].sort((a, b) => b[1] - a[1])])),
  streetPot: [...gPairs.entries()].sort((a, b) => b[1] - a[1]),
  posStreet: [...gPosStreet.entries()].sort((a, b) => b[1] - a[1]),
  ms: Date.now() - t0
};
out.optionSamples = optionAmounts.slice(0, 4000);

const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";
fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(SCRATCH + "/agent_f_coverage.json", JSON.stringify(out));
console.log(JSON.stringify({
  totalSpots, uniqueSig: gSig.size, uniqueFull: gFull.size,
  entropy: out.global.entropySig, ms: out.global.ms
}, null, 2));
