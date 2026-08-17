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

    setItem(k, v) {
      const r = raw.setItem(Store.physical(k), v);
      // Toute écriture applicative d'un utilisateur connecté marque l'espace
      // comme « à synchroniser ». Sans cela, la synchronisation ne se produit
      // que si l'utilisateur pense à cliquer un bouton — et une déconnexion
      // fait alors disparaître la progression accumulée depuis.
      if (Store.isAppKey(k) && !Identity.isGuest) Queue.markDirty();
      return r;
    },

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
    },

    /** Clés applicatives réellement présentes dans un espace de noms. */
    presentKeys(prefix) {
      return APP_KEYS.filter(k => raw.getItem(prefix + k) !== null);
    }
  };

  /* ═══════════════════════════════════════════════ FILE D'ÉCRITURES ════════
     La synchronisation est différée puis groupée : le moteur écrit très
     souvent (à chaque décision), une requête par écriture serait absurde.
     Mais elle doit être AUTOMATIQUE — voir Store.setItem.                  */
  const Queue = {
    dirty: false,
    timer: null,
    inFlight: false,
    DELAY: 2500,

    markDirty() {
      Queue.dirty = true;
      if (Queue.timer) clearTimeout(Queue.timer);
      Queue.timer = setTimeout(() => Queue.flush(), Queue.DELAY);
    },

    /** Pousse si nécessaire. Retourne le résultat, ou null si rien à faire. */
    async flush() {
      if (Queue.timer) { clearTimeout(Queue.timer); Queue.timer = null; }
      if (!Queue.dirty || Identity.isGuest || Queue.inFlight) return null;
      Queue.inFlight = true;
      try {
        const r = await Sync.push();
        // On ne retire le drapeau qu'en cas de succès : un échec réseau doit
        // laisser les données en attente, pas les considérer sauvegardées.
        if (r && r.ok) Queue.dirty = false;
        return r;
      } finally {
        Queue.inFlight = false;
      }
    }
  };

  /* Dernière chance d'écrire avant que l'onglet ne disparaisse. */
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") Queue.flush();
  });
  window.addEventListener("pagehide", () => { Queue.flush(); });

  /* Substitution de window.localStorage. Le moteur n'y voit que du feu ; les
     clés hors liste blanche (sessions Supabase comprises) passent au travers. */
  const shim = {
    getItem: k => Store.getItem(String(k)),
    setItem: (k, v) => Store.setItem(String(k), String(v)),
    removeItem: k => Store.removeItem(String(k)),
    clear: () => Store.purge(Identity.prefix),   // ne vide QUE l'espace courant
    // key()/length sont restreints à l'espace de noms courant : sans cela, une
    // énumération exposerait les clés des autres comptes de l'appareil et les
    // clés de session Supabase.
    key(i) {
      const mine = Store.presentKeys(Identity.prefix);
      return i >= 0 && i < mine.length ? mine[i] : null;
    },
    get length() { return Store.presentKeys(Identity.prefix).length; }
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

    /**
     * Déconnexion.
     *
     * L'ordre des opérations est le point délicat : purger avant d'avoir
     * sauvegardé détruirait toute la progression accumulée depuis la dernière
     * synchronisation. On sauvegarde donc d'abord, et on ne purge QUE si la
     * sauvegarde est confirmée.
     *
     * @param {{force?:boolean}} opt  force:true purge malgré un échec de
     *        sauvegarde (choix explicite de l'utilisateur, jamais par défaut).
     * @returns {{ok:boolean, reason?:string, kept?:boolean}}
     */
    async signOut(opt) {
      const c = client();
      const previous = Identity.prefix;
      const force = !!(opt && opt.force);

      // 1. sauvegarder ce qui ne l'est pas encore
      let saved = { ok: true };
      if (!Identity.isGuest) {
        const pending = await Queue.flush();
        if (pending && !pending.ok) saved = pending;
      }

      // 2. si la sauvegarde a échoué et qu'on ne force pas : on ne détruit rien
      if (!saved.ok && !force) {
        return { ok: false, reason: saved.reason, kept: true };
      }

      // 3. clore la session
      if (c) { try { await c.auth.signOut(); } catch (e) { console.warn("signOut", e); } }

      // 4. purger l'espace du compte quitté : ses données ne doivent pas rester
      //    lisibles par la personne suivante sur l'appareil.
      Store.purge(previous);
      Queue.dirty = false;
      Auth.user = null;
      Identity.set(null);
      reloadEngine();
      window.dispatchEvent(new CustomEvent("herolab:identity", { detail: { uid: null } }));
      return { ok: true };
    },

    /** Applique une session (ou son absence) à l'identité locale. */
    _apply(session) {
      const uid = session && session.user ? session.user.id : null;
      const before = Identity.uid;
      const changed = Identity.set(uid);
      Auth.user = session ? session.user : null;
      // Bascule directe d'un compte à un autre (expiration de session, second
      // compte sur le même appareil) sans passer par signOut : les données du
      // compte précédent resteraient sinon sur le disque indéfiniment.
      // Elles ne sont pas SERVIES au nouvel utilisateur (l'espace de noms
      // diffère), mais rester lisibles suffit à en faire une fuite.
      if (changed && before && before !== uid) {
        Store.purge(userPrefix(before));
        Queue.dirty = false;
      }
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

  const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const MAX_DOC_BYTES = 1048576;   // doit rester aligné sur la contrainte SQL

  const Sync = {
    /** Révisions connues à la dernière lecture, par doc_key. */
    _seenRevision: Object.create(null),

    /**
     * Pousse l'espace local courant vers la base. Jamais en mode invité.
     *
     * La révision distante est relue avant écriture : si elle a avancé depuis
     * notre dernière lecture, un autre appareil a écrit entre-temps et un
     * upsert aveugle effacerait son travail sans le dire. On refuse alors et
     * on laisse l'appelant arbitrer.
     */
    async push(opt) {
      const c = client();
      if (!c || Identity.isGuest) return { ok: false, reason: "guest" };
      const force = !!(opt && opt.force);

      const snap = Store.snapshot(Identity.prefix);
      const rows = [];
      for (const [k, v] of Object.entries(snap)) {
        let payload;
        try { payload = JSON.parse(v); } catch { continue; }
        if (!isPlainObject(payload)) continue;
        if (v.length > MAX_DOC_BYTES) {
          return { ok: false, reason: `document « ${DOC_OF_KEY[k]} » trop volumineux` };
        }
        // user_id volontairement absent : la base l'impose via
        // DEFAULT auth.uid(), et WITH CHECK refuserait toute autre valeur.
        rows.push({ doc_key: DOC_OF_KEY[k], payload });
      }
      if (!rows.length) return { ok: true, pushed: 0 };

      if (!force) {
        const { data, error } = await c.from("user_documents").select("doc_key,revision");
        if (error) return { ok: false, reason: error.message };
        const stale = [];
        for (const row of data || []) {
          const seen = Sync._seenRevision[row.doc_key];
          if (seen !== undefined && row.revision > seen) stale.push(row.doc_key);
        }
        if (stale.length) {
          return { ok: false, reason: "conflit", conflict: stale };
        }
      }

      const { error } = await c.from("user_documents")
        .upsert(rows, { onConflict: "user_id,doc_key" })
        .select("doc_key,revision");
      if (error) return { ok: false, reason: error.message };
      // On repart des révisions écrites, sinon la poussée suivante se croirait
      // en conflit avec sa propre écriture.
      const after = await c.from("user_documents").select("doc_key,revision");
      for (const row of (after.data || [])) Sync._seenRevision[row.doc_key] = row.revision;
      return { ok: true, pushed: rows.length };
    },

    /**
     * Rapatrie les documents distants dans l'espace local courant.
     *
     * Le contenu distant est validé avant écriture, au même titre que le
     * contenu poussé : une réponse n'est pas digne de confiance du seul fait
     * qu'elle vient du serveur, et un document mal formé ferait planter le
     * moteur au chargement suivant (il attend des objets).
     */
    async pull() {
      const c = client();
      if (!c || Identity.isGuest) return { ok: false, reason: "guest" };
      const { data, error } = await c.from("user_documents")
        .select("doc_key,payload,revision");
      if (error) return { ok: false, reason: error.message };

      const byDoc = Object.create(null);
      for (const row of data || []) {
        if (!isPlainObject(row.payload)) continue;         // rejet silencieux
        byDoc[row.doc_key] = row.payload;
        Sync._seenRevision[row.doc_key] = row.revision;
      }
      let n = 0, skipped = 0;
      for (const [k, doc] of Object.entries(DOC_OF_KEY)) {
        if (!(doc in byDoc)) continue;
        const s = JSON.stringify(byDoc[doc]);
        if (s.length > MAX_DOC_BYTES) { skipped++; continue; }
        raw.setItem(Identity.prefix + k, s);
        n++;
      }
      if (n) { Queue.dirty = false; reloadEngine(); }
      return { ok: true, pulled: n, skipped };
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
    Identity, Store, Auth, Sync, Migration, Queue,
    APP_KEYS, DOC_OF_KEY, GUEST_PREFIX, userPrefix,
    _reloadEngine: reloadEngine,
    _rawStorage: raw
  };
})();
