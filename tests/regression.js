/**
 * Suite de régression HeroLab.
 *
 * Chaque bloc couvre un bug identifié par l'audit. Les tests sont écrits pour
 * échouer sur VERSION_ORIGINALE et passer sur VERSION_PRODUCTION.
 *
 * Usage : node tests/regression.js [chemin/du/fichier.html]
 */
const load = require("./harness");
const { suite, test, eq, ok, notOk, near, report, C, H } = require("./lib");

const target = process.argv[2] || "VERSION_PRODUCTION/herolab.html";
console.log(`Cible : ${target}`);
const { M } = load(target);
const { BoardTex, Ranges, BlockerEngine, Parser, Odds, Fmt, MODES, Spot, App, Studio } = M;

/* ══════════════════════════════════════════════════════════════════════════
   P0-1 — madeHand().draw doit être un objet nullable {flush, straight, strong}
   ══════════════════════════════════════════════════════════════════════════ */
suite("P0-1 · madeHand().draw");

test("tirage couleur détecté (AhKh sur Qh7h2c)", () => {
  const m = BoardTex.madeHand(H("Ah Kh"), H("Qh 7h 2c"));
  ok(m.draw, "draw doit être renseigné");
  ok(m.draw.flush, "draw.flush attendu");
  ok(m.draw.strong, "un tirage couleur est un tirage fort");
});

test("tirage quinte bilatéral détecté (9h8s sur 7d6c2h)", () => {
  const m = BoardTex.madeHand(H("9h 8s"), H("7d 6c 2h"));
  ok(m.draw, "draw doit être renseigné");
  ok(m.draw.straight, "draw.straight attendu");
  ok(m.draw.openEnded, "9-8-7-6 est bilatéral");
  ok(m.draw.strong, "un bilatéral est un tirage fort");
  notOk(m.draw.flush, "pas de tirage couleur ici");
});

test("ventre (gutshot) : tirage mais pas fort (9h5s sur 7d6c2h)", () => {
  const m = BoardTex.madeHand(H("9h 5s"), H("7d 6c 2h"));
  ok(m.draw, "draw doit être renseigné");
  ok(m.draw.straight, "draw.straight attendu");
  notOk(m.draw.openEnded, "5-6-7-9 est un ventre, pas un bilatéral");
  notOk(m.draw.strong, "un ventre n'est pas un tirage fort");
});

test("absence de tirage : draw === null (Ah2c sur Kd7s3h)", () => {
  const m = BoardTex.madeHand(H("Ah 2c"), H("Kd 7s 3h"));
  eq(m.draw, null, "draw doit valoir null sans tirage");
});

test("combinaison tirage + main faite (paire + tirage couleur)", () => {
  const m = BoardTex.madeHand(H("Ah Qh"), H("Qs 7h 2h"));
  ok(m.draw && m.draw.flush, "tirage couleur présent malgré la paire");
  ok(m.cat >= 1, "la paire est bien reconnue");
  ok(m.strength > 0.5, "la force combine paire et tirage");
});

test("river : plus aucun tirage (board complet)", () => {
  const m = BoardTex.madeHand(H("Ah Kh"), H("Qh 7h 2c 3d 4s"));
  eq(m.draw, null, "pas de tirage à la river");
});

test("compatibilité : made.draw reste utilisable en booléen", () => {
  const avec = BoardTex.madeHand(H("Ah Kh"), H("Qh 7h 2c"));
  const sans = BoardTex.madeHand(H("Ah 2c"), H("Kd 7s 3h"));
  ok(!!avec.draw, "truthy avec tirage");
  notOk(!!sans.draw, "falsy sans tirage");
});

test("champs plats flushDraw/straightDraw conservés", () => {
  const m = BoardTex.madeHand(H("Ah Kh"), H("Qh 7h 2c"));
  ok(m.flushDraw === true, "flushDraw conservé pour les consommateurs existants");
  ok(typeof m.straightDraw === "boolean", "straightDraw conservé");
});

suite("P0-1b · BlockerEngine.categorize (dépend de draw)");

test("tirage couleur max → nutflushdraw", () => {
  const cat = BlockerEngine.categorize(H("Ah 5h"), H("Kh 7h 2c"));
  eq(cat, "nutflushdraw");
});

test("tirage couleur non-max → flushdraw", () => {
  const cat = BlockerEngine.categorize(H("5h 4h"), H("Kh 7h 2c"));
  eq(cat, "flushdraw");
});

test("tirage quinte bilatéral → straightdraw", () => {
  const cat = BlockerEngine.categorize(H("9h 8s"), H("7d 6c 2s"));
  eq(cat, "straightdraw");
});

