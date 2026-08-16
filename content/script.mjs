/**
 * Script de voix off et de sous-titres, par vidéo montée.
 *
 * Généré à partir du manifeste de production : la situation vient de la spec
 * Studio, les chiffres viennent de `Judge.evaluate`, les timecodes du compteur
 * d'images de l'encodeur. AUCUN chiffre n'est écrit à la main, et aucune
 * affirmation chiffrée n'est inventée (« 9 joueurs sur 10 se trompent » n'a pas
 * de source, donc n'apparaît jamais).
 *
 * STATUT DU TEXTE : c'est une PROPOSITION, calibrée sur la durée réelle de
 * chaque beat (~2,3 mots par seconde de voix posée). Le ton se reformule
 * librement ; les chiffres, eux, sont ceux de l'écran et ne doivent pas être
 * modifiés — le spectateur les a sous les yeux au même moment.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Débit de parole, en mots par seconde — la contrainte qui calibre chaque ligne.
 *
 * 2,8 mots/s ≈ 170 mots/min : le débit d'une voix off dynamique de format
 * court, plus rapide qu'une lecture posée mais sans précipitation. La règle est
 * APPLIQUÉE, pas décorative : le générateur refuse d'écrire une ligne qui ne
 * tient pas dans la fenêtre de son beat — un script trop long pour sa vidéo
 * n'est pas un script, c'est un problème repoussé au moment de l'enregistrement.
 */
export const DEBIT = 2.8;

const tc = (s) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(2).padStart(5, "0")}`;
};

const SYMBOLES = { h: "♥", d: "♦", c: "♣", s: "♠" };
const carte = (c) => c.replace(/^(.+)([hdcs])$/, (_, r, s) => (r === "T" ? "10" : r) + SYMBOLES[s]);
const cartes = (liste) => liste.trim().split(/\s+/).map(carte).join(" ");

/** Positions en français parlé. */
const POSITIONS = {
  UTG: "l'UTG", HJ: "le hijack", CO: "le cutoff",
  BTN: "le bouton", SB: "la petite blinde", BB: "la grosse blinde",
};
const EN_POSITION = {
  UTG: "UTG", HJ: "au hijack", CO: "au cutoff",
  BTN: "au bouton", SB: "en petite blinde", BB: "en grosse blinde",
};

/**
 * Profils en français parlé — les glossaires de l'application, résumés.
 * « profil … » plutôt qu'un adjectif nu : l'adjectif s'accorderait avec la
 * position (« la petite blinde, très serré » est fautif), le nom « profil »
 * reste invariable quel que soit le siège.
 */
const PROFILS = {
  nit: "profil très serré", tag: "profil serré-agressif", lag: "profil large-agressif",
  reg: "un régulier solide", fish: "un joueur faible", station: "du genre à tout payer",
  maniac: "profil hyper-agressif", rec: "un récréatif",
};

/**
 * Lit la spec Studio — la même grammaire que `Studio.parse`, en lecture seule.
 * On n'interprète rien : on traduit les actions écrites, telles quelles.
 */
export function lireSpec(spec) {
  const l = Object.fromEntries(spec.split("\n").map(x => {
    const i = x.indexOf(":");
    return [x.slice(0, i).trim().toLowerCase(), x.slice(i + 1).trim()];
  }));
  const hero = /^(\w+),\s*([^,]+),\s*(\d+)bb$/.exec(l.hero || "");
  const table = /^(\S+),\s*(\S+)$/.exec(l.table || "");
  const vilains = (l.villains || "").split(/\)\s*,/).map(v => {
    const m = /^\s*(\w+)\s*\((\w+)/.exec(v);
    return m ? { pos: m[1], profil: m[2] } : null;
  }).filter(Boolean);

  const rue = (txt) => {
    if (!txt) return null;
    const [avant, apres] = txt.includes("|") ? txt.split("|") : [null, txt];
    return { board: avant ? avant.trim() : null, actions: apres.trim() };
  };
  return {
    hero: hero ? { pos: hero[1], cartes: hero[2].trim(), stack: hero[3] } : null,
    table: table ? { taille: table[1], limite: table[2] } : null,
    vilains,
    preflop: l.preflop ? { board: null, actions: l.preflop } : null,
    flop: rue(l.flop),
    turn: rue(l.turn),
    river: rue(l.river),
  };
}

const virgule = (n) => String(n).replace(".", ",");

/**
 * Traduit une liste d'actions de la spec en français parlé.
 *
 * `compact` remplace la position du vilain par « il » et omet les montants —
 * sauf `garderMontant`, qui les conserve (utilisé pour la dernière rue : c'est
 * la mise qui pose le problème, son montant doit être dit).
 */
export function direActions(actions, { compact = false, garderMontant = true } = {}) {
  const dits = [];
  for (const a of actions.split(",").map(x => x.trim())) {
    if (/to act$/i.test(a)) continue;      // c'est la décision : elle n'est pas encore prise
    const m = /^(\w+)\s+(raise|bet|call|check|fold)\s*([\d.]+)?(bb)?/i.exec(a);
    if (!m) continue;
    const tu = m[1] === "hero";
    const qui = tu ? "tu" : compact ? "il" : (POSITIONS[m[1]] || m[1]);
    const verbe = {
      raise: (tu ? "relances" : "relance") + (m[3] && garderMontant ? ` à ${virgule(m[3])} bb` : ""),
      bet: (tu ? "mises" : "mise") + (m[3] && garderMontant ? ` ${virgule(m[3])} bb` : ""),
      call: tu ? "paies" : "paie",
      check: tu ? "checkes" : "check",
      fold: tu ? "passes" : "passe",
    }[m[2].toLowerCase()];
    dits.push(`${qui} ${verbe}`);
  }
  return dits.join(", ");
}

const mots = (txt) => txt.split(/\s+/).filter(Boolean).length;
const bb = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Number(n)).toFixed(2).replace(".", ",")}`;
const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

