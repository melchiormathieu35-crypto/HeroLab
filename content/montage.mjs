/**
 * Montage — vidéos courtes assemblées, prêtes à recevoir voix et sous-titres.
 *
 * `produce.mjs` livre des rushs : un beat = un fichier, à assembler. Ce module
 * livre l'étape d'après — UN SEUL fichier par vidéo, de 30 s à 1 min, monté,
 * dans lequel il ne reste qu'à poser la voix off et les sous-titres.
 *
 * POURQUOI UN RENDU CONTINU PLUTÔT QU'UNE CONCATÉNATION
 * Le ffmpeg de l'environnement est compilé `--disable-everything` : ses seuls
 * démultiplexeurs sont `image2pipe` et `matroska,webm`. Il n'a donc NI le
 * démultiplexeur `concat`, NI le filtre `concat`, et ne peut pas recoller six
 * WebM existants. Plutôt que de contourner par un réencodage bancal, la vidéo
 * est tournée d'une traite : une page, un encodeur, les beats à la suite. Effet
 * secondaire heureux — la continuité est réelle, la décision est jouée une seule
 * fois au REVEAL et le PAYOFF poursuit sur le même écran, donc l'enchaînement
 * n'a plus rien d'un collage.
 *
 * Les coupes entre beats sont franches (mouvement `coupe`) : aucun fondu, aucune
 * transition décorative. Le montage reste lisible et les points de coupe sont
 * identifiables au timecode dans le README.
 *
 * CE QUI N'EST PAS FAIT ICI, VOLONTAIREMENT : voix off, sous-titres, textes
 * incrustés définitifs. Le README donne les timecodes et les chiffres exacts.
 */
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openShot, loadSpot, ANCHORS } from "./studio.mjs";
import { Encodeur, executer, ffmpegPath, FPS } from "./produce.mjs";
import { genererSpots } from "./generate.mjs";
import { noter, signature } from "./scan.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Racine du format court. Les vidéos montées sont rangées PAR CONCEPT. */
export const COURT_DIR = join(ROOT, "Format court");

/**
 * Concepts de format court.
 *
 * Un concept est une forme narrative, pas un thème de poker : c'est ce qui
 * détermine la structure de la vidéo. Un seul est actif pour l'instant, à la
 * demande — les autres seront ajoutés ici quand ils seront décidés, sans
 * toucher au rendu.
 */
export const CONCEPTS = {
  quizz: {
    dossier: "Quizz",
    titre: "Quizz",
    principe:
      "Le spectateur est mis en situation, voit les options réelles, doit choisir, " +
      "puis le moteur tranche et chiffre ce que son réflexe coûte.",
  },
};

/** Fourchette de durée imposée pour une vidéo montée, en secondes. */
export const DUREE_CIBLE = { min: 30, max: 60 };

/** Nom de fichier de la vidéo montée, identique dans chaque dossier. */
export const FICHIER = "video.webm";

