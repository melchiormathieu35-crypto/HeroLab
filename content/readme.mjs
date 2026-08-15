/**
 * Génère les README livrés avec les rushes.
 *
 * Tout ce qui est écrit ici sort du relevé de production : chiffres du moteur,
 * durées réelles des fichiers, contrôles de cadrage. Rien n'est estimé de
 * mémoire, et aucun chiffre de poker n'est écrit à la main.
 *
 * Ce que ces README ne contiennent PAS, volontairement : la voix off, les
 * sous-titres et le texte final à l'écran. Ils relèvent du montage, donc de
 * l'auteur. Le README donne la matière et les chiffres exacts sur lesquels
 * s'appuyer, pas le script à réciter.
 *
 * Usage : node content/readme.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SERIES } from "./spots.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUSH_DIR = join(ROOT, "Format court", "Rush avant montage");

/** Rôle narratif de chaque plan, pour que le monteur sache quoi en faire. */
const ROLES = {
  "01-accroche-main": ["Accroche", "La main seule, resserrée. À poser en premier : on montre le problème avant de l'expliquer. C'est le plan qui doit retenir dans les deux premières secondes."],
  "02-situation-large": ["Situation", "La table entière, fixe. Laisse le temps de lire le board, le pot et la position. À garder si le spectateur doit vraiment comprendre la main."],
  "02b-situation-serree": ["Situation (variante)", "Même moment, resserré sur le board. Plus nerveux, moins informatif. À préférer quand le rythme prime."],
  "03-choix": ["Choix", "Descente de la table vers les options réelles, avec leurs montants. C'est ici que le spectateur décide. Ne coupe pas trop tôt : c'est le plan qui crée l'engagement."],
  "04-verdict": ["Verdict", "La décision instinctive est jouée, le moteur tranche, le coût s'affiche. Le plan de bascule."],
  "04b-verdict-serre": ["Verdict (variante)", "Resserré sur le verdict seul. Coupe plus sèche, sans le raisonnement."],
  "05-preuve-ev": ["Preuve", "L'espérance de chaque option, en big blinds. C'est ce plan qui rend le propos vérifiable — à garder même si tu raccourcis ailleurs."],
};

const nb = (n) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

/**
 * Décrit le paradoxe du spot avec les seuls chiffres du moteur.
 * Retourne null si le moteur n'a pas produit d'analyse — on n'invente pas.
 */
function lecture(e) {
  if (!e) return null;
  const passer = e.options.find(o => o.action === "fold");
  const choisi = e.joue;
  const best = e.meilleure;
  const pire = e.options[e.options.length - 1];
  const lignes = [];

  lignes.push(`Le moteur donne au héros **${e.equity} % d'équité**.`);
  if (choisi.evBB < 0 && passer) {
    lignes.push(
      `L'action instinctive — ${choisi.label} — vaut **${nb(choisi.evBB)} bb**. ` +
      `Comme passer vaut 0 par construction, cela veut dire, littéralement, ` +
      `que ce coup coûte plus cher que de jeter la main.`);
  } else {
    lignes.push(`L'action instinctive — ${choisi.label} — vaut **${nb(choisi.evBB)} bb**.`);
  }
  lignes.push(`La meilleure option est **${best.label}**, à **${nb(best.evBB)} bb**.`);
  lignes.push(`L'écart entre les deux, soit le coût de l'erreur, est de **${e.lossBB.toFixed(2)} bb**. ` +
    `Le verdict rendu par l'application est « ${e.verdict} ».`);
  // On ne répète pas l'action instinctive si c'est déjà elle la pire.
  if (pire && pire.evBB < 0 && pire.label !== choisi.label) {
    lignes.push(`La pire option du spot est ${pire.label}, à ${nb(pire.evBB)} bb.`);
  }
  return lignes;
}