/**
 * Construit le script d'une vidéo montée : une entrée par beat, chacune avec la
 * voix off proposée, les sous-titres découpés, et la contrainte de durée.
 */
export function construireScript(m) {
  const s = lireSpec(m.spot.spec);
  const e = m.moteur;
  const beat = (nom) => m.timeline.find(b => b.beat === nom);

  const vilain = s.vilains[0];
  const vilainDit = `${POSITIONS[vilain.pos] || vilain.pos}, ${PROFILS[vilain.profil] || vilain.profil}`;

  // Rues jouées, traduites depuis la spec — forme complète, pour les sous-titres.
  const rues = [];
  if (s.preflop) rues.push(`Préflop : ${direActions(s.preflop.actions)}.`);
  if (s.flop) rues.push(`Flop ${cartes(s.flop.board)} : ${direActions(s.flop.actions)}.`);
  if (s.turn) rues.push(`Turn ${carte(s.turn.board)}${s.turn.actions ? ` : ${direActions(s.turn.actions)}` : ""}.`);
  if (s.river) rues.push(`River ${carte(s.river.board)}${s.river.actions ? ` : ${direActions(s.river.actions)}` : ""}.`);

  const entrees = [];

  // ── HOOK — pas de chiffre, pas de contexte : l'image porte, la voix intrigue.
  entrees.push({
    beat: "HOOK",
    voix: `${cartes(s.hero.cartes)} ${EN_POSITION[s.hero.pos] || s.hero.pos}. Simple, en apparence.`,
    sousTitres: [`${cartes(s.hero.cartes)} ${EN_POSITION[s.hero.pos] || s.hero.pos}.`, "Simple, en apparence."],
    note: "L'accroche tient par l'image des cartes ; la voix ne fait qu'ouvrir la question. Aucun chiffre ici.",
  });

  // ── SITUATION — le déroulé réel, rue par rue.
  //
  // ÉCHELLE DE COMPRESSION. Sept secondes ne suffisent pas toujours à raconter
  // trois rues au débit d'une voix off : plutôt que d'écrire un texte trop long
  // (le premier jet proposait 33 mots pour une fenêtre de 16), on essaie trois
  // niveaux de détail et on garde le plus riche qui TIENT. Ce qui saute à la
  // voix reste dans les sous-titres et dans le panneau « Déroulement » à
  // l'écran — rien n'est perdu, c'est réparti.
  const ruesJouees = [
    s.preflop && { nom: "Préflop", board: null, actions: s.preflop.actions },
    s.flop && { nom: "Flop", board: s.flop.board, actions: s.flop.actions },
    s.turn && { nom: "Turn", board: s.turn.board, actions: s.turn.actions },
    s.river && { nom: "River", board: s.river.board, actions: s.river.actions },
  ].filter(Boolean);
  const derniere = ruesJouees[ruesJouees.length - 1];
  const dire = (r, derniereRue) =>
    `${r.nom}${r.board ? ` ${cartes(r.board)}` : ""}${r.actions ? ` : ${direActions(r.actions, { compact: true, garderMontant: derniereRue })}` : ""}.`;

  const niveaux = [
    // 1 — tout : limite, table, profil, chaque rue avec ses montants.
    `${s.table.limite}, table de ${s.table.taille.replace("-max", "")}. En face : ${vilainDit}. ${rues.join(" ")}`,
    // 2 — le profil et les rues, pronoms, montants seulement sur la dernière.
    `En face : ${vilainDit}. ${ruesJouees.map(r => dire(r, r === derniere)).join(" ")}`,
    // 3 — le profil et la seule rue du problème.
    `En face : ${vilainDit}. ${dire(derniere, true)}`,
    // 4 — la seule rue du problème. Le profil reste à l'écran et en sous-titre.
    dire(derniere, true),
  ];

  entrees.push({
    beat: "SITUATION",
    voixNiveaux: niveaux,
    sousTitres: [`${s.table.limite} · en face : ${vilainDit}`, ...rues],
    note: "Tout ce qui est dit ici est aussi à l'écran (panneau « Déroulement »). Si la voix ne raconte pas toutes les rues, les sous-titres les portent.",
  });

  // ── TENSION — le prix, et rien d'autre. L'équité n'est PAS dite : c'est le
  // moteur qui la révèle au PAYOFF, la dire ici tuerait le quizz.
  // Sans mise en face, la tension n'est pas un prix : c'est la main faite qui
  // donne une fausse assurance — même bascule que dans le plan de tournage.
  const faceAMise = e.toCall > 0;
  entrees.push({
    beat: "TENSION",
    voix: faceAMise
      ? `Le prix : ${eur(e.toCall)}, dans un pot de ${eur(e.pot)}.`
      : `Personne n'a misé. Le pot : ${eur(e.pot)}. À toi de fixer le prix.`,
    sousTitres: faceAMise
      ? [`À payer : ${eur(e.toCall)}`, `Pot : ${eur(e.pot)}`]
      : [`Pot : ${eur(e.pot)}`, "Personne n'a misé."],
    note: "Silence recommandé sur le freeze final. Ne pas donner l'équité ni la réponse : c'est le moment où le spectateur se forge un avis.",
  });

  // ── CHOICE — les options réelles (les familles viennent du moteur), puis le
  // silence du choix.
  entrees.push({
    beat: "CHOICE",
    voix: faceAMise
      ? `Passer, suivre, ou relancer — les montants sont à l'écran. Tu fais quoi ?`
      : `Checker, ou miser — les montants sont à l'écran. Tu fais quoi ?`,
    sousTitres: [faceAMise ? "Passer, suivre… ou relancer ?" : "Checker… ou miser ?", "Tu fais quoi ?"],
    note: "La question posée, laisser le temps de pose travailler : les ~5 dernières secondes du beat sont volontairement muettes (compte à rebours possible).",
  });

  // ── REVEAL — le verdict, avec les chiffres de l'écran. Le coût est un coût :
  // il se dit sans signe, « 7,26 big blinds », pas « +7,26 ».
  const joueMot = e.joue.action === "check" ? "Checké" : "Suivi";
  entrees.push({
    beat: "REVEAL",
    voix: `${joueMot} ? ${e.verdict === "erreur" ? "Erreur" : e.verdict}, dit le moteur. Coût : ${e.lossBB.toFixed(2).replace(".", ",")} big blinds. Il fallait ${e.meilleure.label.toLowerCase()}.`,
    sousTitres: [`Verdict : ${e.verdict}.`, `Coût : ${e.lossBB.toFixed(2).replace(".", ",")} bb`, `La bonne réponse : ${e.meilleure.label.toLowerCase()}`],
    note: "C'est ici que la voix a le plus de valeur. Les chiffres dits sont exactement ceux affichés — ne pas les arrondir autrement.",
  });

  // ── PAYOFF — la preuve, lue dans la liste des espérances. Le mot du réflexe
  // suit l'action réellement jouée : « suivre » face à une mise, « checker »
  // sans mise en face.
  const evJoue = e.joue.evBB;
  const reflexeMot = e.joue.action === "check" ? "Checker" : "Suivre";
  // Le cas « rien ne bat le fold » ne vaut que pour un fold : un check optimal
  // passe par la formulation générique, qui reste juste.
  const meilleurEstFold = e.meilleure.label === "Passer";
  entrees.push({
    beat: "PAYOFF",
    voix: meilleurEstFold
      ? `Passer vaut zéro. ${reflexeMot} : ${bb(evJoue)} — pire que jeter la main. Rien ne bat le fold.`
      : `${e.meilleure.label} : ${bb(e.meilleure.evBB)}. ${reflexeMot} : ${bb(evJoue)}${evJoue < 0 ? " — pire que jeter la main" : ""}. Tout l'écart est là.`,
    sousTitres: meilleurEstFold
      ? [`Passer = 0 bb`, `${e.joue.label} = ${bb(evJoue)} bb`, "Rien ne bat le fold ici."]
      : [`${e.meilleure.label} = ${bb(e.meilleure.evBB)} bb`, `${e.joue.label} = ${bb(evJoue)} bb`],
    note: "Ne rien poser par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. Terminer la voix avant la dernière seconde.",
  });

  // ── Contrainte de durée : appliquée, pas déclarative.
  //
  // Pour la SITUATION, on descend l'échelle de compression jusqu'au niveau qui
  // tient. Pour tous les beats, une ligne qui déborde encore est une ERREUR de
  // génération — on refuse d'écrire un script infaisable plutôt que de laisser
  // l'utilisateur le découvrir au micro.
  for (const en of entrees) {
    const b = beat(en.beat);
    en.debut = b.debut; en.fin = b.fin; en.secondes = b.secondes;
    en.motsMax = Math.floor(b.secondes * DEBIT);
    if (en.voixNiveaux) {
      en.voix = en.voixNiveaux.find(v => mots(v) <= en.motsMax) || en.voixNiveaux[en.voixNiveaux.length - 1];
      en.niveauxEcartes = en.voixNiveaux.indexOf(en.voix);
      delete en.voixNiveaux;
    }
    en.motsProposes = mots(en.voix);
    if (en.motsProposes > en.motsMax) {
      throw new Error(`script infaisable : ${en.beat} demande ${en.motsProposes} mots pour une fenêtre de ${en.motsMax} (${en.secondes} s à ${DEBIT} mots/s) — « ${en.voix} »`);
    }
  }
  return entrees;
}

