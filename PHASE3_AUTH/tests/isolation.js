/**
 * Tests d'isolation côté client (Chromium).
 *
 * Ce que RLS ne peut pas protéger : ce qui reste sur l'APPAREIL. Le scénario
 * critique est l'appareil partagé — A se déconnecte, B se connecte — où une
 * implémentation naïve fait hériter B de la progression de A, puis la pousse
 * dans le compte de B.
 *
 * Usage : node PHASE3_AUTH/tests/isolation.js [artefact.html]
 */
const path = require("path");
const { chromium } = require("playwright");

const target = process.argv[2] || "PHASE3_AUTH/herolab-auth.html";
const fileUrl = "file://" + path.resolve(__dirname, "..", "..", target);

const results = [];
const t = async (name, fn) => {
  try { await fn(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, err: e.message }); }
};
const ok = (v, m) => { if (!v) throw new Error(m || "attendu vrai"); };
const eq = (a, b, m) => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${m || ""} attendu ${y}, obtenu ${x}`);
};

const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";

(async () => {
  console.log(`Cible : ${target}\n`);
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(500);

  await t("la couche identité est en place et démarre en invité", async () => {
    const r = await page.evaluate(() => ({
      present: typeof window.HeroLabAuth === "object",
      guest: window.HeroLabAuth.Identity.isGuest,
      prefix: window.HeroLabAuth.Identity.prefix
    }));
    ok(r.present, "HeroLabAuth absent");
    ok(r.guest, "doit démarrer en invité");
    eq(r.prefix, "hl:guest:");
  });

  await t("le moteur charge sans compte (mode hors ligne préservé)", async () => {
    const r = await page.evaluate(() => ({
      progress: typeof Progress === "object" && !!Progress.data,
      play: typeof Play === "object"
    }));
    ok(r.progress, "Progress.data doit exister sans authentification");
    ok(r.play, "le moteur doit être présent");
  });

  await t("les écritures du moteur sont préfixées par l'identité", async () => {
    const r = await page.evaluate(() => {
      localStorage.setItem("pivot.v1", JSON.stringify({ xp: 42 }));
      const brut = window.HeroLabAuth._rawStorage;
      return {
        prefixee: brut.getItem("hl:guest:pivot.v1"),
        nue: brut.getItem("pivot.v1")
      };
    });
    ok(r.prefixee && JSON.parse(r.prefixee).xp === 42, "la clé préfixée doit contenir la donnée");
    eq(r.nue, null, "aucune écriture ne doit atterrir sur la clé nue");
  });

  await t("les clés hors liste blanche traversent sans préfixe (sessions Supabase)", async () => {
    const r = await page.evaluate(() => {
      localStorage.setItem("sb-abc-auth-token", "jeton");
      const brut = window.HeroLabAuth._rawStorage;
      return {
        nue: brut.getItem("sb-abc-auth-token"),
        prefixee: brut.getItem("hl:guest:sb-abc-auth-token")
      };
    });
    eq(r.nue, "jeton", "la session doit rester hors espace de noms applicatif");
    eq(r.prefixee, null, "elle ne doit pas être préfixée");
  });

  /* ══════════════ le scénario critique : appareil partagé ═══════════════ */

  await t("A puis B : B n'hérite JAMAIS de la progression de A", async () => {
    const r = await page.evaluate(async ([a, b]) => {
      const HL = window.HeroLabAuth;
      // — A se connecte et progresse
      HL.Identity.set(a);
      localStorage.setItem("pivot.v1", JSON.stringify({ xp: 9999, owner: "A" }));
      const vuParA = JSON.parse(localStorage.getItem("pivot.v1"));

      // — A se déconnecte (purge de son espace), puis B se connecte
      HL.Store.purge(HL.Identity.prefix);
      HL.Identity.set(null);
      HL.Identity.set(b);
      const vuParB = localStorage.getItem("pivot.v1");

      return { vuParA, vuParB };
    }, [UID_A, UID_B]);
    eq(r.vuParA.xp, 9999, "A doit voir sa propre progression");
    eq(r.vuParB, null, "B ne doit rien voir de la progression de A");
  });

  await t("A et B coexistent sans se marcher dessus", async () => {
    const r = await page.evaluate(async ([a, b]) => {
      const HL = window.HeroLabAuth;
      HL.Identity.set(a);
      localStorage.setItem("pivot.v1", JSON.stringify({ owner: "A" }));
      HL.Identity.set(b);
      localStorage.setItem("pivot.v1", JSON.stringify({ owner: "B" }));
      HL.Identity.set(a);
      const a2 = JSON.parse(localStorage.getItem("pivot.v1"));
      HL.Identity.set(b);
      const b2 = JSON.parse(localStorage.getItem("pivot.v1"));
      return { a2, b2 };
    }, [UID_A, UID_B]);
    eq(r.a2.owner, "A", "l'espace de A doit être intact");
    eq(r.b2.owner, "B", "l'espace de B doit être intact");
  });

  await t("la déconnexion purge l'espace du compte quitté", async () => {
    const r = await page.evaluate(async ([a]) => {
      const HL = window.HeroLabAuth;
      HL.Identity.set(a);
      for (const k of HL.APP_KEYS) localStorage.setItem(k, '{"x":1}');
      const avant = HL.Store.hasData(HL.userPrefix(a));
      await HL.Auth.signOut();
      return {
        avant,
        apres: HL.Store.hasData(HL.userPrefix(a)),
        guest: HL.Identity.isGuest
      };
    }, [UID_A]);
    ok(r.avant, "les données doivent exister avant déconnexion");
    ok(!r.apres, "elles doivent avoir disparu après déconnexion");
    ok(r.guest, "on doit retomber en invité");
  });

  await t("clear() ne vide que l'espace courant, jamais celui d'un autre", async () => {
    const r = await page.evaluate(([a, b]) => {
      const HL = window.HeroLabAuth;
      HL.Identity.set(a);
      localStorage.setItem("pivot.v1", '{"owner":"A"}');
      HL.Identity.set(b);
      localStorage.setItem("pivot.v1", '{"owner":"B"}');
      localStorage.clear();                       // B vide « son » stockage
      const bVide = localStorage.getItem("pivot.v1") === null;
      HL.Identity.set(a);
      const aIntact = localStorage.getItem("pivot.v1") !== null;
      return { bVide, aIntact };
    }, [UID_A, UID_B]);
    ok(r.bVide, "l'espace de B doit être vidé");
    ok(r.aIntact, "l'espace de A ne doit pas l'être");
  });

  /* ═════════════════════════════ migration ══════════════════════════════ */

  await t("les données héritées non préfixées sont détectées, pas absorbées", async () => {
    const r = await page.evaluate(([a]) => {
      const HL = window.HeroLabAuth;
      HL._rawStorage.clear();
      // simulation d'une installation Phase 2 : clés nues
      HL._rawStorage.setItem("pivot.v1", '{"xp":500,"legacy":true}');
      HL.Identity.set(a);
      const vu = localStorage.getItem("pivot.v1");     // espace utilisateur, vide
      const legacy = HL.Store.legacySnapshot();
      return { vu, legacyKeys: Object.keys(legacy) };
    }, [UID_A]);
    eq(r.vu, null, "les données héritées ne doivent pas être servies automatiquement");
    eq(r.legacyKeys, ["pivot.v1"], "mais elles doivent être détectables pour migration");
  });

  await t("la migration est idempotente et ne détruit rien avant écriture", async () => {
    const r = await page.evaluate(async ([a]) => {
      const HL = window.HeroLabAuth;
      HL._rawStorage.clear();
      HL._rawStorage.setItem("pivot.v1", '{"xp":500}');
      HL.Identity.set(a);
      // Sans Supabase configuré, push() échoue : la migration ne doit alors
      // PAS supprimer les données héritées.
      const r1 = await HL.Migration.resolve("local");
      const legacyApres = HL._rawStorage.getItem("pivot.v1");
      return { ok: r1.ok, legacyApres };
    }, [UID_A]);
    ok(!r.ok, "sans backend, la migration doit signaler l'échec");
    ok(r.legacyApres !== null,
      "les données héritées doivent survivre à une migration non confirmée");
  });

  /* ═══════════════════════════ jetons & secrets ═════════════════════════ */

  await t("aucune clé service_role dans l'artefact", async () => {
    const fs = require("fs");
    const src = fs.readFileSync(path.resolve(__dirname, "..", "..", target), "utf8");
    // On ignore les commentaires de config qui expliquent l'interdiction.
    const hits = src.split("\n").filter(l =>
      /service_role/.test(l) && !/^\s*(\*|\/\/|<!--|--)/.test(l) && !/N'INSCRIRE|contourne RLS|BUILD REFUS/.test(l));
    eq(hits.length, 0, `lignes suspectes : ${hits.slice(0, 2).join(" | ")}`);
  });

  await t("la CSP autorise le réseau au strict nécessaire", async () => {
    const c = await page.evaluate(() => {
      const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return m && m.getAttribute("content");
    });
    ok(c, "CSP absente");
    ok(/default-src 'none'/.test(c), "default-src 'none' attendu");
    ok(!/connect-src[^;]*\*/.test(c), "aucun joker ne doit figurer dans connect-src");
    ok(!/script-src[^;]*https?:/.test(c), "script-src ne doit porter aucune origine externe");
  });

  await t("le nom d'affichage Google est traité comme non fiable", async () => {
    const r = await page.evaluate(() => {
      const HL = window.HeroLabAuth;
      HL.Identity.set("33333333-3333-4333-8333-333333333333");
      HL.Auth.user = { user_metadata: { full_name: '<img src=x onerror="window.__xss=1">' } };
      window.dispatchEvent(new CustomEvent("herolab:identity", { detail: {} }));
      const badge = document.querySelector(".hl-acct .hl-who");
      return {
        xss: !!window.__xss,
        imgs: document.querySelectorAll(".hl-acct img").length,
        texte: badge ? badge.textContent : null
      };
    });
    ok(!r.xss, "le nom Google ne doit pas pouvoir exécuter de script");
    eq(r.imgs, 0, "aucune balise ne doit être créée depuis le nom");
    ok(r.texte && r.texte.includes("<img"), "le nom doit être affiché comme texte brut");
  });

  await t("aucune erreur JavaScript pendant la session de test", async () => {
    ok(errors.length === 0, `erreurs : ${errors.slice(0, 3).join(" | ")}`);
  });

  await browser.close();

  let pass = 0, fail = 0;
  for (const r of results) {
    if (r.pass) { pass++; console.log(`  PASS  ${r.name}`); }
    else { fail++; console.log(`  FAIL  ${r.name}\n        ${r.err}`); }
  }
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
