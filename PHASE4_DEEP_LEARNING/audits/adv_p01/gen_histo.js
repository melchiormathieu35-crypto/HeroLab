/** Génère un historique Winamax synthétique exploitable par le Tracker. */
const fs = require("fs");
const path = require("path");

const NOMS = ["Alice", "Bob", "Carla", "Dimitri", "Eva"];
const RANGS = "23456789TJQKA".split("");
const COUL = ["s", "h", "d", "c"];
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];

function carte(used) {
  let c;
  do { c = pick(RANGS) + pick(COUL); } while (used.has(c));
  used.add(c); return c;
}

function main(i) {
  const used = new Set();
  const btn = 1 + (i % 5);
  const sbSeat = (btn % 5) + 1, bbSeat = ((btn + 1) % 5) + 1;
  const sb = NOMS[sbSeat - 1], bb = NOMS[bbSeat - 1];
  const heroSeat = 3, hero = "Hero";
  const noms = NOMS.slice();
  noms[heroSeat - 1] = hero;
  const h1 = carte(used), h2 = carte(used);
  const flop = [carte(used), carte(used), carte(used)];
  const turn = carte(used), river = carte(used);
  const gagne = i % 3 === 0;
  const pot = (0.30 + (i % 7) * 0.15).toFixed(2);
  const L = [];
  L.push(`Winamax Poker - CashGame - HandId: #900000-${1000 + i}-${2000 + i} - Holdem no limit (0.02€/0.05€) - 2026/06/${String(1 + (i % 27)).padStart(2, "0")} 20:${String(10 + (i % 45)).padStart(2, "0")}:33 UTC`);
  L.push(`Table: 'Wichita 05' 5-max (real money) Seat #${btn} is the button`);
  for (let s = 1; s <= 5; s++) L.push(`Seat ${s}: ${noms[s - 1]} (5€)`);
  L.push("*** ANTE/BLINDS ***");
  L.push(`${noms[sbSeat - 1]} posts small blind 0.02€`);
  L.push(`${noms[bbSeat - 1]} posts big blind 0.05€`);
  L.push(`Dealt to ${hero} [${h1} ${h2}]`);
  L.push("*** PRE-FLOP ***");
  // Le héros ouvre très large et paie beaucoup : de quoi générer des fuites.
  const villain = noms.find(n => n !== hero && n !== noms[bbSeat - 1]) || "Alice";
  if (i % 2 === 0) {
    L.push(`${hero} raises 0.10€ to 0.15€`);
    L.push(`${noms[bbSeat - 1] === hero ? villain : noms[bbSeat - 1]} calls 0.10€`);
  } else {
    L.push(`${hero} calls 0.05€`);
    L.push(`${noms[bbSeat - 1] === hero ? villain : noms[bbSeat - 1]} checks`);
  }
  L.push(`*** FLOP *** [${flop.join(" ")}]`);
  L.push(`${hero} bets 0.20€`);
  L.push(`${noms[bbSeat - 1] === hero ? villain : noms[bbSeat - 1]} calls 0.20€`);
  L.push(`*** TURN *** [${flop.join(" ")}][${turn}]`);
  L.push(`${hero} checks`);
  L.push(`${noms[bbSeat - 1] === hero ? villain : noms[bbSeat - 1]} checks`);
  L.push(`*** RIVER *** [${flop.join(" ")}][${turn}][${river}]`);
  L.push(`${hero} checks`);
  L.push(`${noms[bbSeat - 1] === hero ? villain : noms[bbSeat - 1]} bets 0.30€`);
  L.push(gagne ? `${hero} calls 0.30€` : `${hero} folds`);
  L.push("*** SHOW DOWN ***");
  L.push("*** SUMMARY ***");
  L.push(`Total pot ${pot}€ | No rake`);
  L.push(`Board: [${flop.join(" ")} ${turn} ${river}]`);
  if (gagne) L.push(`Seat ${heroSeat}: ${hero} won ${pot}€`);
  else L.push(`Seat ${heroSeat}: ${hero} lost`);
  return L.join("\n");
}

const N = +(process.argv[2] || 80);
const out = [];
for (let i = 0; i < N; i++) out.push(main(i));
const f = path.join(__dirname, "histo_test.txt");
fs.writeFileSync(f, out.join("\n\n") + "\n");
console.log("écrit", f, N, "mains");
