/**
 * Génère le README de montage livré avec chaque vidéo.
 *
 * Tout ce qui est écrit sort du manifeste de production : chiffres du moteur,
 * durées réelles des fichiers, raisons de chaque mouvement telles qu'elles ont
 * été déclarées dans le blueprint. Aucun chiffre de poker n'est écrit à la main.
 *
 * Ce README ne contient PAS, volontairement, la voix off, les sous-titres ni
 * les textes définitifs : il indique OÙ les placer et sur QUELLES données
 * s'appuyer, pas quoi dire.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bb = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)} bb`;

/** Où poser la voix, les sous-titres et les textes, plan par plan. */
const PLACEMENTS = {
  HOOK: {
    voix: "Rien, ou une seule phrase courte. Le plan doit tenir par l'image.",
    soustitres: "Aucun — ils entreraient en concurrence avec les cartes.",
    textes: "Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs.",
  },
  SITUATION: {
    voix: "Pose du contexte. C'est le plan le plus tolérant à la parole.",
    soustitres: "À partir d'ici, en bas de la bande utile.",
    textes: "Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran.",
  },
  TENSION: {
    voix: "Silence recommandé sur le freeze. Le vide fait le travail.",
    soustitres: "La question, si tu veux la poser à l'écrit.",
    textes: "C'est l'emplacement naturel d'un « tu fais quoi ? ». Ne masque pas le montant.",
  },
  CHOICE: {
    voix: "Énoncé des options, ou silence complet pour laisser choisir.",
    soustitres: "Oui, courts.",
    textes: "Éventuel compte à rebours. Ne recouvre pas les boutons : ce sont eux le sujet.",
  },
  REVEAL: {
    voix: "La bascule. C'est ici que la voix a le plus de valeur.",
    soustitres: "Oui — le verdict doit être lisible sans le son.",
    textes: "Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler.",
  },
  PAYOFF: {
    voix: "Explication de l'écart, calmement.",
    soustitres: "Oui.",
    textes: "Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible.",
  },
};

export function readmeVideo(m, qa) {
  const e = m.moteur;
  const plansOk = m.plans.filter(p => p.ok);
  const duree = plansOk.reduce((n, p) => n + (p.secondes || 0), 0);
  const rates = m.plans.filter(p => !p.ok);
  const qaVideo = qa || null;


  return `# ${m.video} — ${m.titreInterne}

**Titre interne** : ${m.titreInterne}
**Spot** : \`${m.spot.id}\`
**Potentiel contenu** : ${m.score}/100

## Concept

${m.concept}

**Objectif de rétention.** ${m.objectifRetention}

**Moment exact du reveal.** ${m.momentReveal}

---

## Ce que dit le moteur

${e ? `- Le héros a **${e.equity} % d'équité**.
- L'action instinctive est **${e.joue.label}**, à **${bb(e.joue.evBB)}**.${e.joue.evBB < 0 ? `\n  Passer valant 0 par construction, ce coup coûte donc plus cher que de jeter la main.` : ""}
- La meilleure action est **${e.meilleure.label}**, à **${bb(e.meilleure.evBB)}**.
- **Différentiel d'EV : ${e.lossBB.toFixed(2)} bb.** Verdict de l'application : « ${e.verdict} ».` : "**NON VÉRIFIÉ** — aucun plan n'a produit d'analyse moteur pour cette vidéo."}

${e ? `### Espérance de chaque option

En big blinds, à partir de la décision. Passer vaut 0 : c'est la référence
commune, l'argent déjà investi étant ignoré pour toutes les options. Un chiffre
négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
${e.options.map(o => `| ${o.label} | ${bb(o.evBB)} |`).join("\n")}

Ces valeurs sont celles affichées à l'écran dans \`06-payoff.webm\`. Elles
viennent de \`Judge.evaluate\`. Comme l'indique l'application elle-même, ce sont
des estimations sur la range adverse et les profils en jeu — un ordre de
grandeur et un classement, pas une sortie de solveur. Ne les présente pas
autrement.` : ""}

---

## Ordre des rushs

