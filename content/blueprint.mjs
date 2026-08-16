/**
 * Blueprint vidéo — traduit un spot noté en plan de tournage.
 *
 * C'est la pièce qui sépare « faire des rushs » d'« avoir une chaîne de
 * production » : le producteur n'écrit plus une séquence en dur, il exécute un
 * blueprint. Changer la narration ne demande donc plus de toucher au moteur de
 * rendu, et un spot qui n'a pas de board n'a pas à subir des plans qui
 * supposent un board.
 *
 * Structure par défaut, adaptable :
 *
 *   HOOK        montrer le problème avant de l'expliquer
 *   SITUATION   donner le contexte lisible
 *   TENSION     poser la question, laisser le spectateur décider
 *   CHOICE      les options réelles, avec leurs montants
 *   REVEAL      la décision instinctive est jouée, le moteur tranche
 *   PAYOFF      l'espérance de chaque option — la preuve
 *
 * RÈGLE APPLIQUÉE ICI : aucun mouvement décoratif. Chaque geste de caméra porte
 * un champ `pourquoi`, et ce champ est repris tel quel dans le README. Un
 * mouvement qu'on ne sait pas justifier n'est pas écrit.
 *
 * Vocabulaire de mouvement exécuté par produce.mjs :
 *
 *   cadre    place une cible dans la bande utile, sans mouvement
 *   fixe     plan arrêté d'une durée donnée
 *   zoomIn   rapprochement — attirer l'œil sur un détail décisif
 *   zoomOut  éloignement — rendre le contexte après un détail
 *   pan      déplacement vertical vers une cible
 *   panPx    déplacement d'une distance mesurée
 *   jouer    joue l'action instinctive et bascule l'écran en analyse
 *   freeze   arrêt franc après un mouvement, pour laisser lire
 */
import { ANCHORS } from "./studio.mjs";

/** Noms de fichiers imposés par la convention de livraison. */
export const CONVENTION = ["01-hook", "02-situation", "03-tension", "04-choice", "05-reveal", "06-payoff"];

