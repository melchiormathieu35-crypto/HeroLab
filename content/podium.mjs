/**
 * Podium des erreurs — le concept n° 3 du format court.
 *
 * Trois erreurs réelles, dans une seule vidéo continue, classées de la moins
 * chère à la plus chère. C'est le format liste : la rétention vient du
 * classement lui-même — le spectateur reste pour voir le numéro un, pas parce
 * qu'on le lui promet mais parce que la structure l'y pousse mécaniquement.
 *
 * Contrairement au duel, chaque beat rejoue une situation DIFFÉRENTE : trois
 * spots indépendants, choisis par le seul critère qui définit ce concept — le
 * coût réel de l'erreur, en bb, tel que `Judge.evaluate` le calcule. Aucune
 * appréciation, aucun choix éditorial sur ce qui « mérite » sa place : on
 * prend les erreurs les plus chères du catalogue, sans en inventer une seule.
 *
 * MÉMOIRE ENTRE EXÉCUTIONS. Une fois trois spots utilisés dans une vidéo, ils
 * ne doivent plus jamais resservir : republier la même erreur dans un futur
 * lot serait la même vidéo en costume différent. `historique.json`, propre à
 * ce concept, mémorise chaque identifiant de spot livré ; toute exécution
 * future de `node content/podium.mjs` les exclut automatiquement — pas besoin
 * d'y penser, la chaîne s'en souvient à ta place.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openShot, ANCHORS } from "./studio.mjs";
import { ffmpegPath } from "./produce.mjs";
import { scan } from "./scan.mjs";
import { CONCEPTS, COURT_DIR, DUREE_CIBLE, produireMontage, prochainNumero, slug } from "./montage.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONCEPT = "podium";
const DOSSIER_CONCEPT = join(COURT_DIR, CONCEPTS[CONCEPT].dossier);

/** Seuil d'entrée : en dessous, l'erreur n'est pas assez marquante pour un podium. */
export const COUT_MIN = 4;

/** Mémoire propre au concept — mêmes principes que content/history.mjs, portée réduite. */
export const HISTOIRE = join(DOSSIER_CONCEPT, "historique.json");

async function chargerHistoire() {
  if (!existsSync(HISTOIRE)) return { version: 1, spotsUtilises: [], videos: [] };
  try {
    const h = JSON.parse(await readFile(HISTOIRE, "utf8"));
    return h && Array.isArray(h.spotsUtilises) ? h : { version: 1, spotsUtilises: [], videos: [] };
  } catch {
    return { version: 1, spotsUtilises: [], videos: [] };  // illisible ne doit pas bloquer une production
  }
}
async function sauverHistoire(h) {
  await mkdir(DOSSIER_CONCEPT, { recursive: true });
  await writeFile(HISTOIRE, JSON.stringify(h, null, 2));
}

