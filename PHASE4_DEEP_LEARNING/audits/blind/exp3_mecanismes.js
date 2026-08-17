/**
 * EXPÉRIENCE 3 — Mécanismes isolés (chaque bloc = une hypothèse testée seule).
 *
 * A. Seuil de verdict vs niveau : MÊMES décisions, MÊMES pertes d'EV, jugées
 *    aux 6 niveaux. Isole strictement l'effet `level.tolerance` (l.4169-4170).
 * B. Compteur de maîtrise : `Progress.tags` sort avant les tags leak quand la
 *    décision n'est pas une erreur (l.4686) -> `recordMastery(k, ok)` n'est
 *    jamais appelé avec ok=true (l.7287-7289).
 * C. Missions de Journey : progression = nombre d'erreurs.
 * D. Journey.story : « tu t'es amélioré » déclenché par 15 échecs.
 * E. Arithmétique de promotion NL2 -> NL5.
 * F. Plancher d'XP et indépendance XP / niveau de difficulté.
 */
const fs = require("fs");
const L = require("./lib_af.js");
const N = +(process.argv[2] || 220);
const out = {};

/* ---------------------------------------------------------------- A ---- */
{
  const { M, sandbox } = L.boot();
  L.seedRandom(sandbox, 777);
  const LK = Object.keys(M.LEVELS);
  const rows = [];
  // On génère au niveau intermédiaire, on mesure la perte d'EV d'un fold,
  // puis on rejoue UNIQUEMENT le seuil de verdict pour chaque niveau.
  for (let i = 0; i < N; i++) {
    const t = L.freshSpot(M, { level: "intermediaire", mode: "libre", stake: "NL10", stackRange: [40, 150] }, "intermediaire", "libre");
    if (!t) continue;
    const opts = M.Spot.options(t);
    const dec = opts.find(o => o.action === "fold") || opts.find(o => o.action === "check") || opts[0];
    const a = M.Judge.evaluate(t, dec);
    rows.push({ loss: a.loss, pot: a.pot, bb: t.bb, lossBB: a.lossBB, action: dec.action });
  }
  const verdicts = {};
  for (const k of LK) {
    const tol0 = M.LEVELS[k].tolerance;
    const c = { correct: 0, acceptable: 0, erreur: 0, evLossCompte: 0, evLossReelle: 0 };
    for (const r of rows) {
      // Formule exacte de Judge.evaluate l.4169-4170
      const tolerance = (1.0 * r.bb + r.pot * 0.03) * (tol0 / 0.1);
      const v = r.loss <= tolerance * 0.35 ? "correct" : r.loss <= tolerance ? "acceptable" : "erreur";
      c[v]++;
      c.evLossReelle += r.lossBB;
      if (v === "erreur") c.evLossCompte += r.lossBB;
    }
    const n = rows.length;
    verdicts[k] = {
      tolerance: tol0, mult: +(tol0 / 0.1).toFixed(2),
      justessePct: +((c.correct + c.acceptable) / n * 100).toFixed(1),
      correctPct: +(c.correct / n * 100).toFixed(1),
      xp: c.correct * 12 + c.acceptable * 6 + c.erreur * 2,
      evLossReelle: +c.evLossReelle.toFixed(1),
      evLossCompte: +c.evLossCompte.toFixed(1),
      occultePct: +((1 - c.evLossCompte / c.evLossReelle) * 100).toFixed(1)
    };
  }
  out.A_seuil_par_niveau = { n: rows.length, note: "mêmes décisions, mêmes pertes d'EV, seul le seuil change", verdicts };
}

/* ---------------------------------------------------------------- B/C/D - */
{
  const { M, sandbox } = L.boot();
  L.seedRandom(sandbox, 909);
  const res = {};
  for (const stratKey of ["oracle", "fold", "rotation", "station"]) {
    const { M: MM, sandbox: sb } = L.boot();
    L.seedRandom(sb, 909);
    const r = L.runStrategy(MM, sb, { stratKey, decisions: 300, levelKey: "intermediaire", modeKey: "libre", seed: 909, snapshots: [] });
    // Missions telles que le produit les calcule
    MM.Journey.load();
    const missions = MM.Journey.activeMissions().map(m => ({
      titre: m.title, fait: m.done, cible: m.target,
      pctBarre: +(m.done / m.target * 100).toFixed(0),
      tauxReussite: +(m.successRate * 100).toFixed(1),
      complete: m.complete, palierMaitrise: m.mastery.name, tier: m.mastery.tier
    }));
    let anyOk = 0, anySeen = 0;
    for (const v of Object.values(MM.Player.data.mastery)) { anyOk += v.ok; anySeen += v.seen; }
    res[stratKey] = {
      decisions: r.decisions, justessePct: r.final.accuracyPct,
      masteryTotalSeen: anySeen, masteryTotalOk: anyOk,
      palierMaxAtteint: Math.max(0, ...Object.values(r.final.mastery).map(x => x.tier)),
      missions
    };
  }
  out.B_maitrise_et_missions = {
    note: "recordMastery n'est appelable qu'avec ok=false : Progress.tags (l.4686) ne produit de tag leak: que sur verdict==='erreur'",
    res
  };
}

