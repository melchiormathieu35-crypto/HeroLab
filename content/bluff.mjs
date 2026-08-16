/**
 * Le Bluff — le cinquième concept. Une relance qui a l'air d'un bon coup, mais
 * un bluff se juge par un calcul (fold equity nécessaire vs fold equity réelle
 * du profil), pas par une impression. Le moteur écrit lui-même l'équation dans
 * `Judge.evOption` (« Une mise de X € demande Y % de folds… l'estimation est de
 * Z % ») ; on lit cette phrase, on ne la recalcule pas.
 *
 * DEUX SENS, COMME LA COTE. « Le bluff brûle » (la mise tentante existe dans la
 * liste des options mais sa marge de fold equity est nettement négative — elle
 * coûte cher alors qu'elle a l'air raisonnable) et « le bluff passe » (la
 * meilleure action EST cette relance, avec une vraie marge positive). Une
 * série qui ne montrerait que des bluffs qui brûlent enseignerait « ne jamais
 * bluffer », l'inverse de la méthode.
 *
 * CHOIX DE LA MISE « BRÛLE » : parmi les options agressives à marge négative,
 * on retient celle dont le coût est le plus FAIBLE — la plus tentante, pas
 * l'overbet extrême que personne ne considérerait. C'est la leçon honnête :
 * même le bluff le plus raisonnable de la liste brûle, pas seulement les excès.
 *
 * MÉCANIQUE DE TOURNAGE : contrairement au Quizz et à La Cote, le REVEAL ne
 * joue pas le réflexe passif (`instinct`) — c'est la relance elle-même qui est
 * le sujet. Le mouvement `jouer` reçoit donc le libellé exact de l'option
 * ciblée, comme au Duel de profils.
 *
 * CONÇU POUR LA RÉTENTION ET L'ÉDUCATION (demande explicite) :
 *   - HOOK neutre : ni le sens, ni le verdict n'est trahi avant le REVEAL —
 *     le spectateur ne sait pas si ça va payer ou brûler, il doit regarder ;
 *   - LE PARI isole la mise et laisse un temps de calcul avant la réponse ;
 *   - LA LEÇON referme sur une phrase de méthode transposable, pas sur le
 *     seul chiffre — et définit « fold equity » en clair au premier usage.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openShot, loadSpot, ANCHORS } from "./studio.mjs";
import { ffmpegPath } from "./produce.mjs";
import { scan } from "./scan.mjs";
import { CONCEPTS, COURT_DIR, DUREE_CIBLE, produireMontage, prochainNumero, slug } from "./montage.mjs";
import { spotsDejaLivres } from "./cote.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONCEPT = "le-bluff";
const DOSSIER_CONCEPT = join(COURT_DIR, CONCEPTS[CONCEPT].dossier);

/** Marges minimales, en points de pourcentage. */
export const MARGE_PASSE_MIN = 15;   // le bluff qui marche : marge franche
export const MARGE_BRULE_MAX = -10;  // le bluff qui brûle : déficit franc

const HISTOIRE = join(DOSSIER_CONCEPT, "historique.json");
async function chargerHistoire() {
  if (!existsSync(HISTOIRE)) return { version: 1, spotsUtilises: [], videos: [] };
  try {
    const h = JSON.parse(await readFile(HISTOIRE, "utf8"));
    return h && Array.isArray(h.spotsUtilises) ? h : { version: 1, spotsUtilises: [], videos: [] };
  } catch { return { version: 1, spotsUtilises: [], videos: [] }; }
}
async function sauverHistoire(h) {
  await mkdir(DOSSIER_CONCEPT, { recursive: true });
  await writeFile(HISTOIRE, JSON.stringify(h, null, 2));
}

const fam = (a) => (a === "bet" || a === "raise" ? "aggro" : a);