test("vraie air → air", () => {
  const cat = BlockerEngine.categorize(H("Jh 4c"), H("Kd 7s 2h"));
  eq(cat, "air");
});

/* ══════════════════════════════════════════════════════════════════════════
   P0-2 — Ranges.expand : intervalles à carte haute fixe
   ══════════════════════════════════════════════════════════════════════════ */
suite("P0-2 · Ranges.expand");

const setOf = s => [...new Set(Ranges.expand(s))].sort();

test("A2s-AJs → A2s..AJs (10 mains)", () => {
  const r = setOf("A2s-AJs");
  eq(r.length, 10, `obtenu ${r.join(",")} —`);
  ok(r.includes("A2s") && r.includes("AJs") && r.includes("A7s"), "bornes et milieu présents");
});

test("A2o-AJo → 10 mains offsuit", () => {
  const r = setOf("A2o-AJo");
  eq(r.length, 10, `obtenu ${r.join(",")} —`);
  ok(r.includes("A2o") && r.includes("AJo"), "bornes présentes");
  ok(r.every(x => x.endsWith("o")), "toutes offsuit");
});

test("K2s-KQs → 11 mains", () => {
  const r = setOf("K2s-KQs");
  eq(r.length, 11, `obtenu ${r.join(",")} —`);
  ok(r.includes("KQs") && r.includes("K2s"), "bornes présentes");
});

test("K2o-KQo → 11 mains", () => {
  const r = setOf("K2o-KQo");
  eq(r.length, 11, `obtenu ${r.join(",")} —`);
});

test("A2s-A5s → 4 mains (sous-intervalle)", () => {
  const r = setOf("A2s-A5s");
  eq(r, ["A2s", "A3s", "A4s", "A5s"]);
});

test("22-99 → 8 paires", () => {
  const r = setOf("22-99");
  eq(r.length, 8, `obtenu ${r.join(",")} —`);
  ok(r.includes("22") && r.includes("99"), "bornes présentes");
});

test("T9s-65s → connecteurs à écart constant (non régressé)", () => {
  const r = setOf("T9s-65s");
  ok(r.includes("T9s") && r.includes("98s") && r.includes("65s"), `obtenu ${r.join(",")}`);
  eq(r.length, 5, `obtenu ${r.join(",")} —`);
});

test("bornes inversées tolérées (AJs-A2s)", () => {
  eq(setOf("AJs-A2s").length, 10);
});

test("notation simple inchangée (AKs, TT+, 77)", () => {
  eq(Ranges.expand("AKs"), ["AKs"]);
  ok(Ranges.expand("TT+").includes("AA"), "TT+ inclut AA");
  eq(Ranges.expand("77"), ["77"]);
});

suite("P0-2b · ranges consommatrices (BB_DEF, priors)");

// Ranges.parse() est la vraie API de consommation (liste séparée par virgules,
// renvoie un Set de labels) : c'est elle que le moteur appelle sur BB_DEF.
const parseSet = str => [...Ranges.parse(str)];

test("BB_DEF : chaque range se développe sans perte", () => {
  const def = Ranges.BB_DEF;
  ok(def && Object.keys(def).length, "BB_DEF présent");
  for (const [pos, str] of Object.entries(def)) {
    const labels = parseSet(str);
    ok(labels.length >= 35, `BB_DEF.${pos} trop courte : ${labels.length} mains`);
  }
});

test("BB_DEF.UTG : compte exact (39 mains, vérifié à la main)", () => {
  // 22-JJ:10 + A2s-AJs:10 + ATo-AQo:3 + K9s+:4 + KJo+:2 + Q9s+:3
  // + QJo:1 + J9s+:2 + T9s:1 + 98s:1 + 87s:1 + 76s:1 = 39
  eq(parseSet(Ranges.BB_DEF.UTG).length, 39);
});

test("BB_DEF vs CO contient bien les As intermédiaires", () => {
  const labels = parseSet(Ranges.BB_DEF.CO);
  const aces = labels.filter(c => c.startsWith("A"));
  ok(aces.length >= 8, `seulement ${aces.length} mains As : ${aces.join(",")}`);
  ["A3s", "A7s", "AJs", "ATo", "AQo"].forEach(h =>
    ok(labels.includes(h), `${h} manquante de la défense BB vs CO`));
});

test("A2s-AJs présente 10 mains dans une liste complète", () => {
  const labels = parseSet("22-JJ, A2s-AJs, K9s+");
  const aces = labels.filter(c => /^A.s$/.test(c));
  eq(aces.length, 10, `obtenu ${aces.join(",")} —`);
});

