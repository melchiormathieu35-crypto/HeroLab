/**
 * Catalogue de spots candidats pour le contenu court.
 *
 * Chaque entrée est écrite dans le DSL Studio de Hero Lab. Rien n'est décidé
 * ici sur la qualité du spot : c'est le MOTEUR qui tranche, via content/scan.mjs.
 * On propose des situations plausibles ; le moteur dit lesquelles sont
 * réellement contre-intuitives, et avec quels chiffres.
 *
 * C'est le point important du pipeline : on ne fabrique pas une accroche puis
 * on cherche un spot qui la justifie. On mesure d'abord, on raconte ensuite.
 *
 * Grammaire Studio (rappel) :
 *   Hero: POS, Cartes, Nbb
 *   Table: 6-max, NLxx
 *   Villains: POS (profil, Nbb[, Cartes][, "Nom"]), ...
 *   Preflop: <actions>, hero to act
 *   Flop: <3 cartes> | <actions>, hero to act
 *   Turn/River: <1 carte> | <actions>, hero to act
 *   Runout: <cartes qui tombent après la décision>
 *
 * Profils disponibles : voir PROFILES dans index.html.
 */

/** Actions testées à chaque spot ; le moteur les classe par EV. */
export const ACTIONS = ["fold", "call", "raise"];

export const SPOTS = [
  // ─────────────────────────────────────────── river : payer ou passer
  {
    id: "river_bluffcatch_ak",
    theme: "river",
    label: "Top paire, gros sizing river",
    spec: `Hero: BTN, AhKd, 100bb
Table: 6-max, NL50
Villains: UTG (reg, 100bb), BB (fish, 120bb)
Preflop: UTG raise 3bb, hero call, BB call
Flop: Kh 8c 3d | BB check, UTG bet 5bb, hero to act`,
  },
  {
    id: "river_overfold_bb",
    theme: "river",
    label: "Défense de grosse blinde face à un nit",
    spec: `Hero: BB, Qs Jh, 100bb
Table: 6-max, NL25
Villains: CO (nit, 100bb)
Preflop: CO raise 2.5bb, hero call
Flop: Qd 7c 2s | hero check, CO bet 4bb, hero to act`,
  },
  {
    id: "river_second_pair",
    theme: "river",
    label: "Deuxième paire face à une grosse mise",
    spec: `Hero: CO, Jc Jd, 100bb
Table: 6-max, NL50
Villains: BTN (lag, 100bb)
Preflop: hero raise 2.5bb, BTN raise 8bb, hero call
Flop: Ah 9s 4c | hero check, BTN bet 6bb, hero to act`,
  },

  // ─────────────────────────────────────────── préflop : pièges de range
  {
    id: "pre_facing_3bet",
    theme: "preflop",
    label: "Petite paire face à un 3bet",
    spec: `Hero: BTN, 5h5s, 100bb
Table: 6-max, NL25
Villains: SB (reg, 100bb)
Preflop: hero raise 2.5bb, SB raise 11bb, hero to act`,
  },
  {
    id: "pre_utg_suited",
    theme: "preflop",
    label: "Connecteur assorti sous le pistolet",
    spec: `Hero: UTG, 7h6h, 100bb
Table: 6-max, NL10
Villains: BTN (lag, 100bb), BB (fish, 100bb)
Preflop: hero to act`,
  },
  {
    id: "pre_aj_squeeze",
    theme: "preflop",
    label: "AJ face à une ouverture et un call",
    spec: `Hero: BB, Ac Jd, 100bb
Table: 6-max, NL50
Villains: HJ (reg, 100bb), BTN (fish, 140bb)
Preflop: HJ raise 2.5bb, BTN call, hero to act`,
  },

  // ─────────────────────────────────────────── flop : boards piégeux
  {
    id: "flop_monotone_overpair",
    theme: "flop",
    label: "Overpaire sur board monotone",
    spec: `Hero: HJ, Qh Qs, 100bb
Table: 6-max, NL50
Villains: BB (reg, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: Jd 7d 3d | BB check, hero to act`,
  },
  {
    id: "flop_paired_board",
    theme: "flop",
    label: "As-roi sur board pairé",
    spec: `Hero: CO, Ad Kc, 100bb
Table: 6-max, NL25
Villains: BB (station, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: 8h 8s 4c | BB check, hero to act`,
  },
  {
    id: "flop_set_wet",
    theme: "flop",
    label: "Brelan sur board très connecté",
    spec: `Hero: BTN, 6c6d, 100bb
Table: 6-max, NL50
Villains: BB (lag, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: 6h 7s 8s | BB bet 5bb, hero to act`,
  },

  // ─────────────────────────────────────────── turn : le tournant
  {
    id: "turn_draw_price",
    theme: "turn",
    label: "Tirage couleur au turn face à une grosse mise",
    spec: `Hero: BB, Ah 5h, 100bb
Table: 6-max, NL25
Villains: BTN (reg, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: Kh 9h 2c | hero check, BTN bet 4bb, hero call
Turn: 3s | hero check, BTN bet 12bb, hero to act`,
  },
  {
    id: "turn_thin_value",
    theme: "turn",
    label: "Valeur fine contre un joueur passif",
    spec: `Hero: CO, Ks Qc, 100bb
Table: 6-max, NL50
Villains: BB (station, 120bb)
Preflop: hero raise 2.5bb, BB call
Flop: Qd 8h 3c | BB check, hero bet 3bb, BB call
Turn: 2s | BB check, hero to act`,
  },
  {
    id: "turn_overcard",
    theme: "turn",
    label: "Une carte haute tombe au turn",
    spec: `Hero: BTN, Tc Td, 100bb
Table: 6-max, NL25
Villains: BB (reg, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: 7h 5c 2d | BB check, hero bet 3bb, BB call
Turn: Ah | BB bet 9bb, hero to act`,
  },
];

/** Séries éditoriales : regroupent les spots par angle narratif. */
export const SERIES = {
  "tu-fais-quoi": {
    title: "Tu fais quoi ici ?",
    angle: "Le spectateur décide avant le reveal. Format quiz pur.",
    themes: ["river", "flop", "turn", "preflop"],
  },
  "paradoxe": {
    title: "Ça semble évident. Ça ne l'est pas.",
    angle: "Un chiffre rassurant (équité, top paire) contredit par le verdict.",
    themes: ["river", "flop", "turn"],
  },
  "cout-reel": {
    title: "Ce spot te coûte des bb",
    angle: "L'erreur est chiffrée. Le montant est le hook.",
    themes: ["river", "turn", "preflop"],
  },
};