/** Lit la marge de fold equity dans le texte que le moteur écrit lui-même. */
export function margeDe(detail) {
  if (!detail) return null;
  const need = /demande\s+(\d+)\s*%\s+de folds/.exec(detail);
  const est = /estimation est de\s+(\d+)\s*%/.exec(detail);
  const eqCalled = /équité tombe à environ\s+(\d+)\s*%/.exec(detail);
  return need && est
    ? { exige: Number(need[1]), estimation: Number(est[1]), marge: Number(est[1]) - Number(need[1]), eqCalled: eqCalled ? Number(eqCalled[1]) : null }
    : null;
}

/**
 * Sélectionne les leçons de bluff. « Passe » réutilise directement le
 * `margeFE` déjà calculé par `noter()` (le même chiffre que la garde de
 * fragilité du scanner) ; « brûle » relit la marge de chaque option agressive
 * de la liste — la meilleure n'étant pas agressive, il faut chercher ailleurs.
 */
export async function chercherBluffs({ combien = 10, budget = 2500, exclureIds = new Set(), exclureSpecs = new Set(), verbeux = true } = {}) {
  const log = (s) => { if (verbeux) console.log(s); };
  const { retenus } = await scan({ max: budget, verbeux: false });

  const passe = [];
  const brule = [];
  for (const s of retenus) {
    if (exclureIds.has(s.id) || exclureSpecs.has(s.spec)) continue;

    if (fam(s.best.action) === "aggro" && s.margeFE !== null && s.margeFE >= MARGE_PASSE_MIN) {
      passe.push({ ...s, sens: "passe", cible: s.best, marge: margeDe(s.best.detail) });
      continue;
    }
    if (fam(s.best.action) !== "aggro") {
      // Parmi les options agressives, celle qui brûle le moins fort — la plus
      // tentante, donc la plus instructive.
      const candidats = s.options
        .filter(o => fam(o.action) === "aggro" && o.label !== s.best.label)
        .map(o => ({ option: o, m: margeDe(o.detail) }))
        .filter(x => x.m && x.m.marge <= MARGE_BRULE_MAX);
      if (!candidats.length) continue;
      candidats.sort((a, b) => b.option.evBB - a.option.evBB);   // le moins coûteux d'abord
      const c = candidats[0];
      brule.push({ ...s, sens: "brule", cible: c.option, marge: c.m });
    }
  }
  log(`  ${passe.length} « le bluff passe » · ${brule.length} « le bluff brûle » (hors déjà-livrés)`);

  const quotaPasse = Math.min(passe.length, Math.round(combien / 3));
  const vuSignature = new Set(); const vuMain = new Set(); const parModele = new Map();
  const plafondModele = Math.max(1, Math.ceil(combien / 3));
  const retenu = [];
  const prendre = (liste, max) => {
    let pris = 0;
    for (const s of liste) {
      if (pris >= max || retenu.length >= combien) break;
      if (vuSignature.has(s.signature) || vuMain.has(s.heroCls)) continue;
      if ((parModele.get(s.modele) || 0) >= plafondModele) continue;
      vuSignature.add(s.signature); vuMain.add(s.heroCls);
      parModele.set(s.modele, (parModele.get(s.modele) || 0) + 1);
      retenu.push(s); pris++;
    }
  };
  // Classer par ampleur (marge la plus franche d'abord) dans chaque sens.
  passe.sort((a, b) => b.marge.marge - a.marge.marge);
  brule.sort((a, b) => a.marge.marge - b.marge.marge);
  prendre(passe, quotaPasse);
  prendre(brule, combien - retenu.length);
  // Voie de secours : mêmes gardes de diversité que la passe stricte, sinon
  // elle réintroduit des mains déjà retenues dès que le plafond par modèle a
  // forcé un repli — constaté à la mesure (8/10 mains distinctes au lieu de
  // 10/10, faute d'avoir vérifié `vuMain` ici).
  if (retenu.length < combien) {
    for (const s of [...brule, ...passe]) {
      if (retenu.length >= combien) break;
      if (retenu.includes(s) || vuSignature.has(s.signature) || vuMain.has(s.heroCls)) continue;
      vuSignature.add(s.signature); vuMain.add(s.heroCls); retenu.push(s);
    }
  }
  retenu.sort((a, b) => Math.abs(b.marge.marge) - Math.abs(a.marge.marge));
  log(`  ${retenu.length} spot(s) retenus (${retenu.filter(s => s.sens === "passe").length} « passe », ${retenu.filter(s => s.sens === "brule").length} « brûle »)`);
  return retenu;
}