test("THREEBET / FOURBET / OPEN se développent aussi", () => {
  ok(parseSet(Ranges.THREEBET.value + ", " + Ranges.THREEBET.bluff).length >= 10);
  ok(parseSet(Ranges.FOURBET.value + ", " + Ranges.FOURBET.bluff).length >= 4);
  if (Ranges.OPEN) for (const [pos, str] of Object.entries(Ranges.OPEN))
    ok(parseSet(str).length >= 10, `OPEN.${pos} trop courte`);
});

/* ══════════════════════════════════════════════════════════════════════════
   P0-4 — Import PokerStars : les posts de blindes doivent être conservés
   ══════════════════════════════════════════════════════════════════════════ */
suite("P0-4 · Import PokerStars");

const PS_HERO_SB = `PokerStars Hand #240000000001:  Hold'em No Limit ($0.01/$0.02 USD) - 2024/01/15 15:30:00 ET
Table 'Alpha' 6-max Seat #3 is the button
Seat 1: Hero ($2 in chips)
Seat 2: Vilain1 ($2 in chips)
Seat 3: Vilain2 ($2 in chips)
Hero: posts small blind $0.01
Vilain1: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Vilain2: folds
Hero: folds
Vilain1: collected $0.03 from pot
*** SUMMARY ***
Total pot $0.03 | Rake $0
Seat 2: Vilain1 collected ($0.03)
`;

const PS_HERO_BB_WINS = `PokerStars Hand #240000000002:  Hold'em No Limit ($0.01/$0.02 USD) - 2024/01/15 15:35:00 ET
Table 'Alpha' 6-max Seat #3 is the button
Seat 1: Vilain1 ($2 in chips)
Seat 2: Hero ($2 in chips)
Seat 3: Vilain2 ($2 in chips)
Vilain1: posts small blind $0.01
Hero: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [As Ad]
Vilain2: folds
Vilain1: folds
Hero: collected $0.02 from pot
*** SUMMARY ***
Total pot $0.02 | Rake $0
Seat 2: Hero collected ($0.02)
`;

const parsePS = txt => Parser.parseFile(txt, "test.txt");

test("hero SB qui passe : profit = -0.01 (et non 0)", () => {
  const { hands, errors } = parsePS(PS_HERO_SB);
  eq(errors.length, 0, `erreurs de parsing : ${errors.join(" | ")}`);
  eq(hands.length, 1, "une main attendue");
  near(hands[0].invested, 0.01, 1e-9, "investissement hero");
  near(hands[0].profit, -0.01, 1e-9, "profit hero");
});

test("les posts de blindes apparaissent dans actions.blinds", () => {
  const { hands } = parsePS(PS_HERO_SB);
  const blinds = hands[0].actions.blinds;
  ok(blinds.length >= 2, `attendu ≥2 posts, obtenu ${blinds.length}`);
  const posters = blinds.map(b => b.player);
  ok(posters.includes("Hero"), "post du hero présent");
  ok(posters.includes("Vilain1"), "post du vilain présent");
});

test("hero BB qui encaisse : profit = 0 (BB rendue)", () => {
  const { hands, errors } = parsePS(PS_HERO_BB_WINS);
  eq(errors.length, 0, `erreurs : ${errors.join(" | ")}`);
  near(hands[0].invested, 0.02, 1e-9, "hero a investi sa BB");
  near(hands[0].collected, 0.02, 1e-9, "hero encaisse le pot");
  near(hands[0].profit, 0, 1e-9, "profit net nul");
});

test("blindes des autres joueurs comptées dans le pot", () => {
  const { hands } = parsePS(PS_HERO_SB);
  near(hands[0].pot, 0.03, 1e-9, "pot total");
});

test("position hero correctement déduite (SB)", () => {
  const { hands } = parsePS(PS_HERO_SB);
  eq(hands[0].heroPos, "SB");
});

const PS_POSTFLOP = `PokerStars Hand #240000000003:  Hold'em No Limit ($0.05/$0.10 USD) - 2024/02/02 12:00:00 ET
Table 'Beta' 6-max Seat #1 is the button
Seat 1: Vilain1 ($10 in chips)
Seat 2: Hero ($10 in chips)
Seat 3: Vilain2 ($10 in chips)
Hero: posts small blind $0.05
Vilain2: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Vilain1: folds
Hero: raises $0.20 to $0.30
Vilain2: calls $0.20
*** FLOP *** [Qh 7h 2c]
Hero: bets $0.40
Vilain2: calls $0.40
*** TURN *** [Qh 7h 2c] [3d]
Hero: checks
Vilain2: checks
*** RIVER *** [Qh 7h 2c 3d] [Jh]
Hero: bets $1
Vilain2: folds
Uncalled bet ($1) returned to Hero
Hero collected $1.40 from pot
*** SUMMARY ***
Total pot $1.40 | Rake $0
Board [Qh 7h 2c 3d Jh]
Seat 2: Hero (small blind) collected ($1.40)
`;

