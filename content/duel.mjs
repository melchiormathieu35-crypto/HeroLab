/**
 * Duel de profils — le concept n° 2 du format court.
 *
 * Même main, même board, même mise en face : seul l'adversaire change. La même
 * action, correcte contre le profil A, devient une erreur chiffrée contre le
 * profil B. C'est le concept qui exploite le mieux l'atout propre du produit :
 * un moteur qui réagit aux profils — les vidéos concurrentes affirment, ici la
 * bascule est calculée et montrée à l'écran.
 *
 * SÉLECTION PAR LE MOTEUR, PAS PAR LE GOÛT. Une paire (A, B) n'est retenue que
 * si le moteur lui-même donne des réponses de familles opposées sur les deux
 * versions du spot, que l'action optimale contre A existe telle quelle contre
 * B, et qu'aucun des deux côtés n'est fragile (gardes de scan.mjs : équité
 * plancher, marge de fold equity, écart de tête). Le contraste — ce que la
 * même action perd en passant de A à B — sert de classement.
 *
 * Les habits (README, SCRIPT, QA, rangement par concept) sont ceux du Quizz.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openShot, ANCHORS } from "./studio.mjs";
import { ffmpegPath } from "./produce.mjs";
import { genererSpots, PROFILS as PROFILS_DSL } from "./generate.mjs";
import {
  CONCEPTS, COURT_DIR, DUREE_CIBLE, produireMontage, prochainNumero,
  evaluerEtNoter, freresParModele, slug, CATALOGUE_COMPLET,
} from "./montage.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONCEPT = "duel-profils";

/** Contraste minimal pour qu'un duel vaille une vidéo, en bb. */
export const CONTRASTE_MIN = 2;

const famille = (a) => (a === "bet" || a === "raise" ? "aggro" : a);

/**
 * Les situations de base : celles du classement des rushs. Elles ont déjà
 * traversé l'exploration, le barème et les gardes — on ne repart pas de zéro,
 * on fait varier l'adversaire sur des situations prouvées.
 */
async function basesDuClassement() {
  const classement = JSON.parse(
    await readFile(join(ROOT, "Format court", "Rush avant montage", "classement.json"), "utf8"));
  const bases = [];
  for (const c of classement) {
    const m = JSON.parse(await readFile(join(ROOT, c.dossier, "manifest.json"), "utf8"));
    bases.push(m.spot.id);
  }
  return bases;
}

/**
 * Les frères de profil d'un spot : la MÊME spec, au mot du profil près.
 *
 * Première version : on retrouvait les frères dans le catalogue. Faux à
 * l'image — le catalogue assigne la limite par une formule qui dépend du nom
 * du profil, si bien que le « frère » de NL50 se jouait en NL10 : mêmes
 * montants en big blinds, mais tous les euros changeaient à l'écran, et la
 * promesse « seul l'adversaire change » devenait visiblement fausse. Constaté
 * sur une image extraite de la manche B, pas dans un rapport.
 *
 * On construit donc la variante en remplaçant UNIQUEMENT le mot du profil
 * dans la ligne Villains — profils pris dans le catalogue du produit, spec
 * identique au reste. La promesse est alors littérale : un seul mot diffère
 * entre les deux specs, et c'est vérifiable.
 */
export function freresDeProfil(id, catalogue) {
  const spot = catalogue.find(s => s.id === id);
  if (!spot) return [];
  return PROFILS_DSL.map(p => {
    if (p === spot.profil) return spot;
    const spec = spot.spec.replace(`(${spot.profil},`, `(${p},`);
    if (spec === spot.spec) return null;                       // profil introuvable dans la spec
    return { ...spot, profil: p, spec, id: spot.id.replace(`_${spot.profil}`, `_${p}`) };
  }).filter(Boolean);
}

/**
 * Cherche les meilleures paires de duel.
 *
 * Pour chaque situation de base, chaque profil est évalué par le moteur ; une
 * paire est valable quand :
 *   - la meilleure action contre A est agressive et non fragile ;
 *   - cette action, au même libellé, est perdante contre B (EV < 0) ;
 *   - la meilleure action contre B est d'une autre famille ;
 *   - B n'est pas fragile non plus.
 * Le contraste = EV(action, A) − EV(action, B), en bb.
 */
