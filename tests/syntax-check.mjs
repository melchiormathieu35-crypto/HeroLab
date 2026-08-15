/**
 * Contrôle de syntaxe des scripts inline, hors navigateur.
 *
 * Rapide, et surtout : évite de lancer Playwright sur un fichier cassé (le
 * harnais partirait alors en timeout au lieu de dire ce qui ne va pas).
 *
 * La première version supposait que le JS applicatif était le DEUXIÈME bloc
 * `<script>` — vrai pour index.html, où Chart.js est inliné en premier, faux
 * pour tout fichier chargeant Chart.js depuis un CDN. Elle produisait donc un
 * faux positif sur la génération archivée. Cette version parcourt tous les
 * blocs inline, sans hypothèse sur leur ordre ni leur nombre.
 *
 * Usage:
 *   node tests/syntax-check.mjs [fichier.html]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] || "index.html";
const src = readFileSync(resolve(ROOT, file), "utf8");

/** Numéro de ligne (1-indexé) d'un offset, pour situer une erreur. */
const lineAt = (offset) => src.slice(0, offset).split("\n").length;

/**
 * Blocs `<script>` à vérifier : uniquement les scripts inline exécutables.
 * On écarte ceux qui ont un `src` (rien à parser) et ceux dont le `type` n'est
 * pas du JavaScript — application/ld+json notamment, qui est du JSON et ferait
 * échouer un parseur JS.
 */
const blocks = [];
const openTag = /<script\b([^>]*)>/gi;
let m;
while ((m = openTag.exec(src))) {
  const attrs = m[1] || "";
  const bodyStart = m.index + m[0].length;
  const bodyEnd = src.indexOf("</script>", bodyStart);
  if (bodyEnd === -1) {
    console.error(`${file}: <script> non refermé à la ligne ${lineAt(m.index)}`);
    process.exit(1);
  }
  openTag.lastIndex = bodyEnd;

  if (/\bsrc\s*=/i.test(attrs)) continue;                       // script externe
  const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
  if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type[1])) {
    // JSON-LD et consorts : on vérifie quand même que le JSON est valide.
    if (/json/i.test(type[1])) {
      try { JSON.parse(src.slice(bodyStart, bodyEnd)); }
      catch (e) {
        console.error(`${file}: JSON invalide dans <script type="${type[1]}"> ligne ${lineAt(bodyStart)}`);
        console.error("  " + e.message);
        process.exit(1);
      }
    }
    continue;
  }
  blocks.push({ code: src.slice(bodyStart, bodyEnd), line: lineAt(bodyStart), isModule: !!(type && type[1] === "module") });
}

if (!blocks.length) {
  console.error(`${file}: aucun script inline trouvé — cible probablement incorrecte`);
  process.exit(1);
}

let total = 0;
for (const b of blocks) {
  try {
    // Un script classique et un module ne se parsent pas pareil (import/export).
    if (b.isModule) new vm.SourceTextModule(b.code, { identifier: `${file}#L${b.line}` });
    else new vm.Script(b.code, { filename: `${file} (inline @L${b.line})` });
    total += b.code.length;
  } catch (e) {
    console.error(`SYNTAXE INVALIDE dans ${file}, bloc inline commençant ligne ${b.line} :`);
    console.error("  " + e.message);
    process.exit(1);
  }
}

console.log(`syntaxe OK — ${blocks.length} bloc(s) inline, ${total} chars`);
