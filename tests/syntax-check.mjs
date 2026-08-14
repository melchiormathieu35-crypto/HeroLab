/**
 * Contrôle de syntaxe du JS applicatif, hors navigateur.
 * Rapide, et surtout : évite de lancer Playwright sur un fichier cassé
 * (le harnais partirait alors en timeout au lieu de dire ce qui ne va pas).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] || "index4.html";
const src = readFileSync(resolve(ROOT, file), "utf8");
const first = src.indexOf("<script>");
const start = src.indexOf("<script>", first + 8);   // 2e bloc = JS applicatif
const end = src.lastIndexOf("</script>");
const js = src.slice(start + 8, end);

try {
  new vm.Script(js, { filename: file + " (app script)" });
  console.log(`syntaxe OK — ${js.length} chars`);
} catch (e) {
  console.error(`SYNTAXE INVALIDE dans ${file}:`);
  console.error("  " + e.message);
  if (e.stack) console.error(e.stack.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
}
