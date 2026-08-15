/**
 * Scanner de spots — sélection automatique par le moteur.
 *
 * Le principe : ne pas écrire une accroche puis chercher un spot qui la
 * justifie. On soumet chaque spot candidat au moteur de Hero Lab, on lui
 * demande l'EV de chaque option, et on mesure trois choses :
 *
 *   ÉCART      la distance d'EV entre la meilleure option et la deuxième.
 *              Faible = décision serrée, deux options plausibles → tension.
 *              Élevé = l'erreur coûte cher → hook chiffré.
 *
 *   PARADOXE   l'équité du héros contredit-elle la bonne décision ?
 *              Forte équité et pourtant il faut passer, ou l'inverse.
 *              C'est le « attends… pourquoi ? » recherché.
 *
 *   PIÈGE      l'action intuitive (celle qu'un joueur moyen choisit) est-elle
 *              la mauvaise ? On prend « call » comme intuition par défaut face
 *              à une mise, « raise » avec une main forte.
 *
 * Aucun de ces chiffres n'est inventé : tout vient de Judge.evaluate.
 *
 * LECTURE DES EV — vérifié dans index.html (Judge.evOption) :
 * l'EV d'une option est le gain net « à partir de maintenant », les montants
 * déjà investis étant ignorés pour toutes les options. Passer vaut donc
 * exactement 0 par construction, et c'est le zéro de référence commun. Un
 * `evBB` positif signifie « mieux que passer », et l'écart entre deux options
 * est un vrai différentiel en bb. C'est pour cela que « Passer → 0bb »
 * apparaît sur chaque spot : c'est la définition, pas une anomalie.
 *
 * Usage : node content/scan.mjs [--theme river] [--top 5] [--json]
 */
import { SPOTS } from "./spots.mjs";
import { launch, openShot, loadSpot } from "./studio.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const THEME = arg("--theme", null);
const TOP = Number(arg("--top", "0"));
const AS_JSON = argv.includes("--json");

/**
 * Évalue toutes les options d'un spot sans consommer la main : on recharge le
 * spot avant chaque action, donc chaque évaluation part du même état.
 */
