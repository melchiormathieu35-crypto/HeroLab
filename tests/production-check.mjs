/**
 * Contrôles de production, hors navigateur.
 *
 * Vérifie que ce qui doit être déployé existe et est cohérent. Ces contrôles
 * répondent à un incident réel : la production a longtemps été un dépôt manuel
 * sans `robots.txt` ni `sitemap.xml`, et `main` ne contenait aucun `index.html`.
 * Ils échouent le build plutôt que de laisser partir une version incomplète.
 *
 * Usage : node tests/production-check.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "https://herolab.eu";
const fails = [];
const ok = [];
// Le détail décrit POURQUOI un contrôle échoue : ne l'afficher que sur échec,
// sinon la sortie CI se lit à contresens (« OK — le titre annonce Pivot »).
const check = (name, cond, detail = "") => {
  if (cond) ok.push(name);
  else fails.push(`${name}${detail ? " — " + detail : ""}`);
};

// ------------------------------------------------- fichiers indispensables
const REQUIRED = ["index.html", "robots.txt", "sitemap.xml", "netlify.toml", "assets/og-image.png"];
for (const f of REQUIRED) {
  const p = resolve(ROOT, f);
  check(`fichier présent : ${f}`, existsSync(p) && statSync(p).size > 0,
    existsSync(p) ? "" : "ABSENT");
}
if (fails.length) { report(); process.exit(1); }

const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
const head = html.slice(0, html.indexOf("<body"));
const attr = (re) => { const m = re.exec(head); return m ? m[1] : null; };

// ------------------------------------------------------- point d'entrée
check("index.html est bien Hero Lab",
  /<title>[^<]*Hero\s?Lab/i.test(head), "titre inattendu : " + attr(/<title>([^<]*)</));
check("index.html n'est pas l'ancienne génération",
  !/<title>[^<]*Pivot/i.test(head), "le titre annonce Pivot");
check("l'ancienne génération reste hors du point d'entrée",
  !existsSync(resolve(ROOT, "pivot-simulateur-cashgame-17.html")),
  "un fichier Pivot est revenu à la racine");

// ------------------------------------------------------------- métadonnées
const canonical = attr(/rel="canonical"\s+href="([^"]+)"/);
check("canonical absolu sur le domaine de production",
  canonical === `${DOMAIN}/`, `obtenu : ${canonical}`);
const ogUrl = attr(/property="og:url"\s+content="([^"]+)"/);
check("og:url absolu", ogUrl === `${DOMAIN}/`, `obtenu : ${ogUrl}`);
const ogImg = attr(/property="og:image"\s+content="([^"]+)"/);
check("og:image est une URL hébergée absolue",
  !!ogImg && ogImg.startsWith(DOMAIN) && !ogImg.startsWith("data:"),
  `obtenu : ${(ogImg || "").slice(0, 60)}`);
check("l'image og référencée existe dans le dépôt",
  !!ogImg && existsSync(resolve(ROOT, ogImg.replace(DOMAIN + "/", ""))),
  ogImg || "");
for (const tag of ["description", "robots"]) {
  check(`meta ${tag} présente`, new RegExp(`name="${tag}"`).test(head));
}
for (const tag of ["og:title", "og:description", "og:type"]) {
  check(`${tag} présente`, head.includes(`property="${tag}"`));
}
check("twitter:card présente", head.includes('name="twitter:card"'));
check("favicon présent", /rel="icon"/.test(head));
check("lang déclaré", /<html[^>]+lang="/.test(html));
check("charset déclaré", /<meta charset=/i.test(head));
check("viewport déclaré", /name="viewport"/.test(head));

// -------------------------------------------------------------- structure
const count = (re) => (html.match(re) || []).length;
check("un seul h1", count(/<h1[\s>]/g) === 1, `${count(/<h1[\s>]/g)} trouvés`);
check("hiérarchie h2 présente", count(/<h2[\s>]/g) >= 1);
check("bloc noscript présent", /<noscript>/.test(html));

// ---------------------------------------------------------------- JSON-LD
const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
check("JSON-LD présent", !!ld);
if (ld) {
  let data = null;
  try { data = JSON.parse(ld[1]); } catch (e) { check("JSON-LD parsable", false, e.message); }
  if (data) {
    check("JSON-LD parsable", true);
    check("JSON-LD @type renseigné", !!data["@type"], String(data["@type"]));
    check("JSON-LD name cohérent avec la marque", data.name === "Hero Lab", String(data.name));
    check("JSON-LD url cohérente avec le canonical", data.url === `${DOMAIN}/`, String(data.url));
    // Une promesse de fonctionnalité doit correspondre à un module réel.
    const features = data.featureList || [];
    check("JSON-LD annonce des fonctionnalités", features.length > 0);
  }
}

// ------------------------------------------------------- robots / sitemap
const robots = readFileSync(resolve(ROOT, "robots.txt"), "utf8");
check("robots.txt déclare le sitemap",
  robots.includes(`Sitemap: ${DOMAIN}/sitemap.xml`));
check("robots.txt interdit /archive/", /Disallow:\s*\/archive\//.test(robots));
const sitemap = readFileSync(resolve(ROOT, "sitemap.xml"), "utf8");
check("sitemap utilise le namespace officiel",
  sitemap.includes("http://www.sitemaps.org/schemas/sitemap/0.9"));
check("sitemap déclare une URL absolue",
  new RegExp(`<loc>${DOMAIN}/?</loc>`).test(sitemap),
  (/<loc>([^<]*)<\/loc>/.exec(sitemap) || [])[1]);

// ------------------------------------------------------------- netlify.toml
const toml = readFileSync(resolve(ROOT, "netlify.toml"), "utf8");
check("netlify publie la racine", /publish\s*=\s*"\."/.test(toml));
check("netlify ne déclare aucun build", /command\s*=\s*""/.test(toml));
check("netlify bloque /archive/", /from\s*=\s*"\/archive\/\*"/.test(toml) && /status\s*=\s*404/.test(toml));

function report() {
  for (const o of ok) console.log(`  OK   ${o}`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  console.log(`\n${ok.length}/${ok.length + fails.length} contrôles de production`);
}
report();
if (fails.length) process.exit(1);
