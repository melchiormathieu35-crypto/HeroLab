/** Met en tableau les résultats d'exp1. */
const fs = require("fs");
const LEVELS = process.argv.slice(2).length ? process.argv.slice(2) : ["debutant", "intermediaire", "gto"];
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);

for (const lv of LEVELS) {
  const data = JSON.parse(fs.readFileSync(`${__dirname}/exp1_${lv}.json`, "utf8"));
  console.log(`\n===================== NIVEAU ${lv.toUpperCase()} =====================`);
  for (const vol of [50, 200, 500]) {
    console.log(`\n--- volume = ${vol} décisions`);
    console.log(pad("stratégie", 30) + padl("XP", 6) + padl("niv", 5) + padl("just%", 7) + padl("corr%", 7) +
      padl("rating", 8) + padl("tier", 12) + padl("disc", 6) + padl("EVréel", 9) + padl("bb/déc", 8) + padl("mains", 7) + padl("m/déc", 7));
    for (const r of data) {
      const s = r.snaps.find(x => x.at === vol);
      if (!s) continue;
      console.log(
        pad(r.name, 30) + padl(s.xp, 6) + padl(s.niveau, 5) +
        padl(s.accuracyPct.toFixed(1), 7) + padl(s.correctPct.toFixed(1), 7) +
        padl(s.rating, 8) + padl(s.ratingTier, 12) + padl(s.disciplineScore, 6) +
        padl(s.evLossReelle.toFixed(1), 9) + padl((s.evLossReelle / vol).toFixed(3), 8) +
        padl(s.hands, 7) + padl((s.hands / vol).toFixed(2), 7));
    }
  }
  console.log("\n--- actions jouées / netBB total (500 déc) / EV comptée par le produit vs réelle");
  console.log(pad("stratégie", 30) + padl("EVcomptée", 11) + padl("EVréelle", 10) + padl("occultée%", 11) + padl("netBB", 9) + "  actions");
  for (const r of data) {
    const f = r.final;
    const hidden = f.evLossReelle > 0 ? (1 - f.evLossCompte / f.evLossReelle) * 100 : 0;
    console.log(pad(r.name, 30) + padl(f.evLossCompte.toFixed(1), 11) + padl(f.evLossReelle.toFixed(1), 10) +
      padl(hidden.toFixed(1), 11) + padl(r.netBB.toFixed(1), 9) + "  " + JSON.stringify(r.chosenActs));
  }
  console.log("\n--- maîtrise (Player.mastery) après 500 décisions");
  for (const r of data) {
    const m = r.final.mastery;
    const ks = Object.keys(m);
    const tot = ks.reduce((a, k) => a + m[k].seen, 0);
    const ok = ks.reduce((a, k) => a + m[k].ok, 0);
    const tiers = [...new Set(ks.map(k => m[k].name))];
    console.log(pad(r.name, 30) + `clés=${ks.length} seen=${tot} ok=${ok} paliers=${JSON.stringify(tiers)}`);
  }
}