function readmeVideo(v) {
  const plans = v.shots.filter(s => s.ok);
  const rates = v.shots.filter(s => !s.ok);
  const duree = plans.reduce((n, s) => n + s.seconds, 0);
  const e = v.engine;
  const serie = v.serie ? SERIES[v.serie] : null;
  const l = lecture(e);

  const cadrageKo = (v.framing || []).filter(f => !f.ok);

  return `# ${v.label}

Rushes verticaux prêts à monter — \`${v.id}\`${serie ? ` · série « ${serie.title} »` : ""}

${plans.length} plan(s), ${duree.toFixed(1)} s de matière au total, 1080×1920, 30 im/s.

---

## Ce que dit le moteur

${l ? l.map(x => `- ${x}`).join("\n") : "**NON VÉRIFIÉ** — le moteur n'a pas produit d'analyse pour ce spot lors de cette prise."}

${e ? `### Espérance de chaque option

Valeurs en big blinds, à partir de la décision. Passer vaut 0 : c'est la
référence commune, l'argent déjà investi étant ignoré pour toutes les options.
Un chiffre négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
${e.options.map(o => `| ${o.label} | ${nb(o.evBB)} bb |`).join("\n")}

Ces valeurs sont celles affichées à l'écran dans le plan \`05-preuve-ev\`. Elles
proviennent de \`Judge.evaluate\` et sont, comme l'indique l'application
elle-même, des estimations sur la range adverse et les profils en jeu — un
ordre de grandeur et un classement, pas une vérité au centième. Ne les présente
pas comme une sortie de solveur.` : ""}

---

## Les plans

| fichier | durée | rôle |
|---|---|---|
${plans.map(s => `| \`${s.name}.webm\` | ${s.seconds.toFixed(1)} s | ${(ROLES[s.name] || ["—"])[0]} |`).join("\n")}

${plans.map(s => {
  const r = ROLES[s.name] || ["—", "—"];
  return `### \`${s.name}.webm\` — ${r[0]}\n\n${r[1]}`;
}).join("\n\n")}

${rates.length ? `\n> **Plans manquants** : ${rates.map(s => `\`${s.name}\` (${s.why})`).join(", ")}\n` : ""}
---

## Montage suggéré

Un ordre qui fonctionne, à ajuster :

1. \`01-accroche-main\` — la main, sans contexte.
2. \`02-situation-large\` ou \`02b-situation-serree\` — une seule des deux.
3. \`03-choix\` — le spectateur décide.
4. \`04-verdict\` ou \`04b-verdict-serre\` — la bascule.
5. \`05-preuve-ev\` — les chiffres.

Les plans sont indépendants : aucun ne dépend du précédent, l'ordre et les
coupes restent entièrement libres. Chacun commence sur une image posée, donc
une coupe franche au début d'un plan ne coupe jamais un mouvement.

Les mouvements de caméra sont calculés image par image, pas enregistrés au vol :
un ralenti ou un accéléré sur ces plans reste propre.

---

## Ce qui n'est pas fait ici, volontairement

- **pas de voix off** ;
- **pas de sous-titres** ;
- **pas de texte final à l'écran** ;
- **pas de montage**.

Ces éléments t'appartiennent. Le README fournit les chiffres exacts pour que
rien de ce que tu écriras ne contredise ce qui est à l'image.

---

## Distribution

**Format livré** : WebM / VP8, 1080×1920, 30 im/s.

Ce point demande une action de ta part : le \`ffmpeg\` disponible dans
l'environnement de production est compilé sans multiplexeur MP4 — il ne sait
écrire que du WebM. TikTok, Reels et Shorts privilégient MP4/H.264. Les WebM
s'importent sans problème dans CapCut, Premiere, DaVinci Resolve ou Final Cut,
donc cela ne gêne pas le montage ; c'est à l'export final que le MP4 se fait.
Si tu veux convertir un rush avant montage, avec un ffmpeg complet :

\`\`\`sh
ffmpeg -i 01-accroche-main.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p 01-accroche-main.mp4
\`\`\`

**Zones à ne pas encombrer.** Les plans sont cadrés en tenant compte de
l'interface des plateformes : rien d'important n'est placé dans les 10 % du
haut ni les 20 % du bas, ni dans la bande droite des boutons. Garde cette
contrainte pour tes textes ajoutés.

**Durées.** La matière totale est de ${duree.toFixed(0)} s. En gardant une
variante sur deux aux étapes 2 et 4, il reste environ ${(duree - (plans.find(s => s.name === "02b-situation-serree")?.seconds || 0) - (plans.find(s => s.name === "04b-verdict-serre")?.seconds || 0)).toFixed(0)} s,
ce qui laisse de la marge pour resserrer vers 20–30 s.

**Ordre de publication.** Le plan de preuve est ce qui distingue ce contenu
d'une simple question de quiz : il montre le calcul. Si tu publies plusieurs
vidéos de la série, garde ce plan dans toutes — c'est lui qui installe la
crédibilité et justifie l'application.

${cadrageKo.length ? `\n> **Réserves de cadrage relevées à la prise** : ${cadrageKo.map(f => `${f.plan} (${f.why})`).join(", ")}. À vérifier à l'œil avant publication.\n` : ""}
---

