/**
 * Fingerprint déterministe du CORE / ENGINE (DF-B).
 *
 * Ce module ne teste pas des valeurs « attendues » écrites à la main : il exécute
 * une batterie fixe d'appels moteur et produit un hash. Le hash de la baseline est
 * gelé dans tests/baseline.json. Toute dérive du moteur — même d'un centième sur
 * une équité — change le hash et fait échouer la suite.
 *
 * Le code ci-dessous est sérialisé et exécuté DANS la page (page.evaluate), donc
 * il accède aux bindings globaux du script classique (Deck, HandEval, ...).
 */

/** Batterie exécutée dans la page. Retourne un objet de résultats bruts. */
export function engineProbe() {
  const out = {};

  // --- RNG déterministe fourni par le moteur lui-même (pas Math.random) ---
  const seeded = (s) => Equity._mulberry(Equity._fnv(String(s)));

  // --- Deck ---------------------------------------------------------------
  out.deck_full = (() => {
    const d = Deck.full ? Deck.full() : null;
    return d ? { n: d.length, first: d[0], last: d[d.length - 1] } : null;
  })();
  out.deck_shuffle = (() => {
    const rng = seeded("deck|1");
    const d = Deck.full ? Deck.full() : [];
    const s = Deck.shuffle(d.slice(), rng);
    return s.slice(0, 12);
  })();
  // encodage carte = entier : rang = c>>2, couleur = c&3
  out.deck_encoding = [0, 1, 2, 3, 4, 17, 33, 51].map(c => ({ c, r: c >> 2, s: c & 3 }));

  // --- HandEval -----------------------------------------------------------
  // 7 cartes, jeux de mains couvrant chaque catégorie
  const hands7 = [
    [0, 4, 8, 12, 16, 20, 24],
    [0, 1, 2, 3, 20, 24, 28],
    [51, 47, 43, 39, 35, 31, 27],
    [0, 5, 10, 15, 20, 25, 30],
    [2, 6, 10, 14, 18, 22, 26],
    [1, 5, 9, 13, 17, 21, 25],
    [0, 1, 4, 5, 8, 9, 12],
    [3, 7, 11, 15, 19, 23, 27],
    [0, 2, 4, 6, 8, 10, 12],
    [48, 49, 50, 51, 44, 45, 46],
  ];
  out.handeval = hands7.map(h => {
    try { return HandEval.score7 ? HandEval.score7(h) : HandEval.best7(h); }
    catch (e) { return "ERR:" + e.message; }
  });

  // --- Ranges -------------------------------------------------------------
  const rangeTexts = [
    "77+, A5s+",
    "22+",
    "AKs",
    "AKo",
    "JJ+, AQs+, AKo",
    "T9s+, 76s",
    "any",
    "",
  ];
  out.ranges = rangeTexts.map(t => {
    try {
      const combos = Ranges.parse ? Ranges.parse(t) : Ranges.expand(t);
      return { t, n: combos ? combos.length : 0 };
    } catch (e) { return { t, err: e.message }; }
  });

  // --- BoardTex -----------------------------------------------------------
  const boards = [
    [0, 4, 8],
    [51, 47, 43],
    [0, 1, 2],
    [12, 16, 20, 24],
    [3, 7, 11, 15, 19],
    [2, 3, 6],
    [40, 44, 48],
    [0, 5, 34],
  ];
  out.boardtex_analyse = boards.map(b => BoardTex.analyse(b));
  out.boardtex_made = boards.map(b => BoardTex.madeHand([50, 46], b));
  out.boardtex_made2 = boards.map(b => BoardTex.madeHand([0, 13], b));
  out.boardtex_empty = BoardTex.analyse([]);
  out.boardtex_made_pre = BoardTex.madeHand([50, 46], []);

  // --- Equity (déterministe par construction) -----------------------------
  out.equity = (() => {
    const res = [];
    const combos = Ranges.parse ? Ranges.parse("77+, A5s+") : [];
    for (const board of [[], [0, 4, 8], [12, 16, 20, 24]]) {
      try {
        res.push(Equity.vsRange
          ? Equity.vsRange([50, 46], combos, board, 300)
          : Equity.equity([50, 46], combos, board, 300));
      } catch (e) { res.push("ERR:" + e.message); }
    }
    return res;
  })();

  // --- Odds ---------------------------------------------------------------
  out.odds = (() => {
    const r = {};
    const pairs = [[100, 50], [30, 10], [200, 200], [75, 25]];
    r.potOdds = pairs.map(([p, c]) => { try { return Odds.potOdds(p, c); } catch (e) { return null; } });
    r.mdf = [0.25, 0.5, 0.75, 1].map(x => { try { return Odds.mdf(x); } catch (e) { return null; } });
    r.foldEquity = pairs.map(([p, c]) => { try { return Odds.foldEquity(p, c); } catch (e) { return null; } });
    return r;
  })();

  // --- CAT / RANKS (tables constantes) ------------------------------------
  out.cat = typeof CAT !== "undefined" ? CAT : null;
  out.ranks = typeof RANKS !== "undefined" ? RANKS : null;

  return out;
}

/**
 * Pureté du moteur : le source de chaque module gelé ne doit contenir aucune
 * référence DOM / stockage / couche supérieure. Vérifié sur Function.toString(),
 * donc sur le code réellement chargé, pas sur le fichier.
 */
export function enginePurityProbe() {
  const FROZEN = ["Deck", "HandEval", "Ranges", "BoardTex", "Equity", "Odds"];
  const FORBIDDEN = [
    "document", "localStorage", "sessionStorage", "innerHTML",
    "window.", "App.", "UI.", "Modal.", "alert(", "Chart",
  ];
  const report = {};
  for (const name of FROZEN) {
    const mod = globalThis[name] !== undefined ? globalThis[name] : eval(name);
    let src = "";
    for (const k of Object.keys(mod)) {
      const v = mod[k];
      if (typeof v === "function") src += v.toString() + "\n";
    }
    const hits = FORBIDDEN.filter(f => src.includes(f));
    report[name] = { methods: Object.keys(mod).length, violations: hits };
  }
  return report;
}
