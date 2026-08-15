/**
 * Résolution du binaire Chromium, partagée par les runners.
 *
 * Le chemin était codé en dur vers l'image de développement, ce qui rendait les
 * suites inexécutables ailleurs — notamment en CI. L'ordre de résolution :
 *
 *   1. PLAYWRIGHT_CHROMIUM_PATH  — surcharge explicite si besoin
 *   2. un chemin local connu, s'il existe réellement sur la machine
 *   3. rien — Playwright résout alors le navigateur qu'il a installé lui-même,
 *      ce qui est le cas normal en CI après `playwright install chromium`
 *
 * Retourner `undefined` est le comportement voulu dans le cas 3 : passer
 * `executablePath: undefined` à `chromium.launch()` équivaut à ne pas le passer.
 */
import { existsSync } from "node:fs";

const CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
];

export function chromiumPath() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`PLAYWRIGHT_CHROMIUM_PATH pointe vers un binaire inexistant: ${override}`);
    }
    return override;
  }
  for (const p of CANDIDATES) if (existsSync(p)) return p;
  return undefined;   // Playwright résout son propre navigateur
}

/** Options de lancement communes. `headless` est explicite pour la CI. */
export function launchOptions(extra = {}) {
  const executablePath = chromiumPath();
  return { headless: true, ...(executablePath ? { executablePath } : {}), ...extra };
}
