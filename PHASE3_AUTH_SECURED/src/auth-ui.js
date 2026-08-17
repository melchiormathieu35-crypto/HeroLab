/* ============================================================================
   HeroLab — interface d'authentification.

   Volontairement autonome : un badge de compte et une modale, greffés sur le
   document, sans toucher au système de vues du moteur. La couche écoute
   l'événement `herolab:identity` plutôt que d'appeler le moteur.

   Règle absolue de ce fichier : le nom et l'avatar viennent de Google, donc
   d'une source que l'utilisateur contrôle. Ils ne sont JAMAIS insérés en HTML
   sans échappement — un compte nommé « <img onerror=…> » ne doit rien pouvoir
   déclencher. Le nom est posé via textContent partout où c'est possible.
   ========================================================================== */
(function () {
  "use strict";

  const HL = window.HeroLabAuth;
  if (!HL) return;

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ────────────────────────────────── styles ─────────────────────────────── */
  const css = `
  .hl-acct{position:fixed;top:10px;right:12px;z-index:60;display:flex;align-items:center;
    gap:8px;background:var(--panel-2,#16202e);border:1px solid var(--line,#243244);
    border-radius:999px;padding:6px 8px 6px 12px;font-size:12.5px;color:var(--bone,#e8e2d6)}
  /* 44px : même seuil de confort tactile que le reste de l'application. */
  .hl-acct button{min-height:44px;border-radius:999px;padding:6px 14px;font-size:12.5px;
    border:1px solid var(--line-lit,#324563);background:var(--panel,#111a26);
    color:var(--bone,#e8e2d6);cursor:pointer}
  .hl-acct button.pri{background:var(--brass,#c9a227);border-color:var(--brass,#c9a227);
    color:var(--ink,#0b1017);font-weight:650}
  .hl-acct .hl-who{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .hl-dot{width:7px;height:7px;border-radius:50%;background:#4ea36b;flex:0 0 auto}
  .hl-dot.off{background:var(--faint,#5b6b7f)}
  .hl-modal{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.62);
    display:flex;align-items:center;justify-content:center;padding:18px}
  .hl-sheet{background:var(--panel,#111a26);border:1px solid var(--line,#243244);
    border-radius:14px;max-width:520px;width:100%;padding:22px;color:var(--bone,#e8e2d6)}
  .hl-sheet h3{margin:0 0 6px;font-size:17px}
  .hl-sheet p{font-size:13.5px;line-height:1.55;color:var(--dim,#9fb0c4);margin:0 0 14px}
  .hl-choice{border:1px solid var(--line,#243244);border-radius:10px;padding:13px;
    margin-bottom:10px;cursor:pointer;background:var(--panel-2,#16202e)}
  .hl-choice:hover{border-color:var(--brass,#c9a227)}
  .hl-choice b{display:block;margin-bottom:3px;font-size:14px}
  .hl-choice span{font-size:12.5px;color:var(--dim,#9fb0c4)}
  .hl-row{display:flex;gap:9px;justify-content:flex-end;margin-top:16px}
  .hl-row button{min-height:44px;padding:10px 16px;border-radius:8px;cursor:pointer;
    border:1px solid var(--line-lit,#324563);background:var(--panel-2,#16202e);
    color:var(--bone,#e8e2d6);font-size:13px}
  .hl-row button.pri{background:var(--brass,#c9a227);border-color:var(--brass,#c9a227);
    color:var(--ink,#0b1017);font-weight:650}
  .hl-err{color:#d98b8b;font-size:12.5px;margin-top:8px}
  @media(max-width:760px){.hl-acct{top:auto;bottom:10px;right:10px;padding:5px 7px 5px 10px}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ────────────────────────────────── modale ─────────────────────────────── */
  let openSheet = null;
  function closeSheet() {
    if (openSheet) { openSheet.remove(); openSheet = null; }
    document.removeEventListener("keydown", onEsc);
  }
  function onEsc(e) { if (e.key === "Escape") closeSheet(); }

  function sheet(build) {
    closeSheet();
    const wrap = document.createElement("div");
    wrap.className = "hl-modal";
    const box = document.createElement("div");
    box.className = "hl-sheet";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    build(box);
    wrap.appendChild(box);
    wrap.addEventListener("click", e => { if (e.target === wrap) closeSheet(); });
    document.body.appendChild(wrap);
    document.addEventListener("keydown", onEsc);
    openSheet = wrap;
    const first = box.querySelector("button");
    if (first) first.focus();
    return box;
  }

  /* ──────────────────────────────── badge compte ─────────────────────────── */
  const badge = document.createElement("div");
  badge.className = "hl-acct";
  document.body.appendChild(badge);

  function renderBadge() {
    badge.textContent = "";
    const dot = document.createElement("span");
    dot.className = "hl-dot" + (HL.Identity.isGuest ? " off" : "");
    badge.appendChild(dot);

    const who = document.createElement("span");
    who.className = "hl-who";
    if (HL.Identity.isGuest) {
      who.textContent = "Invité — hors ligne";
    } else {
      const u = HL.Auth.user || {};
      const meta = u.user_metadata || {};
      // textContent : le nom vient de Google, il n'est pas digne de confiance.
      who.textContent = meta.full_name || meta.name || u.email || "Connecté";
      who.title = who.textContent;
    }
    badge.appendChild(who);

    const btn = document.createElement("button");
    if (HL.Identity.isGuest) {
      btn.className = "pri";
      btn.textContent = "Se connecter";
      btn.onclick = signIn;
      if (!HL.Auth.available) { btn.disabled = true; btn.title = "Supabase non configuré"; }
    } else {
      btn.textContent = "Compte";
      btn.onclick = accountSheet;
    }
    badge.appendChild(btn);
  }

  /* ─────────────────────────────────── actions ───────────────────────────── */
  function signIn() {
    sheet(box => {
      const h = document.createElement("h3");
      h.textContent = "Se connecter avec Google";
      const p = document.createElement("p");
      p.textContent = "Ta progression sera sauvegardée sur ton compte et te suivra "
        + "d'un appareil à l'autre. Sans connexion, HeroLab continue de "
        + "fonctionner hors ligne : la progression reste sur cet appareil.";
      const row = document.createElement("div");
      row.className = "hl-row";
      const cancel = document.createElement("button");
      cancel.textContent = "Plus tard";
      cancel.onclick = closeSheet;
      const go = document.createElement("button");
      go.className = "pri";
      go.textContent = "Continuer avec Google";
      go.onclick = async () => {
        go.disabled = true; go.textContent = "Redirection…";
        try { await HL.Auth.signInWithGoogle(); }
        catch (e) {
          go.disabled = false; go.textContent = "Continuer avec Google";
          const err = document.createElement("div");
          err.className = "hl-err";
          err.textContent = e && e.message ? e.message : "Connexion impossible.";
          box.appendChild(err);
        }
      };
      row.append(cancel, go);
      box.append(h, p, row);
    });
  }

  function accountSheet() {
    sheet(box => {
      const u = HL.Auth.user || {};
      const meta = u.user_metadata || {};
      const h = document.createElement("h3");
      h.textContent = "Mon compte";
      const p = document.createElement("p");
      p.textContent = (meta.full_name || meta.name || u.email || "Compte connecté")
        + " — la progression est synchronisée sur ce compte.";

      const row = document.createElement("div");
      row.className = "hl-row";

      const sync = document.createElement("button");
      sync.textContent = "Synchroniser maintenant";
      sync.onclick = async () => {
        sync.disabled = true; sync.textContent = "Synchronisation…";
        const r = await HL.Sync.push();
        sync.textContent = r.ok ? "Synchronisé ✓" : "Échec";
        if (!r.ok) {
          const err = document.createElement("div");
          err.className = "hl-err";
          err.textContent = "Synchronisation impossible : " + (r.reason || "erreur inconnue");
          box.appendChild(err);
        }
        setTimeout(() => { sync.disabled = false; sync.textContent = "Synchroniser maintenant"; }, 1800);
      };

      const out = document.createElement("button");
      out.textContent = "Se déconnecter";
      out.onclick = async () => {
        out.disabled = true; out.textContent = "Sauvegarde…";
        const r = await HL.Auth.signOut();
        if (r.ok) { closeSheet(); return; }
        // La déconnexion a été refusée pour ne pas perdre de progression : on
        // le dit, et on n'offre la sortie forcée qu'en connaissance de cause.
        out.disabled = false; out.textContent = "Se déconnecter";
        const err = document.createElement("div");
        err.className = "hl-err";
        err.textContent = "Impossible de sauvegarder ta progression ("
          + (r.reason || "erreur réseau") + "). Déconnexion annulée pour ne rien perdre.";
        const force = document.createElement("button");
        force.textContent = "Se déconnecter quand même (perte des données non sauvegardées)";
        force.style.marginTop = "10px";
        force.onclick = async () => { await HL.Auth.signOut({ force: true }); closeSheet(); };
        box.append(err, force);
      };

      const close = document.createElement("button");
      close.className = "pri";
      close.textContent = "Fermer";
      close.onclick = closeSheet;

      row.append(out, sync, close);
      box.append(h, p, row);
    });
  }

  /* ─────────────────── import initial (consentement requis) ─────────────── */
  function importSheet(info) {
    sheet(box => {
      const h = document.createElement("h3");
      h.textContent = "Reprendre ta progression sur ce compte ?";
      const p = document.createElement("p");
      p.textContent = "Cet appareil contient une progression jouée sans compte "
        + `(${info.keys.length} jeu(x) de données). Tu peux l'associer à ton compte `
        + "pour la retrouver ailleurs, ou la laisser sur cet appareil uniquement.";

      const row = document.createElement("div");
      row.className = "hl-row";

      const skip = document.createElement("button");
      skip.textContent = "Laisser sur l'appareil";
      skip.onclick = closeSheet;

      const go = document.createElement("button");
      go.className = "pri";
      go.textContent = "Associer à mon compte";
      go.onclick = async () => {
        go.disabled = true; go.textContent = "Import…";
        const r = await HL.Migration.resolve("local");
        if (r.ok) { closeSheet(); return; }
        go.disabled = false; go.textContent = "Associer à mon compte";
        const err = document.createElement("div");
        err.className = "hl-err";
        err.textContent = "Import impossible : " + (r.reason || "erreur inconnue")
          + ". Tes données locales sont intactes.";
        box.appendChild(err);
      };

      row.append(skip, go);
      box.append(h, p, row);
    });
  }

  /* ───────────────────────── résolution de conflit ───────────────────────── */
  function conflictSheet(info) {
    sheet(box => {
      const h = document.createElement("h3");
      h.textContent = "Deux progressions différentes";
      const p = document.createElement("p");
      p.textContent = "Cet appareil contient une progression locale, et ton compte "
        + "en contient déjà une. Elles ne peuvent pas être fusionnées sans risque "
        + "de fausser tes statistiques : choisis celle à conserver.";

      const mkChoice = (titre, detail, val) => {
        const d = document.createElement("div");
        d.className = "hl-choice";
        d.setAttribute("role", "button");
        d.tabIndex = 0;
        const b = document.createElement("b");
        b.textContent = titre;
        const s = document.createElement("span");
        s.textContent = detail;
        d.append(b, s);
        const pick = async () => {
          box.textContent = "";
          const wait = document.createElement("p");
          wait.textContent = "Application du choix…";
          box.appendChild(wait);
          const r = await HL.Migration.resolve(val);
          closeSheet();
          if (!r.ok) console.warn("migration", r.reason);
        };
        d.onclick = pick;
        d.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
        return d;
      };

      box.append(h, p,
        mkChoice("Garder la progression de cet appareil",
          `${info.keys.length} jeu(x) de données locales — elles remplaceront celles du compte.`,
          "local"),
        mkChoice("Garder la progression du compte",
          "Les données locales seront conservées sur l'appareil, en mode invité.",
          "remote"));

      const row = document.createElement("div");
      row.className = "hl-row";
      const later = document.createElement("button");
      later.textContent = "Décider plus tard";
      later.onclick = closeSheet;
      row.appendChild(later);
      box.appendChild(row);
    });
  }

  /* ──────────────────────────────── démarrage ────────────────────────────── */
  async function boot() {
    renderBadge();
    if (!HL.Auth.available) return;
    try { await HL.Auth.init(); } catch (e) { console.warn("init auth", e); }
    renderBadge();
    if (HL.Identity.isGuest) return;

    const a = await HL.Migration.assess();
    if (a.state === "conflict") conflictSheet(a);
    // Téléverser la progression d'un appareil dans un compte est une décision
    // qui appartient à l'utilisateur : associer durablement des données à une
    // identité ne doit jamais se produire en arrière-plan.
    else if (a.state === "local-only") importSheet(a);
    // Rapatrier ne fait qu'hydrater l'appareil avec les données du compte
    // auquel l'utilisateur vient de se connecter : aucun choix à lui demander.
    else if (a.state === "remote-only") await HL.Sync.pull();
  }

  window.addEventListener("herolab:identity", renderBadge);

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
