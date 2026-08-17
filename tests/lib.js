/** Micro-framework de test (pas de dépendance externe). */
const results = [];
let currentSuite = "(sans suite)";

function suite(name) { currentSuite = name; results.push({ type: "suite", name }); }

function test(name, fn) {
  try {
    fn();
    results.push({ type: "test", suite: currentSuite, name, pass: true });
  } catch (e) {
    results.push({ type: "test", suite: currentSuite, name, pass: false, err: e.message });
  }
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || ""} attendu ${b}, obtenu ${a}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || `attendu vrai, obtenu ${JSON.stringify(v)}`); }
function notOk(v, msg) { if (v) throw new Error(msg || `attendu faux, obtenu ${JSON.stringify(v)}`); }
function near(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol)
    throw new Error(`${msg || ""} attendu ${expected} ±${tol}, obtenu ${actual}`);
}

function report() {
  let pass = 0, fail = 0;
  for (const r of results) {
    if (r.type === "suite") { console.log(`\n── ${r.name}`); continue; }
    if (r.pass) { pass++; console.log(`  PASS  ${r.name}`); }
    else { fail++; console.log(`  FAIL  ${r.name}\n        ${r.err}`); }
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  return fail;
}

/* Helpers cartes : "Ah" -> id numérique (rang*4 + couleur). */
const RANKS = "23456789TJQKA", SUITS = "cdhs";
const C = s => RANKS.indexOf(s[0].toUpperCase()) * 4 + SUITS.indexOf(s[1].toLowerCase());
const H = str => str.trim().split(/\s+/).map(C);

module.exports = { suite, test, eq, ok, notOk, near, report, C, H };
