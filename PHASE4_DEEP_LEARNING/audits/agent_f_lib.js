/**
 * AGENT F — bibliothèque commune de mesure de couverture.
 * Script d'ANALYSE (aucune modification du moteur).
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { M } = require(path.join(ROOT, "tests", "harness"))("VERSION_PRODUCTION/herolab.html");

const POS6 = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** Reproduit la boucle de rejet de App.newHand() : 25 essais, spot jouable. */
function newHand(cfg, maxTries = 25) {
  let tries = 0, t = null, rejected = 0;
  while (tries++ < maxTries) {
    t = M.Spot.generate(cfg);
    if (!t.finished && M.Spot.options(t).length) return { t, rejected };
    rejected++;
    t = null;
  }
  return { t: null, rejected };
}

/** Type de pot déduit du journal préflop. */
function potType(t) {
  const pre = t.log.filter(l => l.street === "preflop");
  const raises = pre.filter(l => l.action === "raise" || l.action === "bet").length;
  // Aucun raise préflop : pot non ouvert (décision préflop) ou pot limpé (postflop)
  if (raises === 0) return t.street === "preflop" ? "unopened" : "limped";
  if (raises === 1) return "SRP";
  if (raises === 2) return "3bet";
  if (raises === 3) return "4bet";
  return "5bet+";
}

/** Profondeur effective (héros vs le plus court adversaire vivant), en bb. */
function effDepthBB(t) {
  const hero = t.hero;
  const opps = t.players.filter(p => !p.isHero && !p.folded);
  const heroTot = hero.stack + hero.invested;
  const oppMax = opps.length ? Math.max(...opps.map(o => o.stack + o.invested)) : heroTot;
  return Math.min(heroTot, oppMax) / t.bb;
}

function depthBucket(bb) {
  if (bb < 20) return "<20";
  if (bb < 40) return "20-40";
  if (bb < 60) return "40-60";
  if (bb < 100) return "60-100";
  if (bb < 150) return "100-150";
  if (bb < 200) return "150-200";
  return "200+";
}

/** Bucket de texture : sec / humide / monotone / pairé (+ preflop). */
function texBucket(t) {
  if (!t.board.length) return "preflop";
  const x = M.BoardTex.analyse(t.board);
  if (x.trips) return "brelan";
  if (x.paired) return "paire";
  if (x.maxSuit >= 4) return "4-flush";
  if (x.monotone) return "monotone";
  if (x.veryConnected) return "tres-connecte";
  if (x.connected) return "connecte";
  if (x.maxSuit === 2) return "bicolore-sec";
  return "arc-sec";
}

/** Texture détaillée : croisement des 3 axes indépendants. */
function texFull(t) {
  if (!t.board.length) return null;
  const x = M.BoardTex.analyse(t.board);
  const suit = x.maxSuit >= 4 ? "4flush" : x.maxSuit === 3 ? "monotone" : x.maxSuit === 2 ? "bicolore" : "rainbow";
  const pair = x.trips ? "trips" : x.paired ? "paired" : "unpaired";
  const conn = x.veryConnected ? "veryconn" : x.connected ? "conn" : "dry";
  const high = x.high >= 11 ? "high" : x.high <= 8 ? "low" : "mid";
  return { suit, pair, conn, high, x };
}

/** Action à laquelle le héros fait face. */
function facing(t) {
  const toCall = t.toCall(t.hero);
  const cur = t.log.filter(l => l.street === t.street && l.pos !== t.hero.pos);
  const acts = cur.filter(l => ["bet", "raise", "call", "check", "fold"].includes(l.action));
  const aggr = acts.filter(l => l.action === "bet" || l.action === "raise");
  if (toCall <= 0) {
    if (!acts.length) return "premier-de-parole";
    return acts.some(l => l.action === "check") ? "face-check" : "personne-mise";
  }
  if (aggr.length >= 2) return "face-relance";
  if (aggr.length === 1) return t.street === "preflop" ? "face-ouverture" : "face-mise";
  return "face-blinde";
}

/** Profils adverses vivants, triés. */
function oppProfiles(t) {
  return t.players.filter(p => !p.isHero && !p.folded)
    .map(p => (p.p && p.p.key) || p.profileKey || "?").sort();
}

/** Signature complète demandée par le mandat. */
function signature(t) {
  const live = t.players.filter(p => !p.folded).length;
  return [
    t.hero.pos,
    t.street,
    potType(t),
    live + "w",
    depthBucket(effDepthBB(t)),
    oppProfiles(t).join("+"),
    texBucket(t),
    facing(t)
  ].join("|");
}

/** Signature « ce que le joueur perçoit » : + cartes + board + sizings. */
function fullSignature(t) {
  const lbl = M.Ranges.label(t.hero.hole);
  const board = t.board.map(c => "23456789TJQKA"[c >> 2] + "shdc"[c & 3]).sort().join("");
  return signature(t) + "|" + lbl + "|" + board;
}

function entropy(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  let h = 0;
  for (const c of counts) { if (c > 0) { const p = c / n; h -= p * Math.log2(p); } }
  return h;
}

module.exports = {
  M, ROOT, POS6, newHand, potType, effDepthBB, depthBucket, texBucket, texFull,
  facing, oppProfiles, signature, fullSignature, entropy
};
