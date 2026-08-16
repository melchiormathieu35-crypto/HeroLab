/**
 * La Cote — le concept n° 4 du format court, et le format « volume ».
 *
 * Le prix à payer, le pot, et la question que tout joueur devrait se poser :
 * combien d'équité ce prix exige-t-il, et combien en ai-je vraiment ? Les deux
 * nombres viennent du moteur — l'exigence est écrite par `Judge.evOption` dans
 * son propre texte d'explication (« Payer 0.40 € dans un pot de 0.95 € exige
 * 30 % d'équité. Tu en as 31.5 %. »), et ce texte est affiché tel quel à
 * l'écran pendant le REVEAL. On le lit, on ne le recalcule pas.
 *
 * DEUX SENS, VOLONTAIREMENT. « La cote dit non » (l'équité réelle est loin
 * sous l'exigée : payer est une erreur chiffrée, passer est la réponse) et
 * « la cote dit oui » (l'équité réelle dépasse l'exigée : payer est correct).
 * Une série qui ne dirait que « fold » n'enseignerait pas la méthode, elle
 * enseignerait un réflexe — l'inverse du propos. L'écart minimal de 5 points
 * entre exigé et réel écarte les cas limites, qui basculeraient au moindre
 * ajustement du modèle (même logique que les gardes de fragilité du scanner).
 *
 * EXCLUSION INTER-CONCEPTS. Contrairement aux autres concepts, la sélection
 * exclut aussi les spots déjà livrés dans Quizz, Duel de profils et Podium
 * (identifiants ET specs — les manches B des duels sont des specs construites
 * hors catalogue) : un spectateur ne doit pas retrouver la même main dans deux
 * habits. La mémoire propre au concept s'y ajoute pour les lots futurs.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ANCHORS } from "./studio.mjs";
import { ffmpegPath } from "./produce.mjs";
import { launch } from "./studio.mjs";
import { scan } from "./scan.mjs";
import { CONCEPTS, COURT_DIR, DUREE_CIBLE, produireMontage, prochainNumero, slug } from "./montage.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONCEPT = "la-cote";
const DOSSIER_CONCEPT = join(COURT_DIR, CONCEPTS[CONCEPT].dossier);

/** Écart minimal (points d'équité) entre l'exigé et le réel : la leçon doit être franche. */
export const ECART_MIN = 5;

/**
 * Le panneau « Votre équité » de l'écran d'analyse. Il n'a pas de classe
 * propre : c'est la seconde carte du seul bloc `.grid.c2` sans `.mt` de la vue
 * (vérifié dans index.html, ligne ~7701 — les quatre autres grilles portent
 * `.mt`). Le nombre en 38 px qu'il contient est le plus grand texte du bloc,
 * donc le contrôle de lisibilité le mesure sans clé dédiée.
 */
export const PANNEAU_EQUITE = ".grid.c2:not(.mt) > .card:nth-of-type(2)";

/** Mémoire propre au concept. */
export const HISTOIRE = join(DOSSIER_CONCEPT, "historique.json");

async function chargerHistoire() {
  if (!existsSync(HISTOIRE)) return { version: 1, spotsUtilises: [], videos: [] };
  try {
    const h = JSON.parse(await readFile(HISTOIRE, "utf8"));
    return h && Array.isArray(h.spotsUtilises) ? h : { version: 1, spotsUtilises: [], videos: [] };
  } catch {
    return { version: 1, spotsUtilises: [], videos: [] };  // illisible ne doit pas bloquer
  }
}
async function sauverHistoire(h) {
  await mkdir(DOSSIER_CONCEPT, { recursive: true });
  await writeFile(HISTOIRE, JSON.stringify(h, null, 2));
}

/** Lit l'exigence de la cote dans le texte que le moteur écrit lui-même. */
export function lireCote(detail) {
  if (!detail) return null;
  const ex = /exige\s+([\d.]+)\s*%\s+d'équité/.exec(detail);
  const tu = /Tu en as\s+([\d.]+)\s*%/.exec(detail);
  return ex && tu ? { exige: Number(ex[1]), tuEnAs: Number(tu[1]) } : null;
}

/**
 * Tout ce qui a déjà été livré, tous concepts confondus : identifiants ET
 * specs. Les specs couvrent les manches B des duels, construites hors
 * catalogue donc introuvables par identifiant.
 */
