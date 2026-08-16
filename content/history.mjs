/**
 * Historique de production — mémoire anti-redondance entre exécutions.
 *
 * Le scanner sait déjà éviter les doublons à l'intérieur d'une même passe. Sans
 * mémoire, la passe suivante reproduirait pourtant les mêmes meilleurs spots :
 * le classement est déterministe, donc « les dix meilleurs » restent les dix
 * mêmes. L'historique est ce qui permet à `GENERATE 10 SHORTS` lancé deux fois
 * de produire vingt vidéos différentes plutôt que dix doublons.
 *
 * On mémorise trois niveaux, du plus strict au plus large :
 *
 *   id                 le spot exact
 *   signature          le concept — modèle, famille de main, texture, nature du
 *                      paradoxe, famille d'action correcte
 *   signatureVisuelle  l'accroche — main et texture, pour ne pas ouvrir deux
 *                      vidéos sur la même image
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CHEMIN = join(ROOT, "Format court", "Rush avant montage", "historique.json");

const VIDE = { version: 1, videos: [] };

export async function charger() {
  if (!existsSync(CHEMIN)) return { ...VIDE, videos: [] };
  try {
    const h = JSON.parse(await readFile(CHEMIN, "utf8"));
    return h && Array.isArray(h.videos) ? h : { ...VIDE, videos: [] };
  } catch {
    // Un historique illisible ne doit pas bloquer une production : on repart
    // d'une mémoire vide plutôt que d'échouer, et l'anti-redondance interne à
    // la passe joue quand même son rôle.
    return { ...VIDE, videos: [] };
  }
}

export async function sauver(historique) {
  await mkdir(dirname(CHEMIN), { recursive: true });
  await writeFile(CHEMIN, JSON.stringify(historique, null, 2));
}

/** Ensembles d'exclusion prêts à passer au scanner. */
export function exclusions(historique) {
  return {
    ids: new Set(historique.videos.map(v => v.spot)),
    signatures: new Set(historique.videos.map(v => v.signature)),
    visuelles: new Set(historique.videos.map(v => v.signatureVisuelle).filter(Boolean)),
  };
}

/** Prochain numéro de vidéo libre, en repartant de l'historique. */
export function prochainNumero(historique) {
  const max = historique.videos.reduce((n, v) => Math.max(n, v.numero || 0), 0);
  return max + 1;
}

/** Ajoute une vidéo produite à la mémoire. */
export function enregistrer(historique, { numero, dossier, spot, note, bp, qaOk }) {
  historique.videos.push({
    numero,
    dossier,
    titre: bp.titre,
    titreInterne: bp.titreInterne,
    spot: spot.id,
    modele: spot.modele,
    signature: spot.signature,
    signatureVisuelle: spot.signatureVisuelle,
    score: note.score,
    qa: qaOk ? "ok" : "anomalies",
  });
  return historique;
}