const bb = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)} bb`;

/**
 * Plan de tournage. HOOK neutre (aucun sens trahi) → SITUATION → LE PARI
 * (la mise isolée, freeze) → REVEAL (la mise ciblée est jouée par son
 * libellé exact — pas le réflexe passif) → LA LEÇON (espérances, méthode).
 */
export function bluffBlueprint(note, { index = 1 } = {}) {
  const preflop = note.street === "preflop";
  const beats = [];

  beats.push({
    beat: "HOOK",
    role: "La main, sans dire si le pari qui vient paie ou brûle — la question est la promesse.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.6 },
      {
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: "max", duree: 0.9,
        pourquoi: "Ouvrir sur la main sans indice sur l'issue : le spectateur doit regarder pour savoir si le pari tient.",
      },
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 2.6 },
    ],
  });

  beats.push({
    beat: "SITUATION",
    role: "La table et le profil adverse — c'est lui qui décide si un bluff a une chance ici.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "controle", cible: ANCHORS.table, texte: preflop ? ".pot" : ".board" },
      { type: "fixe", duree: 5.0 },
    ],
  });

  beats.push({
    beat: "LE PARI",
    role: `Isoler la mise envisagée (${note.cible.label}) : c'est elle qu'il faut juger, pas la main.`,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.6 },
      {
        // `.actions` et non `ANCHORS.actions` (= « .act-zone ») : c'est
        // l'enveloppe extérieure, plus haute que le bloc des boutons lui-même
        // (mesuré ici : sort de la bande utile). `.actions` est le sélecteur
        // que Quizz, Duel, Podium et La Cote utilisent déjà pour ce même
        // geste — repris tel quel plutôt que réinventé.
        type: "pan", cible: ".actions", duree: 0.9, at: 0.16, align: "top",
        pourquoi: "Descendre vers les options montre le pari envisagé au milieu des autres : la comparaison est le point du beat.",
      },
      { type: "controle", cible: ".actions", texte: ".a-n" },
      {
        type: "freeze", duree: 6.4,
        pourquoi: "Le temps du calcul : combien de fois l'adversaire doit-il passer pour que ce pari soit rentable ? Le silence laisse deviner avant la réponse.",
      },
    ],
  });

  beats.push({
    beat: "REVEAL",
    role: `La mise (${note.cible.label}) est jouée à l'écran ; le moteur écrit sa propre équation et tranche : ${note.sens === "brule" ? "le bluff brûle" : "le bluff passe"}.`,
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.5 },
      {
        type: "jouer", quoi: note.cible.label,
        pourquoi: "Le pari est joué à l'écran, pas raconté : l'équation qui s'affiche est celle du moteur, vérifiable telle quelle.",
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.9, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict porte l'équation complète ; calé en haut pour que le titre et le calcul entrent dans la bande utile.",
      },
      { type: "zoomIn", cible: ".vh", de: 1, a: "max", duree: 0.5, pourquoi: "Le resserrement accompagne le verdict — le point de bascule de la vidéo." },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 6.6 },
    ],
  });

  beats.push({
    beat: "LA LEÇON",
    role: "L'espérance de chaque option — la preuve chiffrée, et la méthode qui s'en dégage.",
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.evList, at: 0.26, align: "top" },
      { type: "controle", cible: ANCHORS.evList, texte: ".ev" },
      { type: "fixe", duree: 2.0, pourquoi: "La meilleure option se lit en premier — la réponse avant la démonstration." },
      {
        type: "panPx", mesure: ".opt-row", duree: 1.4,
        pourquoi: "La descente parcourt le classement complet : c'est la preuve que le calcul, pas l'instinct, doit trancher.",
      },
      { type: "fixe", duree: 4.6, pourquoi: "Dernière image tenue : la vidéo se termine sur la preuve, pas sur un mouvement." },
    ],
  });

  const dureePrevue = beats.reduce((n, b) => n + b.mouvements.reduce((m, x) => m + (x.duree || 0), 0), 0);
  const coutOuGain = note.sens === "brule" ? note.best.evBB - note.cible.evBB : note.cible.evBB;

  return {
    index, concept: CONCEPT,
    titre: `${String(index).padStart(2, "0")} - ${slug(`le bluff ${note.sens} ${note.label}`, 64)}`,
    titreInterne: `Le bluff ${note.sens === "brule" ? "brûle" : "passe"} : ${note.label}`,
    enonce: note.sens === "brule"
      ? `${note.cible.label} a l'air d'un bon coup mais demande ${note.marge.exige} % de folds — ce profil n'en donne que ${note.marge.estimation} % : le bluff brûle, coût ${coutOuGain.toFixed(2)} bb.`
      : `${note.cible.label} demande ${note.marge.exige} % de folds — ce profil en donne ${note.marge.estimation} % : le bluff passe, marge ${note.marge.marge} points.`,
    spot: note.id,
    modele: note.modele,
    signature: `bluff|${note.sens}|${note.signature}`,
    score: note.score,
    dureePrevue: Math.round(dureePrevue * 100) / 100,
    momentReveal: "Beat REVEAL, quand le moteur affiche sa propre équation de fold equity et tranche.",
    objectifRetention:
      "Retenir par la méthode : le pari est isolé, l'exigence de folds est posée, la réponse du profil est comparée — " +
      "et la leçon ferme sur une règle transposable, pas sur une seule main.",
    bluff: {
      sens: note.sens,
      action: note.cible.label,
      evCible: Math.round(note.cible.evBB * 100) / 100,
      evMeilleure: { label: note.best.label, evBB: Math.round(note.best.evBB * 100) / 100 },
      exige: note.marge.exige, estimation: note.marge.estimation, marge: note.marge.marge,
      eqCalled: note.marge.eqCalled,
      cout: Math.round(coutOuGain * 100) / 100,
      spot: { id: note.id, label: note.label, spec: note.spec },
    },
    beats,
  };
}