export function scriptMarkdown(m) {
  const entrees = construireScript(m);
  const e = m.moteur;

  return `# Script — ${m.video}

**Vidéo** : \`${m.fichier}\` · ${m.duree.toFixed(2)} s · **Concept** : ${m.conceptTitre || m.concept}
**Situation** : ${m.titreInterne}

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ ${DEBIT} mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.

---

## Le script, d'une traite

${entrees.map(en => en.voix).join("\n\n")}

*(Les crochets de calage : ${entrees.map(en => `${en.beat} à ${tc(en.debut)}`).join(" · ")}.)*

---

## Le détail, beat par beat

${entrees.map(en => `### ${en.beat} — \`${tc(en.debut)}\` → \`${tc(en.fin)}\` (${en.secondes.toFixed(1)} s · ${en.motsMax} mots max, proposé : ${en.motsProposes})

**Voix off proposée**

> ${en.voix}

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

${en.sousTitres.map(s => `- ${s}`).join("\n")}

**Note de jeu.** ${en.note}
`).join("\n")}
---

## Les chiffres de référence (ceux de l'écran)

| donnée | valeur |
|---|---|
| équité du héros | ${e.equity} % |
| action jouée dans la vidéo | ${e.joue.label} (${bb(e.joue.evBB)} bb) |
| meilleure action | ${e.meilleure.label} (${bb(e.meilleure.evBB)} bb) |
| coût de l'erreur | ${e.lossBB.toFixed(2).replace(".", ",")} bb |
| verdict affiché | « ${e.verdict} » |
${e.options.map(o => `| espérance — ${o.label} | ${bb(o.evBB)} bb |`).join("\n")}

Ces valeurs viennent de \`Judge.evaluate\` et sont affichées dans la vidéo aux
beats REVEAL et PAYOFF. Comme l'application l'indique elle-même, ce sont des
estimations sur la range adverse et les profils en jeu — un ordre de grandeur et
un classement, pas une sortie de solveur. Le script ne doit pas les présenter
autrement.
`;
}

/** Écrit le SCRIPT.md de chaque dossier vidéo passé. */
export async function ecrireScripts(dossiers) {
  const faits = [];
  for (const d of dossiers) {
    const mf = join(d, "manifest.json");
    if (!existsSync(mf)) continue;
    const m = JSON.parse(await readFile(mf, "utf8"));
    await writeFile(join(d, "SCRIPT.md"), scriptMarkdown(m));
    faits.push({ dossier: d, video: m.video });
  }
  return faits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const base = join(ROOT, "Format court", arg("--concept-dir", "Quizz"));
  const dossiers = (await readdir(base, { withFileTypes: true }))
    .filter(x => x.isDirectory()).map(x => join(base, x.name)).sort();
  const faits = await ecrireScripts(dossiers);
  for (const f of faits) console.log(`  ✓ ${relative(ROOT, f.dossier)}/SCRIPT.md`);
  console.log(`${faits.length} script(s) écrit(s)`);
}