## Reproduire ce spot

Le spot est défini dans le DSL Studio de Hero Lab. Ouvre l'application avec
\`?admin=1\` et colle ceci pour retrouver exactement la même main :

\`\`\`
${v.spec}
\`\`\`

Rejouer la production : \`node content/produce.mjs --spot ${v.id}\`
`;
}

function readmeIndex(releve) {
  const total = releve.reduce((n, v) => n + v.shots.filter(s => s.ok).reduce((m, s) => m + s.seconds, 0), 0);
  return `# Rushes avant montage — format court

Matière brute pour TikTok, Reels et Shorts, produite depuis le mode Studio de
Hero Lab. ${releve.length} vidéo(s), ${releve.reduce((n, v) => n + v.shots.filter(s => s.ok).length, 0)} plans,
${total.toFixed(0)} s au total. Tous les plans sont en 1080×1920, 30 im/s.

| vidéo | spot | plans | durée | série |
|---|---|---|---|---|
${releve.map(v => {
  const p = v.shots.filter(s => s.ok);
  return `| [${v.label}](${encodeURI(relative(RUSH_DIR, v.dir))}/README.md) | \`${v.id}\` | ${p.length} | ${p.reduce((n, s) => n + s.seconds, 0).toFixed(0)} s | ${v.serie || "—"} |`;
}).join("\n")}

## Comment ces spots ont été choisis

Ils ne l'ont pas été à la main. \`content/scan.mjs\` soumet chaque spot candidat
au moteur de l'application, lit l'espérance de chaque option légale, et classe
selon trois mesures : l'action instinctive est-elle perdante, l'équité
contredit-elle la bonne décision, et combien coûte l'erreur. On mesure d'abord,
on raconte ensuite — jamais l'inverse.

## La chaîne

| étape | commande | rôle |
|---|---|---|
| catalogue | \`content/spots.mjs\` | spots candidats, en DSL Studio |
| sélection | \`node content/scan.mjs\` | classement par le moteur |
| tournage | \`node content/produce.mjs --serie <clé>\` | plans 1080×1920 |
| contrôle | \`node content/qa.mjs\` | format, durée, image, cadrage |
| README | \`node content/readme.mjs\` | cette documentation |

## Ce qui n'est pas fourni

Voix off, sous-titres, texte à l'écran et montage final. Chaque README de
vidéo donne en revanche les chiffres exacts du moteur, pour que le texte
ajouté ne contredise jamais l'image.

## Format des fichiers

WebM / VP8. Le \`ffmpeg\` de l'environnement de production est compilé sans
multiplexeur MP4. Les fichiers s'importent tels quels dans les logiciels de
montage courants ; la conversion en MP4 se fait à l'export final. La commande
de conversion figure dans chaque README de vidéo.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const relevePath = join(RUSH_DIR, "production.json");
  if (!existsSync(relevePath)) {
    console.error(`relevé absent : ${relevePath} — lancer content/produce.mjs d'abord`);
    process.exit(1);
  }
  const releve = JSON.parse(await readFile(relevePath, "utf8"));
  for (const v of releve) {
    const p = join(v.dir, "README.md");
    await writeFile(p, readmeVideo(v));
    console.log("écrit :", relative(ROOT, p));
  }
  const idx = join(RUSH_DIR, "README.md");
  await writeFile(idx, readmeIndex(releve));
  console.log("écrit :", relative(ROOT, idx));
}
