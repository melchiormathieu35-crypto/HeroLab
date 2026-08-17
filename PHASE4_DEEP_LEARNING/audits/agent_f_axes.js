/**
 * AGENT F — décomposition : quelle part de la « variété » vient de quel axe ?
 * On recompte les situations uniques en retirant un axe à la fois.
 * Mesure aussi le biais introduit par la boucle de rejet de App.newHand().
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;
const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";
const PER = +(process.argv[2] || 6000);
const MODES = Object.keys(M.MODES);

const AXES = ["pos", "street", "pot", "players", "depth", "profil", "texture", "facing"];
function parts(t) {
  return {
    pos: t.hero.pos, street: t.street, pot: L.potType(t),
    players: t.players.filter(p => !p.folded).length + "w",
    depth: L.depthBucket(L.effDepthBB(t)),
    profil: L.oppProfiles(t).join("+"),
    texture: L.texBucket(t), facing: L.facing(t)
  };
}

const rows = [];
let rejected = 0, generated = 0;
const rejBias = { generated: new Map(), kept: new Map() };

for (const mode of MODES) {
  const cfg = { ...M.App.cfg, mode };
  for (let i = 0; i < PER; i++) {
    // mesure du biais : on regarde ce que Spot.generate produit brut
    const raw = M.Spot.generate(cfg);
    generated++;
    const keep = !raw.finished && M.Spot.options(raw).length > 0;
    const rawPos = raw.hero ? raw.hero.pos : "?";
    rejBias.generated.set(rawPos, (rejBias.generated.get(rawPos) || 0) + 1);
    if (keep) rejBias.kept.set(rawPos, (rejBias.kept.get(rawPos) || 0) + 1);
    else rejected++;

    const r = L.newHand(cfg);
    if (r.t) rows.push(parts(r.t));
  }
  process.stderr.write(mode + " ok\n");
}

function uniq(keys) {
  const s = new Set();
  rows.forEach(p => s.add(keys.map(k => p[k]).join("|")));
  return s.size;
}
function counts(keys) {
  const m = new Map();
  rows.forEach(p => { const k = keys.map(x => p[x]).join("|"); m.set(k, (m.get(k) || 0) + 1); });
  return m;
}

const full = uniq(AXES);
const res = {
  spots: rows.length, uniqueFullSig: full,
  entropyFull: +L.entropy([...counts(AXES).values()]).toFixed(3),
  maxEntropyFull: +Math.log2(full).toFixed(3),
  perAxisRemoved: AXES.map(a => {
    const k = AXES.filter(x => x !== a);
    const c = counts(k);
    return { removed: a, unique: c.size, ratio: +(full / c.size).toFixed(2),
             entropy: +L.entropy([...c.values()]).toFixed(3) };
  }),
  axisCardinality: AXES.map(a => ({ axis: a, values: uniq([a]) })),
  coreSig: (() => { const c = counts(["pos", "street", "pot", "players", "facing"]);
    return { unique: c.size, entropy: +L.entropy([...c.values()]).toFixed(3),
             maxEntropy: +Math.log2(c.size).toFixed(3),
             top10: [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
               .map(([k, v]) => [k, v, +(100 * v / rows.length).toFixed(2)]),
             pctTop10: +(100 * [...c.values()].sort((a, b) => b - a).slice(0, 10)
               .reduce((a, b) => a + b, 0) / rows.length).toFixed(1) }; })(),
  strategicSig: (() => { const c = counts(["pos", "street", "pot", "facing"]);
    return { unique: c.size, entropy: +L.entropy([...c.values()]).toFixed(3),
             pctTop10: +(100 * [...c.values()].sort((a, b) => b - a).slice(0, 10)
               .reduce((a, b) => a + b, 0) / rows.length).toFixed(1) }; })(),
  rejection: {
    generated, rejected, rejectPct: +(100 * rejected / generated).toFixed(2),
    byPos: [...rejBias.generated.entries()].map(([p, g]) =>
      ({ pos: p, generated: g, kept: rejBias.kept.get(p) || 0,
         keepPct: +(100 * (rejBias.kept.get(p) || 0) / g).toFixed(1) }))
      .sort((a, b) => b.keepPct - a.keepPct)
  }
};
fs.writeFileSync(SCRATCH + "/agent_f_axes.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
