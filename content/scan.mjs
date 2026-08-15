/**
 * Scanner de spots — sélection et notation par le moteur.
 *
 * Le principe n'a pas changé : on n'écrit pas une accroche puis on cherche un
 * spot qui la justifie. On soumet chaque candidat au moteur de Hero Lab, on lit
 * l'espérance de chaque option légale, et on note.
 *
 * LECTURE DES EV — vérifié dans index.html (`Judge.evOption`) : l'espérance
 * d'une option est le gain net « à partir de maintenant », les montants déjà
 * investis étant ignorés pour toutes les options. Passer vaut donc exactement 0
 * par construction, et c'est le zéro de référence commun. Un `evBB` négatif
 * signifie littéralement « pire que jeter la main ». L'application affiche
 * elle-même cette convention : « en big blinds, à partir d'ici ».
 *
 * Rien n'est inventé ici : ni profil, ni action, ni montant, ni option, ni
 * équité. Tout provient de `Spot.options` et `Judge.evaluate`.
 *
 * Usage :
 *   node content/scan.mjs [--max 800] [--top 10] [--json]
 */
import { genererSpots } from "./generate.mjs";
import { launch, openShot, loadSpot } from "./studio.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/**
 * Barème du potentiel contenu, sur 100.
 *
 * Chaque critère est mesuré sur des grandeurs que le moteur produit, jamais sur
 * une appréciation. Les poids traduisent une hiérarchie assumée : ce qui
 * retient (paradoxe, contre-intuitivité, coût de l'erreur) pèse plus que ce qui
 * décore.
 */
export const BAREME = {
  paradoxe: 18,          // l'action instinctive est perdante dans l'absolu
  contreIntuitif: 14,    // la bonne action n'est pas de la même famille que l'instinct
  differentielEV: 18,    // ce que coûte l'erreur, en bb
  difficulte: 11,        // deux options réellement proches en tête
  curiosite: 7,          // l'équité contredit l'apparence de la main
  lisibilite: 9,         // le spot se lit vite à l'écran
  reveal: 8,             // la révélation est franche
  pedagogie: 6,          // il y a une leçon transposable
  debat: 5,              // deux lignes défendables
  serie: 4,              // le concept se décline
};
export const TOTAL_BAREME = Object.values(BAREME).reduce((a, b) => a + b, 0);

/**
 * SEUIL DE FRAGILITÉ — garde éditorial, et non une donnée du moteur.
 *
 * Première exécution du barème : les huit meilleurs spots avaient tous la même
 * forme — équité du héros entre 2 et 10 %, adversaire « nit », et le moteur
 * recommandant une relance pot. Ces recommandations ne reposent pas sur la
 * main : elles reposent entièrement sur l'estimation de fold equity, c'est-à-dire
 * sur la partie du modèle qui extrapole le plus. L'application le dit
 * elle-même à l'écran : « des estimations calculées sur la range adverse et les
 * profils en jeu, pas des sorties de solveur ».
 *
 * Le barème lui-même créait l'incitation : `curiosite` récompense « peu
 * d'équité et pourtant une ligne agressive », `paradoxe` récompense une EV
 * instinctive négative. Les deux saturent précisément dans ce coin. Le score ne
 * mesurait donc pas le potentiel de contenu mais la distance dans la zone
 * d'extrapolation.
 *
 * On écarte donc ces spots au lieu de les publier. Le seuil est un choix
 * assumé, pas une mesure : en dessous de 25 % d'équité, une recommandation
 * agressive tient au fait que l'adversaire passe, pas à ce que le héros tient.
 */
export const EQUITE_MIN_AGGRO = 0.25;

/**
 * MARGE DE FOLD EQUITY MINIMALE, en points de pourcentage.
 *
 * Le seuil d'équité ci-dessus est grossier : un spot à 26 % passe alors que sa
 * recommandation peut tenir à un cheveu. Le moteur donne pourtant la mesure
 * exacte dans son propre texte d'explication d'une mise :
 *
 *   « Une mise de 9.75 € demande 87 % de folds pour être rentable en bluff pur.
 *     Face à cet adversaire, l'estimation est de 88 %. »
 *
 * Un écart d'un point entre le nécessaire et l'estimé signifie que la
 * recommandation bascule au moindre ajustement du modèle. Ce n'est pas une
 * leçon de poker, c'est le bord d'une estimation. On exige donc une marge
 * franche. Les deux nombres sont produits par `Judge.evOption` — on les lit,
 * on ne les recalcule pas.
 */
export const MARGE_FE_MIN = 8;

/** Ramène une valeur dans [0, max] à partir d'une échelle linéaire saturante. */
const echelle = (valeur, pleine, max) => Math.max(0, Math.min(max, (valeur / pleine) * max));

/** Familles d'action : raisonner sur l'intention, pas sur le sizing exact. */
const famille = (a) => (a === "bet" || a === "raise" ? "aggro" : a);

/**
 * Interroge le moteur sur un spot déjà chargé.
 *
 * On n'invente aucune action : `Spot.options(t)` donne les coups légaux avec
 * leurs montants exacts, et `Judge.evaluate` les évalue tous en une passe en
 * rendant `options` déjà trié par espérance. Passer un montant arbitraire
 * ferait retomber le juge sur un autre coup que celui visé — c'est une erreur
 * qui a réellement faussé une première version de ce scanner.
 */
async function interroger(page) {
  return page.evaluate(() => {
    const t = App.t;
    if (!t) return null;
    const opts = Spot.options(t);
    if (!opts.length) return null;
    const a = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    if (!a || !a.options || !a.options.length) return null;
    return {
      equity: a.equity,
      toCall: a.toCall,
      pot: a.pot,
      bb: t.bb,
      street: t.street,
      nOpp: (a.opps || []).length,
      oppRangePct: a.oppRangePct ?? null,
      made: a.made ? { label: a.made.label ?? null, topPair: !!a.made.topPair, draw: !!a.made.draw, rank: a.made.rank ?? null } : null,
      options: a.options.map(o => ({
        action: o.action, label: o.label || o.action,
        amount: o.amount, evBB: o.evBB, detail: o.detail || null,
      })),
      best: { action: a.best.action, label: a.best.label || a.best.action, evBB: a.best.evBB },
    };
  });
}

/**
 * Note un spot évalué. Retourne le détail critère par critère : un score
 * global sans sa décomposition n'est pas vérifiable, donc pas utilisable.
 */
export function noter(r, spot, contexte = {}) {
  const evs = r.options;
  const best = evs[0];
  const second = evs[1] || best;
  const worst = evs[evs.length - 1];

  const ecartSecond = Math.abs(best.evBB - second.evBB);
  const coutMax = Math.abs(best.evBB - worst.evBB);

  // L'action instinctive : payer quand il y a une mise en face, checker sinon.
  // C'est le réflexe que le contenu vient contredire.
  const instinct = r.toCall > 0 ? "call" : "check";
  const optInstinct = evs.find(o => o.action === instinct) || null;
  const coutInstinct = optInstinct ? Math.abs(best.evBB - optInstinct.evBB) : 0;

  const famBest = famille(best.action);
  const famInstinct = optInstinct ? famille(optInstinct.action) : null;

  // — Paradoxe : l'instinct est perdant dans l'absolu, pas seulement moins bon.
  // Puisque passer vaut 0, une EV négative veut dire « pire que jeter ».
  const instinctPerdant = !!optInstinct && optInstinct.evBB < -0.15;
  // Cas symétrique, plus rare : beaucoup d'équité et pourtant rien à investir.
  const equiteTrompeuse = r.equity >= 0.60 && (famBest === "fold" || famBest === "check");
  const paradoxe = instinctPerdant
    ? BAREME.paradoxe
    : equiteTrompeuse ? BAREME.paradoxe * 0.85 : 0;

  // — Contre-intuitivité : la bonne famille d'action n'est pas celle du réflexe.
  const contreIntuitif = famInstinct && famInstinct !== famBest ? BAREME.contreIntuitif : 0;

  // — Différentiel d'EV : ce que l'erreur coûte réellement. Saturé à 8 bb,
  // au-delà l'écart n'est plus une nuance mais une évidence.
  const differentielEV = echelle(coutInstinct, 8, BAREME.differentielEV);

  // — Difficulté : deux options proches en tête forcent un vrai choix. Un écart
  // large rend la décision évidente une fois posée, donc moins tendue.
  const serre = ecartSecond < 2 ? 1 - ecartSecond / 2 : 0;
  const viables = evs.filter(o => o.evBB > -0.5).length;
  const difficulte = BAREME.difficulte * (0.65 * serre + 0.35 * Math.min(1, (viables - 1) / 3));

  // — Curiosité : l'équité et la décision pointent dans des directions
  // opposées. C'est le « attends… pourquoi ? ».
  const ecartAttendu = famBest === "aggro" ? Math.max(0, 0.50 - r.equity)
    : famBest === "fold" || famBest === "check" ? Math.max(0, r.equity - 0.50) : 0;
  const curiosite = echelle(ecartAttendu, 0.25, BAREME.curiosite);

  // — Lisibilité : ce qu'il faut tenir en tête pour comprendre le spot.
  // Moins d'adversaires et une rue précoce se lisent plus vite ; une main faite
  // nommée par le moteur donne un point d'accroche immédiat.
  const penaliteOpp = Math.max(0, r.nOpp - 1) * 0.35;
  const penaliteRue = { preflop: 0, flop: 0.1, turn: 0.2, river: 0.3 }[r.street] ?? 0.2;
  const bonusMade = r.made && r.made.label ? 0.15 : 0;
  const lisibilite = BAREME.lisibilite * Math.max(0, Math.min(1, 1 - penaliteOpp - penaliteRue + bonusMade));

  // — Force du reveal : l'ampleur de l'erreur rapportée au pot. Perdre 3 bb
  // dans un pot de 4 frappe plus fort que 3 bb dans un pot de 60.
  const potBB = r.pot / r.bb;
  const reveal = echelle(potBB > 0 ? coutInstinct / potBB : 0, 0.6, BAREME.reveal);

  // — Intérêt pédagogique : la leçon se transpose-t-elle ? Un spot dont la
  // bonne réponse tient à la structure (position, texture, profil) enseigne ;
  // un spot qui tient au hasard des cartes n'enseigne rien.
  const structurel = (spot.texture ? 0.4 : 0) + (spot.profil ? 0.3 : 0) + (spot.heroPos ? 0.3 : 0);
  const pedagogie = BAREME.pedagogie * structurel * (coutInstinct > 0.5 ? 1 : 0.4);

  // — Débat : deux lignes défendables, donc des commentaires.
  const debat = BAREME.debat * (ecartSecond < 1.5 && famille(second.action) !== famBest ? 1
    : ecartSecond < 1.5 ? 0.5 : 0);

  // — Potentiel de série : le concept se décline-t-il sur d'autres paramètres ?
  const serie = BAREME.serie * Math.min(1, (contexte.freresDuModele || 1) / 12);

  // Marge de fold equity de la meilleure option, lue dans l'explication que le
  // moteur produit lui-même pour une mise ou une relance.
  let margeFE = null;
  if (best.detail) {
    const need = /demande\s+(\d+)\s*%\s+de folds/.exec(best.detail);
    const est = /estimation est de\s+(\d+)\s*%/.exec(best.detail);
    if (need && est) margeFE = Number(est[1]) - Number(need[1]);
  }

  // — Garde de fragilité. Un spot dont la bonne réponse repose sur la seule
  // fold equity n'est pas enseignable : il enseignerait l'estimation du modèle,
  // pas le poker. Voir EQUITE_MIN_AGGRO.
  const fragileFoldEquity = famBest === "aggro" && r.equity < EQUITE_MIN_AGGRO;
  // Recommandation agressive dont la rentabilité ne tient qu'à une poignée de
  // points d'estimation : elle bascule au moindre ajustement du modèle.
  const fragileMarge = famBest === "aggro" && margeFE !== null && margeFE < MARGE_FE_MIN;
  // Un « meilleur » coup qui ne devance le suivant que d'un cheveu n'est pas
  // une leçon : c'est un classement arbitraire à l'échelle du modèle.
  const fragileEgalite = ecartSecond < 0.05;
  const fragile = fragileFoldEquity || fragileMarge || fragileEgalite;
  const motifFragile = fragileFoldEquity
    ? `recommandation portée par la fold equity (équité ${(r.equity * 100).toFixed(1)} % < ${EQUITE_MIN_AGGRO * 100} %)`
    : fragileMarge
      ? `marge de fold equity trop mince (${margeFE} point(s), minimum ${MARGE_FE_MIN})`
      : fragileEgalite ? `meilleure option non départagée (écart ${ecartSecond.toFixed(3)} bb)` : null;

  const details = {
    paradoxe, contreIntuitif, differentielEV, difficulte, curiosite,
    lisibilite, reveal, pedagogie, debat, serie,
  };
  const score = Object.values(details).reduce((a, b) => a + b, 0);

  return {
    score: Math.round(score),
    fragile, motifFragile, margeFE,
    details: Object.fromEntries(Object.entries(details).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    equity: r.equity, street: r.street, pot: r.pot, bb: r.bb, toCall: r.toCall,
    made: r.made, nOpp: r.nOpp, oppRangePct: r.oppRangePct,
    best, second, worst, ecartSecond, coutMax,
    instinct, optInstinct, coutInstinct,
    instinctPerdant, equiteTrompeuse,
    famBest, famInstinct,
    options: evs.map(o => ({ action: o.action, label: o.label, amount: o.amount, evBB: Number(o.evBB.toFixed(2)) })),
  };
}

/**
 * Signature de concept — le cœur de l'anti-redondance.
 *
 * Deux vidéos sont redondantes quand elles racontent la même chose, pas quand
 * elles montrent les mêmes cartes. On signe donc ce qui fait le récit : le type
 * de situation, la famille de main, la texture, la nature du paradoxe et la
 * famille d'action correcte. Deux spots de même signature enseignent la même
 * leçon avec des habits différents.
 */
export function signature(spot, note) {
  return [
    spot.modele,
    spot.heroFam,
    spot.texture || "sans-board",
    note.famBest,
    note.instinctPerdant ? "instinct-perdant" : note.equiteTrompeuse ? "equite-trompeuse" : "ordinaire",
  ].join("|");
}

/** Signature d'accroche visuelle : ce que le spectateur voit au premier plan. */
export function signatureVisuelle(spot) {
  return [spot.heroCls, spot.texture || "preflop", spot.turnRole || "-"].join("|");
}

/**
 * Parcourt les candidats, les évalue, les note, puis élimine les redondances.
 *
 * `exclureSignatures` permet à l'historique de production d'écarter ce qui a
 * déjà été tourné lors des exécutions précédentes.
 */
export async function scan({
  max = 800, exclureSignatures = new Set(), exclureIds = new Set(), verbeux = false,
} = {}) {
  const spots = genererSpots({ max });
  const freres = {};
  for (const s of spots) freres[s.modele] = (freres[s.modele] || 0) + 1;

  const browser = await launch();
  const { ctx, page, errors } = await openShot(browser);

  const notes = [];
  const rejets = new Map();
  let n = 0;
  for (const spot of spots) {
    n++;
    if (verbeux && n % 100 === 0) process.stderr.write(`  ${n}/${spots.length}\r`);
    if (exclureIds.has(spot.id)) { rejets.set("déjà produit", (rejets.get("déjà produit") || 0) + 1); continue; }
    const built = await loadSpot(page, spot.spec);
    if (!built.ok) { rejets.set(built.err.slice(0, 70), (rejets.get(built.err.slice(0, 70)) || 0) + 1); continue; }
    const r = await interroger(page);
    if (!r) { rejets.set("options indisponibles", (rejets.get("options indisponibles") || 0) + 1); continue; }
    const note = noter(r, spot, { freresDuModele: freres[spot.modele] });
    notes.push({ ...spot, ...note, signature: signature(spot, note), signatureVisuelle: signatureVisuelle(spot) });
  }

  await ctx.close();
  await browser.close();

  notes.sort((a, b) => b.score - a.score);

  // Anti-redondance : à signature de concept égale, on ne garde que le
  // meilleur. Même chose sur l'accroche visuelle, pour ne pas ouvrir deux
  // vidéos sur exactement la même image.
  const vusConcept = new Set(exclureSignatures);
  const vusVisuel = new Set();
  const retenus = [];
  const ecartes = [];
  for (const s of notes) {
    if (s.fragile) { ecartes.push({ ...s, motif: s.motifFragile }); continue; }
    if (vusConcept.has(s.signature)) { ecartes.push({ ...s, motif: "concept déjà couvert" }); continue; }
    if (vusVisuel.has(s.signatureVisuelle)) { ecartes.push({ ...s, motif: "même accroche visuelle" }); continue; }
    vusConcept.add(s.signature);
    vusVisuel.add(s.signatureVisuelle);
    retenus.push(s);
  }

  const fragiles = notes.filter(s => s.fragile).length;
  return { retenus, ecartes, fragiles, evalues: notes.length, candidats: spots.length, rejets, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const MAX = Number(arg("--max", "800"));
  const TOP = Number(arg("--top", "10"));
  const AS_JSON = argv.includes("--json");

  const { retenus, ecartes, fragiles, evalues, candidats, rejets } = await scan({ max: MAX, verbeux: !AS_JSON });
  const kept = retenus.slice(0, TOP);

  if (AS_JSON) { console.log(JSON.stringify(kept, null, 2)); }
  else {
    console.log(`\n${candidats} candidats · ${evalues} évalués · ${fragiles} écartés pour fragilité · ${retenus.length} retenus après anti-redondance\n`);
    if (rejets.size) {
      console.log("Rejets :");
      for (const [e, k] of [...rejets].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`   ${String(k).padStart(4)}× ${e}`);
      console.log("");
    }
    for (const r of kept) {
      console.log(`  ${String(r.score).padStart(3)}/100  ${r.label}`);
      console.log(`         ${r.id}`);
      console.log(`         équité ${(r.equity * 100).toFixed(1)}%  ·  instinct ${r.instinct} → ${r.optInstinct ? r.optInstinct.evBB.toFixed(2) : "—"}bb  ·  meilleur ${r.best.label} → ${r.best.evBB.toFixed(2)}bb  ·  coût ${r.coutInstinct.toFixed(2)}bb`);
      console.log(`         ${Object.entries(r.details).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
      console.log("");
    }
  }
}