const bb = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)} bb`;

/** Nom de dossier lisible et portable : sans accent, sans ponctuation exotique. */
export function slug(texte, max = 58) {
  const s = texte
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ");
  return (s.length > max ? s.slice(0, max).replace(/\s\S*$/, "") : s);
}

/**
 * Plan de tournage d'une vidéo montée.
 *
 * Même charpente narrative que le blueprint des rushs — c'est elle qui a été
 * notée et contrôlée — mais adaptée au rendu continu :
 *
 *   · une coupe explicite ouvre chaque beat, sinon l'échelle du beat précédent
 *     déborderait sur le suivant ;
 *   · la décision n'est jouée QU'UNE FOIS, au REVEAL ; le PAYOFF enchaîne sur
 *     le même écran au lieu de rejouer le coup ;
 *   · les temps de pose sont allongés. Les rushs tenaient en 24 s parce qu'ils
 *     étaient faits pour être coupés au montage ; une vidéo finie doit laisser
 *     le temps de lire, et surtout le temps de CHOISIR — c'est tout le concept
 *     du quizz. Le total visé est de 32 à 36 s.
 *
 * Chaque mouvement de caméra porte son `pourquoi`, repris tel quel dans le
 * README. Aucun mouvement n'est là pour faire joli.
 */
export function montageBlueprint(spot, note, { index = 1, concept = "quizz" } = {}) {
  const preflop = note.street === "preflop";
  const meilleurEstPassif = note.famBest === "fold" || note.famBest === "check";
  const instinctEv = note.optInstinct ? note.optInstinct.evBB : null;
  const reflexe = note.instinct === "call" ? "payer" : "checker";

  const enonce = meilleurEstPassif
    ? `Une main qui semble jouable ne l'est pas : ${reflexe} coûte ${bb(instinctEv ?? 0)}, alors que ${note.best.label.toLowerCase()} est la bonne réponse.`
    : `Le réflexe (${reflexe}) coûte ${bb(instinctEv ?? 0)} ; la bonne réponse est ${note.best.label.toLowerCase()}, à ${bb(note.best.evBB)}.`;

  const beats = [];

  // ── HOOK — la main seule. Aucun contexte : montrer le problème avant de
  // l'expliquer, et tenir les deux premières secondes.
  beats.push({
    beat: "HOOK",
    role: "Montrer la main sans son contexte. C'est ce plan qui doit retenir dans les deux premières secondes.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.6 },
      {
        // `max` et non une valeur choisie : voir la garde de rognage dans
        // produce.mjs. Un ×1,45 sur ces deux cartes agrandissait toute la page
        // autour d'elles et affichait « 7.5 bb » au lieu de « 97.5 bb ». La
        // mise en page mobile de Hero Lab occupant toute la largeur, le
        // rapprochement maximal sans rien couper est de l'ordre de 1,08 : c'est
        // peu, mais c'est un mouvement réel et il ne ment sur aucun chiffre.
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: "max", duree: 0.9,
        pourquoi: "Resserrer sur les cartes conduit l'œil vers la seule information utile à cet instant, sans jamais rogner un montant.",
      },
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 2.2 },
    ],
  });

  // ── SITUATION — le contexte, lisible. Sans board, la table suffit ; avec
  // board, on désigne le centre parce que c'est lui qui pose le problème.
  const situation = [
    { type: "coupe" },
    { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
    { type: "controle", cible: ANCHORS.table, texte: preflop ? ".pot" : ".board" },
    // Préflop, la SITUATION n'a pas de mouvement vers le board : tout le temps
    // du beat est du temps de lecture. 6 s et non 4,5 : c'est la fenêtre qu'il
    // faut pour DIRE la situation au débit d'une voix off — mesuré par le
    // générateur de script, qui refuse une ligne trop longue pour son beat.
    { type: "fixe", duree: preflop ? 6.0 : 2.0 },
  ];
  if (!preflop) {
    // DÉPLACEMENT ET NON ZOOM. Un ×1,3 sur le centre de la table coupait les
    // deux colonnes de vilains et tronquait le tapis du héros — vérifié à
    // l'image. Le déplacement obtient le même effet narratif (dire où regarder)
    // sans jamais rogner : c'est le cadrage qui isole, pas l'agrandissement.
    situation.push(
      {
        type: "pan", cible: ".center", duree: 0.9, at: 0.42,
        pourquoi: "Le board est ce qui rend la décision difficile : amener le centre de la table au centre du cadre dit où regarder avant qu'on pose la question.",
      },
      { type: "controle", cible: ".center", texte: ".board" },
      { type: "fixe", duree: 2.0 },
      {
        type: "pan", cible: ANCHORS.table, duree: 0.7, at: 0.22, align: "top",
        pourquoi: "Rendre le contexte après le détail : le spectateur doit relier le board aux tapis et au pot pour juger.",
      },
      { type: "fixe", duree: 1.4 },
    );
  }
  beats.push({
    beat: "SITUATION",
    role: preflop
      ? "Poser la table : position, adversaire, montant à payer."
      : "Poser la table puis désigner le board, qui est le cœur du problème.",
    mouvements: situation,
  });

  // ── TENSION — la donnée qui contredit l'instinct, tenue à l'écran.
  const cibleTension = note.toCall > 0 ? ".hero-hand" : ANCHORS.table;
  beats.push({
    beat: "TENSION",
    role: note.toCall > 0
      ? "Isoler le montant à payer : c'est lui qui rend la décision coûteuse."
      : "Isoler la main faite : c'est elle qui donne une fausse assurance.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.7 },
      {
        // Un zoom serait destructeur ici : ce bloc fait 332 px pour un cadre de
        // 360, l'agrandir couperait les montants aux deux bords. Le mouvement se
        // fait donc par déplacement, qui ne rogne rien.
        type: "pan", cible: cibleTension, duree: 0.9, at: 0.36,
        pourquoi: note.toCall > 0
          ? "Descendre sur la ligne du montant à payer conduit l'œil vers la donnée que le spectateur oublie de regarder : c'est elle qui rend la décision coûteuse."
          : "Descendre sur la main faite installe la confiance que le verdict viendra contredire.",
      },
      { type: "controle", cible: cibleTension, texte: ".val" },
      {
        type: "freeze", duree: 3.0,
        pourquoi: "L'arrêt franc laisse le temps de se forger un avis. Sans ce temps mort il n'y a pas de participation, donc pas de rétention.",
      },
    ],
  });

  // ── CHOICE — les options réelles et leurs montants. C'est LE beat du quizz :
  // le temps de pose y est le plus long de la vidéo, parce que c'est le seul
  // moment où le spectateur a quelque chose à faire.
  beats.push({
    beat: "CHOICE",
    role: "Présenter les options légales et leurs montants exacts. C'est ici que le spectateur choisit — le temps de pose est dimensionné pour ça.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.9 },
      {
        type: "pan", cible: ".actions", duree: 1.0, at: 0.16, align: "top",
        pourquoi: "Descendre de la table vers les boutons reproduit le geste réel du joueur : le mouvement raconte le passage de l'observation à la décision.",
      },
      { type: "controle", cible: ".actions", texte: ".a-n" },
      {
        type: "fixe", duree: 5.0,
        pourquoi: "Temps de choix. Cinq secondes sur les options est la seule durée de la vidéo qui n'est pas dictée par la lecture mais par la décision : c'est la fenêtre où poser un compte à rebours si tu en veux un.",
      },
    ],
  });

  // ── REVEAL — l'action instinctive est jouée à l'écran, le moteur tranche.
  beats.push({
    beat: "REVEAL",
    role: `Jouer l'action instinctive (${note.instinct}) et afficher le verdict du moteur avec son coût.`,
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.8 },
      {
        type: "jouer", quoi: "instinct",
        pourquoi: "La décision est jouée à l'écran, pas racontée : le verdict vient du moteur, ce qui rend la révélation vérifiable.",
      },
      { type: "fixe", duree: 0.5 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.9, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict fait presque la hauteur de la bande utile ; on le cale en haut pour que le titre et le coût entrent dans le cadre.",
      },
      {
        // Là aussi borné par la page : le bloc verdict occupe toute la largeur,
        // donc le resserrement est faible par construction.
        type: "zoomIn", cible: ".vh", de: 1, a: "max", duree: 0.5,
        pourquoi: "Le resserrement final accompagne la révélation : le coût chiffré est le point de bascule de la vidéo.",
      },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 3.2 },
    ],
  });

  // ── PAYOFF — l'espérance de chaque option. Aucun `jouer` ici : en rendu
  // continu la décision a déjà été prise au beat précédent, et c'est le même
  // écran qui continue. C'est ce plan qui rend le propos vérifiable.
  beats.push({
    beat: "PAYOFF",
    role: "Montrer l'espérance de chaque option, en big blinds. C'est la preuve, et ce qui distingue la vidéo d'un simple quiz.",
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.evList, at: 0.26, align: "top" },
      { type: "controle", cible: ANCHORS.evList, texte: ".ev" },
      {
        type: "fixe", duree: 2.0,
        pourquoi: "La meilleure option est lue en premier : elle donne la réponse avant de montrer ce que l'erreur coûte.",
      },
      {
        type: "panPx", mesure: ".opt-row", duree: 1.6,
        pourquoi: "La descente le long de la liste fait parcourir l'écart du meilleur au pire coup — le classement se lit comme une chute, ce qui est exactement le propos.",
      },
      {
        type: "fixe", duree: 2.6,
        pourquoi: "Dernière image tenue : la vidéo se termine sur la preuve, pas sur un mouvement.",
      },
    ],
  });

  const dureePrevue = beats.reduce(
    (n, b) => n + b.mouvements.reduce((m, x) => m + (x.duree || 0), 0), 0);

  return {
    index, concept,
    titre: `${String(index).padStart(2, "0")} - ${slug(spot.label)}`,
    titreInterne: spot.label,
    enonce,
    spot: spot.id,
    modele: spot.modele,
    signature: spot.signature || signature(spot, note),
    score: note.score,
    dureePrevue: Math.round(dureePrevue * 100) / 100,
    momentReveal: "Beat REVEAL, à l'affichage du verdict après l'action jouée.",
    objectifRetention:
      "Retenir par la contradiction : le spectateur croit connaître la réponse au HOOK, choisit au CHOICE, " +
      "et découvre au REVEAL que son réflexe est chiffré comme une perte. Le PAYOFF empêche le doute en montrant le calcul.",
    beats,
  };
}

