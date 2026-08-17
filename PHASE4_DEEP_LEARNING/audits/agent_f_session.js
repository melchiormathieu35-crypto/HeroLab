/**
 * AGENT F — répétition ressentie par l'utilisateur.
 * Simule des sessions de 200 mains JOUÉES JUSQU'AU BOUT (Play.step), donc
 * plusieurs points de décision par main, et mesure les doublons.
 */
const fs = require("fs");
const L = require("./agent_f_lib");
const { M } = L;

const SCRATCH = "/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad";

/** Politique « joueur engagé » : check/call dominant, agression occasionnelle. */
function policyMixed(t) {
  const opts = M.Spot.options(t);
  const r = Math.random();
  const toCall = t.toCall(t.hero);
  if (toCall > 0) {
    if (r < 0.30) return opts.find(o => o.action === "fold") || opts[0];
    if (r < 0.85) return opts.find(o => o.action === "call") || opts[0];
    const raises = opts.filter(o => o.action === "raise");
    return raises.length ? raises[(Math.random() * raises.length) | 0] : opts[0];
  }
  if (r < 0.55) return opts.find(o => o.action === "check") || opts[0];
  const bets = opts.filter(o => o.action === "bet");
  return bets.length ? bets[(Math.random() * bets.length) | 0] : opts[0];
}

/** Politique « passive » : jamais de fold — maximise le nombre de streets vues. */
function policyPassive(t) {
  const opts = M.Spot.options(t);
  return opts.find(o => o.action === "check") || opts.find(o => o.action === "call") || opts[0];
}

function runSession(cfg, hands, policy) {
  const sigs = [], fulls = [];
  let decisions = 0;
  for (let h = 0; h < hands; h++) {
    const r = L.newHand(cfg);
    if (!r.t) continue;
    let t = r.t, guard = 0;
    while (guard++ < 12) {
      sigs.push(L.signature(t));
      fulls.push(L.fullSignature(t));
      decisions++;
      const d = policy(t);
      let res;
      try { res = M.Play.step(t, { action: d.action, amount: d.amount }); }
      catch (e) { break; }
      if (res.done) break;
    }
  }
  return { sigs, fulls, decisions };
}

function dupStats(arr) {
  const m = new Map();
  arr.forEach(s => m.set(s, (m.get(s) || 0) + 1));
  const counts = [...m.values()];
  const uniq = m.size;
  const maxRep = Math.max(...counts);
  const rep2 = counts.filter(c => c >= 2).length;
  const inRepeated = counts.filter(c => c >= 2).reduce((a, b) => a + b, 0);
  return {
    n: arr.length, uniq,
    dupRate: +(100 * (1 - uniq / arr.length)).toFixed(1),
    sigSeen2plus: rep2,
    pctDecisionsInRepeatedSig: +(100 * inRepeated / arr.length).toFixed(1),
    maxRep,
    entropy: +L.entropy(counts).toFixed(3),
    top5: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  };
}

const out = { sessions: {} };
const SESS = 30;   // 30 sessions indépendantes de 200 mains

for (const [name, cfg, pol] of [
  ["libre-mixte", { ...M.App.cfg, mode: "libre" }, policyMixed],
  ["libre-passif", { ...M.App.cfg, mode: "libre" }, policyPassive],
  ["preflop-mixte", { ...M.App.cfg, mode: "preflop" }, policyMixed],
  ["flop-mixte", { ...M.App.cfg, mode: "flop" }, policyMixed],
  ["bvb-mixte", { ...M.App.cfg, mode: "bvb" }, policyMixed],
  ["btnbb-mixte", { ...M.App.cfg, mode: "btnbb" }, policyMixed]
]) {
  const agg = [];
  for (let s = 0; s < SESS; s++) {
    const r = runSession(cfg, 200, pol);
    agg.push({ sig: dupStats(r.sigs), full: dupStats(r.fulls), decisions: r.decisions });
  }
  const avg = f => +(agg.reduce((a, b) => a + f(b), 0) / agg.length).toFixed(2);
  out.sessions[name] = {
    sessions: SESS, handsPerSession: 200,
    avgDecisions: avg(x => x.decisions),
    avgDecisionsPerHand: +(avg(x => x.decisions) / 200).toFixed(2),
    sig: {
      avgUnique: avg(x => x.sig.uniq),
      avgDupRate: avg(x => x.sig.dupRate),
      avgPctInRepeated: avg(x => x.sig.pctDecisionsInRepeatedSig),
      avgMaxRep: avg(x => x.sig.maxRep),
      avgEntropy: avg(x => x.sig.entropy)
    },
    full: {
      avgUnique: avg(x => x.full.uniq),
      avgDupRate: avg(x => x.full.dupRate),
      avgMaxRep: avg(x => x.full.maxRep)
    },
    exampleTop5: agg[0].sig.top5
  };
  process.stderr.write(name + " done\n");
}

fs.writeFileSync(SCRATCH + "/agent_f_session.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
