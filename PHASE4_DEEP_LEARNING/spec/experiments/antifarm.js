/**
 * §3 — Protocole anti-farm.
 *
 * Six politiques de jeu jouent le MÊME nombre de décisions. On mesure ce que
 * chacune obtient en progression, et ce qu'elle paie en qualité de poker.
 *
 * Deux systèmes de notation sont mesurés en parallèle sur les mêmes parties :
 *   - ACTUEL   : la maîtrise dérive du verdict (correct / acceptable / erreur)
 *   - PROPOSÉ  : la maîtrise dérive de lossBB via q = exp(-lossBB / c)
 *
 * Aucun fichier applicatif n'est modifié : on lit le moteur, on ne l'altère pas.
 *
 * Usage : node PHASE4_DEEP_LEARNING/spec/experiments/antifarm.js [nDécisions]
 */
const load = require("../../../tests/harness");
const { M } = load("VERSION_PRODUCTION/herolab.html");
const { Spot, Judge, App, LEVELS, BoardTex } = M;

const N = +(process.argv[2] || 1000);
const JALONS = [50, 200, 500, 1000].filter(x => x <= N);
const C_BB = 1.0;                       // constante FIXE de la fonction qualité
const q = lossBB => Math.exp(-lossBB / C_BB);

/* ─────────────────────────────── politiques ─────────────────────────────── */
/* Chaque politique reçoit les options et l'analyse, et renvoie son choix.
   `an.options` porte l'EV de chaque option : c'est une information que
   l'interface AFFICHE réellement au joueur, donc exploitable par lui. */

const POLITIQUES = {
  // Référence : joue réellement bien.
  competent: (opts, an) => meilleure(opts, an),

  // A — décisions au hasard.
  A_aleatoire: opts => opts[(Math.random() * opts.length) | 0],

  // B — passif : check/call/fold, jamais d'agression.
  B_passif: opts =>
    opts.find(o => o.action === "check") ||
    opts.find(o => o.action === "call") ||
    opts.find(o => o.action === "fold") || opts[0],

  // C — exploite la tolérance : la PIRE option encore jugée acceptable.
  //     Sous une notation au verdict, elle est créditée comme une bonne
  //     décision ; sous une notation au coût, elle paie son écart.
  C_tolerance: (opts, an, t) => {
    const tol = tolerance(t, an);
    const acceptables = opts.filter(o => perte(o, an) <= tol);
    if (!acceptables.length) return meilleure(opts, an);
    return acceptables.reduce((pire, o) => perte(o, an) > perte(pire, an) ? o : pire);
  },

  // D — répétition : ne joue que la famille de spots la plus favorable.
  //     Modélisée par le filtrage en amont (voir `familleFavorable`).
  D_repetition: (opts, an) => meilleure(opts, an),

  // E — niveau : joue au niveau qui maximise le rendement apparent.
  //     Modélisée par le choix du niveau (voir la boucle principale).
  E_niveau: opts =>
    opts.find(o => o.action === "check") ||
    opts.find(o => o.action === "call") ||
    opts.find(o => o.action === "fold") || opts[0]
};

function evOf(o, an) {
  const e = (an.options || []).find(x => x.action === o.action && x.amount === o.amount);
  return e && typeof e.ev === "number" ? e.ev : null;
}
function meilleure(opts, an) {
  let best = opts[0], bev = -Infinity;
  for (const o of opts) { const e = evOf(o, an); if (e !== null && e > bev) { bev = e; best = o; } }
  return best;
}
function perte(o, an) {
  const e = evOf(o, an);
  if (e === null) return 0;
  const evs = opts_ev(an);
  return evs.length ? (Math.max(...evs) - e) : 0;
}
function opts_ev(an) {
  return (an.options || []).map(x => x.ev).filter(x => typeof x === "number");
}
function tolerance(t, an) {
  // même forme que le moteur : tolérance du niveau, mise à l'échelle du pot
  const lv = t.level || LEVELS.intermediaire;
  return (lv.tolerance || 0.1) * Math.max(1, (an.pot || t.pot || 1) / (t.bb || 1)) * (t.bb || 1) * 0.1;
}

/* ────────────────────────── signature d'un spot ─────────────────────────── */
const bucketSPR = t => {
  const spr = (t.hero.stack || 0) / Math.max(1, t.pot);
  return spr < 1 ? "spr<1" : spr < 3 ? "spr1-3" : spr < 8 ? "spr3-8" : "spr8+";
};
const texture = t => {
  if (!t.board || t.board.length < 3) return "preflop";
  const tx = BoardTex.classify ? BoardTex.classify(t.board) : null;
  const r = t.board.map(c => c >> 2), s = t.board.map(c => c & 3);
  const paire = new Set(r).size < r.length;
  const mono = new Set(s).size === 1;
  return (paire ? "pairé" : "") + (mono ? "mono" : "") || "sec";
};
const famille = t => [t.street, t.hero.pos, t.live().length, bucketSPR(t)].join("|");
const profilDe = t => {
  const v = t.players.find(p => !p.isHero && !p.folded);
  return v && v.p ? (v.p.key || "-") : "-";
};
const signature = t => [famille(t), texture(t), profilDe(t)].join("|");

