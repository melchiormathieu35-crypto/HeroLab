/**
 * Harness de test HeroLab.
 *
 * Extrait le JS applicatif du fichier HTML mono-page et l'exécute dans un
 * contexte vm avec des stubs DOM/localStorage minimalistes, de façon à pouvoir
 * tester le moteur (BoardTex, Ranges, Play, Parser…) sous Node sans navigateur.
 *
 * Usage : const { M } = require("./harness")("VERSION_PRODUCTION/herolab.html");
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* Modules du fichier exposés aux tests. Les `const` de haut niveau d'un script
   vm ne deviennent pas des propriétés du global : on les recopie explicitement. */
const MODULES = [
  "Deck", "HandEval", "BoardTex", "Ranges", "Equity", "Odds", "Fmt", "UI",
  "PROFILES", "PROFILE_KEYS", "MODES", "AI", "Spot", "Play", "Table",
  "Progress", "Career", "Player", "Rating", "Journey", "App",
  "RangeModel", "HRSpot", "HRStats", "PRLab", "PRStats", "BlockerEngine",
  "BLStats", "Studio", "Calibrate", "StorageGuard", "Mentor", "MENTORS",
  "AVATARS", "APP_VERSION"
];

/* Modules vivant dans l'IIFE `window.Feutre = (function () { … })()` : ils ne
   sont pas globaux, on injecte leur export juste avant la fermeture de l'IIFE. */
const FEUTRE_MODULES = ["Parser", "Store", "Stats", "V", "FT", "LEAK_PLAIN", "LEAK_DRILL"];

function makeStubs() {
  const store = new Map();
  const noop = () => {};

  const makeEl = () => {
    const el = {
      style: {}, dataset: {}, classList: {
        add: noop, remove: noop, toggle: noop, contains: () => false
      },
      children: [], textContent: "", innerHTML: "", value: "",
      appendChild: noop, removeChild: noop, remove: noop, insertAdjacentHTML: noop,
      addEventListener: noop, removeEventListener: noop, setAttribute: noop,
      getAttribute: () => null, focus: noop, click: noop, scrollIntoView: noop,
      querySelector: () => makeEl(), querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      closest: () => null
    };
    return el;
  };

  const document = {
    readyState: "complete",
    documentElement: makeEl(),
    body: makeEl(),
    head: makeEl(),
    // Un élément stub est renvoyé pour chaque id : le code de rendu s'exécute
    // sans erreur, ce qui permet de tester la logique qui l'entoure.
    getElementById: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    createTextNode: () => makeEl(),
    addEventListener: noop,
    removeEventListener: noop
  };

  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; }
  };

  const window = {
    location: { search: "", hash: "", href: "http://localhost/", pathname: "/" },
    localStorage,
    addEventListener: noop, removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    requestAnimationFrame: cb => setTimeout(cb, 0),
    cancelAnimationFrame: noop,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    innerWidth: 390, innerHeight: 844,
    devicePixelRatio: 2,
    scrollTo: noop
  };

  return { document, localStorage, window, store };
}

/**
 * Extrait le <script> du moteur.
 *
 * On l'identifie par son CONTENU et non par sa position : la Phase 3 injecte
 * des scripts avant lui (SDK, config, couche identité), ce qui décalerait tout
 * repérage par index.
 */
function extractAppScript(html) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Signature du moteur : ses constantes de cartes, présentes nulle part
    // ailleurs (ni dans Chart.js, ni dans le SDK Supabase).
    if (m[1].includes('const RANKS = "23456789TJQKA"')) return m[1];
  }
  throw new Error("script du moteur introuvable");
}

/** Injecte l'export des internes de l'IIFE Feutre juste avant sa fermeture. */
function injectFeutreExport(code) {
  const open = code.indexOf("window.Feutre = (function () {");
  if (open < 0) throw new Error("IIFE Feutre introuvable");
  const close = code.lastIndexOf("})();");
  if (close < open) throw new Error("fermeture de l'IIFE Feutre introuvable");
  // L'IIFE se termine par un `return { … }` : injecter avant ce return, sinon
  // le code d'export est inatteignable.
  const ret = code.lastIndexOf("return {", close);
  if (ret < open) throw new Error("return final de l'IIFE Feutre introuvable");
  const exp = "globalThis.__F = {};\n" +
    FEUTRE_MODULES.map(m => `  try { globalThis.__F[${JSON.stringify(m)}] = ${m}; } catch (e) {}`).join("\n") +
    "\n  ";
  return code.slice(0, ret) + exp + code.slice(ret);
}

function load(relPath) {
  const abs = path.resolve(__dirname, "..", relPath);
  const html = fs.readFileSync(abs, "utf8");
  const code = injectFeutreExport(extractAppScript(html));

  const stubs = makeStubs();
  const sandbox = {
    console,
    document: stubs.document,
    window: stubs.window,
    localStorage: stubs.localStorage,
    location: stubs.window.location,
    navigator: { userAgent: "node", clipboard: { writeText: () => Promise.resolve() } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: stubs.window.requestAnimationFrame,
    cancelAnimationFrame: () => {},
    matchMedia: stubs.window.matchMedia,
    getComputedStyle: stubs.window.getComputedStyle,
    Chart: function () { return { update() {}, destroy() {}, data: {}, options: {} }; },
    URL: { createObjectURL: () => "blob:stub", revokeObjectURL: () => {} },
    Blob: function () {},
    FileReader: function () {},
    alert: () => {}, confirm: () => true, prompt: () => null
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  // Le script se termine par des appels d'init qui touchent le DOM : ils sont
  // déjà protégés par try/catch dans le fichier, mais on isole quand même.
  const exporter = `\n;globalThis.__M = {};\n` +
    MODULES.map(m => `try { globalThis.__M[${JSON.stringify(m)}] = ${m}; } catch (e) {}`).join("\n");

  vm.runInContext(code + exporter, sandbox, { filename: relPath, timeout: 60000 });

  const M = Object.assign({}, sandbox.__M, sandbox.__F || {});
  return { M, sandbox, storage: stubs.store };
}

module.exports = load;
module.exports.MODULES = MODULES;
module.exports.FEUTRE_MODULES = FEUTRE_MODULES;