export async function spotsDejaLivres() {
  const ids = new Set();
  const specs = new Set();
  for (const def of Object.values(CONCEPTS)) {
    const dossier = join(COURT_DIR, def.dossier);
    let entrees = [];
    try { entrees = await readdir(dossier, { withFileTypes: true }); } catch { continue; }
    for (const d of entrees) {
      if (!d.isDirectory()) continue;
      try {
        const m = JSON.parse(await readFile(join(dossier, d.name, "manifest.json"), "utf8"));
        if (m.spot?.id) ids.add(m.spot.id);
        if (m.spot?.spec) specs.add(m.spot.spec);
        if (m.duel) { specs.add(m.duel.specA); specs.add(m.duel.specB); }
        if (m.podium) for (const r of m.podium.rang) { ids.add(r.spot.id); specs.add(r.spot.spec); }
      } catch { /* dossier étranger */ }
    }
  }
  return { ids, specs };
}

/**
 * Sélectionne les spots du lot : leçons franches dans les deux sens, environ
 * un tiers de « la cote dit oui » pour que la série enseigne la méthode et non
 * le réflexe du fold. Classement par ampleur de l'écart — les cas les plus
 * nets d'abord — avec l'anti-redondance habituelle (une signature de concept
 * par lot, plafond par modèle de situation).
 */
export async function chercherCotes({ combien = 10, budget = 2500, exclureIds = new Set(), exclureSpecs = new Set(), verbeux = true } = {}) {
  const log = (s) => { if (verbeux) console.log(s); };
  const { retenus } = await scan({ max: budget, verbeux: false });

  const non = [];
  const oui = [];
  for (const s of retenus) {
    if (s.toCall <= 0 || !s.optInstinct) continue;
    if (exclureIds.has(s.id) || exclureSpecs.has(s.spec)) continue;
    const c = lireCote(s.optInstinct.detail);
    if (!c) continue;
    const ecart = c.tuEnAs - c.exige;
    if (ecart <= -ECART_MIN && s.famBest === "fold") non.push({ ...s, cote: c, ecart, sens: "non" });
    else if (ecart >= ECART_MIN && s.best.action === "call") oui.push({ ...s, cote: c, ecart, sens: "oui" });
  }
  non.sort((a, b) => a.ecart - b.ecart);       // les plus négatifs d'abord
  oui.sort((a, b) => b.ecart - a.ecart);       // les plus positifs d'abord
  log(`  ${non.length} « la cote dit non » · ${oui.length} « la cote dit oui » (écart ≥ ${ECART_MIN} points, hors déjà-livrés)`);

  const quotaOui = Math.min(oui.length, Math.round(combien / 3));
  const vuSignature = new Set();
  // Une main de héros par lot : trois vidéos ouvrant toutes sur « 33 » sont
  // trois accroches identiques, même si les boards diffèrent — constaté au
  // test à sec, pas supposé.
  const vuMain = new Set();
  const parModele = new Map();
  const plafondModele = Math.max(1, Math.ceil(combien / 3));
  const retenu = [];
  const prendre = (liste, max) => {
    let pris = 0;
    for (const s of liste) {
      if (pris >= max || retenu.length >= combien) break;
      if (vuSignature.has(s.signature) || vuMain.has(s.heroCls)) continue;
      if ((parModele.get(s.modele) || 0) >= plafondModele) continue;
      vuSignature.add(s.signature);
      vuMain.add(s.heroCls);
      parModele.set(s.modele, (parModele.get(s.modele) || 0) + 1);
      retenu.push(s); pris++;
    }
  };
  prendre(oui, quotaOui);
  prendre(non, combien - retenu.length);
  // Si les plafonds ont trop mordu, compléter avec les meilleurs restants.
  if (retenu.length < combien) {
    for (const s of [...non, ...oui]) {
      if (retenu.length >= combien) break;
      if (retenu.includes(s) || vuSignature.has(s.signature)) continue;
      vuSignature.add(s.signature);
      retenu.push(s);
    }
  }
  // Ordre de livraison : alterner autant que possible pour que deux « oui »
  // ne se suivent pas — la variété est le propos de la série.
  retenu.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
  log(`  ${retenu.length} spot(s) retenus (${retenu.filter(s => s.sens === "oui").length} « oui », ${retenu.filter(s => s.sens === "non").length} « non »)`);
  return retenu;
}