export async function chercherDuels({ combien = 3, verbeux = true } = {}) {
  const log = (s) => { if (verbeux) console.log(s); };
  const catalogue = genererSpots({ max: CATALOGUE_COMPLET });
  const bases = await basesDuClassement();
  const freres = freresParModele();

  const browser = await launch();
  const { ctx, page } = await openShot(browser);

  const duels = [];
  for (const baseId of bases) {
    const variantes = freresDeProfil(baseId, catalogue);
    if (variantes.length < 2) continue;
    log(`  ${baseId} — ${variantes.length} profils à évaluer`);

    const notes = [];
    for (const v of variantes) {
      try { notes.push(await evaluerEtNoter(page, v, { freresDuModele: freres[v.modele] })); }
      catch { /* variante non jouable : ignorée */ }
    }

    for (const A of notes) {
      if (A.fragile || famille(A.best.action) !== "aggro") continue;
      const action = A.best.label;
      for (const B of notes) {
        if (B === A || B.fragile) continue;
        if (famille(B.best.action) === famille(A.best.action)) continue;
        const optB = B.options.find(o => o.label === action);
        if (!optB || optB.evBB >= 0) continue;    // la bascule doit être une vraie perte
        const contraste = A.best.evBB - optB.evBB;
        if (contraste < CONTRASTE_MIN) continue;
        duels.push({ base: baseId, A, B, action, evA: A.best.evBB, evB: optB.evBB, contraste });
      }
    }
  }

  await ctx.close();
  await browser.close();

  // Meilleur duel par situation de base, puis diversité de modèles.
  duels.sort((a, b) => b.contraste - a.contraste);
  const parBase = new Map();
  for (const d of duels) if (!parBase.has(d.base)) parBase.set(d.base, d);

  const plafondModele = Math.max(1, Math.ceil(combien / 2));
  const parModele = new Map();
  const retenus = [];
  for (const d of [...parBase.values()].sort((a, b) => b.contraste - a.contraste)) {
    if (retenus.length >= combien) break;
    const n = parModele.get(d.A.modele) || 0;
    if (n >= plafondModele) continue;
    parModele.set(d.A.modele, n + 1);
    retenus.push(d);
  }
  if (retenus.length < combien) {
    for (const d of [...parBase.values()].sort((a, b) => b.contraste - a.contraste)) {
      if (retenus.length >= combien) break;
      if (!retenus.includes(d)) retenus.push(d);
    }
  }
  return { retenus, examines: duels.length, bases: bases.length };
}

/**
 * Plan de tournage d'un duel. Deux manches sur la même page, coupes franches,
 * chaque geste de caméra justifié. La même action est jouée deux fois — c'est
 * le principe — et c'est le libellé exact de l'option qui la désigne.
 */