async function evaluateSpot(page, spot) {
  const built = await loadSpot(page, spot.spec);
  if (!built.ok) return { ...spot, error: built.err };

  // On n'invente aucune action : Spot.options(t) donne les coups légaux avec
  // leurs montants exacts. Judge.evaluate les évalue tous en une passe et rend
  // `options` déjà trié par EV, ainsi que `best`. Inutile de rejouer le spot
  // action par action — et surtout, passer un montant arbitraire ferait
  // retomber Judge sur un autre coup que celui visé.
  const r = await page.evaluate(() => {
    const t = App.t;
    if (!t) return null;
    const opts = Spot.options(t);
    if (!opts.length) return null;
    const a = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    if (!a || !a.options) return null;
    return {
      equity: a.equity,
      toCall: t.toCall(t.hero),
      bb: t.bb,
      options: a.options.map(o => ({
        action: o.action, label: o.label, amount: o.amount, ev: o.ev, evBB: o.evBB,
      })),
      best: { action: a.best.action, label: a.best.label, evBB: a.best.evBB },
    };
  });
  if (!r) return { ...spot, error: "options indisponibles" };

  const evs = r.options;
  const best = evs[0];
  const second = evs[1] || best;
  const worst = evs[evs.length - 1];
  const equity = r.equity;

  // Écarts exprimés en bb, à partir des EV réelles du moteur.
  const gap = Math.abs(best.evBB - second.evBB);
  const cost = Math.abs(best.evBB - worst.evBB);

  // Familles d'actions, pour raisonner sans dépendre du sizing exact.
  const fam = (a) => (a === "bet" || a === "raise" ? "aggro" : a);
  const bestFam = fam(best.action);

  // L'action intuitive : payer quand il y a une mise en face, checker sinon.
  const intuitive = r.toCall > 0 ? "call" : "check";
  const intuitiveOpt = evs.find(o => o.action === intuitive);
  const trap = !!intuitiveOpt && fam(intuitiveOpt.action) !== bestFam;
  const trapCost = intuitiveOpt ? Math.abs(best.evBB - intuitiveOpt.evBB) : 0;

  // Paradoxe. Première version testée : « peu d'équité et pourtant une ligne
  // agressive gagne ». Elle se déclenchait sur presque tous les spots — dans ce
  // modèle l'agression domine souvent — donc elle ne triait rien.
  //
  // Le vrai paradoxe, lisible à l'écran et vérifiable, c'est quand l'action
  // instinctive est NÉGATIVE : puisque passer vaut 0 par construction, un
  // `evBB` négatif signifie littéralement « ce coup coûte plus cher que jeter
  // ta main ». C'est l'énoncé fort, et il est direct dans les chiffres.
  const intuitiveLosesToFold = !!intuitiveOpt && intuitiveOpt.evBB < -0.15;
  // Second cas, plus rare : une grosse équité et pourtant aucune ligne
  // agressive rentable — le moteur préfère ne pas investir.
  const equityMisleads = equity >= 0.60 && (bestFam === "fold" || bestFam === "check");
  const paradox = intuitiveLosesToFold || equityMisleads;

  const score =
    (intuitiveLosesToFold ? 35 : 0) +
    (equityMisleads ? 35 : 0) +
    (trap ? 20 : 0) +
    Math.min(25, trapCost * 2) +
    Math.min(10, cost) -
    (gap > 8 ? 10 : 0);

  return {
    ...spot,
    equity, best, second, worst, gap, cost,
    paradox, trap, intuitive, trapCost,
    intuitiveEvBB: intuitiveOpt ? Number(intuitiveOpt.evBB.toFixed(2)) : null,
    intuitiveLabel: intuitiveOpt ? (intuitiveOpt.label || intuitiveOpt.action) : null,
    intuitiveLosesToFold, equityMisleads,
    score: Math.round(score),
    options: evs.map(o => ({ action: o.action, label: o.label, evBB: Number(o.evBB.toFixed(2)) })),
  };
}

export async function scan({ theme = null } = {}) {
  const browser = await launch();
  const { ctx, page, errors } = await openShot(browser);
  const pool = theme ? SPOTS.filter(s => s.theme === theme) : SPOTS;
  const out = [];
  for (const spot of pool) out.push(await evaluateSpot(page, spot));
  await ctx.close();
  await browser.close();
  return { results: out.sort((a, b) => (b.score || -1) - (a.score || -1)), errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { results, errors } = await scan({ theme: THEME });
  const kept = TOP ? results.slice(0, TOP) : results;

  if (AS_JSON) {
    console.log(JSON.stringify(kept, null, 2));
  } else {
    console.log(`\nScan de ${results.length} spots${THEME ? ` (thème : ${THEME})` : ""}\n`);
    for (const r of kept) {
      if (r.error) { console.log(`  ✗  ${r.id.padEnd(24)} ${r.error}`); continue; }
      const tags = [
        r.intuitiveLosesToFold ? `PARADOXE(${r.intuitiveLabel} → ${r.intuitiveEvBB}bb, pire que passer)` : null,
        r.equityMisleads ? "PARADOXE(équité trompeuse)" : null,
        r.trap ? `PIÈGE(${r.intuitive})` : null,
        r.gap < 2 ? "SERRÉ" : null,
      ].filter(Boolean).join(" · ");
      console.log(`  ${String(r.score).padStart(3)}  ${r.id.padEnd(24)} ${r.label}`);
      console.log(`       équité ${(r.equity * 100).toFixed(1)}%  ·  meilleur : ${r.best.action}` +
        `  ·  écart 2e : ${r.gap.toFixed(2)}bb  ·  pire erreur : ${r.cost.toFixed(2)}bb`);
      console.log(`       options : ${r.options.slice(0, 5).map(o => `${o.label || o.action} → ${o.evBB}bb`).join("  |  ")}`);
      if (tags) console.log(`       → ${tags}`);
      console.log("");
    }
    if (errors.length) console.log("  erreurs page :", errors.slice(0, 3).join(" | "));
  }
}