const bb = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)} bb`;

/**
 * Plan de tournage d'une vidéo La Cote. Cinq beats, un seul spot :
 * HOOK → SITUATION → LA COTE (le prix isolé, le calcul posé) → REVEAL (le
 * réflexe joué, le moteur compare) → ÉQUITÉ (le panneau d'équité en grand,
 * tenu jusqu'au bout — c'est la preuve, et la dernière image).
 */
export function coteBlueprint(note, { index = 1 } = {}) {
  const preflop = note.street === "preflop";
  const c = note.cote;
  const beats = [];

  beats.push({
    beat: "HOOK",
    role: "La main, et la promesse d'un calcul — pas encore les nombres.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.6 },
      {
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: "max", duree: 0.9,
        pourquoi: "Ouvrir sur la main pose le sujet ; la promesse de la vidéo est le calcul, pas la réponse.",
      },
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 2.9 },
    ],
  });

  beats.push({
    beat: "SITUATION",
    role: "La table, l'adversaire, la mise en face — le contexte du prix.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "controle", cible: ANCHORS.table, texte: preflop ? ".pot" : ".board" },
      { type: "fixe", duree: 5.4 },
    ],
  });

  beats.push({
    beat: "LA COTE",
    role: `Isoler le prix : ${note.toCall} à payer. C'est ici que la question de la cote est posée (elle exige ${c.exige} % d'équité).`,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.6 },
      {
        type: "pan", cible: ".hero-hand", duree: 0.8, at: 0.36,
        pourquoi: "Descendre sur la ligne « à payer » isole la seule donnée dont le calcul a besoin : le prix.",
      },
      { type: "controle", cible: ".hero-hand", texte: ".val" },
      {
        type: "freeze", duree: 5.2,
        pourquoi: "Le temps du calcul. La voix pose l'exigence de la cote pendant que le prix est seul à l'écran — sans ce temps, la vidéo affirme au lieu de démontrer.",
      },
    ],
  });

  beats.push({
    beat: "REVEAL",
    role: `Le réflexe (payer) est joué ; le moteur écrit lui-même la comparaison à l'écran — exigé ${c.exige} %, réel ${c.tuEnAs} % — et tranche : ${note.sens === "non" ? "erreur" : "correct"}.`,
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.5 },
      {
        type: "jouer", quoi: "instinct",
        pourquoi: "La décision est jouée, pas racontée : la phrase de comparaison qui s'affiche vient du moteur, mot pour mot.",
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.9, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict porte la phrase de la cote ; calé en haut pour que le titre et le coût entrent dans la bande utile.",
      },
      { type: "zoomIn", cible: ".vh", de: 1, a: "max", duree: 0.5, pourquoi: "Le resserrement accompagne le verdict — le point de bascule de la vidéo." },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 5.4 },
    ],
  });

  beats.push({
    beat: "ÉQUITÉ",
    role: "Le panneau d'équité en grand : le nombre réel, la barre, la preuve. Dernière image de la vidéo.",
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: PANNEAU_EQUITE, at: 0.16, align: "top" },
      { type: "controle", cible: PANNEAU_EQUITE },
      {
        type: "fixe", duree: 9.4,
        pourquoi: "La vidéo se termine sur le nombre qui répond à la question posée au beat LA COTE — la leçon est la comparaison, elle doit rester à l'écran le temps de s'installer.",
      },
    ],
  });

  const dureePrevue = beats.reduce((n, b) => n + b.mouvements.reduce((m, x) => m + (x.duree || 0), 0), 0);

  return {
    index, concept: CONCEPT,
    titre: `${String(index).padStart(2, "0")} - ${slug(`la cote ${note.sens === "non" ? "dit non" : "dit oui"} ${note.label}`, 64)}`,
    titreInterne: `La cote dit ${note.sens} : ${note.label}`,
    enonce: note.sens === "non"
      ? `Le prix exige ${c.exige} % d'équité, le héros n'en a que ${c.tuEnAs} % : payer coûte ${note.coutInstinct.toFixed(2)} bb, la cote disait non.`
      : `Le prix exige ${c.exige} % d'équité, le héros en a ${c.tuEnAs} % : payer est correct, la cote disait oui.`,
    spot: note.id,
    modele: note.modele,
    signature: `cote|${note.sens}|${note.signature}`,
    score: note.score,
    dureePrevue: Math.round(dureePrevue * 100) / 100,
    momentReveal: "Beat REVEAL, quand le moteur affiche la comparaison exigé/réel et tranche.",
    objectifRetention:
      "Retenir par la méthode : la question est posée (que demande le prix ?), le calcul est affiché, la réponse est " +
      "chiffrée. La série alterne « la cote dit non » et « la cote dit oui » — c'est la comparaison qui s'apprend, pas un réflexe.",
    cote: {
      sens: note.sens,
      exige: c.exige,
      tuEnAs: c.tuEnAs,
      ecart: Math.round(note.ecart * 10) / 10,
      toCall: note.toCall,
      pot: note.pot,
      coutInstinct: Math.round(note.coutInstinct * 100) / 100,
      spot: { id: note.id, label: note.label, spec: note.spec },
    },
    beats,
  };
}

