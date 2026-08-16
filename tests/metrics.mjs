/**
 * Métriques architecturales statiques — comparaison BEFORE / AFTER.
 *
 * Usage:
 *   node tests/metrics.mjs                       # mesure index.html
 *   node tests/metrics.mjs --file x.html --json  # sortie machine
 *   node tests/metrics.mjs --save before         # fige un instantané
 *   node tests/metrics.mjs --diff before         # compare à un instantané
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SNAP = resolve(__dirname, "snapshots");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const TARGET = arg("--file", "index.html");

const FROZEN = ["Deck", "HandEval", "Ranges", "BoardTex", "Equity", "Odds", "CAT", "RANKS"];
const LAB_FAMILIES = { HR: /^HR/, PR: /^PR(?!OFILE)/, BL: /^BL/ };

export function collect(file) {
  const src = readFileSync(resolve(ROOT, file), "utf8");
  const lines = src.split("\n");

  // Le JS applicatif commence après le dernier <script> d'ouverture ; on ignore
  // Chart.js inliné et les blobs base64 (lignes > 5000 chars) pour ne pas
  // polluer les compteurs.
  const appStart = lines.findIndex((l, i) => i > 100 && /^<script>\s*$/.test(l)) + 1;
  const isNoise = (l) => l.length > 5000;

  // --- modules top-level (const X = ... en colonne 0) ---
  const mods = [];
  lines.forEach((l, i) => {
    const m = /^(?:const|var|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/.exec(l);
    if (m && i + 1 >= appStart) mods.push({ line: i + 1, name: m[1] });
  });
  // + IIFE assignée (window.X = (function(){)
  lines.forEach((l, i) => {
    const m = /^window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\(function/.exec(l);
    if (m) mods.push({ line: i + 1, name: m[1], iife: true });
  });
  mods.sort((a, b) => a.line - b.line);

  const bounds = {};
  mods.forEach((m, i) => {
    bounds[m.name] = [m.line, i + 1 < mods.length ? mods[i + 1].line - 1 : lines.length];
  });
  const seg = (n) => bounds[n] ? lines.slice(bounds[n][0] - 1, bounds[n][1]).join("\n") : "";

  const count = (s, re) => (s.match(re) || []).length;
  const names = mods.map(m => m.name);

  const fanOut = (n) => names.filter(t => t !== n && new RegExp(`\\b${t}\\.`).test(seg(n))).length;
  const fanIn = (n) => names.filter(s => s !== n && new RegExp(`\\b${n}\\.`).test(seg(s))).length;

  // --- App ---
  const appSeg = seg("App");
  const appMethods = (appSeg.match(/^  [A-Za-z_$][A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/gm) || []).length;
  const appDeclared = new Set(
    [...appSeg.matchAll(/^  ([A-Za-z_$][A-Za-z0-9_$]*)\s*[(:]/gm)].map(m => m[1]));
  const appRefd = new Set(
    [...src.matchAll(/\bApp\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map(m => m[1]));
  const appDynamic = [...appRefd].filter(k => !appDeclared.has(k));

  // --- localStorage : accès RÉELS uniquement (les commentaires qui mentionnent
  // le mot ne sont pas des dépendances) ---
  const LS_ACCESS = /localStorage\s*\.\s*(?:getItem|setItem|removeItem|clear|key|length)|localStorage\s*\[/g;
  const lsModules = names.filter(n => new RegExp(LS_ACCESS.source).test(seg(n)));
  const lsTotal = lines.filter((l, i) => i + 1 >= appStart && !isNoise(l))
    .reduce((a, l) => a + count(l, new RegExp(LS_ACCESS.source, "g")), 0);

  // --- DOM ---
  const domRe = /\b(?:innerHTML|getElementById|querySelector|querySelectorAll|createElement)\b/g;
  const domModules = names.filter(n => count(seg(n), domRe) > 0);

  // --- moteur ---
  const engineViolations = {};
  for (const f of FROZEN) {
    if (!bounds[f]) continue;
    const s = seg(f);
    const v = ["document", "localStorage", "innerHTML", "window.", "App.", "UI."]
      .filter(x => s.includes(x));
    if (v.length) engineViolations[f] = v;
  }

  // --- couplage inter-labs ---
  const interLab = [];
  for (const [fa, ra] of Object.entries(LAB_FAMILIES)) {
    for (const [fb, rb] of Object.entries(LAB_FAMILIES)) {
      if (fa === fb) continue;
      for (const s of names.filter(n => ra.test(n))) {
        for (const tg of names.filter(n => rb.test(n))) {
          if (new RegExp(`\\b${tg}\\.`).test(seg(s))) interLab.push(`${s}->${tg}`);
        }
      }
    }
  }

  const appLoc = bounds.App ? bounds.App[1] - bounds.App[0] + 1 : 0;
  const topN = names.map(n => ({ n, loc: bounds[n][1] - bounds[n][0] + 1, out: fanOut(n), in: fanIn(n) }))
    .sort((a, b) => b.out - a.out).slice(0, 8);

  return {
    file,
    totalLines: lines.length,
    appJsLines: lines.length - appStart,
    modules: names.length,
    App: {
      lines: appLoc,
      methods: appMethods,
      stateDeclared: appDeclared.size - appMethods,
      stateDynamic: appDynamic.length,
      dynamicFields: appDynamic.sort(),
      fanOut: fanOut("App"),
      fanIn: fanIn("App"),
      domWrites: count(appSeg, domRe),
      selfRefs: count(appSeg, /\bApp\./g),
    },
    storage: {
      directModules: lsModules.length,
      modules: lsModules,
      totalRefs: lsTotal,
      hasStorageLayer: names.includes("Storage") || names.includes("StorageLayer"),
    },
    dom: { modules: domModules.length, list: domModules },
    engine: {
      frozenPresent: FROZEN.filter(f => bounds[f]).length,
      violations: engineViolations,
      pure: Object.keys(engineViolations).length === 0,
    },
    interLabDeps: { count: interLab.length, list: interLab },
    topFanOut: topN,
  };
}

const fmt = (m) => {
  const L = [];
  L.push(`fichier                  ${m.file}`);
  L.push(`lignes totales           ${m.totalLines}`);
  L.push(`modules top-level        ${m.modules}`);
  L.push(``);
  L.push(`App — lignes             ${m.App.lines}`);
  L.push(`App — méthodes           ${m.App.methods}`);
  L.push(`App — état déclaré       ${m.App.stateDeclared}`);
  L.push(`App — état dynamique     ${m.App.stateDynamic}  ${m.App.dynamicFields.join(" ")}`);
  L.push(`App — fan-out            ${m.App.fanOut}`);
  L.push(`App — fan-in             ${m.App.fanIn}`);
  L.push(`App — écritures DOM      ${m.App.domWrites}`);
  L.push(``);
  L.push(`localStorage — modules   ${m.storage.directModules}`);
  L.push(`localStorage — refs      ${m.storage.totalRefs}`);
  L.push(`couche Storage           ${m.storage.hasStorageLayer ? "OUI" : "NON"}`);
  L.push(`modules touchant le DOM  ${m.dom.modules}`);
  L.push(`dépendances inter-labs   ${m.interLabDeps.count}  ${m.interLabDeps.list.join(" ")}`);
  L.push(`moteur gelé — pur        ${m.engine.pure ? "OUI" : "NON " + JSON.stringify(m.engine.violations)}`);
  return L.join("\n");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = collect(TARGET);
  const save = arg("--save"), diff = arg("--diff");
  if (!existsSync(SNAP)) mkdirSync(SNAP, { recursive: true });
  if (save) { writeFileSync(resolve(SNAP, save + ".json"), JSON.stringify(m, null, 2)); console.log(`instantané → tests/snapshots/${save}.json`); }
  if (diff) {
    const b = JSON.parse(readFileSync(resolve(SNAP, diff + ".json"), "utf8"));
    const rows = [
      ["lignes totales", b.totalLines, m.totalLines],
      ["modules", b.modules, m.modules],
      ["App lignes", b.App.lines, m.App.lines],
      ["App méthodes", b.App.methods, m.App.methods],
      ["App état déclaré", b.App.stateDeclared, m.App.stateDeclared],
      ["App état dynamique", b.App.stateDynamic, m.App.stateDynamic],
      ["App fan-out", b.App.fanOut, m.App.fanOut],
      ["App écritures DOM", b.App.domWrites, m.App.domWrites],
      ["localStorage modules", b.storage.directModules, m.storage.directModules],
      ["localStorage refs", b.storage.totalRefs, m.storage.totalRefs],
      ["dépendances inter-labs", b.interLabDeps.count, m.interLabDeps.count],
      ["moteur pur", b.engine.pure ? 1 : 0, m.engine.pure ? 1 : 0],
    ];
    const w = Math.max(...rows.map(r => r[0].length));
    console.log(`\n${"métrique".padEnd(w)}  ${"avant".padStart(7)}  ${"après".padStart(7)}  delta`);
    console.log("-".repeat(w + 30));
    for (const [k, a, c] of rows) {
      const d = c - a, s = d === 0 ? "=" : (d > 0 ? "+" + d : String(d));
      console.log(`${k.padEnd(w)}  ${String(a).padStart(7)}  ${String(c).padStart(7)}  ${s}`);
    }
  }
  if (argv.includes("--json")) console.log(JSON.stringify(m, null, 2));
  else if (!diff) console.log("\n" + fmt(m));
}
