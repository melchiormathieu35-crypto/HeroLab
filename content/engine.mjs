/**
 * Content Engine — la chaîne complète, en une commande.
 *
 *   node content/engine.mjs --count 10
 *
 * Enchaîne : exploration → notation → anti-redondance → blueprint → tournage →
 * QA → README → classement → historique.
 *
 * L'architecture est dimensionnée pour que passer de 10 à 30 vidéos ne demande
 * qu'un nombre : rien n'est écrit en dur pour un compte donné. Ce qui varie avec
 * l'échelle, c'est la taille de l'exploration (`--explore`), calculée par défaut
 * à partir du nombre demandé.
 *
 * L'historique fait que deux exécutions successives ne produisent pas les mêmes
 * vidéos : le classement étant déterministe, sans mémoire « les dix meilleurs »
 * resteraient les dix mêmes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./studio.mjs";
import { scan } from "./scan.mjs";
import { blueprint } from "./blueprint.mjs";
import { produireVideo, ffmpegPath, RUSH_DIR } from "./produce.mjs";
import { qa } from "./qa.mjs";
import { ecrireReadmes, readmeIndex } from "./readme.mjs";
import * as histo from "./history.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/**
 * Diversité de la sélection finale.
 *
 * Sans plafond, les meilleures notes se concentrent sur un ou deux modèles de
 * situation : le classement est cohérent, donc il répète. Un plafond par modèle
 * garantit que dix vidéos couvrent plusieurs types de décision plutôt que dix
 * variantes de la même.
 */
export function selectionner(candidats, combien) {
  const plafondModele = Math.max(1, Math.ceil(combien / 3));
  // Plafond par LEÇON. La signature de concept distingue les familles de main,
  // si bien que « défendre sa grosse blinde face à un nit » ressortait trois
  // fois de suite avec 88, KTs puis Q9s : trois habits, une seule leçon. Le
  // couple modèle + famille d'action correcte capture ce que la vidéo enseigne.
  const plafondLecon = Math.max(1, Math.ceil(combien / 5));
  const parModele = new Map();
  const parLecon = new Map();
  const retenus = [];

  for (const c of candidats) {
    if (retenus.length >= combien) break;
    const lecon = `${c.modele}|${c.famBest}`;
    const n = parModele.get(c.modele) || 0;
    const l = parLecon.get(lecon) || 0;
    if (n >= plafondModele || l >= plafondLecon) continue;
    parModele.set(c.modele, n + 1);
    parLecon.set(lecon, l + 1);
    retenus.push(c);
  }
  // Si le plafond a été trop strict pour atteindre le compte, on complète avec
  // les meilleurs restants plutôt que de livrer moins que demandé.
  if (retenus.length < combien) {
    for (const c of candidats) {
      if (retenus.length >= combien) break;
      if (!retenus.includes(c)) retenus.push(c);
    }
  }
  return retenus;
}