test("main postflop complète : investissement et profit exacts", () => {
  const { hands, errors } = parsePS(PS_POSTFLOP);
  eq(errors.length, 0, `erreurs : ${errors.join(" | ")}`);
  const h = hands[0];
  // hero investit 0.30 (préflop, blinde incluse) + 0.40 (flop) = 0.70
  near(h.invested, 0.70, 1e-9, "investissement hero");
  near(h.collected, 1.40, 1e-9, "encaissé");
  near(h.profit, 0.70, 1e-9, "profit net");
});

test("main postflop : board et rues correctement lus", () => {
  const { hands } = parsePS(PS_POSTFLOP);
  const h = hands[0];
  eq(h.boardAll.length, 5, "board complet");
  ok(h.actions.flop.length >= 2, "actions de flop présentes");
  ok(h.actions.river.length >= 1, "actions de river présentes");
  eq(h.heroPos, "SB");
});

test("plusieurs mains dans un même fichier", () => {
  const { hands, errors } = parsePS(PS_HERO_SB + "\n" + PS_HERO_BB_WINS + "\n" + PS_POSTFLOP);
  eq(errors.length, 0, `erreurs : ${errors.join(" | ")}`);
  eq(hands.length, 3, "trois mains attendues");
  const ids = new Set(hands.map(h => h.id));
  eq(ids.size, 3, "identifiants distincts");
});

suite("P0-4b · non-régression Winamax");

const WINA = `Winamax Poker - CashGame - HandId: #999-1-1 - Holdem no limit (0.02€/0.05€) - 2024/03/12 20:14:33 UTC
Table: 'Wichita 05' 5-max (real money) Seat #3 is the button
Seat 1: Alice (5€)
Seat 2: Hero (5€)
Seat 3: Bob (5€)
*** ANTE/BLINDS ***
Alice posts small blind 0.02€
Hero posts big blind 0.05€
Dealt to Hero [As Kd]
*** PRE-FLOP ***
Bob folds
Alice folds
Hero collected 0.07€ from pot
*** SUMMARY ***
Total pot 0.07€ | No rake
Seat 2: Hero (big blind) won 0.07€
`;

test("main Winamax toujours parsée correctement", () => {
  const { hands, errors } = Parser.parseFile(WINA, "wina.txt");
  eq(errors.length, 0, `erreurs : ${errors.join(" | ")}`);
  eq(hands.length, 1);
  near(hands[0].invested, 0.05, 1e-9, "BB investie");
  near(hands[0].collected, 0.07, 1e-9, "pot encaissé");
  near(hands[0].profit, 0.02, 1e-9, "profit net");
});

test("les blindes Winamax restent dans actions.blinds", () => {
  const { hands } = Parser.parseFile(WINA, "wina.txt");
  eq(hands[0].actions.blinds.length, 2);
});

/* ══════════════════════════════════════════════════════════════════════════
   P0-3 — Side pots
   ══════════════════════════════════════════════════════════════════════════ */
suite("P0-3 · Side pots");

const { Play, Table, HandEval } = M;

/**
 * Construit une table figée : mains imposées, board imposé, rake nul, pot égal
 * à la somme des engagements. On appelle directement Play.finish (showdown).
 */
function makeTable(specs, boardStr) {
  const t = new Table({ bb: 1, rake: 0 });
  t.board = H(boardStr);
  t.deck = [];
  specs.forEach((s, i) => {
    t.seat({
      name: s.name, pos: s.pos || `P${i}`, stack: s.stack ?? 0,
      hole: H(s.hole), isHero: !!s.hero, folded: !!s.folded,
      total: s.total, invested: 0, allin: false, actions: []
    });
  });
  t.hero = t.players.find(p => p.isHero) || t.players[0];
  t.pot = specs.reduce((a, s) => a + s.total, 0);
  return t;
}
const wonBy = (t, name) => t.players.find(p => p.name === name).won;

