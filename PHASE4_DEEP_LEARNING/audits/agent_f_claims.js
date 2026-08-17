/**
 * AGENT F — vérification des promesses de mode + textures de board.
 * A) Chaque mode tient-il ce que sa `desc` annonce ?
 * B) Distribution des textures observée vs énumération exhaustive des 22 100 flops.
 * C) Cellules du produit cartésien jamais générées.
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;
const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";
const N = +(process.argv[2] || 8000);

function inc(m, k) { m.set(k, (m.get(k) || 0) + 1); }
function pct(m, n) { return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, +(100 * v / n).toFixed(2)]); }

/* ================= A) promesses de mode ================= */
const claims = {};
const MODE_LIST = ["libre", "preflop", "flop", "turn", "river", "pot3bet", "pot4bet",
                   "bvb", "btnbb", "multiway", "deep", "short", "cible"];
for (const mode of MODE_LIST) {
  const cfg = { ...M.App.cfg, mode };
  const street = new Map(), pot = new Map(), live = new Map(), seats = new Map(),
        pos = new Map(), depth = new Map();
  let n = 0, depthMin = Infinity, depthMax = -Infinity;
  for (let i = 0; i < N; i++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    const t = r.t; n++;
    inc(street, t.street); inc(pot, L.potType(t));
    inc(live, t.players.filter(p => !p.folded).length + "w");
    inc(seats, t.players.length + " sièges");
    inc(pos, t.hero.pos);
    const d = L.effDepthBB(t);
    depthMin = Math.min(depthMin, d); depthMax = Math.max(depthMax, d);
    inc(depth, L.depthBucket(d));
  }
  claims[mode] = { n, street: pct(street, n), pot: pct(pot, n), live: pct(live, n),
                   seats: pct(seats, n), pos: pct(pos, n), depth: pct(depth, n),
                   depthMin: +depthMin.toFixed(1), depthMax: +depthMax.toFixed(1) };
  process.stderr.write("claim " + mode + "\n");
}

/* ================= B) textures : théorie vs observé ================= */
/* Énumération exhaustive des 22 100 flops via BoardTex.analyse */
const theo = new Map(), theoAxis = new Map(), theoFull = new Map();
let flops = 0;
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) {
  const board = [a, b, c];
  const x = M.BoardTex.analyse(board);
  const bucket = x.trips ? "brelan" : x.paired ? "paire" : x.maxSuit >= 4 ? "4-flush"
    : x.monotone ? "monotone" : x.veryConnected ? "tres-connecte" : x.connected ? "connecte"
    : x.maxSuit === 2 ? "bicolore-sec" : "arc-sec";
  inc(theo, bucket); flops++;
  const suit = x.maxSuit >= 3 ? "monotone" : x.maxSuit === 2 ? "bicolore" : "rainbow";
  const pair = x.trips ? "trips" : x.paired ? "paired" : "unpaired";
  const conn = x.veryConnected ? "veryconn" : x.connected ? "conn" : "dry";
  const high = x.high >= 11 ? "high" : x.high <= 8 ? "low" : "mid";
  inc(theoAxis, "suit:" + suit); inc(theoAxis, "pair:" + pair);
  inc(theoAxis, "conn:" + conn); inc(theoAxis, "high:" + high);
  inc(theoFull, [suit, pair, conn, high].join("-"));
}

/* Observé : flops réellement distribués en mode flop */
const obs = new Map(), obsAxis = new Map(), obsFull = new Map(), obsCards = new Set();
let nf = 0;
const cfgFlop = { ...M.App.cfg, mode: "flop" };
for (let i = 0; i < 30000; i++) {
  const r = L.newHand(cfgFlop);
  if (!r.t || r.t.board.length !== 3) continue;
  const t = r.t; nf++;
  const x = M.BoardTex.analyse(t.board);
  const bucket = x.trips ? "brelan" : x.paired ? "paire" : x.maxSuit >= 4 ? "4-flush"
    : x.monotone ? "monotone" : x.veryConnected ? "tres-connecte" : x.connected ? "connecte"
    : x.maxSuit === 2 ? "bicolore-sec" : "arc-sec";
  inc(obs, bucket);
  const suit = x.maxSuit >= 3 ? "monotone" : x.maxSuit === 2 ? "bicolore" : "rainbow";
  const pair = x.trips ? "trips" : x.paired ? "paired" : "unpaired";
  const conn = x.veryConnected ? "veryconn" : x.connected ? "conn" : "dry";
  const high = x.high >= 11 ? "high" : x.high <= 8 ? "low" : "mid";
  inc(obsAxis, "suit:" + suit); inc(obsAxis, "pair:" + pair);
  inc(obsAxis, "conn:" + conn); inc(obsAxis, "high:" + high);
  inc(obsFull, [suit, pair, conn, high].join("-"));
  obsCards.add([...t.board].sort((p, q) => p - q).join("-"));
}

/* ================= C) cellules jamais générées ================= */
const seen = new Set();
const cells = { posStreet: new Map(), streetPot: new Map(), potPlayers: new Map(),
                posPot: new Map(), streetTex: new Map(), streetFacing: new Map(),
                depthStreet: new Map() };
let nAll = 0;
for (const mode of MODE_LIST) {
  const cfg = { ...M.App.cfg, mode };
  for (let i = 0; i < 4000; i++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    const t = r.t; nAll++;
    const live = t.players.filter(p => !p.folded).length;
    inc(cells.posStreet, t.hero.pos + "|" + t.street);
    inc(cells.streetPot, t.street + "|" + L.potType(t));
    inc(cells.potPlayers, L.potType(t) + "|" + live + "w");
    inc(cells.posPot, t.hero.pos + "|" + L.potType(t));
    inc(cells.streetTex, t.street + "|" + L.texBucket(t));
    inc(cells.streetFacing, t.street + "|" + L.facing(t));
    inc(cells.depthStreet, L.depthBucket(L.effDepthBB(t)) + "|" + t.street);
    seen.add(L.signature(t));
  }
  process.stderr.write("cells " + mode + "\n");
}

const res = {
  claims,
  textures: {
    theoreticalFlops: flops,
    observedFlops: nf,
    distinctFlopsSeen: obsCards.size,
    theo: pct(theo, flops), obs: pct(obs, nf),
    theoAxis: pct(theoAxis, flops), obsAxis: pct(obsAxis, nf),
    theoFullClasses: theoFull.size, obsFullClasses: obsFull.size,
    missingFullClasses: [...theoFull.keys()].filter(k => !obsFull.has(k))
      .map(k => [k, theoFull.get(k), +(100 * theoFull.get(k) / flops).toFixed(4)]),
    rareFullClasses: [...theoFull.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8)
      .map(([k, v]) => [k, v, obsFull.get(k) || 0])
  },
  cells: Object.fromEntries(Object.entries(cells).map(([k, m]) => [k, pct(m, nAll)])),
  nAll, uniqueSigAllModes: seen.size
};
fs.writeFileSync(SCRATCH + "/agent_f_claims.json", JSON.stringify(res, null, 2));
console.log("done", nAll, seen.size, nf, obsCards.size);