export async function monterBluffs({ combien = 10, budget = 2500, verbeux = true } = {}) {
  const def = CONCEPTS[CONCEPT];
  const log = (s) => { if (verbeux) console.log(s); };

  const historique = await chargerHistoire();
  const dejaAilleurs = await spotsDejaLivres();
  const exclureIds = new Set([...historique.spotsUtilises, ...dejaAilleurs.ids]);
  log(`\nExclusions : ${exclureIds.size} spot(s) déjà livrés (tous concepts) + ${dejaAilleurs.specs.size} spec(s)\n`);

  log(`Recherche de ${combien} leçons de bluff (marge passe ≥ ${MARGE_PASSE_MIN}, marge brûle ≤ ${MARGE_BRULE_MAX})…`);
  const spots = await chercherBluffs({ combien, budget, exclureIds, exclureSpecs: dejaAilleurs.specs, verbeux });
  if (spots.length < combien) log(`\n⚠ ${spots.length} spot(s) pour ${combien} demandés — augmenter --budget si besoin.`);

  const ff = await ffmpegPath();
  const browser = await launch();
  let numero = await prochainNumero(DOSSIER_CONCEPT);
  const produits = [];

  for (const note of spots) {
    const bp = bluffBlueprint(note, { index: numero });
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

  const { produits, dossierConcept, def } = await monterBluffs({ combien, budget });
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
