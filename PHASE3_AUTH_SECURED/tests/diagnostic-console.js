/* ============================================================================
   Diagnostic à coller dans la console du navigateur, sur le site publié.
   (Ouvrir herolab.eu → F12 → onglet « Console » → coller → Entrée)

   Répond à une seule question : « qu'est-ce qui manque encore pour que la
   connexion Google fonctionne ? »
   ============================================================================ */
(() => {
  const ok = "✅", ko = "❌", warn = "⚠️";
  const lignes = [];
  const dire = (etat, quoi, detail) =>
    lignes.push(`${etat}  ${quoit(quoi)}${detail ? "\n      " + detail : ""}`);
  const quoit = s => s.padEnd(34);

  /* 1. Quelle version est en ligne ? */
  const aAuth = typeof window.HeroLabAuth === "object";
  dire(aAuth ? ok : ko, "Version avec authentification",
    aAuth ? null : "C'est la version Phase 2 qui est publiée. Déployer "
                 + "PHASE3_AUTH_SECURED/herolab-auth.html à la place.");

  /* 2. Le moteur tourne-t-il ?
     Ses modules sont déclarés en `const` au niveau du script : ils vivent dans
     l'environnement lexical global et ne sont donc PAS des propriétés de
     window. On les teste par leur nom, via la chaîne de portées. */
  let moteur = false;
  try { moteur = typeof Play === "object" && typeof Ranges === "object"; } catch (e) {}
  dire(moteur ? ok : ko, "Moteur de jeu chargé");

  /* 3. La configuration Supabase est-elle renseignée ? */
  const cfg = window.HEROLAB_SUPABASE || {};
  const configure = !!(cfg.url && cfg.anonKey);
  dire(configure ? ok : ko, "Projet Supabase configuré",
    configure ? cfg.url
              : "Lancer configure.js avec l'URL et la clé anon, puis republier.");

  /* 4. La clé est-elle bien la clé publique ? */
  if (cfg.anonKey) {
    let role = "(illisible)";
    try { role = JSON.parse(atob(cfg.anonKey.split(".")[1])).role; } catch (e) {}
    const bonne = role === "anon";
    dire(bonne ? ok : ko, "Rôle de la clé",
      bonne ? "anon (correct)"
            : `« ${role} » — DANGER si c'est service_role : la remplacer `
              + "immédiatement par la clé anon et régénérer l'ancienne.");
  }

  /* 5. La politique de sécurité autorise-t-elle Supabase ? */
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const csp = meta ? meta.getAttribute("content") : "";
  const connect = (csp.match(/connect-src ([^;]*)/) || [])[1] || "";
  if (cfg.url) {
    let origine = "";
    try { origine = new URL(cfg.url).origin; } catch (e) {}
    const autorise = origine && connect.includes(origine);
    dire(autorise ? ok : ko, "CSP autorise l'appel à Supabase",
      autorise ? connect
               : `connect-src vaut « ${connect} » et ne contient pas ${origine}. `
                 + "L'artefact a été construit AVANT la configuration : "
                 + "relancer configure.js puis republier.");
  } else {
    dire(warn, "CSP", `connect-src : ${connect || "(absent)"}`);
  }

  /* 6. L'origine permet-elle OAuth ? */
  const proto = location.protocol;
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const bonneOrigine = proto === "https:" || local;
  dire(bonneOrigine ? ok : ko, "Origine compatible OAuth",
    bonneOrigine ? location.origin
                 : `${proto}// — Google exige HTTPS (ou localhost). `
                   + "Une page ouverte en fichier local ne pourra jamais se connecter.");

  /* 7. Session en cours ? */
  if (aAuth) {
    const id = window.HeroLabAuth.Identity;
    dire(id.isGuest ? warn : ok, "Session",
      id.isGuest ? "Mode invité (normal tant que tu ne t'es pas connecté)"
                 : "Connecté — identifiant " + id.uid);
  }

  /* 8. Adresse exacte à déclarer dans Supabase. */
  const retour = location.origin + location.pathname;

  console.log("\n════ DIAGNOSTIC HEROLAB ════\n");
  console.log(lignes.join("\n"));
  console.log("\n──── À déclarer dans Supabase ────");
  console.log("Authentication → URL Configuration → Redirect URLs :");
  console.log("   " + retour);
  console.log("(adresse exacte, sans joker)\n");
  if (cfg.url) {
    console.log("Authorized redirect URI côté Google Cloud :");
    console.log("   " + cfg.url.replace(/\/$/, "") + "/auth/v1/callback\n");
  }
})();