export async function generer({ combien = 10, explorer = null, verbeux = true } = {}) {
  const explore = explorer || Math.max(400, combien * 80);
  const log = (s) => { if (verbeux) console.log(s); };

  // ── 1. Mémoire des productions précédentes
  const historique = await histo.charger();
  const ex = histo.exclusions(historique);
  log(`\nHistorique : ${historique.videos.length} vidéo(s) déjà produite(s)\n`);

  // ── 2. Exploration et notation
  log(`Exploration de ${explore} situations…`);
  const { retenus, ecartes, fragiles, evalues, candidats, rejets } = await scan({
    max: explore, exclureSignatures: ex.signatures, exclureIds: ex.ids, verbeux: false,
  });
  log(`  ${candidats} candidats · ${evalues} évalués · ${fragiles} écartés pour fragilité · ${retenus.length} retenus`);
  if (rejets.size) {
    const top = [...rejets].sort((a, b) => b[1] - a[1])[0];
    log(`  rejets de construction : ${[...rejets.values()].reduce((a, b) => a + b, 0)} (principal : ${top[0]})`);
  }

  // ── 3. Sélection diversifiée
  const choisis = selectionner(retenus.filter(r => !ex.visuelles.has(r.signatureVisuelle)), combien);
  if (choisis.length < combien) {
    log(`\n⚠ ${choisis.length} spots disponibles pour ${combien} demandés — l'exploration ou l'historique limite le choix.`);
  }
  log(`\nSélection : ${choisis.length} spot(s)\n`);

  // ── 4. Tournage
  const ff = await ffmpegPath();
  const browser = await launch();
  const produits = [];
  let numero = histo.prochainNumero(historique);

  for (const spot of choisis) {
    const bp = blueprint(spot, spot, { index: numero });
    const dossier = join(RUSH_DIR, bp.titre);
    process.stdout.write(`  ▶ ${bp.titre}  ${spot.label.slice(0, 46).padEnd(48)}`);
    const t0 = Date.now();
    const r = await produireVideo(browser, ff, spot, bp, dossier);
    const ok = r.plans.filter(p => p.ok).length;
    const duree = r.plans.filter(p => p.ok).reduce((n, p) => n + p.seconds, 0);
    console.log(` ${ok}/${r.plans.length} plans · ${duree.toFixed(1)}s · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    for (const p of r.plans) if (!p.ok) console.log(`       ✗ ${p.plan} : ${p.why}`);
    produits.push({ ...r, numero, spot });
    numero++;
  }
  await browser.close();

  // ── 5. QA sur ce qui vient d'être écrit
  log(`\nContrôle qualité…`);
  const rapportQA = await qa({ dossiers: produits.map(p => p.dossier) });
  const anomalies = rapportQA.reduce((n, v) =>
    n + v.plans.reduce((m, p) => m + p.controles.filter(c => !c.ok).length, 0) + (v.ordre.ok ? 0 : 1), 0);
  const nplans = rapportQA.reduce((n, v) => n + v.plans.length, 0);
  log(`  ${rapportQA.length} vidéo(s), ${nplans} plans, ${anomalies} anomalie(s)`);
  for (const v of rapportQA) {
    if (v.ok) continue;
    console.log(`  ✗ ${v.video}`);
    for (const p of v.plans) for (const c of p.controles.filter(x => !x.ok)) console.log(`       ${p.plan} · ${c.nom} : ${c.why}`);
    if (!v.ordre.ok) console.log(`       ordre : ${v.ordre.why}`);
  }

  // ── 6. README
  const manifests = await ecrireReadmes(produits.map(p => p.dossier), rapportQA);
  await mkdir(RUSH_DIR, { recursive: true });
  await writeFile(join(RUSH_DIR, "README.md"), readmeIndex(manifests, { plans: nplans, anomalies }));

  // ── 7. Classement, du plus fort potentiel au plus faible
  const classement = produits
    .map(p => ({
      video: p.bp.titre, titre: p.bp.titreInterne, score: p.bp.score,
      dossier: relative(ROOT, p.dossier),
      differentielEV: p.moteur ? p.moteur.lossBB : null,
      qa: rapportQA.find(v => v.dossier === p.dossier)?.ok ? "ok" : "anomalies",
    }))
    .sort((a, b) => b.score - a.score);
  await writeFile(join(RUSH_DIR, "classement.json"), JSON.stringify(classement, null, 2));

  // ── 8. Historique
  for (const p of produits) {
    histo.enregistrer(historique, {
      numero: p.numero, dossier: relative(ROOT, p.dossier),
      spot: p.spot, note: p.spot, bp: p.bp,
      qaOk: rapportQA.find(v => v.dossier === p.dossier)?.ok,
    });
  }
  await histo.sauver(historique);

  return { produits, rapportQA, classement, anomalies, nplans };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const combien = Number(arg("--count", "10"));
  const explorer = arg("--explore", null) ? Number(arg("--explore")) : null;

  const { classement, anomalies, nplans } = await generer({ combien, explorer });

  console.log(`\nClassement\n`);
  for (const c of classement) {
    console.log(`  ${String(c.score).padStart(3)}/100  ${c.video.padEnd(10)} ${c.titre.slice(0, 50).padEnd(52)} ` +
      `${c.differentielEV !== null ? (c.differentielEV.toFixed(2) + "bb").padStart(8) : "       —"}  ${c.qa}`);
  }
  console.log(`\n${classement.length} vidéo(s) · ${nplans} plans · ${anomalies} anomalie(s)`);
  console.log(`Livré dans : ${relative(ROOT, RUSH_DIR)}/`);
  if (anomalies) process.exitCode = 1;
}
