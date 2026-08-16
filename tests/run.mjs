/**
 * Suite de régression Hero Lab.
 *
 * Usage:
 *   node tests/run.mjs                 # compare au baseline gelé
 *   node tests/run.mjs --write-baseline # (re)génère le baseline — à n'utiliser
 *                                        que sur un arbre vérifié inchangé
 *   node tests/run.mjs --file autre.html
 *
 * Principe : le moteur est gelé par fingerprint (hash). Le reste est testé par
 * assertions de contrat et de workflow. Aucun test n'est neutralisé pour obtenir
 * un résultat vert — un échec est rapporté tel quel.
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { engineProbe, enginePurityProbe } from "./engine-fingerprint.mjs";
import { contractSuite } from "./contracts.mjs";
import { launchOptions } from "./browser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const argv = process.argv.slice(2);
const WRITE = argv.includes("--write-baseline");
const fileArg = argv.indexOf("--file");
const TARGET = fileArg >= 0 ? argv[fileArg + 1] : "index.html";
const BASELINE = resolve(__dirname, "baseline.json");

const stable = (v) => JSON.stringify(v, (k, val) =>
  typeof val === "number" && !Number.isInteger(val) ? Number(val.toFixed(10)) : val);
const hash = (v) => createHash("sha256").update(stable(v)).digest("hex").slice(0, 16);

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  const tag = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${tag}  ${name}${detail ? "  — " + detail : ""}`);
};

const run = async () => {
  const target = resolve(ROOT, TARGET);
  if (!existsSync(target)) throw new Error("fichier introuvable: " + target);
  console.log(`\nHero Lab — suite de régression\n  cible: ${TARGET}\n`);

  const browser = await chromium.launch(launchOptions());
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  await page.goto(pathToFileURL(target).href, { waitUntil: "load" });
  await page.waitForTimeout(600);

  const base = existsSync(BASELINE) && !WRITE
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : null;
  const out = {};

  // ---------------------------------------------------------------- ENGINE
  console.log("ENGINE (DF-B, gelé)");
  const probe = await page.evaluate(`(${engineProbe.toString()})()`);
  out.engine = {};
  for (const [k, v] of Object.entries(probe)) out.engine[k] = hash(v);
  out.engineFull = probe;

  if (base) {
    for (const k of Object.keys(out.engine)) {
      const same = base.engine[k] === out.engine[k];
      record(`engine:${k}`, same, same ? "" : `hash ${base.engine[k]} → ${out.engine[k]}`);
    }
  } else {
    for (const k of Object.keys(out.engine)) record(`engine:${k}`, true, "baseline écrit");
  }

  // pureté
  const purity = await page.evaluate(`(${enginePurityProbe.toString()})()`);
  out.purity = purity;
  for (const [mod, r] of Object.entries(purity)) {
    record(`purity:${mod}`, r.violations.length === 0,
      r.violations.length ? "VIOLATIONS: " + r.violations.join(", ") : `${r.methods} méthodes, pur`);
  }

  // ------------------------------------------------------------- CONTRATS
  console.log("\nCONTRATS / WORKFLOWS");
  const suite = await page.evaluate(`(${contractSuite.toString()})()`);
  out.contracts = suite;
  for (const t of suite.tests) record(t.name, t.pass, t.detail || "");

  // --------------------------------------------------------- ERREURS PAGE
  console.log("\nSANTÉ RUNTIME");
  record("no-page-errors", pageErrors.length === 0,
    pageErrors.length ? pageErrors.slice(0, 3).join(" | ") : "aucune erreur JS");

  await browser.close();

  if (WRITE) {
    writeFileSync(BASELINE, JSON.stringify(out, null, 2));
    console.log(`\nbaseline écrit → tests/baseline.json`);
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log(`\x1b[31m${failed.length} ÉCHEC(S)\x1b[0m`);
    failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
    process.exitCode = 1;
  }
};

run().catch((e) => { console.error("HARNESS ERROR:", e); process.exitCode = 2; });