| # | fichier | beat | durée | rôle |
|---|---|---|---|---|
${m.plans.map((p, i) => `| ${i + 1} | ${p.ok ? `\`${p.fichier}\`` : "—"} | ${p.beat} | ${p.ok ? `${p.secondes.toFixed(1)} s` : "raté"} | ${(p.role || "").split(".")[0]}. |`).join("\n")}

**Durée totale de matière : ${duree.toFixed(1)} s.**

${rates.length ? `> **Plans manquants** : ${rates.map(p => `${p.beat} (${p.why})`).join(", ")}\n` : ""}
---

## Détail des plans

${m.plans.filter(p => p.ok).map(p => {
  const pl = PLACEMENTS[p.beat] || {};
  const mv = p.mouvements.filter(x => x.pourquoi);
  return `### \`${p.fichier}\` — ${p.beat} · ${p.secondes.toFixed(1)} s

${p.role}

${mv.length ? `**Mouvements et leur raison**\n\n${mv.map(x => `- *${x.type}*${x.duree ? ` (${x.duree} s)` : ""} — ${x.pourquoi}`).join("\n")}` : "Plan fixe."}

**Montage** — voix : ${pl.voix || "libre."} · sous-titres : ${pl.soustitres || "libre."} · textes : ${pl.textes || "libre."}`;
}).join("\n\n")}

---

## Indications de montage

1. Les plans sont **indépendants** : aucun ne dépend du précédent, l'ordre et
   les coupes restent libres.
2. Chaque plan **commence sur une image posée**, donc une coupe franche au début
   ne coupe jamais un mouvement.
3. Les mouvements sont **calculés image par image**, pas enregistrés au vol : un
   ralenti ou un accéléré reste propre.
4. Le plan \`06-payoff\` est celui à ne pas sacrifier si tu raccourcis : c'est
   lui qui rend le propos vérifiable.

### Emplacement recommandé de la voix, des sous-titres et des textes

| beat | voix | sous-titres | textes |
|---|---|---|---|
${m.plans.filter(p => p.ok).map(p => {
  const pl = PLACEMENTS[p.beat] || {};
  return `| ${p.beat} | ${pl.voix || "—"} | ${pl.soustitres || "—"} | ${pl.textes || "—"} |`;
}).join("\n")}

**Zones à ne pas encombrer.** Les plans sont cadrés en tenant compte de
l'interface des plateformes : rien d'essentiel dans les 10 % du haut, les 20 %
du bas, ni la bande droite des boutons. Garde cette contrainte pour tes ajouts.

**Ce qui n'est pas fait ici, volontairement** : pas de voix off, pas de
sous-titres, pas de texte définitif, pas de montage. Ces éléments t'appartiennent.
Le README fournit les chiffres exacts pour que rien de ce que tu écriras ne
contredise ce qui est à l'image.

---

## Contrôle qualité

${qaVideo ? `${qaVideo.ok ? "**Tous les contrôles sont passés.**" : "**Anomalies relevées — à vérifier avant publication.**"}

| plan | format | durée | image | safe area | cohérence moteur |
|---|---|---|---|---|---|
${qaVideo.plans.map(p => {
  const c = (nom) => { const x = p.controles.find(y => y.nom === nom); return x ? (x.ok ? "ok" : `✗ ${x.why}`) : "—"; };
  return `| \`${p.plan}\` | ${c("format")} | ${c("durée")} | ${c("image")} | ${c("safe area")} | ${c("cohérence moteur")} |`;
}).join("\n")}` : "Non exécuté."}

---

## Format

WebM / VP8, 1080×1920, ${m.format.fps} im/s.

Le \`ffmpeg\` de l'environnement de production est compilé sans multiplexeur
MP4 ; il ne sait écrire que du WebM. Les fichiers s'importent tels quels dans
CapCut, Premiere, DaVinci Resolve et Final Cut, donc le montage n'est pas gêné —
c'est à l'export final que le MP4 se fait. Pour convertir un rush en amont, avec
un ffmpeg complet :

\`\`\`sh
ffmpeg -i 01-hook.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p 01-hook.mp4
\`\`\`

---

## Reproduire ce spot

Ouvre l'application avec \`?admin=1\` et colle ceci dans le mode Studio :

\`\`\`
${m.spot.spec}
\`\`\`
`;
}