/**
 * Tourne la vidéo montée : une page, un encodeur, les beats à la suite.
 *
 * Le découpage en beats est conservé dans le manifeste avec ses timecodes
 * réels — mesurés au compteur d'images de l'encodeur, donc exacts et non
 * estimés. C'est ce qui permet de poser voix et sous-titres sans compter à la
 * main.
 */
export async function produireMontage(browser, ff, spot, bp, dossier) {
  await mkdir(dossier, { recursive: true });
  const fichier = join(dossier, FICHIER);
  const { ctx, page, errors } = await openShot(browser);
  const enc = new Encodeur(ff, fichier);
  const etat = { scrollY: 0, scale: 1, origin: null, cadrages: [], bornages: [] };

  const timeline = [];
  let moteur = null, echec = null;

  try {
    const built = await loadSpot(page, spot.spec);
    if (!built.ok) throw new Error(built.err);
    // Studio joue en fantôme : une prise ne doit jamais toucher la vraie
    // progression du joueur. Vérifié à chaque tournage plutôt que supposé.
    if (!built.ghost) throw new Error("spot non fantôme");

    for (const b of bp.beats) {
      const debut = enc.frames;
      etat.cadrages = [];
      for (const m of b.mouvements) {
        const r = await executer(page, enc, m, etat);
        if (r) moteur = r;
      }
      const cadrages = etat.cadrages.slice();
      timeline.push({
        beat: b.beat,
        role: b.role,
        debut: Math.round((debut / FPS) * 100) / 100,
        fin: Math.round((enc.frames / FPS) * 100) / 100,
        secondes: Math.round(((enc.frames - debut) / FPS) * 100) / 100,
        mouvements: b.mouvements
          .filter(m => m.pourquoi)
          .map(m => ({ type: m.type, cible: m.cible || m.mesure || null, duree: m.duree ?? null, pourquoi: m.pourquoi })),
        cadrages,
        cadrage: cadrages.find(c => !c.ok) || cadrages[0] || null,
      });
    }
  } catch (e) { echec = e.message; }

  const fin = await enc.close();
  await ctx.close();

  const fatals = errors.filter(e => !/favicon|net::ERR_FILE_NOT_FOUND/i.test(e));
  if (echec) return { ok: false, why: echec, dossier };
  if (fin.code !== 0) return { ok: false, why: `ffmpeg a échoué : ${fin.err.slice(0, 160)}`, dossier };

  const manifest = {
    video: bp.titre,
    concept: bp.concept,
    conceptTitre: CONCEPTS[bp.concept]?.titre || bp.concept,
    titreInterne: bp.titreInterne,
    enonce: bp.enonce,
    fichier: FICHIER,
    montee: true,
    spot: { id: spot.id, modele: spot.modele, theme: spot.theme, label: spot.label, spec: spot.spec },
    score: bp.score,
    scoreDetail: spot.details || null,
    signature: bp.signature,
    momentReveal: bp.momentReveal,
    objectifRetention: bp.objectifRetention,
    format: { largeur: 1080, hauteur: 1920, fps: FPS, conteneur: "webm", codec: "vp8" },
    duree: Math.round(fin.seconds * 100) / 100,
    images: fin.frames,
    moteur,
    timeline,
    bornages: etat.bornages,
    erreurs: fatals,
  };
  await writeFile(join(dossier, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { ok: true, dossier, fichier, manifest, bp, spot, moteur, seconds: fin.seconds };
}

/**
 * Retrouve un spot par son identifiant, dans le catalogue COMPLET.
 *
 * `genererSpots` est déterministe et sans aléatoire, mais son paramètre `max`
 * n'est pas un simple plafond : au-delà du seuil il échantillonne de façon
 * stratifiée, si bien que deux budgets différents ne donnent pas des listes
 * emboîtées. Chercher un identifiant dans un catalogue échantillonné revient
 * donc à demander si ce spot a survécu à CE tirage — ce qui a réellement fait
 * échouer neuf recherches sur dix ici, les rushs ayant été tournés avec un autre
 * budget d'exploration.
 *
 * L'échantillonnage ne sert qu'à borner le coût du scan, jamais l'identité :
 * on énumère donc l'espace entier (≈ 12 000 combinaisons, du JavaScript pur,
 * sans navigateur) et la recherche est exacte quel que soit le budget qui a
 * produit l'identifiant.
 */
export const CATALOGUE_COMPLET = 1e6;

export function spotParId(id, { budget = CATALOGUE_COMPLET } = {}) {
  return genererSpots({ max: budget }).find(s => s.id === id) || null;
}

/** Numéro libre suivant dans un dossier de concept. */
export async function prochainNumero(dossierConcept) {
  let max = 0;
  try {
    for (const d of await readdir(dossierConcept, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const n = /^(\d+)\s*-/.exec(d.name);
      if (n) max = Math.max(max, Number(n[1]));
    }
  } catch { /* dossier pas encore créé */ }
  return max + 1;
}

/**
 * Nombre de spots frères par modèle, sur le catalogue complet.
 *
 * `noter` s'en sert pour le critère « potentiel de série ». Sans cette mesure le
 * score d'une vidéo montée ne serait pas comparable à celui du même spot noté
 * lors du scan complet — le chiffre affiché ne voudrait plus rien dire.
 */
export function freresParModele({ budget = CATALOGUE_COMPLET } = {}) {
  const f = {};
  for (const s of genererSpots({ max: budget })) f[s.modele] = (f[s.modele] || 0) + 1;
  return f;
}

/** Évalue un spot dans la page et le note, sans rien inventer. */
export async function evaluerEtNoter(page, spot, contexte = {}) {
  const built = await loadSpot(page, spot.spec);
  if (!built.ok) throw new Error(`spot non chargeable (${spot.id}) : ${built.err}`);
  const r = await page.evaluate(() => {
    const t = App.t;
    const opts = Spot.options(t);
    if (!opts.length) return null;
    const a = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    if (!a || !a.options || !a.options.length) return null;
    return {
      equity: a.equity, toCall: a.toCall, pot: a.pot, bb: t.bb, street: t.street,
      nOpp: (a.opps || []).length, oppRangePct: a.oppRangePct ?? null,
      made: a.made ? { label: a.made.label ?? null, topPair: !!a.made.topPair, draw: !!a.made.draw, rank: a.made.rank ?? null } : null,
      options: a.options.map(o => ({ action: o.action, label: o.label || o.action, amount: o.amount, evBB: o.evBB, detail: o.detail || null })),
      best: { action: a.best.action, label: a.best.label || a.best.action, evBB: a.best.evBB },
    };
  });
  if (!r) throw new Error(`options indisponibles pour ${spot.id}`);
  const note = noter(r, spot, contexte);
  return { ...spot, ...note, signature: signature(spot, note) };
}

/**
 * Choisit les spots à monter.
 *
 * Par défaut on repart du classement des rushs : ces spots ont déjà traversé
 * l'exploration, le barème, les gardes de fragilité et l'anti-redondance. Les
 * re-sélectionner reviendrait à refaire 800 évaluations pour retomber sur les
 * mêmes — le classement est déterministe. On applique en revanche le même
 * plafond de diversité : à deux vidéos, deux modèles de situation différents,
 * sinon on livrerait deux fois la même leçon en habits différents.
 */
export async function choisirSpots({ combien = 2, ids = null, exclure = new Set(), budget = CATALOGUE_COMPLET } = {}) {
  if (ids && ids.length) {
    return ids.map(id => {
      const s = spotParId(id, { budget });
      if (!s) throw new Error(`spot inconnu dans le catalogue : ${id}`);
      return s;
    });
  }

  const classement = JSON.parse(
    await readFile(join(ROOT, "Format court", "Rush avant montage", "classement.json"), "utf8"));
  const manifests = [];
  for (const c of classement) {
    const m = JSON.parse(await readFile(join(ROOT, c.dossier, "manifest.json"), "utf8"));
    if (!exclure.has(m.spot.id)) manifests.push(m);
  }

  const plafondModele = Math.max(1, Math.ceil(combien / 3));
  const parModele = new Map();
  const choisis = [];
  for (const m of manifests) {
    if (choisis.length >= combien) break;
    const n = parModele.get(m.spot.modele) || 0;
    if (n >= plafondModele) continue;
    const spot = spotParId(m.spot.id, { budget });
    if (!spot) continue;
    parModele.set(m.spot.modele, n + 1);
    choisis.push(spot);
  }
  // Si le plafond de diversité empêche d'atteindre le compte, on complète avec
  // les meilleurs restants plutôt que de livrer moins que demandé.
  if (choisis.length < combien) {
    for (const m of manifests) {
      if (choisis.length >= combien) break;
      if (choisis.some(s => s.id === m.spot.id)) continue;
      const spot = spotParId(m.spot.id, { budget });
      if (spot) choisis.push(spot);
    }
  }
  return choisis;
}

export async function monter({ concept = "quizz", combien = 2, ids = null, verbeux = true } = {}) {
  const def = CONCEPTS[concept];
  if (!def) throw new Error(`concept inconnu : ${concept} (disponibles : ${Object.keys(CONCEPTS).join(", ")})`);
  const log = (s) => { if (verbeux) console.log(s); };

  const dossierConcept = join(COURT_DIR, def.dossier);

  // Anti-redondance du concept : un spot déjà monté dans ce dossier ne doit
  // jamais être repris — sans cette mémoire, « les N meilleurs du classement »
  // rendrait les mêmes vidéos à chaque exécution.
  const dejaMontes = new Set();
  try {
    for (const d of await readdir(dossierConcept, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const mf = join(dossierConcept, d.name, "manifest.json");
      try { dejaMontes.add(JSON.parse(await readFile(mf, "utf8")).spot.id); } catch { /* dossier sans manifeste */ }
    }
  } catch { /* premier passage : pas encore de dossier */ }

  const spots = await choisirSpots({ combien, ids, exclure: dejaMontes });
  if (spots.length < combien) log(`\n⚠ ${spots.length} spot(s) disponibles pour ${combien} demandés.`);
  log(`\nConcept « ${def.titre} » — ${spots.length} vidéo(s) à monter\n`);

  const freres = freresParModele();
  const ff = await ffmpegPath();
  const browser = await launch();
  let numero = await prochainNumero(dossierConcept);

  // Notation dans une page dédiée : le tournage ouvre la sienne, et mélanger
  // les deux ferait porter l'évaluation sur un écran déjà en cours de plan.
  const { ctx, page } = await openShot(browser);
  const notes = [];
  for (const spot of spots) notes.push(await evaluerEtNoter(page, spot, { freresDuModele: freres[spot.modele] }));
  await ctx.close();

  const produits = [];
  for (const note of notes) {
    const bp = montageBlueprint(note, note, { index: numero, concept });
    const dossier = join(dossierConcept, bp.titre);
    process.stdout.write(`  ▶ ${bp.titre.padEnd(64)}`);
    const t0 = Date.now();
    const r = await produireMontage(browser, ff, note, bp, dossier);
    if (!r.ok) { console.log(` ✗ ${r.why}`); continue; }
    console.log(` ${r.seconds.toFixed(1)}s · prévu ${bp.dureePrevue.toFixed(1)}s · rendu en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    produits.push(r);
    numero++;
  }

  await browser.close();
  return { produits, dossierConcept, def };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const concept = arg("--concept", "quizz");
  const combien = Number(arg("--count", "2"));
  const ids = arg("--spots", null) ? arg("--spots").split(",").map(s => s.trim()) : null;

  const { produits, dossierConcept, def } = await monter({ concept, combien, ids });
  if (!produits.length) { console.error("aucune vidéo produite"); process.exitCode = 1; }
  else {
    const { qaMontage } = await import("./qa.mjs");
    const { readmeMontage, readmeConcept } = await import("./readme.mjs");
    const { ecrireScripts } = await import("./script.mjs");

    console.log(`\nContrôle qualité…`);
    const rapport = await qaMontage({ dossiers: produits.map(p => p.dossier), duree: DUREE_CIBLE });
    let anomalies = 0;
    for (const v of rapport) {
      const ko = v.controles.filter(c => !c.ok);
      anomalies += ko.length;
      console.log(`  ${v.ok ? "✓" : "✗"} ${v.video.padEnd(64)} ${v.duree ? v.duree.toFixed(1) + "s" : ""}`);
      for (const c of ko) console.log(`       ✗ ${c.nom} : ${c.why}`);
    }

    for (const p of produits) {
      const m = JSON.parse(await readFile(join(p.dossier, "manifest.json"), "utf8"));
      const q = rapport.find(v => v.dossier === p.dossier) || null;
      await writeFile(join(p.dossier, "README.md"), readmeMontage(m, q));
    }
    // L'index du concept liste le DOSSIER ENTIER, pas la dernière exécution :
    // ne passer que les manifestes du lot écrasait les lignes des vidéos
    // précédentes — constaté sur le lot de 8, qui avait fait disparaître les
    // deux premières de l'index.
    const manifests = [];
    for (const d of (await readdir(dossierConcept, { withFileTypes: true })).filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      try { manifests.push(JSON.parse(await readFile(join(dossierConcept, d.name, "manifest.json"), "utf8"))); } catch { /* dossier étranger */ }
    }
    await writeFile(join(dossierConcept, "README.md"), readmeConcept(def, manifests));
    await ecrireScripts(produits.map(p => p.dossier));

    console.log(`\n${produits.length} vidéo(s) montée(s) · ${anomalies} anomalie(s)`);
    console.log(`Livré dans : ${relative(ROOT, dossierConcept)}/`);
    if (anomalies) process.exitCode = 1;
  }
}