const bb = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)} bb`;

/**
 * Sélectionne `combien` podiums de 3 erreurs chacun.
 *
 * Source : `scan()`, exactement le même scanner que le quizz et le duel —
 * mêmes gardes de fragilité, même anti-redondance de concept à l'intérieur du
 * budget exploré. On y ajoute un filtre propre au format : coût réel de
 * l'erreur (`coutInstinct`) au-dessus de COUT_MIN, et l'exclusion des spots
 * déjà livrés dans un podium précédent.
 *
 * Diversité : à l'intérieur d'un même podium, les trois erreurs ne peuvent
 * pas partager la même signature de concept — sinon la « leçon n°2 » ne serait
 * qu'une resucée de la « leçon n°3 » avec un habit différent, ce qui viderait
 * le classement de son sens.
 */
export async function chercherPodiums({ combien = 10, budget = 2500, exclureIds = new Set(), verbeux = true } = {}) {
  const log = (s) => { if (verbeux) console.log(s); };
  const { retenus } = await scan({ max: budget, exclureIds, verbeux: false });

  const pool = retenus
    .filter(s => s.coutInstinct >= COUT_MIN)
    .sort((a, b) => b.coutInstinct - a.coutInstinct);

  log(`  ${pool.length} erreur(s) ≥ ${COUT_MIN} bb disponibles (hors historique)`);

  // Un spot par signature de concept au plus, dans TOUT le lot : deux podiums
  // qui répéteraient la même leçon avec des cartes différentes ne feraient
  // qu'un classement gonflé artificiellement.
  const vuSignature = new Set();
  const dedupe = [];
  for (const s of pool) {
    if (vuSignature.has(s.signature)) continue;
    vuSignature.add(s.signature);
    dedupe.push(s);
  }

  const podiums = [];
  const file = [...dedupe];
  while (podiums.length < combien && file.length >= 3) {
    const triple = [];
    const modelesPris = new Set();
    // Passe 1 : préférer des modèles distincts dans un même podium — trois
    // erreurs qui se ressemblent structurellement racontent moins bien un
    // classement que trois erreurs de nature différente.
    for (let i = 0; i < file.length && triple.length < 3; i++) {
      if (modelesPris.has(file[i].modele)) continue;
      triple.push(file[i]); modelesPris.add(file[i].modele);
      file.splice(i, 1); i--;
    }
    // Passe 2 : si le pool ne fournit pas trois modèles distincts, compléter
    // avec ce qui reste plutôt que livrer moins que demandé.
    while (triple.length < 3 && file.length) triple.push(file.shift());
    if (triple.length < 3) break;
    // Ordre de lecture : de la moins chère (rang 3) à la plus chère (rang 1).
    triple.sort((a, b) => a.coutInstinct - b.coutInstinct);
    podiums.push(triple);
  }

  log(`  ${podiums.length} podium(s) constitué(s) sur ${combien} demandé(s)`);
  return podiums;
}

/**
 * Plan de tournage d'un podium. Trois mini-erreurs à la suite, chacune une
 * situation rechargée (mouvement `charger`, comme au duel de profils), dans
 * l'ordre croissant du coût. Aucun `CHOICE` : le format est un classement
 * rapide, pas un quizz — le spectateur n'a pas le temps de deviner avant que
 * le réflexe soit joué, ce qui est le ressort du format liste : on enchaîne.
 *
 * Les temps de pose croissent avec le rang : la moins chère se lit vite, la
 * plus chère — le clou de la vidéo — reste à l'écran le plus longtemps.
 */
export function podiumBlueprint(triple, { index = 1 } = {}) {
  const beats = [];
  const rangs = [3, 2, 1];    // ordre de lecture : la moins chère d'abord

  beats.push({
    beat: "HOOK",
    role: "La main de la première erreur, sans contexte : la promesse du classement, pas encore la réponse.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.6 },
      {
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: "max", duree: 0.9,
        pourquoi: "Ouvrir sur une main, sans dire laquelle des trois erreurs elle est, pose la promesse du classement.",
      },
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 2.8 },
    ],
  });

  triple.forEach((note, i) => {
    const rang = rangs[i];
    const preflop = note.street === "preflop";
    const p = i;   // 0 = moins chère, 2 = plus chère : les temps de pose croissent avec p
    const mouvements = [];
    if (i > 0) mouvements.push({ type: "charger", spec: note.spec });
    mouvements.push(
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "controle", cible: ANCHORS.table, texte: preflop ? ".pot" : ".board" },
      { type: "fixe", duree: 2.7 + 0.35 * p },
      {
        type: "jouer", quoi: "instinct",
        pourquoi: `Le réflexe (${note.instinct === "call" ? "payer" : "checker"}) est joué à l'écran : c'est lui, chiffré, qui fait l'erreur n°${rang}.`,
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.85, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict monte en haut du cadre pour que le titre et le coût entrent dans la bande utile.",
      },
      {
        type: "zoomIn", cible: ".vh", de: 1, a: "max", duree: 0.5,
        pourquoi: `Le resserrement accompagne le chiffre qui classe cette erreur — le point de preuve du rang n°${rang}.`,
      },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 3.8 + 1.3 * p },
    );
    beats.push({
      beat: `ERREUR N°${rang}`,
      role: `Rang ${rang}/3 du podium — ${note.label}. Réflexe joué : ${note.instinct}, coût ${bb(note.coutInstinct)}.`,
      reveal: true,
      mouvements,
      // Conservé pour le générateur de script : rien n'est recalculé depuis le texte.
      _note: note, _rang: rang,
    });
  });

  const dureePrevue = beats.reduce((n, b) => n + b.mouvements.reduce((m, x) => m + (x.duree || 0), 0), 0);
  const titreInterne = `Podium : ${triple.map(n => n.label.split(" sur ")[0].split(" — ")[0].split(" face")[0]).join(" · ")}`;

  return {
    index, concept: CONCEPT,
    titre: `${String(index).padStart(2, "0")} - ${slug(`podium ${triple.map(n => n.label).join(" ")}`, 64)}`,
    titreInterne,
    enonce:
      `Trois erreurs classées : n°3 à ${bb(triple[0].coutInstinct)}, n°2 à ${bb(triple[1].coutInstinct)}, ` +
      `n°1 à ${bb(triple[2].coutInstinct)} — le coût réel, tel que le moteur le calcule.`,
    spot: triple[0].id,
    modele: triple[0].modele,
    signature: `podium|${triple.map(n => n.signature).join("+")}`,
    score: Math.round(triple.reduce((n, s) => n + s.score, 0) / 3),
    dureePrevue: Math.round(dureePrevue * 100) / 100,
    momentReveal: "Beat ERREUR N°1, sur le dernier verdict — le plus cher du classement.",
    objectifRetention:
      "Retenir par le classement : chaque erreur est plus chère que la précédente, et la structure elle-même " +
      "pousse à rester jusqu'au numéro un. Aucune main ne dépend d'une autre — ce sont trois preuves indépendantes.",
    podium: {
      rang: beats.filter(b => b._note).map(b => ({
        rang: b._rang,
        spot: { id: b._note.id, modele: b._note.modele, label: b._note.label, spec: b._note.spec },
        instinct: b._note.instinct,
        coutInstinct: b._note.coutInstinct,
        equity: Math.round(b._note.equity * 1000) / 10,
      })),
    },
    beats: beats.map(({ _note, _rang, ...b }) => b),   // champs internes retirés du blueprint final
  };
}

