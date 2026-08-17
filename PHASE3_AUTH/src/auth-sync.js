/* ============================================================================
   HeroLab — couche identité / stockage / synchronisation.

   Cette couche s'intercale SOUS le moteur DF-B, au niveau du stockage. Le
   moteur continue d'appeler localStorage avec ses clés historiques et ignore
   tout de Supabase, des sessions et des jetons.

   Ordre de chargement imposé : ce fichier s'exécute AVANT le script du moteur,
   car il substitue l'adaptateur de stockage avant le premier `load()`.

   Voir ARCHITECTURE.md §2 pour le raisonnement.
   ========================================================================== */
(function () {
  "use strict";

  /* Clés applicatives connues. Liste BLANCHE : tout ce qui n'y figure pas
     traverse l'adaptateur sans être touché (notamment les clés de session
     Supabase `sb-*`, qui ne doivent surtout pas être rangées dans l'espace de
     noms d'un utilisateur). Une liste noire laisserait passer toute clé
     future. */
  const APP_KEYS = Object.freeze([
    "pivot.v1", "pivot.career.v1", "pivot.player.v1", "pivot.hr.v1",
    "pivot.pr.v1", "pivot.bl.v1", "pivot.rating.v1", "pivot.journey.v1",
    "feutre.v1"
  ]);

  /* Correspondance clé locale → document distant (ARCHITECTURE.md §3.2). */
  const DOC_OF_KEY = Object.freeze({
    "pivot.v1": "progress",
    "pivot.career.v1": "career",
    "pivot.player.v1": "player",
    "pivot.hr.v1": "hr",
    "pivot.pr.v1": "pr",
    "pivot.bl.v1": "bl",
    "pivot.rating.v1": "rating",
    "pivot.journey.v1": "journey",
    "feutre.v1": "tracker"
  });

  const GUEST_PREFIX = "hl:guest:";
  const userPrefix = uid => `hl:u:${uid}:`;

  /* Le vrai localStorage, capturé avant toute substitution. */
  const raw = window.localStorage;

  /* ══════════════════════════════════════════════════════════ IDENTITÉ ═════
     Une seule source de vérité pour « qui suis-je ». Rien d'autre dans
     l'application n'a le droit de décider d'un espace de noms.            */
  const Identity = {
    _uid: null,                       // null = invité

    get uid() { return this._uid; },
    get isGuest() { return this._uid === null; },
    get prefix() { return this._uid ? userPrefix(this._uid) : GUEST_PREFIX; },

    /** Change d'identité. Retourne true si l'identité a effectivement changé. */
    set(uid) {
      const next = uid || null;
      if (next === this._uid) return false;
      this._uid = next;
      return true;
    }
  };

  /* ═══════════════════════════════════════════════════ ADAPTATEUR STOCKAGE ══
     Préfixe les clés applicatives par l'identité courante. C'est le point
     unique qui empêche l'utilisateur B d'hériter des données de A sur un
     appareil partagé.                                                     */
  const Store = {
    isAppKey: k => APP_KEYS.indexOf(k) !== -1,

    /** Clé physique réellement utilisée dans localStorage. */
    physical(k) { return Store.isAppKey(k) ? Identity.prefix + k : k; },

    getItem(k) { return raw.getItem(Store.physical(k)); },
    setItem(k, v) { return raw.setItem(Store.physical(k), v); },
    removeItem(k) { return raw.removeItem(Store.physical(k)); },

    /** Supprime toutes les clés applicatives d'un espace de noms donné. */
    purge(prefix) {
      for (const k of APP_KEYS) raw.removeItem(prefix + k);
    },

    /** Lit l'intégralité d'un espace de noms (pour la migration). */
    snapshot(prefix) {
      const out = {};
      for (const k of APP_KEYS) {
        const v = raw.getItem(prefix + k);
        if (v !== null) out[k] = v;
      }
      return out;
    },

    /** Données héritées : clés non préfixées d'avant l'authentification. */
    legacySnapshot() {
      const out = {};
      for (const k of APP_KEYS) {
        const v = raw.getItem(k);
        if (v !== null) out[k] = v;
      }
      return out;
    },

    hasData(prefix) {
      return APP_KEYS.some(k => raw.getItem(prefix + k) !== null);
    }
  };

  /* Substitution de window.localStorage. Le moteur n'y voit que du feu ; les
     clés hors liste blanche (sessions Supabase comprises) passent au travers. */
  const shim = {
    getItem: k => Store.getItem(String(k)),
    setItem: (k, v) => Store.setItem(String(k), String(v)),
    removeItem: k => Store.removeItem(String(k)),
    clear: () => Store.purge(Identity.prefix),   // ne vide QUE l'espace courant
    key: i => raw.key(i),
    get length() { return raw.length; }
  };
  Object.defineProperty(window, "localStorage", {
    value: shim, configurable: true, writable: false
  });

  /* ══════════════════════════════════════════════════ RECHARGE DU MOTEUR ════
     Le moteur met ses données en cache mémoire après load(). Un changement
     d'identité doit donc le forcer à relire. C'est le SEUL point de contact
     avec le moteur, et il est déclaratif : une liste de modules, pas du code
     dispersé dans chacun d'eux.                                            */
  const ENGINE_MODULES = ["Progress", "Career", "Player", "HRStats", "PRStats",
                          "BLStats", "Rating", "Journey"];

  function reloadEngine() {
    for (const name of ENGINE_MODULES) {
      const mod = window[name];
      if (mod && typeof mod.load === "function") {
        try { mod.load(); } catch (e) { console.warn("rechargement " + name, e); }
      }
    }
    try { if (window.Store && typeof window.Store.load === "function") window.Store.load(); }
    catch (e) { /* le tracker vit dans une IIFE : absence tolérée */ }
    try { if (window.App && typeof App.render === "function") App.render(); }
    catch (e) { /* rendu impossible hors DOM : sans conséquence */ }
  }

  /* ════════════════════════════════════════════════════════════ SUPABASE ════ */
  const Cfg = window.HEROLAB_SUPABASE || {};
  let sb = null;

  function client() {
    if (sb) return sb;
    if (!Cfg.url || !Cfg.anonKey) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(Cfg.url, Cfg.anonKey, {
      auth: {
        // PKCE : aucun secret client n'est stockable dans une page statique ;
        // l'interception du code d'autorisation devient inexploitable.
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        // Le SDK écrit sa session dans le VRAI localStorage, hors de tout
        // espace de noms applicatif : elle survit aux changements d'identité
        // et n'est jamais purgée par erreur avec les données de jeu.
        storage: raw,
        // Le jeton arrive dans le fragment d'URL au retour d'OAuth ; on le
        // laisse traiter puis on nettoie l'URL nous-mêmes (voir cleanUrl).
        detectSessionInUrl: true
      }
    });
    return sb;
  }

  /* ═══════════════════════════════════════════════════════════════ AUTH ════ */
  const Auth = {
    user: null,

    get available() { return client() !== null; },

    /** Efface le code d'autorisation de l'URL après échange. */
    cleanUrl() {
      if (!window.history || !window.history.replaceState) return;
      const u = new URL(window.location.href);
      let touched = false;
      for (const p of ["code", "state", "error", "error_description",
                       "access_token", "refresh_token", "expires_in", "token_type"]) {
        if (u.searchParams.has(p)) { u.searchParams.delete(p); touched = true; }
      }
      if (u.hash && /access_token|error=/.test(u.hash)) { u.hash = ""; touched = true; }
      // Sans ce nettoyage le jeton reste dans l'historique et peut fuiter par
      // en-tête Referer ou par une capture d'écran de la barre d'adresse.
      if (touched) window.history.replaceState({}, document.title, u.toString());
    },

    async signInWithGoogle() {
      const c = client();
      if (!c) throw new Error("Authentification indisponible : configuration Supabase absente.");
      const { error } = await c.auth.signInWithOAuth({
        provider: "google",
        options: {
          // L'URL de retour doit figurer dans la liste blanche du tableau de
          // bord Supabase. Sans cette liste, un redirect_to arbitraire
          // exfiltrerait le jeton : c'est la faille classique de ce flux.
          redirectTo: window.location.origin + window.location.pathname,
          queryParams: { prompt: "select_account" }
        }
      });
      if (error) throw error;
    },

    async signOut() {
      const c = client();
      const previous = Identity.prefix;
      if (c) { try { await c.auth.signOut(); } catch (e) { console.warn("signOut", e); } }
      // Purge AVANT de rebasculer en invité : les données du compte quitté ne
      // doivent pas rester lisibles par la personne suivante sur l'appareil.
      Store.purge(previous);
      Auth.user = null;
      Identity.set(null);
      reloadEngine();
      window.dispatchEvent(new CustomEvent("herolab:identity", { detail: { uid: null } }));
    },

    /** Applique une session (ou son absence) à l'identité locale. */
    _apply(session) {
      const uid = session && session.user ? session.user.id : null;
      const changed = Identity.set(uid);
      Auth.user = session ? session.user : null;
      if (changed) {
        reloadEngine();
        window.dispatchEvent(new CustomEvent("herolab:identity", { detail: { uid } }));
      }
      return changed;
    },

    async init() {
      const c = client();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      Auth._apply(data ? data.session : null);
      Auth.cleanUrl();
      c.auth.onAuthStateChange((event, session) => {
        Auth._apply(session);
        if (event === "SIGNED_IN") Auth.cleanUrl();
      });
      return Auth.user;
    }
  };

  /* ══════════════════════════════════════════════════════════════ SYNC ═════ */
  const Sync = {
    /** Pousse l'espace local courant vers la base. Jamais en mode invité. */
    async push() {
      const c = client();
      if (!c || Identity.isGuest) return { ok: false, reason: "guest" };
      const snap = Store.snapshot(Identity.prefix);
      const rows = [];
      for (const [k, v] of Object.entries(snap)) {
        let payload;
        try { payload = JSON.parse(v); } catch { continue; }
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) continue;
        // user_id volontairement absent : la base l'impose via
        // DEFAULT auth.uid(), et WITH CHECK refuserait toute autre valeur.
        rows.push({ doc_key: DOC_OF_KEY[k], payload });
      }
      if (!rows.length) return { ok: true, pushed: 0 };
      const { error } = await c.from("user_documents")
        .upsert(rows, { onConflict: "user_id,doc_key" });
      if (error) return { ok: false, reason: error.message };
      return { ok: true, pushed: rows.length };
    },

    /** Rapatrie les documents distants dans l'espace local courant. */
    async pull() {
      const c = client();
      if (!c || Identity.isGuest) return { ok: false, reason: "guest" };
      const { data, error } = await c.from("user_documents").select("doc_key,payload");
      if (error) return { ok: false, reason: error.message };
      const byDoc = {};
      for (const row of data || []) byDoc[row.doc_key] = row.payload;
      let n = 0;
      for (const [k, doc] of Object.entries(DOC_OF_KEY)) {
        if (!(doc in byDoc)) continue;
        raw.setItem(Identity.prefix + k, JSON.stringify(byDoc[doc]));
        n++;
      }
      if (n) reloadEngine();
      return { ok: true, pulled: n };
    },

    async remoteSummary() {
      const c = client();
      if (!c || Identity.isGuest) return null;
      const { data, error } = await c.from("user_documents")
        .select("doc_key,updated_at,payload");
      if (error) return null;
      return (data || []).map(r => ({
        doc: r.doc_key,
        updatedAt: r.updated_at,
        xp: r.payload && typeof r.payload.xp === "number" ? r.payload.xp : null
      }));
    }
  };

  /* ═════════════════════════════════════════════════════════ MIGRATION ═════
     Déclenchée uniquement sur action explicite. Aucune fusion automatique,
     aucune suppression avant confirmation d'écriture (ARCHITECTURE.md §7). */
  const Migration = {
    /** Que peut-on proposer à l'utilisateur ? Ne modifie rien. */
    async assess() {
      if (Identity.isGuest) return { state: "guest" };
      const legacy = Store.legacySnapshot();
      const guest = Store.snapshot(GUEST_PREFIX);
      const local = Object.keys(legacy).length ? legacy : guest;
      const localSource = Object.keys(legacy).length ? "legacy" : "guest";
      const hasLocal = Object.keys(local).length > 0;

      const remote = await Sync.remoteSummary();
      const hasRemote = Array.isArray(remote) && remote.length > 0;

      if (!hasLocal && !hasRemote) return { state: "empty" };
      if (!hasLocal) return { state: "remote-only" };
      if (!hasRemote) return { state: "local-only", localSource, keys: Object.keys(local) };
      // Deux historiques : on ne tranche pas à la place de l'utilisateur.
      return { state: "conflict", localSource, keys: Object.keys(local), remote };
    },

    /**
     * Importe les données locales dans le compte.
     * @param {"local"|"remote"} choix  résolution retenue par l'utilisateur
     */
    async resolve(choix) {
      if (Identity.isGuest) return { ok: false, reason: "guest" };

      if (choix === "remote") {
        const r = await Sync.pull();
        // On ne supprime PAS les données invité : l'utilisateur peut vouloir
        // les retrouver en se déconnectant. Elles restent dans hl:guest:.
        return r;
      }

      if (choix !== "local") return { ok: false, reason: "choix inconnu" };

      const legacy = Store.legacySnapshot();
      const source = Object.keys(legacy).length ? legacy : Store.snapshot(GUEST_PREFIX);
      if (!Object.keys(source).length) return { ok: true, pushed: 0 };

      // 1. copie dans l'espace de l'utilisateur (idempotent : même clé, même valeur)
      for (const [k, v] of Object.entries(source)) {
        raw.setItem(Identity.prefix + k, v);
      }
      // 2. écriture distante — et seulement si elle réussit…
      const pushed = await Sync.push();
      if (!pushed.ok) return pushed;
      // 3. …on retire les clés héritées non préfixées. L'espace invité, lui,
      //    est conservé : rien n'est détruit sans que ce soit demandé.
      if (Object.keys(legacy).length) {
        for (const k of Object.keys(legacy)) raw.removeItem(k);
      }
      reloadEngine();
      return pushed;
    }
  };

  /* ═══════════════════════════════════════════════════════════ EXPOSITION ══ */
  window.HeroLabAuth = {
    Identity, Store, Auth, Sync, Migration,
    APP_KEYS, DOC_OF_KEY, GUEST_PREFIX, userPrefix,
    _reloadEngine: reloadEngine,
    _rawStorage: raw
  };
})();