export function duelBlueprint(duel, { index = 1 } = {}) {
  const { A, B, action } = duel;
  const beats = [];

  // ── HOOK — la main seule, comme au quizz : elle est le point commun des
  // deux manches, donc la seule ouverture honnête.
  beats.push({
    beat: "HOOK",
    role: "Montrer la main, point commun des deux manches. L'accroche est la promesse d'un duel, pas un chiffre.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.hand, at: 0.42 },
      { type: "fixe", duree: 0.6 },
      {
        type: "zoomIn", cible: ".hero-hand .cards", de: 1, a: "max", duree: 0.9,
        pourquoi: "Resserrer sur les cartes pose le point commun des deux manches sans montrer encore l'adversaire.",
      },
      { type: "controle", cible: ".hero-hand .cards", texte: ".pc" },
      { type: "fixe", duree: 2.0 },
    ],
  });

  // ── MANCHE A — la table, adversaire A visible (badge de profil à l'écran).
  beats.push({
    beat: "MANCHE A",
    role: `Poser la table contre le premier adversaire (${A.profil}). Son badge de profil est à l'écran.`,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "controle", cible: ANCHORS.table, texte: A.spec.includes("Flop:") ? ".board" : ".pot" },
      { type: "fixe", duree: 4.6 },
    ],
  });

  // ── CHOICE A — les options réelles, le spectateur choisit.
  beats.push({
    beat: "CHOICE A",
    role: "Les options et leurs montants. Le spectateur décide contre CE profil.",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.7 },
      {
        type: "pan", cible: ".actions", duree: 0.9, at: 0.16, align: "top",
        pourquoi: "Descendre de la table vers les boutons reproduit le geste du joueur qui décide.",
      },
      { type: "controle", cible: ".actions", texte: ".a-n" },
      { type: "fixe", duree: 3.4 },
    ],
  });

  // ── REVEAL A — l'action optimale contre A est jouée, puis la preuve : la
  // liste des espérances, où le chiffre cité par la voix est à l'écran.
  beats.push({
    beat: "REVEAL A",
    role: `Jouer ${action} — le meilleur coup contre ce profil — et montrer la liste des espérances qui le prouve.`,
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.5 },
      {
        type: "jouer", quoi: action,
        pourquoi: "La décision est jouée à l'écran ; le verdict et les chiffres viennent du moteur, pas du commentaire.",
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.evList, duree: 0.9, at: 0.26, align: "top",
        pourquoi: "La liste des espérances est la preuve de la manche : le chiffre dit par la voix doit être lisible à l'image.",
      },
      { type: "controle", cible: ANCHORS.evList, texte: ".ev" },
      { type: "fixe", duree: 3.0 },
    ],
  });

  // ── MANCHE B — même situation rechargée, seul l'adversaire change. Le badge
  // de profil, différent, est la seule chose qui a bougé à l'écran.
  beats.push({
    beat: "MANCHE B",
    role: `Recharger la même situation contre le second adversaire (${B.profil}). Tout est identique sauf le badge de profil.`,
    mouvements: [
      { type: "charger", spec: B.spec },
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "controle", cible: ANCHORS.table, texte: B.spec.includes("Flop:") ? ".board" : ".pot" },
      { type: "fixe", duree: 4.2 },
    ],
  });

  // ── TENSION B — la question du concept : la même action tient-elle encore ?
  beats.push({
    beat: "TENSION B",
    role: "Poser la question du duel : la même action est-elle encore la bonne ?",
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.6 },
      {
        type: "pan", cible: ".hero-hand", duree: 0.8, at: 0.36,
        pourquoi: "Revenir sur la main rappelle que rien n'a changé côté héros : la question ne porte que sur l'adversaire.",
      },
      { type: "controle", cible: ".hero-hand", texte: ".val" },
      {
        type: "freeze", duree: 2.6,
        pourquoi: "L'arrêt laisse le spectateur parier sur la bascule — c'est la participation qui fait la rétention.",
      },
    ],
  });

  // ── REVEAL B — la même action est jouée, le moteur la chiffre en erreur.
  beats.push({
    beat: "REVEAL B",
    role: `Rejouer exactement ${action} contre le second profil : le moteur tranche, verdict et coût à l'écran.`,
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.table, at: 0.22, align: "top" },
      { type: "fixe", duree: 0.5 },
      {
        type: "jouer", quoi: action,
        pourquoi: "La même action, jouée à l'identique : la bascule du verdict vient du seul changement d'adversaire.",
      },
      { type: "fixe", duree: 0.4 },
      {
        type: "pan", cible: ANCHORS.verdict, duree: 0.9, at: 0.10, align: "top",
        pourquoi: "Le bloc verdict porte la bascule ; calé en haut pour que le titre et le coût entrent dans la bande utile.",
      },
      { type: "zoomIn", cible: ".vh", de: 1, a: "max", duree: 0.5, pourquoi: "Le resserrement accompagne le point de bascule de la vidéo : le coût chiffré." },
      { type: "controle", cible: ".vh", texte: ".cost" },
      { type: "fixe", duree: 2.8 },
    ],
  });

  // ── PAYOFF — la liste des espérances de la manche B : la même action au
  // fond du classement, la nouvelle bonne réponse en tête.
  beats.push({
    beat: "PAYOFF",
    role: "La preuve finale : contre B, l'action de la manche A est au fond de la liste des espérances.",
    reveal: true,
    mouvements: [
      { type: "coupe" },
      { type: "cadre", cible: ANCHORS.evList, at: 0.26, align: "top" },
      { type: "controle", cible: ANCHORS.evList, texte: ".ev" },
      { type: "fixe", duree: 1.8, pourquoi: "La nouvelle meilleure option se lit en premier : la réponse avant le coût." },
      {
        type: "panPx", mesure: ".opt-row", duree: 1.5,
        pourquoi: "La descente de la liste fait parcourir la chute de l'action de la manche A — le classement se lit comme la bascule qu'il est.",
      },
      { type: "fixe", duree: 2.4, pourquoi: "Dernière image tenue : la vidéo finit sur la preuve, pas sur un mouvement." },
    ],
  });

  const dureePrevue = beats.reduce((n, b) => n + b.mouvements.reduce((m, x) => m + (x.duree || 0), 0), 0);
  const titreInterne = `${A.label} — puis face à ${B.profil}, la même action bascule`;

  return {
    index, concept: CONCEPT,
    titre: `${String(index).padStart(2, "0")} - ${slug(`${A.heroCls} ${action} correct contre ${A.profil} erreur contre ${B.profil}`)}`,
    titreInterne,
    enonce: `${action} vaut ${A.best.evBB > 0 ? "+" : ""}${A.best.evBB.toFixed(2)} bb contre ${A.profil} et ${duel.evB.toFixed(2)} bb contre ${B.profil} : la même action bascule de ${duel.contraste.toFixed(2)} bb quand seul l'adversaire change.`,
    spot: A.id,
    modele: A.modele,
    signature: `duel|${A.modele}|${A.heroFam}|${A.profil}->${B.profil}`,
    score: Math.round(Math.min(100, 60 + duel.contraste * 4)),
    dureePrevue: Math.round(dureePrevue * 100) / 100,
    momentReveal: "Beat REVEAL B, quand la même action reçoit le verdict opposé.",
    objectifRetention:
      "Retenir par la bascule : le spectateur voit une action validée en manche A, parie sur sa tenue en manche B, " +
      "et découvre que le seul changement d'adversaire l'a rendue perdante. Le PAYOFF montre le reclassement complet.",
    duel: {
      action,
      profilA: A.profil, profilB: B.profil,
      specA: A.spec, specB: B.spec,
      evA: A.best.evBB, evB: duel.evB, contraste: duel.contraste,
      bestB: { label: B.best.label, evBB: B.best.evBB },
      equityA: Math.round(A.equity * 1000) / 10, equityB: Math.round(B.equity * 1000) / 10,
    },
    beats,
  };
}