test("cas 1 — deux joueurs all-in, stacks identiques", () => {
  const t = makeTable([
    { name: "Hero", hero: true, hole: "Ah Ad", total: 100 },
    { name: "V1", hole: "Kh Kd", total: 100 }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  eq(wonBy(t, "Hero"), 200, "le gagnant prend les deux tapis");
  eq(wonBy(t, "V1"), 0);
  eq(t.result.net, 100, "net hero");
});

test("cas 2 — trois joueurs, un short-stack gagne : side pot au 2e", () => {
  // Short (20) gagne le pot principal ; Hero (100) bat V2 (100) sur le side pot.
  const t = makeTable([
    { name: "Short", hole: "Ah Ad", total: 20 },
    { name: "Hero", hero: true, hole: "Kh Kd", total: 100 },
    { name: "V2", hole: "Qh Qd", total: 100 }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  eq(wonBy(t, "Short"), 60, "pot principal = 20×3");
  eq(wonBy(t, "Hero"), 160, "side pot = 80×2");
  eq(wonBy(t, "V2"), 0);
  eq(wonBy(t, "Short") + wonBy(t, "Hero"), 220, "tout le pot est distribué");
});

test("cas 3 — A couvre B et C : A ne gagne que ce qu'il a couvert", () => {
  const t = makeTable([
    { name: "A", hero: true, hole: "Ah Ad", total: 100 },
    { name: "B", hole: "Kh Kd", total: 40 },
    { name: "C", hole: "Qh Qd", total: 25 }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  // paliers : 25×3=75, (40-25)×2=30, (100-40)×1=60 (surplus non couvert)
  eq(wonBy(t, "A"), 165, "75 + 30 + 60 rendus");
  eq(t.result.net, 65, "net = 165 - 100 engagés");
});

test("cas 4 — gagne le pot principal mais perd un side pot", () => {
  // Short gagne le principal ; Hero perd le side pot contre V2 → net négatif.
  const t = makeTable([
    { name: "Short", hero: true, hole: "Ah Ad", total: 20 },
    { name: "Hero2", hole: "2h 2d", total: 100 },
    { name: "V2", hole: "Kh Kd", total: 100 }
  ], "7c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  eq(wonBy(t, "Short"), 60, "pot principal aux As");
  eq(wonBy(t, "V2"), 160, "side pot aux Rois");
  eq(wonBy(t, "Hero2"), 0);
  eq(t.result.net, 40, "hero (Short) : 60 - 20");
});

test("cas 5 — plusieurs side pots (4 joueurs, 4 tapis différents)", () => {
  const t = makeTable([
    { name: "P10", hole: "Ah Ad", total: 10 },
    { name: "P30", hole: "Kh Kd", total: 30 },
    { name: "P60", hole: "Qh Qd", total: 60 },
    { name: "P100", hero: true, hole: "Jh Jd", total: 100 }
  ], "2c 5d 9s 4h 3c");
  Play.finish(t, "showdown");
  // paliers : 10×4=40 | 20×3=60 | 30×2=60 | 40×1=40
  eq(wonBy(t, "P10"), 40, "pot principal");
  eq(wonBy(t, "P30"), 60, "side pot 1");
  eq(wonBy(t, "P60"), 60, "side pot 2");
  eq(wonBy(t, "P100"), 40, "surplus non couvert rendu");
  eq(wonBy(t, "P10") + wonBy(t, "P30") + wonBy(t, "P60") + wonBy(t, "P100"), 200,
    "conservation des jetons");
});

test("les jetons d'un joueur couché restent dans le pot", () => {
  const t = makeTable([
    { name: "Hero", hero: true, hole: "Ah Ad", total: 50 },
    { name: "V1", hole: "Kh Kd", total: 50 },
    { name: "Couche", hole: "7h 7d", total: 20, folded: true }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  eq(wonBy(t, "Hero"), 120, "50+50+20 au gagnant");
  eq(wonBy(t, "Couche"), 0, "un joueur couché ne gagne rien");
});

test("égalité : partage du pot concerné", () => {
  const t = makeTable([
    { name: "Hero", hero: true, hole: "Ah Ad", total: 50 },
    { name: "V1", hole: "As Ac", total: 50 }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "showdown");
  eq(wonBy(t, "Hero"), 50);
  eq(wonBy(t, "V1"), 50);
  eq(t.result.net, 0, "split = neutre");
});

test("conservation des jetons avec rake", () => {
  const t = makeTable([
    { name: "Hero", hero: true, hole: "Ah Ad", total: 100 },
    { name: "V1", hole: "Kh Kd", total: 40 }
  ], "2c 5d 9s Jh 3c");
  t.rake = 0.05;
  Play.finish(t, "showdown");
  const distribue = t.players.reduce((a, p) => a + p.won, 0);
  near(distribue, t.potAfterRake(), 0.011, "somme distribuée = pot après rake");
});

test("victoire par fold : pas de showdown, tout au dernier joueur", () => {
  const t = makeTable([
    { name: "Hero", hero: true, hole: "7h 2d", total: 30 },
    { name: "V1", hole: "Ah Ad", total: 10, folded: true }
  ], "2c 5d 9s Jh 3c");
  Play.finish(t, "fold");
  eq(wonBy(t, "Hero"), 40, "le pot entier, surplus compris");
  eq(t.result.showdown, false);
});

/* ══════════════════════════════════════════════════════════════════════════
   P1 — Modes en tête-à-tête (BvB, BTN vs BB)
   ══════════════════════════════════════════════════════════════════════════ */
suite("P1 · Modes BvB / BTN vs BB");

/** Génère N spots jouables dans un mode donné. */
function genSpots(mode, n = 60) {
  const out = [];
  for (let i = 0; i < n * 8 && out.length < n; i++) {
    const t = Spot.generate({ ...App.cfg, mode });
    if (!t.finished && Spot.options(t).length) out.push(t);
  }
  return out;
}

[["bvb", ["SB", "BB"]], ["btnbb", ["BTN", "BB"]]].forEach(([mode, duo]) => {
  test(`${mode} : seuls ${duo.join(" et ")} sont encore dans le coup`, () => {
    const spots = genSpots(mode);
    ok(spots.length >= 20, `trop peu de spots générés (${spots.length})`);
    for (const t of spots) {
      // Quand le héros est BTN, la SB n'a pas encore parlé : elle est
      // légitimement encore en jeu (elle se couchera derrière). C'est le
      // déroulé réel d'un BTN vs BB, pas une fuite du mode.
      const attendus = t.hero.pos === "BTN" ? [...duo, "SB"] : duo;
      const vivants = t.live().map(p => p.pos).sort();
      ok(vivants.every(p => attendus.includes(p)),
        `héros ${t.hero.pos} — sièges vivants ${vivants.join(",")}, attendu ⊆ ${attendus.join(",")}`);
    }
  });

  test(`${mode} : le héros occupe bien une des deux positions`, () => {
    const spots = genSpots(mode);
    const vues = new Set(spots.map(t => t.hero.pos));
    ok([...vues].every(p => duo.includes(p)), `positions héros : ${[...vues].join(",")}`);
  });

  test(`${mode} : aucun siège hors duel n'a investi de jetons`, () => {
    for (const t of genSpots(mode)) {
      for (const p of t.players) {
        if (duo.includes(p.pos)) continue;
        // seule la SB de btnbb peut avoir de l'argent mort au pot
        const mort = mode === "btnbb" && p.pos === "SB";
        if (!mort) eq(p.total, 0, `${p.pos} a investi ${p.total} alors qu'il est hors du duel`);
      }
    }
  });

  test(`${mode} : l'agresseur préflop n'est jamais hors du duel`, () => {
    for (const t of genSpots(mode)) {
      const raises = t.log.filter(l => l.street === "preflop" && (l.action === "raise" || l.action === "bet"));
      for (const r of raises)
        ok(duo.includes(r.pos), `${r.pos} a relancé en mode ${mode}`);
    }
  });
});

test("bvb : la SB est bien la première à parler préflop", () => {
  for (const t of genSpots("bvb", 30)) {
    const actions = t.log.filter(l => l.street === "preflop" && l.action !== "post" && l.action !== "fold");
    if (actions.length) eq(actions[0].pos, "SB", "SB parle en premier en BvB");
  }
});

test("btnbb : quand le héros est BB, la SB s'est couchée en laissant sa blinde", () => {
  const spots = genSpots("btnbb", 40).filter(t => t.hero.pos === "BB");
  ok(spots.length >= 5, `trop peu de spots héros-BB (${spots.length})`);
  for (const t of spots) {
    const sb = t.players.find(p => p.pos === "SB");
    ok(sb.folded, "la SB doit être couchée une fois l'action passée");
    ok(sb.total > 0, "sa blinde reste au pot en argent mort");
  }
});

test("btnbb : quand le héros est BTN, la SB n'a pas encore parlé", () => {
  const spots = genSpots("btnbb", 40).filter(t => t.hero.pos === "BTN");
  ok(spots.length >= 5, `trop peu de spots héros-BTN (${spots.length})`);
  for (const t of spots) {
    const sb = t.players.find(p => p.pos === "SB");
    notOk(sb.folded, "la SB parle après le BTN : elle est encore en jeu");
    near(sb.total, t.sb, 1e-9, "elle n'a engagé que sa blinde");
  }
});

test("modes non tête-à-tête : la table reste peuplée (non-régression)", () => {
  const spots = genSpots("libre", 30);
  const maxVivants = Math.max(...spots.map(t => t.live().length));
  ok(maxVivants >= 3, `mode libre : au plus ${maxVivants} joueurs vivants, table trop vide`);
});

/* ══════════════════════════════════════════════════════════════════════════
   P1 — Daily Challenge : restauration du mode
   ══════════════════════════════════════════════════════════════════════════ */
suite("P1 · Daily Challenge / cfg.mode");

/* Le défi ne doit jamais muter App.cfg : le mode « cible » est appliqué sur la
   copie locale de config dans newHand(), comme le fait déjà l'entraînement
   ciblé (drillRun). L'invariant testé est donc « App.cfg.mode inchangé ». */

["libre", "pot3bet", "pot4bet", "preflop", "cible"].forEach(mode => {
  test(`startDaily ne modifie pas le mode configuré (${mode})`, () => {
    App.dailyRun = null;
    App.cfg.mode = mode;
    App.startDaily();
    eq(App.cfg.mode, mode, "App.cfg.mode doit rester intact");
    App.dailyRun = null;
  });
});

// « cible » est un méta-mode : newHand() le résout vers le mode de la fuite la
// plus coûteuse (ou « libre » si aucun historique). On vérifie donc que le défi
// emprunte bien ce chemin, tout en laissant App.cfg intacte.
test("le défi emprunte le chemin « cible » (résolu par la fuite dominante)", () => {
  const vraiGenerate = Spot.generate;
  const vraiWorst = M.Progress.worstLeak;
  const vus = [];
  try {
    Spot.generate = cfg => { vus.push(cfg.mode); return vraiGenerate.call(Spot, cfg); };
    M.Progress.worstLeak = () => ({ key: "cbet-flop" });
    App.dailyRun = null; App.drillRun = null; App.session = null;
    App.cfg.mode = "preflop";
    App.startDaily();
    const attendu = M.Progress.focusFor("cbet-flop").mode;
    ok(vus.length, "Spot.generate doit être appelé");
    ok(vus.every(m => m === attendu),
      `mode transmis : ${vus.join(",")} (attendu « ${attendu} », résolu depuis la fuite)`);
    ok(vus.every(m => m !== "preflop"),
      "le défi ne doit pas utiliser le mode des réglages du joueur");
    eq(App.cfg.mode, "preflop", "et la config du joueur reste intacte");
  } finally {
    Spot.generate = vraiGenerate;
    M.Progress.worstLeak = vraiWorst;
    App.dailyRun = null;
  }
});

test("hors défi, le mode configuré est bien celui transmis", () => {
  const vraiGenerate = Spot.generate;
  const vus = [];
  try {
    Spot.generate = cfg => { vus.push(cfg.mode); return vraiGenerate.call(Spot, cfg); };
    App.dailyRun = null; App.drillRun = null; App.session = null;
    App.cfg.mode = "pot3bet";
    App.newHand();
    ok(vus.length && vus.every(m => m === "pot3bet"), `mode transmis : ${vus.join(",")}`);
  } finally {
    Spot.generate = vraiGenerate;
  }
});

test("fin de défi puis relance : aucune fuite d'état", () => {
  App.cfg.mode = "libre";
  App.startDaily();
  App.dailyRun = null;            // fin du défi (completeDaily remet à null)
  eq(App.cfg.mode, "libre", "mode intact après le 1er défi");
  App.startDaily();
  App.dailyRun = null;
  eq(App.cfg.mode, "libre", "mode intact après le 2e défi");
});

test("abandon en cours de défi : mode intact", () => {
  App.cfg.mode = "river";
  App.startDaily();
  App.dailyRun = null;            // abandon : navigation ailleurs
  eq(App.cfg.mode, "river");
});

/* ══════════════════════════════════════════════════════════════════════════
   P1 — Qualité de la copie affichée
   ══════════════════════════════════════════════════════════════════════════ */
suite("P1 · Copy / textes utilisateur");

const fs = require("fs");
const path = require("path");
const source = fs.readFileSync(path.resolve(__dirname, "..", target), "utf8");
// On ne scanne que le script DU MOTEUR, repéré par son contenu : les artefacts
// de Phase 3 embarquent aussi Chart.js et le SDK Supabase, dont le code de
// bibliothèque n'a pas à être jugé par les règles de style de l'application.
const appSource = (() => {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(source)) !== null)
    if (m[1].includes('const RANKS = "23456789TJQKA"')) return m[1];
  throw new Error("script du moteur introuvable");
})();

test("aucune auto-correction de brouillon dans les textes", () => {
  const m = appSource.match(/…\s*pardon|\.\.\.\s*pardon/gi);
  eq(m, null, `brouillon trouvé : ${m && m.join(" | ")}`);
});

test("le texte sb-overdefend annonce le taux d'abandon (FSB)", () => {
  const bloc = appSource.match(/id:\s*"sb-overdefend"[\s\S]{0,900}?\n\s*\},/);
  ok(bloc, "bloc sb-overdefend introuvable");
  const why = bloc[0].match(/why:\s*s\s*=>\s*`([^`]*)`/);
  ok(why, "champ why introuvable");
  ok(/n'abandonnes[^`]*\$\{s\.FSB/.test(why[1]),
    "la phrase d'abandon doit utiliser s.FSB, pas 100 - s.FSB");
  notOk(/pardon/i.test(why[1]), "aucun brouillon résiduel");
});

test("aucun marqueur de développement dans le script applicatif", () => {
  const interdits = appSource.match(/\b(TODO|FIXME|XXX|HACK|debugger)\b/g);
  eq(interdits, null, `marqueurs trouvés : ${interdits && interdits.join(", ")}`);
});

test("aucun console.log résiduel (les warn/error d'erreur sont tolérés)", () => {
  const logs = appSource.match(/console\.log\(/g);
  eq(logs, null, `console.log trouvés : ${logs && logs.length}`);
});

/* ══════════════════════════════════════════════════════════════════════════
   P2 — Nettoyage ciblé
   ══════════════════════════════════════════════════════════════════════════ */
suite("P2 · Nettoyage");

test("Odds.breakEven donne la cote du pot correcte", () => {
  if (typeof Odds.breakEven !== "function") return; // supprimée : acceptable
  // signature : breakEven(toCall, pot)
  near(Odds.breakEven(50, 100), 50 / 150, 1e-9, "50 à payer dans un pot de 100");
  near(Odds.breakEven(0, 100), 0, 1e-9, "rien à payer → 0 (pas NaN)");
  ok(!Number.isNaN(Odds.breakEven(0, 100)), "pas de NaN");
});

/* ══════════════════════════════════════════════════════════════════════════
   Sécurité
   ══════════════════════════════════════════════════════════════════════════ */
suite("Sécurité · S1 échappement RegExp Studio");

test("le libellé est échappé avant d'entrer dans la RegExp", () => {
  const grab = appSource.match(/const grab = \(name\) => \{[\s\S]{0,220}?\};/);
  ok(grab, "fonction grab introuvable");
  ok(/rx\(name\)/.test(grab[0]),
    "le nom doit passer par un échappeur RegExp avant concaténation");
});

test("Studio.parse fonctionne toujours sur son propre gabarit (non-régression)", () => {
  const spec = Studio.parse(Studio.TEMPLATE);
  eq(spec.heroPos, "BTN");
  eq(spec.heroCards.length, 2);
  near(spec.heroStack, 100, 1e-9);
});

test("un texte porteur de métacaractères ne casse pas le parseur", () => {
  // Sans échappement, un motif comme « (a|b)* » injecté dans la RegExp
  // modifierait la reconnaissance des lignes, voire provoquerait un ReDoS.
  const texte = Studio.TEMPLATE + "\n(a+)+b: piège\n[x-z]: piège";
  const spec = Studio.parse(texte);
  eq(spec.heroPos, "BTN", "le gabarit reste correctement lu");
});

suite("Sécurité · S2 validation des sauvegardes importées");

test("JSON non-objet rejeté proprement", () => {
  const r = M.Player.importAll("[]");
  notOk(r.ok, "un tableau n'est pas une sauvegarde valide");
  ok(r.error, "message d'erreur fourni");
});

test("JSON illisible rejeté proprement", () => {
  const r = M.Player.importAll("{pas du json");
  notOk(r.ok);
  ok(r.error);
});

test("mauvais _format rejeté", () => {
  const r = M.Player.importAll(JSON.stringify({ _format: "autre", player: {} }));
  notOk(r.ok);
});

test("champs de mauvais type ignorés sans corrompre l'état", () => {
  const avant = JSON.stringify(M.Player.data);
  M.Player.importAll(JSON.stringify({ _format: "pivot-save", player: "chaine", career: 42 }));
  ok(M.Player.data && typeof M.Player.data === "object",
    "Player.data doit rester un objet après un import malformé");
  ok(typeof M.Player.data.name === "string" || M.Player.data.name === undefined,
    "le pseudo ne doit pas devenir un type aberrant");
});

test("sauvegarde valide toujours acceptée (compatibilité)", () => {
  const dump = JSON.parse(M.Player.exportAll());
  const r = M.Player.importAll(JSON.stringify(dump));
  ok(r.ok, `une sauvegarde produite par l'app doit être réimportable : ${r.error || ""}`);
});

process.exit(report() ? 1 : 0);
