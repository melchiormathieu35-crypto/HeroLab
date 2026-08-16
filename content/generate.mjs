/**
 * Générateur de spots candidats.
 *
 * L'ancien catalogue était écrit à la main : douze situations choisies par
 * intuition, donc douze fois le goût de celui qui les a écrites. Ici on
 * parcourt l'espace réellement praticable du moteur et on laisse le scanner
 * trancher.
 *
 * Tout le vocabulaire vient du produit, rien n'est inventé :
 *
 *   positions   POS6 dans index.html — UTG, HJ, CO, BTN, SB, BB
 *   profils     les clés de PROFILES — nit, tag, lag, reg, regAgro, fish,
 *               station, maniac, rec
 *   limites     les clés de STAKES
 *   grammaire   celle de Studio.parse : « Hero: POS, Cartes, Nbb », etc.
 *
 * Ce module ne dit RIEN de la qualité d'un spot. Il produit des situations
 * syntaxiquement valides et plausibles ; c'est `Judge.evaluate` qui décide
 * lesquelles méritent une vidéo.
 *
 * Les combinaisons sont énumérées dans un ordre fixe, sans aléatoire : deux
 * exécutions produisent exactement le même catalogue.
 */

/** Positions, dans l'ordre d'action préflop. Identique à POS6. */
export const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/**
 * Profils adverses utilisables. PROFILES en définit neuf, mais seuls huit sont
 * atteignables depuis le DSL.
 *
 * DÉFAUT PRODUIT SIGNALÉ, NON CORRIGÉ : `Studio.parse` normalise le profil par
 * `vm[2].toLowerCase()` avant de le chercher dans PROFILES (index.html:2622).
 * `regAgro` est la seule clé en camelCase du catalogue, donc la seule qui ne
 * peut jamais correspondre — le message d'erreur la propose pourtant dans la
 * liste des profils disponibles, ce qui se contredit lui-même. Corriger cela
 * demanderait de toucher index.html, ce que la production de contenu n'a pas à
 * faire. On l'exclut ici, et le défaut est rapporté tel quel.
 */
export const PROFILS = ["nit", "tag", "lag", "reg", "fish", "station", "maniac", "rec"];

/**
 * Mains du héros, choisies pour couvrir le spectre des décisions plutôt que
 * pour être « jolies » : chaque famille pose un problème différent.
 */
export const MAINS = [
  { c: "Ah Kd", cls: "AKo", fam: "broadway" },
  { c: "Ah Qh", cls: "AQs", fam: "broadway" },
  { c: "Ac Jd", cls: "AJo", fam: "broadway" },
  { c: "Kh Qc", cls: "KQo", fam: "broadway" },
  { c: "Qh Qs", cls: "QQ", fam: "grosse-paire" },
  { c: "Jc Jd", cls: "JJ", fam: "grosse-paire" },
  { c: "Tc Td", cls: "TT", fam: "paire-moyenne" },
  { c: "8h 8s", cls: "88", fam: "paire-moyenne" },
  { c: "5h 5s", cls: "55", fam: "petite-paire" },
  { c: "3c 3d", cls: "33", fam: "petite-paire" },
  { c: "7h 6h", cls: "76s", fam: "connecteur" },
  { c: "9s 8s", cls: "98s", fam: "connecteur" },
  { c: "Ah 5h", cls: "A5s", fam: "as-assorti" },
  { c: "Ad 3d", cls: "A3s", fam: "as-assorti" },
  { c: "Kh Th", cls: "KTs", fam: "assorti-haut" },
  { c: "Qd 9d", cls: "Q9s", fam: "assorti-moyen" },
];

/**
 * Textures de board. Le nom décrit ce que la texture fait à une range, pas son
 * apparence — c'est ce qui rend un spot intéressant ou plat.
 */
export const BOARDS = [
  { cards: "Kh 8c 3d", tex: "sec-tete-haute", desc: "sec, tête haute" },
  { cards: "Qd 7c 2s", tex: "sec-tete-moyenne", desc: "sec, dame haute" },
  { cards: "Jd 7d 3d", tex: "monotone", desc: "monotone" },
  { cards: "9h 8s 7c", tex: "connecte", desc: "très connecté" },
  { cards: "8h 8s 4c", tex: "paire", desc: "pairé" },
  { cards: "Ah 9c 4s", tex: "as-haut", desc: "as haut" },
  { cards: "6c 5h 2s", tex: "bas", desc: "bas et déconnecté" },
  { cards: "Kd Qs 7h", tex: "deux-broadway", desc: "deux broadway" },
];