export async function monterDuels({ combien = 3, verbeux = true } = {}) {
  const def = CONCEPTS[CONCEPT];
  const log = (s) => { if (verbeux) console.log(s); };
  const dossierConcept = join(COURT_DIR, def.dossier);

  log(`\nRecherche des duels (le moteur évalue chaque profil sur chaque situation de base)…`);
  const { retenus, examines, bases } = await chercherDuels({ combien, verbeux });
  log(`  ${bases} situations de base · ${examines} paires valables · ${retenus.length} duel(s) retenu(s)\n`);
  for (const d of retenus) {
    log(`  ${d.A.label}`);
    log(`     ${d.action} : ${d.evA > 0 ? "+" : ""}${d.evA.toFixed(2)} bb contre ${d.A.profil}  →  ${d.evB.toFixed(2)} bb contre ${d.B.profil}  (bascule ${d.contraste.toFixed(2)} bb)`);
  }

  const ff = await ffmpegPath();
  const browser = await launch();
  let numero = await prochainNumero(dossierConcept);
  const produits = [];

  for (const d of retenus) {
    const bp = duelBlueprint(d, { index: numero });
    const dossier = join(dossierConcept, bp.titre);
    process.stdout.write(`\n  ▶ ${bp.titre.slice(0, 66).padEnd(68)}`);
    const t0 = Date.now();
    // Le spot passé à la production est la manche A ; la manche B est rechargée
    // par le blueprint lui-même (mouvement `charger`).
    const r = await produireMontage(browser, ff, d.A, bp, dossier);
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
  const combien = Number(arg("--count", "3"));

  const { produits, dossierConcept, def } = await monterDuels({ combien });
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

    console.log(`\n${produits.length} duel(s) monté(s) · ${anomalies} anomalie(s)`);
    console.log(`Livré dans : ${relative(ROOT, dossierConcept)}/`);
    if (anomalies) process.exitCode = 1;
  }
}
