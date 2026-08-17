/**
 * AGENT F — trous de couverture : cellules du produit cartésien jamais atteintes.
 * Balayage massif : tous les modes × tous les niveaux, 3 000 spots chacun.
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;
const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";
const PER = +(process.argv[2] || 3000);

const MODES = Object.keys(M.MODES);
const LEVELS = Object.keys(M.LEVELS);
const POS = L.POS6;
const STREETS = ["preflop", "flop", "turn", "river"];
const POTS = ["unopened", "limped", "SRP", "3bet", "4bet", "5bet+"];
const TEX = ["paire", "brelan", "monotone", "4-flush", "connecte", "tres-connecte", "bicolore-sec", "arc-sec"];
const DEPTH = ["<20", "20-40", "40-60", "60-100", "100-150", "150-200", "200+"];
const FACING = ["face-blinde", "face-ouverture", "face-relance", "face-mise", "face-check", "premier-de-parole", "personne-mise"];
const PROF = Object.keys(M.PROFILES);

const hit = {
  posStreet: new Set(), streetPot: new Set(), posPot: new Set(), potPlayers: new Set(),
  streetTex: new Set(), depthStreet: new Set(), streetFacing: new Set(),
  profStreet: new Set(), profPos: new Set(), posPlayers: new Set(), potFacing: new Set(),
  posStreetPot: new Set(), profile: new Set()
};
let n = 0;
for (const mode of MODES) for (const level of LEVELS) {
  const cfg = { ...M.App.cfg, mode, level };
  for (let i = 0; i < PER; i++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    const t = r.t; n++;
    const live = t.players.filter(p => !p.folded).length + "w";
    const pos = t.hero.pos, st = t.street, pt = L.potType(t);
    const tx = L.texBucket(t), dp = L.depthBucket(L.effDepthBB(t)), fc = L.facing(t);
    hit.posStreet.add(pos + "|" + st);
    hit.streetPot.add(st + "|" + pt);
    hit.posPot.add(pos + "|" + pt);
    hit.potPlayers.add(pt + "|" + live);
    hit.streetTex.add(st + "|" + tx);
    hit.depthStreet.add(dp + "|" + st);
    hit.streetFacing.add(st + "|" + fc);
    hit.posPlayers.add(pos + "|" + live);
    hit.potFacing.add(pt + "|" + fc);
    hit.posStreetPot.add(pos + "|" + st + "|" + pt);
    L.oppProfiles(t).forEach(p => {
      hit.profStreet.add(p + "|" + st); hit.profPos.add(p + "|" + pos); hit.profile.add(p);
    });
  }
  process.stderr.write(mode + "/" + level + " (" + n + ")\n");
}

/* Cellules « attendues » (théoriquement sensées) */
const expect = {
  posStreet: POS.flatMap(p => STREETS.map(s => p + "|" + s)),
  streetPot: STREETS.flatMap(s => POTS.filter(p =>
    (s === "preflop") ? p !== "limped" : p !== "unopened").map(p => s + "|" + p)),
  posPot: POS.flatMap(p => POTS.map(q => p + "|" + q)),
  potPlayers: POTS.flatMap(p => [2, 3, 4, 5, 6].map(k => p + "|" + k + "w")),
  streetTex: STREETS.filter(s => s !== "preflop").flatMap(s => TEX
    .filter(x => s === "flop" ? x !== "4-flush" : true).map(x => s + "|" + x)),
  depthStreet: DEPTH.flatMap(d => STREETS.map(s => d + "|" + s)),
  streetFacing: STREETS.flatMap(s => FACING.map(f => s + "|" + f)),
  profStreet: PROF.flatMap(p => STREETS.map(s => p + "|" + s)),
  profPos: PROF.flatMap(p => POS.map(q => p + "|" + q)),
  posPlayers: POS.flatMap(p => [2, 3, 4, 5, 6].map(k => p + "|" + k + "w")),
  potFacing: POTS.flatMap(p => FACING.map(f => p + "|" + f)),
  posStreetPot: POS.flatMap(p => STREETS.flatMap(s => POTS
    .filter(q => (s === "preflop") ? q !== "limped" : q !== "unopened").map(q => p + "|" + s + "|" + q)))
};

const res = { n, tables: {} };
for (const k of Object.keys(expect)) {
  const exp = expect[k], got = hit[k];
  const missing = exp.filter(c => !got.has(c));
  res.tables[k] = {
    expected: exp.length, hit: exp.length - missing.length,
    coveragePct: +(100 * (exp.length - missing.length) / exp.length).toFixed(1),
    extra: [...got].filter(c => !exp.includes(c)),
    missing
  };
}
res.profilesSeen = [...hit.profile].sort();
res.profilesDefined = PROF;
fs.writeFileSync(SCRATCH + "/agent_f_holes.json", JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res.tables)) {
  console.log(k.padEnd(14), v.hit + "/" + v.expected, v.coveragePct + "%",
    "manquant:", v.missing.slice(0, 30).join(" ") || "-");
}
console.log("profils vus:", res.profilesSeen.join(","));
console.log("n =", n);