/** Cartes de turn, choisies pour changer réellement la situation. */
export const TURNS = [
  { card: "Ac", role: "surcarte", desc: "une surcarte tombe" },
  { card: "2h", role: "blanche", desc: "carte blanche" },
  { card: "Ts", role: "connexion", desc: "carte qui connecte" },
];

/** Limites retenues : trois échelons suffisent à couvrir les tailles de pot. */
export const LIMITES = ["NL10", "NL25", "NL50"];

/**
 * Modèles de situation. Chacun est une structure de main réellement courante,
 * décrite dans la grammaire Studio. `build` reçoit les paramètres et rend la
 * spécification textuelle.
 *
 * `rue` indique où le héros décide, ce qui sert ensuite au regroupement et à
 * l'anti-redondance.
 */
export const MODELES = [
  {
    id: "pre-ouverture",
    rue: "preflop",
    concept: "ouvrir ou passer",
    heroPos: ["UTG", "HJ", "CO"],
    build: ({ hero, pos, prof, limite }) => ({
      villains: [{ pos: "BTN", prof }, { pos: "BB", prof: "fish" }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: BTN (${prof}, 100bb), BB (fish, 100bb)
Preflop: hero to act`,
    }),
  },
  {
    id: "pre-face-3bet",
    rue: "preflop",
    concept: "continuer face à un 3bet",
    heroPos: ["CO", "BTN"],
    build: ({ hero, pos, prof, limite }) => ({
      villains: [{ pos: "SB", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: SB (${prof}, 100bb)
Preflop: hero raise 2.5bb, SB raise 11bb, hero to act`,
    }),
  },
  {
    id: "pre-defense-bb",
    rue: "preflop",
    concept: "défendre sa grosse blinde",
    heroPos: ["BB"],
    build: ({ hero, pos, prof, limite }) => ({
      villains: [{ pos: "CO", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: CO (${prof}, 100bb)
Preflop: CO raise 2.5bb, hero to act`,
    }),
  },
  {
    id: "pre-squeeze",
    rue: "preflop",
    concept: "face à une ouverture suivie d'un call",
    heroPos: ["BB"],
    build: ({ hero, pos, prof, limite }) => ({
      villains: [{ pos: "HJ", prof }, { pos: "BTN", prof: "fish" }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: HJ (${prof}, 100bb), BTN (fish, 140bb)
Preflop: HJ raise 2.5bb, BTN call, hero to act`,
    }),
  },
  {
    id: "flop-initiative",
    rue: "flop",
    concept: "miser ou checker avec l'initiative",
    heroPos: ["CO", "BTN", "HJ"],
    build: ({ hero, pos, prof, limite, board }) => ({
      villains: [{ pos: "BB", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: BB (${prof}, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: ${board.cards} | BB check, hero to act`,
    }),
  },
  {
    id: "flop-face-mise",
    rue: "flop",
    concept: "face à une mise au flop",
    heroPos: ["BB"],
    build: ({ hero, pos, prof, limite, board }) => ({
      villains: [{ pos: "BTN", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: BTN (${prof}, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: ${board.cards} | hero check, BTN bet 4bb, hero to act`,
    }),
  },
  {
    id: "turn-deuxieme-balle",
    rue: "turn",
    concept: "face à une deuxième mise au turn",
    heroPos: ["BB"],
    build: ({ hero, pos, prof, limite, board, turn }) => ({
      villains: [{ pos: "BTN", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: BTN (${prof}, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: ${board.cards} | hero check, BTN bet 4bb, hero call
Turn: ${turn.card} | hero check, BTN bet 12bb, hero to act`,
    }),
  },
  {
    id: "turn-apres-call",
    rue: "turn",
    concept: "le turn change la main",
    heroPos: ["BTN", "CO"],
    build: ({ hero, pos, prof, limite, board, turn }) => ({
      villains: [{ pos: "BB", prof }],
      spec: `Hero: ${pos}, ${hero.c}, 100bb
Table: 6-max, ${limite}
Villains: BB (${prof}, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: ${board.cards} | BB check, hero bet 3bb, BB call
Turn: ${turn.card} | BB bet 9bb, hero to act`,
    }),
  },
];

/** Cartes occupées par une chaîne, en notation normalisée. */
function cartesDe(s) {
  return (s.match(/[2-9TJQKA][shdc]/g) || []).map(x => x.toUpperCase()[0] + x[1]);
}

/**
 * Une combinaison n'est retenue que si aucune carte n'apparaît deux fois :
 * Studio refuse un spot où le héros tient une carte du board, et il a raison.
 * On filtre en amont plutôt que de compter sur l'erreur.
 */
function cartesDistinctes(...parts) {
  const vues = new Set();
  for (const p of parts) {
    if (!p) continue;
    for (const c of cartesDe(p)) {
      if (vues.has(c)) return false;
      vues.add(c);
    }
  }
  return true;
}

/**
 * Énumère les spots candidats. Ordre déterministe, aucun aléatoire.
 *
 * `max` borne la sortie : l'espace complet se compte en dizaines de milliers,
 * et chaque évaluation coûte un aller-retour dans le moteur. On échantillonne
 * donc régulièrement plutôt que de tronquer en tête, sinon toute la variété
 * des derniers modèles serait perdue.
 */
export function genererSpots({ max = 400, modeles = null } = {}) {
  const choisis = modeles ? MODELES.filter(m => modeles.includes(m.id)) : MODELES;
  const parModele = new Map();

  for (const modele of choisis) {
    const liste = [];
    for (const pos of modele.heroPos) {
      for (const hero of MAINS) {
        for (const prof of PROFILS) {
          const limite = LIMITES[(hero.cls.length + prof.length) % LIMITES.length];
          const boards = modele.rue === "preflop" ? [null] : BOARDS;
          for (const board of boards) {
            const turns = modele.rue === "turn" ? TURNS : [null];
            for (const turn of turns) {
              if (!cartesDistinctes(hero.c, board?.cards, turn?.card)) continue;
              const { spec, villains } = modele.build({ hero, pos, prof, limite, board, turn });
              liste.push({
                id: [modele.id, pos, hero.cls, prof, board?.tex, turn?.role].filter(Boolean).join("_").toLowerCase(),
                modele: modele.id,
                theme: modele.rue,
                concept: modele.concept,
                label: etiquette(modele, hero, board, turn, prof),
                heroPos: pos, heroCls: hero.cls, heroFam: hero.fam,
                profil: prof, limite,
                texture: board?.tex || null,
                turnRole: turn?.role || null,
                villains,
                spec,
              });
            }
          }
        }
      }
    }
    parModele.set(modele.id, liste);
  }

  const total = [...parModele.values()].reduce((n, l) => n + l.length, 0);
  if (total <= max) return [...parModele.values()].flat();

  // Échantillonnage STRATIFIÉ. Un échantillonnage régulier sur la liste
  // concaténée donnait 169 spots au modèle le plus fourni contre 4 au plus
  // maigre : toute une famille de situations disparaissait du catalogue.
  // On répartit donc le budget par modèle, en redistribuant ce que les petits
  // modèles n'utilisent pas.
  const ids = [...parModele.keys()];
  const quota = new Map(ids.map(id => [id, 0]));
  let reste = max;
  let actifs = ids.filter(id => parModele.get(id).length > 0);
  while (reste > 0 && actifs.length) {
    const part = Math.max(1, Math.floor(reste / actifs.length));
    for (const id of [...actifs]) {
      if (reste <= 0) break;
      const dispo = parModele.get(id).length - quota.get(id);
      const pris = Math.min(part, dispo, reste);
      quota.set(id, quota.get(id) + pris);
      reste -= pris;
      if (quota.get(id) >= parModele.get(id).length) actifs = actifs.filter(x => x !== id);
    }
  }

  const gardes = [];
  for (const id of ids) {
    const liste = parModele.get(id);
    const n = quota.get(id);
    if (!n) continue;
    const pas = liste.length / n;
    for (let i = 0; i < n; i++) gardes.push(liste[Math.floor(i * pas)]);
  }
  return gardes;
}

/** Étiquette lisible, uniquement descriptive — aucun jugement sur le spot. */
function etiquette(modele, hero, board, turn, prof) {
  const p = { nit: "un nit", tag: "un TAG", lag: "un LAG", reg: "un reg", regAgro: "un reg agressif",
    fish: "un fish", station: "une calling station", maniac: "un maniac", rec: "un récréatif" }[prof] || prof;
  if (modele.rue === "preflop") return `${hero.cls} — ${modele.concept} face à ${p}`;
  if (modele.rue === "turn") return `${hero.cls} sur ${board.desc}, ${turn.desc}, face à ${p}`;
  return `${hero.cls} sur board ${board.desc} face à ${p}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spots = genererSpots({ max: Number(process.argv[2] || 400) });
  const parModele = {};
  for (const s of spots) parModele[s.modele] = (parModele[s.modele] || 0) + 1;
  console.log(`${spots.length} spots candidats générés\n`);
  for (const [m, n] of Object.entries(parModele)) console.log(`  ${m.padEnd(24)} ${n}`);
  console.log(`\nExemple :\n\n${spots[0].spec}\n`);
}