export async function monterPodium({ combien = 10, budget = 2500, verbeux = true } = {}) {
  const def = CONCEPTS[CONCEPT];
  const log = (s) => { if (verbeux) console.log(s); };

  const historique = await chargerHistoire();
  const exclureIds = new Set(historique.spotsUtilises);
  log(`\nHistorique : ${historique.spotsUtilises.length} spot(s) déjà livré(s) en podium\n`);

  log(`Recherche de ${combien} podium(s) (seuil ${COUT_MIN} bb)…`);
  const podiums = await chercherPodiums({ combien, budget, exclureIds, verbeux });

  if (podiums.length < combien) {
    log(`\n⚠ ${podiums.length} podium(s) constitués pour ${combien} demandés — augmenter --budget si besoin.`);
  }

  const ff = await ffmpegPath();
  const browser = await launch();
  let numero = await prochainNumero(DOSSIER_CONCEPT);
  const produits = [];

  for (const triple of podiums) {
    const bp = podiumBlueprint(triple, { index: numero });
    const dossier = join(DOSSIER_CONCEPT, bp.titre);
    process.stdout.write(`\n  ▶ ${bp.titre.slice(0, 66).padEnd(68)}`);
    const t0 = Date.now();
    const r = await produireMontage(browser, ff, triple[0], bp, dossier);
    if (!r.ok) { console.log(` ✗ ${r.why}`); continue; }
    console.log(` ${r.seconds.toFixed(1)}s · prévu ${bp.dureePrevue.toFixed(1)}s · rendu en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    produits.push({ ...r, triple });
    numero++;
  }

  await browser.close();

  // Mémoire mise à jour : les spots livrés ici ne doivent plus jamais
  // resservir dans un futur lot — c'est la garantie demandée pour la suite.
  for (const p of produits) {
    for (const n of p.triple) historique.spotsUtilises.push(n.id);
    historique.videos.push({
      numero: p.bp.index, titre: p.bp.titre,
      spots: p.triple.map(n => n.id),
    });
  }
  await sauverHistoire(historique);

  return { produits, dossierConcept: DOSSIER_CONCEPT, def };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const combien = Number(arg("--count", "10"));
  const budget = Number(arg("--budget", "2500"));

  const { produits, dossierConcept, def } = await monterPodium({ combien, budget });
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
      console.log(`  ${v.ok ? "✓" : "✗"} ${v.video.padEnd(66)} ${v.duree ? v.duree.toFixed(1) + "s" : ""}`);
      for (const c of ko) console.log(`       ✗ ${c.nom} : ${c.why}`);
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

    console.log(`\n${produits.length} podium(s) monté(s) · ${anomalies} anomalie(s)`);
    console.log(`Livré dans : ${relative(ROOT, dossierConcept)}/`);
    if (anomalies) process.exitCode = 1;
  }
}