/* ---------------------------------------------------------------- D ---- */
{
  const { M, sandbox } = L.boot();
  L.seedRandom(sandbox, 313);
  // On fabrique la condition de Journey.story l.6446 : m.seen >= 15 sur l'ancien
  // leak dominant suffit à déclarer « amélioration », même si la perte a AUGMENTÉ.
  const r = L.runStrategy(M, sandbox, { stratKey: "rotation", decisions: 120, levelKey: "intermediaire", modeKey: "libre", seed: 313, snapshots: [] });
  M.Journey.load();
  M.Journey.snapshot();                 // photo « d'avant »
  const s1 = M.Progress.summary();
  const before = (s1.leaks[0] || {});
  // On recule artificiellement l'horodatage du snapshot pour simuler 14 jours
  M.Journey.data.snaps[0].ts = Date.now() - 15 * 864e5;
  M.Journey.data.snaps[0].day = new Date(Date.now() - 15 * 864e5).toDateString();
  M.Journey.save();
  const r2 = L.runStrategy2 ? null : null;
  // On continue de se tromper : 200 décisions de plus avec la même stratégie
  const st = {};
  const cfg = { level: "intermediaire", mode: "libre", stake: "NL10", players: 0, stackRange: [40, 150] };
  for (let i = 0; i < 200; i++) {
    const t = L.freshSpot(M, cfg, "intermediaire", "libre");
    if (!t) continue;
    const opts = M.Spot.options(t);
    const dec = L.STRATS.rotation.choose(t, opts, M, st);
    const a = M.Judge.evaluate(t, dec);
    const e = M.Progress.record(t, a, dec);
    for (const tag of e.tags) if (tag.startsWith("leak:")) M.Player.recordMastery(tag.slice(5), a.verdict !== "erreur");
  }
  const story = M.Journey.story();
  const s2 = M.Progress.summary();
  const after = (s2.leaks.find(l => l.key === (before.key || "")) || {});
  out.D_recit_amelioration = {
    note: "Journey.story l.6446 : (nowLoss < beforeLoss*0.85) OU (mastery.seen >= 15). mastery.seen ne compte QUE des échecs.",
    leakSuivi: before.key,
    perteAvant: +(before.loss || 0).toFixed(1),
    perteApres: +(after.loss || 0).toFixed(1),
    masterySeen: (M.Player.data.mastery[before.key] || {}).seen || 0,
    masteryOk: (M.Player.data.mastery[before.key] || {}).ok || 0,
    ameliorationDeclaree: !!story.improved,
    dropPctAffiche: story.improved ? story.improved.dropPct : null
  };
}

/* ---------------------------------------------------------------- E ---- */
{
  const { M } = L.boot();
  const t0 = M.TIERS[0], t1 = M.TIERS[1];
  const start = M.Bankroll.buyinValue(t0.stake) * 20;
  const need = M.Bankroll.buyinValue(t1.stake) * t1.reqBuyins;
  const gainEuros = need - start;
  const gainBB = gainEuros / (M.STAKES.find(s => s.key === t0.stake).bb);
  out.E_arithmetique_promotion = {
    note: "Goals.allMet exige les 4 objectifs à 100 % ; promotionStatus exige EN PLUS Bankroll.canMoveUp",
    bankrollDepart: start, bankrollExigee: need, gainEuros: +gainEuros.toFixed(2),
    gainEnBB_NL2: Math.round(gainBB),
    mainsMin: t0.reqHands,
    winrateExigeParObjectif: t1 ? t0.reqWinrate : null,
    winrateImpliqueParBankroll_bb100: +(gainBB / t0.reqHands * 100).toFixed(1),
    facteurEcart: +((gainBB / t0.reqHands * 100) / t0.reqWinrate).toFixed(1),
    mainsNecessairesAuWinrateExige: Math.round(gainBB / t0.reqWinrate * 100),
    filetBanqueroute: `bankroll < ${M.Bankroll.buyinValue(t0.stake) * 3} € -> remise à ${M.Bankroll.buyinValue(t0.stake) * 20} € (Career.closeSession l.5692)`
  };
}

/* ---------------------------------------------------------------- F ---- */
{
  const { M } = L.boot();
  const xpFor = v => (v === "correct" ? 12 : v === "acceptable" ? 6 : 2);
  const lvl = xp => 1 + Math.floor(Math.sqrt(xp / 90));
  const rows = {};
  for (const n of [50, 200, 500, 2000]) {
    rows[n] = {
      parfait: { xp: n * 12, niveau: lvl(n * 12) },
      pire: { xp: n * 2, niveau: lvl(n * 2) },
      ratioXP: +((n * 2) / (n * 12)).toFixed(3),
      ratioNiveau: +(lvl(n * 2) / lvl(n * 12)).toFixed(3),
      decisionsPourEgalerLeParfait: n * 6
    };
  }
  out.F_plancher_xp = {
    note: "Progress.record l.4741-4743 : gain XP fonction du seul verdict. Aucun terme de niveau, mode, limite ou volume de pot.",
    rows
  };
}

fs.writeFileSync(`${__dirname}/exp3_mecanismes.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