/* ─────────────────────── filtre de la stratégie D ───────────────────────── */
/* « Familles les plus faciles » : mesuré en amont, ce sont les spots préflop
   en position tardive avec peu de joueurs. On les impose par forcePos + mode. */
const familleFavorable = { mode: "preflop", forcePos: "BTN" };

/* ──────────────────────────── boucle principale ─────────────────────────── */
function simule(nom, politique, opts = {}) {
  const niveau = opts.niveau || "intermediaire";
  const cfgSup = opts.cfg || {};
  const r = {
    nom, n: 0, sommeLoss: 0, corrects: 0, acceptables: 0,
    qSomme: 0, verdictOk: 0,
    sigs: new Map(), fams: new Map(),
    rues: new Map(), pos: new Map(), profils: new Map(),
    jalons: {}
  };
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);

  while (r.n < N) {
    const t = Spot.generate({ ...App.cfg, mode: "libre", level: niveau, ...cfgSup });
    // GARDE : sans elle, une clé mal passée fait silencieusement retomber
    // sur le niveau par défaut et l'expérience ne mesure pas ce qu'elle croit.
    if (t.level !== LEVELS[niveau]) throw new Error("niveau non appliqué : " + niveau);
    const o = Spot.options(t);
    if (!o.length) continue;

    // On joue la main jusqu'à son terme : une main porte ~4,6 décisions
    // réparties sur les quatre rues. S'arrêter à la première ne mesurerait que
    // du préflop et fausserait toutes les métriques de diversité.
    let garde = 0;
    while (garde++ < 12 && r.n < N) {
      const opts = Spot.options(t);
      if (!opts.length) break;
      const anPre = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
      const choix = politique(opts, anPre, t);
      const an = Judge.evaluate(t, { action: choix.action, amount: choix.amount });

      r.n++;
      r.sommeLoss += an.lossBB;
      r.qSomme += q(an.lossBB);
      if (an.verdict === "correct") r.corrects++;
      if (an.verdict === "acceptable") r.acceptables++;
      if (an.verdict !== "erreur") r.verdictOk++;

      inc(r.sigs, signature(t)); inc(r.fams, famille(t));
      inc(r.rues, t.street); inc(r.pos, t.hero.pos);
      const v = t.players.find(p => !p.isHero && !p.folded);
      inc(r.profils, v && v.p ? (v.p.key || "-") : "-");

      if (JALONS.includes(r.n)) r.jalons[r.n] = instantane(r);
      if (M.Play.step(t, { action: choix.action, amount: choix.amount }).done) break;
    }
  }
  return r;
}

function instantane(r) {
  const dup = [...r.sigs.values()].reduce((a, v) => a + (v - 1), 0);
  const dupFam = [...r.fams.values()].reduce((a, v) => a + (v - 1), 0);
  return {
    lossParDecision: +(r.sommeLoss / r.n).toFixed(4),
    tauxVerdictOk: +(r.verdictOk / r.n * 100).toFixed(1),
    maitriseVerdict: +(r.verdictOk / r.n).toFixed(3),   // système ACTUEL
    maitriseCout: +(r.qSomme / r.n).toFixed(3),         // système PROPOSÉ
    sigsUniques: r.sigs.size,
    famillesUniques: r.fams.size,
    repetitionExacte: +(dup / r.n * 100).toFixed(1),
    repetitionFamille: +(dupFam / r.n * 100).toFixed(1),
    rues: r.rues.size, positions: r.pos.size, profils: r.profils.size
  };
}

/* ─────────────────────────────── exécution ──────────────────────────────── */
const plans = [
  ["competent", POLITIQUES.competent, {}],
  ["A_aleatoire", POLITIQUES.A_aleatoire, {}],
  ["B_passif", POLITIQUES.B_passif, {}],
  ["C_tolerance", POLITIQUES.C_tolerance, {}],
  ["D_repetition", POLITIQUES.D_repetition, { cfg: familleFavorable }],
  ["E_niveau", POLITIQUES.E_niveau, { niveau: "debutant" }]
];

const res = {};
for (const [nom, pol, o] of plans) {
  process.stderr.write("… " + nom + "\n");
  res[nom] = simule(nom, pol, o);
}

console.log(JSON.stringify(
  Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.jalons])), null, 1));
