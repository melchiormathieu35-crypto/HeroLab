/**
 * Assemble l'artefact HeroLab avec authentification.
 *
 *   base (Phase 2)  +  CSP élargie  +  SDK Supabase  +  config  +  auth-sync
 *   →  PHASE3_AUTH_SECURED/herolab-auth.html
 *
 * Le module auth-sync est injecté AVANT le script du moteur : il doit avoir
 * substitué l'adaptateur de stockage avant le premier load().
 *
 * Usage : node PHASE3_AUTH_SECURED/build.js [--out chemin.html]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const P3 = path.join(ROOT, "PHASE3_AUTH_SECURED");

const BASE = path.join(ROOT, "VERSION_PRODUCTION", "herolab.html");
const VENDOR = path.join(P3, "vendor", "supabase-js-2.112.3.umd.js");
const CONFIG = path.join(P3, "src", "config.js");
const MODULE = path.join(P3, "src", "auth-sync.js");
const UI = path.join(P3, "src", "auth-ui.js");

const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? path.resolve(process.argv[outArg + 1])
                        : path.join(P3, "herolab-auth.html");

const read = f => fs.readFileSync(f, "utf8");

/* ─────────────────────────────── garde-fous ─────────────────────────────── */

const config = read(CONFIG);

// La clé service_role est un JWT dont la charge utile contient "service_role".
// La laisser fuiter dans l'artefact exposerait toutes les données de tous les
// comptes : le build échoue plutôt que de produire un fichier dangereux.
if (/service_role/.test(config.replace(/\/\*[\s\S]*?\*\//g, ""))) {
  console.error("BUILD REFUSÉ : « service_role » apparaît hors commentaire dans config.js.");
  process.exit(1);
}

// Contrôle d'intégrité du SDK embarqué.
const crypto = require("crypto");
const vendorSrc = read(VENDOR);
const digest = crypto.createHash("sha256").update(vendorSrc).digest("hex");
const sums = read(path.join(P3, "vendor", "SHA256SUMS"));
if (!sums.includes(digest)) {
  console.error("BUILD REFUSÉ : le SDK embarqué ne correspond pas à SHA256SUMS.");
  console.error("  attendu dans SHA256SUMS, calculé : " + digest);
  process.exit(1);
}
if (/\beval\s*\(|new Function\s*\(/.test(vendorSrc)) {
  console.error("BUILD REFUSÉ : le SDK embarqué contient eval/new Function.");
  process.exit(1);
}

/* ──────────────────────────────── assemblage ────────────────────────────── */

let html = read(BASE);

// 1. CSP — la Phase 2 interdisait tout réseau ; la Phase 3 ouvre la seule
//    origine nécessaire, et rien d'autre (ARCHITECTURE.md §8).
const urlMatch = config.match(/url:\s*"([^"]*)"/);
const supaOrigin = urlMatch && urlMatch[1] ? new URL(urlMatch[1]).origin : "";
const connect = supaOrigin ? `'self' ${supaOrigin}` : "'self'";

const oldCsp = /<meta http-equiv="Content-Security-Policy"[^>]*>/;
if (!oldCsp.test(html)) {
  console.error("BUILD REFUSÉ : CSP de base introuvable dans l'artefact Phase 2.");
  process.exit(1);
}
html = html.replace(oldCsp,
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
  `script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; ` +
  `font-src data:; media-src data:; connect-src ${connect}; ` +
  `base-uri 'none'; form-action 'none'">`);

// 2. Injection avant le script du moteur. Le moteur est le SECOND <script>
//    (le premier est Chart.js) : on s'insère juste avant son ouverture.
const marks = [...html.matchAll(/<script>/g)].map(m => m.index);
if (marks.length < 2) {
  console.error("BUILD REFUSÉ : script du moteur introuvable.");
  process.exit(1);
}
const at = marks[1];

const injected =
  "<!-- ── Phase 3 : identité & synchronisation ──────────────────────────\n" +
  "     Ces trois scripts s'exécutent AVANT le moteur : l'adaptateur de\n" +
  "     stockage doit être en place avant le premier load(). Le moteur, lui,\n" +
  "     reste inchangé et ignore tout de Supabase. -->\n" +
  "<script>/* @supabase/supabase-js 2.112.3 — UMD embarqué, cf. vendor/PROVENANCE.md */\n" +
  vendorSrc + "\n</script>\n" +
  "<script>\n" + config + "\n</script>\n" +
  "<script>\n" + read(MODULE) + "\n</script>\n" +
  (fs.existsSync(UI) ? "<script>\n" + read(UI) + "\n</script>\n" : "");

html = html.slice(0, at) + injected + html.slice(at);

fs.writeFileSync(OUT, html);

const kb = n => (n / 1024).toFixed(0) + " Ko";
console.log("Artefact écrit : " + path.relative(ROOT, OUT));
console.log("  base      " + kb(read(BASE).length));
console.log("  + SDK     " + kb(vendorSrc.length));
console.log("  + modules " + kb(injected.length - vendorSrc.length));
console.log("  = total   " + kb(html.length));
console.log("  CSP connect-src : " + connect);
if (!supaOrigin) {
  console.log("\n  Note : aucune URL Supabase configurée — l'artefact fonctionne");
  console.log("  en mode invité hors ligne, l'authentification reste inactive.");
}
