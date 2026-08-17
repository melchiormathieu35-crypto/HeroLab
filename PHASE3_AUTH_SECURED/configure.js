/**
 * Configure la connexion Supabase et reconstruit l'artefact.
 *
 * Évite d'avoir à éditer une ligne perdue au milieu d'un fichier de 1,7 Mo.
 *
 *   node PHASE3_AUTH_SECURED/configure.js <url-supabase> <cle-anon>
 *   node PHASE3_AUTH_SECURED/configure.js --reset      (repasse en mode invité)
 *
 * Exemple :
 *   node PHASE3_AUTH_SECURED/configure.js \
 *        https://abcdefghijklm.supabase.co eyJhbGciOi...
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const CONFIG = path.join(HERE, "src", "config.js");

const args = process.argv.slice(2);

function write(url, key) {
  const src = fs.readFileSync(CONFIG, "utf8");
  const out = src
    .replace(/url:\s*"[^"]*"/, `url: ${JSON.stringify(url)}`)
    .replace(/anonKey:\s*"[^"]*"/, `anonKey: ${JSON.stringify(key)}`);
  fs.writeFileSync(CONFIG, out);
}

if (args[0] === "--reset") {
  write("", "");
  console.log("Configuration effacée : l'application repasse en mode invité hors ligne.");
} else {
  const [url, key] = args;

  if (!url || !key) {
    console.error("Usage : node PHASE3_AUTH_SECURED/configure.js <url-supabase> <cle-anon>");
    console.error("        node PHASE3_AUTH_SECURED/configure.js --reset");
    process.exit(1);
  }

  // ── Contrôles de saisie : ces erreurs-là coûtent une heure à diagnostiquer.
  let origin;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("protocole");
    origin = u.origin;
  } catch {
    console.error(`URL invalide : « ${url} »`);
    console.error("Attendu quelque chose comme https://abcdefghijklm.supabase.co");
    process.exit(1);
  }

  // Une clé Supabase est un JWT : trois segments séparés par des points.
  const parts = key.split(".");
  if (parts.length !== 3) {
    console.error("La clé ne ressemble pas à une clé Supabase (JWT en trois parties).");
    process.exit(1);
  }

  // Refus catégorique de la clé service_role : elle contourne RLS, donc la
  // livrer au navigateur exposerait publiquement les données de tous les comptes.
  let payload = {};
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
  } catch { /* charge utile illisible : on continue, le contrôle ci-dessous suffit */ }

  if (payload.role === "service_role" || /service_role/.test(key)) {
    console.error("REFUSÉ : c'est la clé « service_role ».");
    console.error("Elle contourne la sécurité au niveau des lignes (RLS) : la mettre");
    console.error("dans une page web exposerait les données de TOUS les utilisateurs.");
    console.error("Utilise la clé « anon / public » du même écran.");
    process.exit(1);
  }

  if (payload.role && payload.role !== "anon") {
    console.error(`REFUSÉ : rôle « ${payload.role} » inattendu, la clé « anon » est requise.`);
    process.exit(1);
  }

  write(url, key);
  console.log("Configuration enregistrée.");
  console.log("  projet      " + origin);
  console.log("  rôle de clé " + (payload.role || "(non lisible)"));
  console.log();
}

execFileSync(process.execPath, [path.join(HERE, "build.js")], { stdio: "inherit" });

if (args[0] !== "--reset") {
  console.log();
  console.log("Il reste à déclarer l'URL de retour dans Supabase :");
  console.log("  Authentication → URL Configuration → Redirect URLs");
  console.log("  Y mettre l'adresse EXACTE de la page publiée, sans joker.");
}