const bb = (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)} bb`;

/**
 * Construit le blueprint d'un spot noté.
 *
 * `note` est la sortie du scanner : elle contient les chiffres du moteur, donc
 * tout ce qui suit est dérivé et non inventé.
 */
export function blueprint(spot, note, { index = 1 } = {}) {
  const preflop = note.street === "preflop";
  const meilleurEstPassif = note.famBest === "fold" || note.famBest === "check";
  const instinctEv = note.optInstinct ? note.optInstinct.evBB : null;

  /** Concept : la phrase que la vidéo doit faire comprendre, sans la dire. */
  const concept = meilleurEstPassif
    ? `Une main qui semble jouable ne l'est pas : ${note.instinct === "call" ? "payer" : "checker"} coûte ${bb(instinctEv ?? 0)}, alors que ${note.best.label.toLowerCase()} est la bonne réponse.`
    : `Le réflexe (${note.instinct === "call" ? "payer" : "checker"}) coûte ${bb(instinctEv ?? 0)} ; la bonne réponse est ${note.best.label.toLowerCase()}, à ${bb(note.best.evBB)}.`;

  const plans = [];

  // ── 01 HOOK — la main seule, resserrée. Aucun contexte : on montre le
  // problème avant de l'expliquer, et on tient les deux premières secondes.
  plans.push({
    fichier: "01-hook",
    beat: "HOOK",
    role: "Montrer la main sans son contexte. C'est le plan qui doit retenir dans les deux premières secondes.",
    mouvements: [
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.5 },
      {
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: 1.45, duree: 0.8,
        pourquoi: "Resserrer sur les cartes isole la seule information utile à cet instant et coupe court à la lecture du reste de l'écran.",
      },
      // Contrôle APRÈS le mouvement : c'est l'image tenue que le spectateur lit.
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 1.5 },
    ],
  });

  // ── 02 SITUATION — le contexte, lisible, fixe. Adapté : sans board, on cadre
  // la table entière ; avec board, on resserre ensuite sur le centre.
  const mouvementsSituation = [
    { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
    { type: "controle", cible: ANCHORS.table, texte: preflop ? ".pot" : ".board" },
    { type: "fixe", duree: preflop ? 2.6 : 1.4 },
  ];
  if (!preflop) {
    mouvementsSituation.push({
      type: "zoomIn", cible: ".center", de: 1, a: 1.3, duree: 0.8,
      pourquoi: "Le board est ce qui rend la décision difficile : le rapprochement dit au spectateur où regarder avant qu'on lui pose la question.",
    });
    mouvementsSituation.push({ type: "controle", cible: ".center", texte: ".board" });
    mouvementsSituation.push({ type: "fixe", duree: 1.4 });
    mouvementsSituation.push({
      type: "zoomOut", cible: ".center", de: 1.3, a: 1, duree: 0.6,
      pourquoi: "Rendre le contexte après le détail : le spectateur doit relier le board aux tapis et au pot pour juger.",
    });
    mouvementsSituation.push({ type: "fixe", duree: 0.9 });
  }
  plans.push({
    fichier: "02-situation",
    beat: "SITUATION",
    role: preflop
      ? "Poser la table : position, adversaire, montant à payer."
      : "Poser la table puis désigner le board, qui est le cœur du problème.",
    mouvements: mouvementsSituation,
  });

  // ── 03 TENSION — la donnée qui contredit l'instinct, tenue à l'écran.
  // On montre le montant à payer (ou la main faite) et on s'arrête dessus.
  const cibleTension = note.toCall > 0 ? ".hero-hand" : ANCHORS.table;
  plans.push({
    fichier: "03-tension",
    beat: "TENSION",
    role: note.toCall > 0
      ? "Isoler le montant à payer : c'est lui qui rend la décision coûteuse."
      : "Isoler la main faite : c'est elle qui donne une fausse assurance.",
    mouvements: [
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.5 },
      {
        // Un zoom serait ici destructeur : ce bloc fait 332 px pour un cadre de
        // 360, donc l'agrandir couperait les montants aux deux bords. Le
        // mouvement se fait par déplacement, qui ne rogne rien.
        type: "pan", cible: cibleTension, duree: 0.8, at: 0.36,
        pourquoi: note.toCall > 0
          ? "Descendre sur la ligne du montant à payer conduit l'œil vers la donnée que le spectateur oublie de regarder : c'est elle qui rend la décision coûteuse."
          : "Descendre sur la main faite installe la confiance que le verdict viendra contredire.",
      },
      { type: "controle", cible: cibleTension, texte: ".val" },
      {
        type: "freeze", duree: 1.9,
        pourquoi: "L'arrêt franc laisse le temps de se forger un avis — sans ce temps mort, il n'y a pas de participation, donc pas de rétention.",
      },
    ],
  });

  // ── 04 CHOICE — les options réelles, avec leurs montants. Le regard descend
  // de la table vers les boutons : c'est le mouvement du joueur qui décide.
  plans.push({
    fichier: "04-choice",
    beat: "CHOICE",
    role: "Présenter les options légales et leurs montants exacts. C'est ici que le spectateur choisit.",
    mouvements: [
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.7 },
      {
        type: "pan", cible: ".actions", duree: 0.9, at: 0.16, align: "top",
        pourquoi: "Descendre de la table vers les boutons reproduit le geste réel du joueur : le mouvement raconte le passage de l'observation à la décision.",
      },
      { type: "controle", cible: ".actions", texte: ".a-n" },
      {
        type: "fixe", duree: 2.5,
        pourquoi: "Temps de lecture des options. Couper ici ferait perdre l'engagement que tout le plan sert à créer.",
      },
    ],
  });

  // ── 05 REVEAL — on joue l'action instinctive, parce que c'est elle qui porte
  // la leçon, et le moteur tranche.
  plans.push({
    fichier: "05-reveal",
    beat: "REVEAL",
    role: `Jouer l'action instinctive (${note.instinct}) et afficher le verdict du moteur avec son coût.`,
    reveal: true,
    mouvements: [
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.6 },
      {
        type: "jouer", quoi: "instinct",
        pourquoi: "La décision est jouée à l'écran, pas racontée : le verdict vient du moteur, ce qui rend la révélation vérifiable.",
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.85, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict fait presque la hauteur de la bande utile ; on le cale en haut pour que le titre et le coût entrent dans le cadre.",
      },
      {
        type: "zoomIn", cible: ".vh", de: 1, a: 1.12, duree: 0.5,
        pourquoi: "Le resserrement final accompagne la révélation : le coût chiffré est le point de bascule de la vidéo.",
      },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 2.4 },
    ],
  });

  // ── 06 PAYOFF — l'espérance de chaque option. C'est ce plan qui rend le
  // propos vérifiable plutôt qu'affirmé.
  plans.push({
    fichier: "06-payoff",
    beat: "PAYOFF",
    role: "Montrer l'espérance de chaque option, en big blinds. C'est la preuve, et ce qui distingue la vidéo d'un simple quiz.",
    reveal: true,
    mouvements: [
      { type: "jouer", quoi: "instinct", silencieux: true },
      { type: "cadre", cible: ANCHORS.evList, at: 0.26, align: "top" },
      { type: "controle", cible: ANCHORS.evList, texte: ".ev" },
      {
        type: "fixe", duree: 1.5,
        pourquoi: "La meilleure option est lue en premier : elle donne la réponse avant de montrer ce que l'erreur coûte.",
      },
      {
        type: "panPx", mesure: ".opt-row", duree: 1.4,
        pourquoi: "La descente le long de la liste fait parcourir l'écart du meilleur au pire coup — le classement se lit comme une chute, ce qui est exactement le propos.",
      },
      { type: "fixe", duree: 1.6 },
    ],
  });

  return {
    index,
    titre: `Video ${String(index).padStart(3, "0")}`,
    titreInterne: spot.label,
    concept,
    spot: spot.id,
    modele: spot.modele,
    signature: spot.signature,
    score: note.score,
    objectifRetention:
      "Retenir par la contradiction : le spectateur croit connaître la réponse au plan 1, choisit au plan 4, et découvre au plan 5 que son réflexe est chiffré comme une perte. Le plan 6 empêche le doute en montrant le calcul.",
    momentReveal: "Plan 05-reveal, à l'affichage du verdict après l'action jouée.",
    plans,
  };
}