export async function monterCotes({ combien = 10, budget = 2500, verbeux = true } = {}) {
  const def = CONCEPTS[CONCEPT];
  const log = (s) => { if (verbeux) console.log(s); };

  const historique = await chargerHistoire();
  const dejaAilleurs = await spotsDejaLivres();
  const exclureIds = new Set([...historique.spotsUtilises, ...dejaAilleurs.ids]);
  log(`\nExclusions : ${exclureIds.size} spot(s) déjà livrés (tous concepts) + ${dejaAilleurs.specs.size} spec(s)\n`);

  log(`Recherche de ${combien} leçons de cote (écart ≥ ${ECART_MIN} points)…`);
  const spots = await chercherCotes({ combien, budget, exclureIds, exclureSpecs: dejaAilleurs.specs, verbeux });
  if (spots.length < combien) log(`\n⚠ ${spots.length} spot(s) pour ${combien} demandés — augmenter --budget si besoin.`);

  const ff = await ffmpegPath();
  const browser = await launch();
  let numero = await prochainNumero(DOSSIER_CONCEPT);
  const produits = [];

  for (const note of spots) {
    const bp = coteBlueprint(note, { index: numero });
    const dossier = join(DOSSIER_CONCEPT, bp.titre);
    process.stdout.write(`\n  ▶ ${bp.titre.slice(0, 66).padEnd(68)}`);
    const t0 = Date.now();
    const r = await produireMontage(browser, ff, note, bp, dossier);
    if (!r.ok) { console.log(` ✗ ${r.why}`); continue; }
    console.log(` ${r.seconds.toFixed(1)}s · prévu ${bp.dureePrevue.toFixed(1)}s · rendu en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    produits.push({ ...r, note });
    numero++;
  }

  await browser.close();

  for (const p of produits) {
    historique.spotsUtilises.push(p.note.id);
    historique.videos.push({ numero: p.bp.index, titre: p.bp.titre, spot: p.note.id, sens: p.note.sens });
  }
  await sauverHistoire(historique);

  return { produits, dossierConcept: DOSSIER_CONCEPT, def };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const combien = Number(arg("--count", "10"));
  const budget = Number(arg("--budget", "2500"));

  const { produits, dossierConcept, def } = await monterCotes({ combien, budget });
  if (!produits.length) { console.error("aucune vidéo produite"); process.exitCode = 1; }
  else {
    const { qaMontage } = await import("./qa.mjs");
    const { readmeMontage, readmeConcept } = await import("./readme.mjs");
    const { ecrireScripts } = await import("./script.mjs");

    console.log(`\nContrôle qualité…`);
    const rapport = await qaMontage({ dossiers: produits.map(p => p.dossier), duree: DUREE_CIBLE });
    let anomalies = 0;
    for (const v of rapport) {
      const ko = v.controles.filter(x => !x.ok);
      anomalies += ko.length;
      console.log(`  ${v.ok ? "✓" : "✗"} ${v.video.padEnd(66)} ${v.duree ? v.duree.toFixed(1) + "s" : ""}`);
      for (const x of ko) console.log(`       ✗ ${x.nom} : ${x.why}`);
    }

    for (const p of produits) {
      const m = JSON.parse(await readFile(join(p.dossier, "manifest.json"), "utf8"));
      const q = rapport.find(v => v.dossier === p.dossier) || null;
      await writeFile(join(p.dossier, "README.md"), readmeMontage(m, q));
    }
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