export function readmeIndex(videos, qaGlobal) {
  const total = videos.reduce((n, v) => n + v.plans.filter(p => p.ok).reduce((m, p) => m + p.secondes, 0), 0);
  return `# Rushes avant montage — format court

Matière brute pour TikTok, Instagram Reels et YouTube Shorts, produite depuis le
mode Studio de Hero Lab. ${videos.length} vidéo(s), ${videos.reduce((n, v) => n + v.plans.filter(p => p.ok).length, 0)} plans,
${total.toFixed(0)} s au total. Tout est en 1080×1920, 30 im/s, un plan par fichier.

| vidéo | titre interne | score | plans | durée | différentiel EV |
|---|---|---|---|---|---|
${videos.map(v => {
  const p = v.plans.filter(x => x.ok);
  return `| [${v.video}](${encodeURI(v.video)}/README.md) | ${v.titreInterne} | ${v.score}/100 | ${p.length} | ${p.reduce((n, x) => n + x.secondes, 0).toFixed(0)} s | ${v.moteur ? v.moteur.lossBB.toFixed(2) + " bb" : "—"} |`;
}).join("\n")}

## Comment ces spots ont été choisis

Aucun n'a été choisi à la main. La chaîne énumère des situations réelles à
partir du vocabulaire du produit (positions, profils, limites, grammaire
Studio), soumet chacune à \`Judge.evaluate\`, et note le potentiel de contenu sur
100 à partir des seuls chiffres du moteur : paradoxe, contre-intuitivité,
différentiel d'EV, difficulté, curiosité, lisibilité, force du reveal, intérêt
pédagogique, potentiel de débat et de série.

Deux garde-fous s'appliquent ensuite :

- **anti-redondance** — deux spots qui racontent la même chose (même modèle,
  même famille de main, même texture, même nature de paradoxe, même famille
  d'action correcte) ne donnent qu'une vidéo, la mieux notée ;
- **fragilité** — un spot dont la bonne réponse repose entièrement sur
  l'estimation de fold equity du modèle est écarté, même s'il score haut. Voir
  \`content/scan.mjs\`.

## La chaîne

| étape | commande | rôle |
|---|---|---|
| génération | \`content/generate.mjs\` | énumère les situations à partir du vocabulaire réel |
| sélection | \`node content/scan.mjs\` | note sur 100, écarte fragiles et doublons |
| blueprint | \`content/blueprint.mjs\` | traduit un spot en plan de tournage |
| tournage | \`content/produce.mjs\` | exécute le blueprint, image par image |
| contrôle | \`node content/qa.mjs\` | format, durée, image, cadrage, cohérence moteur |
| README | \`content/readme.mjs\` | cette documentation |
| tout | \`node content/engine.mjs --count 10\` | la chaîne complète |

${qaGlobal ? `## Contrôle qualité

${qaGlobal.anomalies === 0
  ? `**${qaGlobal.plans} plans contrôlés, aucune anomalie.**`
  : `**${qaGlobal.anomalies} anomalie(s) sur ${qaGlobal.plans} plans contrôlés.** Détail dans le README de chaque vidéo.`}` : ""}

## Ce qui n'est pas fourni

Voix off, sous-titres, textes définitifs et montage final. Chaque README de
vidéo donne en revanche les chiffres exacts du moteur et l'emplacement
recommandé de chaque élément, pour que le texte ajouté ne contredise jamais
l'image.
`;
}

export async function ecrireReadmes(dossiers, rapportQA) {
  const videos = [];
  for (const d of dossiers) {
    const m = JSON.parse(await readFile(join(d, "manifest.json"), "utf8"));
    const qa = rapportQA ? rapportQA.find(v => v.dossier === d) : null;
    await writeFile(join(d, "README.md"), readmeVideo(m, qa));
    videos.push(m);
  }
  return videos;
}
