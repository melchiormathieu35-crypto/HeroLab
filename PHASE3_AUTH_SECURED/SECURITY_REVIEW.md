# Revue de sécurité — Phase 3 (authentification Google / Supabase)

Périmètre demandé : OAuth, sessions, jetons, Supabase, RLS, accès cross-user,
migration localStorage, manipulation des données côté client.

Cible auditée : `PHASE3_AUTH/` · version corrigée : `PHASE3_AUTH_SECURED/`.

---

## Synthèse

**Aucune faille d'accès cross-user côté serveur.** Les 10 tests d'isolation RLS
ont été exécutés sur un PostgreSQL 16 réel, et deux mutations volontaires
confirment qu'ils détectent bien les régressions qu'ils prétendent couvrir.

Les défauts trouvés sont **côté client**, et les deux plus graves ne sont pas des
fuites mais des **pertes de données** — ce qui, dans l'ordre de priorité retenu
pour ce projet (sécurité, puis intégrité des données), passe juste après une
faille d'accès.

| # | Gravité | Sujet | État |
|---|---|---|---|
| S-1 | **Élevée** | Aucune synchronisation automatique | corrigé |
| S-2 | **Élevée** | La déconnexion détruisait la progression non sauvegardée | corrigé |
| S-3 | Moyenne | Rémanence des données au changement de compte direct | corrigé |
| S-4 | Moyenne | Écrasement silencieux entre appareils (`revision` inutilisée) | corrigé |
| S-5 | Faible | `pull()` écrivait le contenu distant sans le valider | corrigé |
| S-6 | Moyenne | Téléversement des données invité sans consentement | corrigé |
| S-7 | Faible | `key()`/`length` divulguaient les autres espaces de noms | corrigé |
| S-8 | Info | `redirectTo` dynamique | non corrigé — action côté tableau de bord |

---

## Détail

### S-1 · Aucune synchronisation automatique — **élevée**

`Sync.push()` n'était appelé que par le bouton « Synchroniser maintenant » et par
la migration. Rien dans le chemin d'écriture ne déclenchait de sauvegarde.

L'architecture annonçait pourtant une file d'écritures (§2). L'implémentation ne
la contenait pas : **écart entre le contrat et le code**, et un utilisateur
pouvait jouer des centaines de mains sans qu'une seule ne quitte l'appareil.

*Correction.* `Store.setItem` marque l'espace comme à synchroniser dès qu'un
utilisateur connecté écrit ; une file groupe les envois (2,5 s de latence, le
moteur écrivant à chaque décision) et vide la file sur `visibilitychange` et
`pagehide`. Le drapeau n'est levé qu'après confirmation : un échec réseau laisse
les données en attente au lieu de les croire sauvegardées.

### S-2 · La déconnexion détruisait la progression non sauvegardée — **élevée**

`signOut()` purgeait l'espace local **avant toute sauvegarde**. Combiné à S-1
(rien n'était jamais synchronisé automatiquement), se déconnecter effaçait
définitivement toute la progression accumulée.

Le correctif de Phase 2 pour la purge à la déconnexion était juste dans son
intention — empêcher la personne suivante de lire les données — mais l'ordre des
opérations transformait une mesure de confidentialité en destruction de données.

*Correction.* L'ordre devient : sauvegarder → n'agir que si la sauvegarde est
confirmée → clore la session → purger. Si la sauvegarde échoue, la déconnexion
est **refusée** et l'interface l'explique ; une sortie forcée reste possible,
mais uniquement sur choix explicite et avec la perte annoncée.

### S-3 · Rémanence au changement de compte direct — **moyenne**

`signOut()` purgeait, mais pas `_apply()`. Or on peut passer d'un compte à un
autre sans déconnexion explicite (expiration de session, second compte). Les
données du compte précédent restaient alors sur l'appareil indéfiniment.

Elles n'étaient pas *servies* au nouvel utilisateur — le préfixage tient — mais
rester lisibles par quiconque ouvre la console suffit à en faire une fuite sur un
appareil partagé.

*Correction.* `_apply()` purge l'espace du compte précédent dès que l'identité
bascule vers un compte différent.

### S-4 · Écrasement silencieux entre appareils — **moyenne**

`push()` faisait un `upsert` aveugle. Deux appareils du même compte : le dernier
qui écrit efface le travail de l'autre, sans avertissement. La colonne
`revision`, ajoutée au schéma exactement pour ce cas, n'était pas utilisée.

*Correction.* Les révisions vues sont mémorisées à chaque lecture ; avant
écriture, `push()` relit les révisions distantes et refuse (`reason: "conflit"`)
si l'une a avancé. `push({force:true})` reste disponible pour un arbitrage
explicite.

### S-5 · Contenu distant écrit sans validation — **faible**

`push()` vérifiait que la charge utile était bien un objet ; `pull()` écrivait
tel quel ce que renvoyait le serveur. Asymétrie de confiance : une réponse n'est
pas fiable du seul fait qu'elle vient du serveur. La contrainte SQL
`jsonb_typeof(payload) = 'object'` couvrait le cas, mais la défense reposait
alors entièrement sur elle.

*Correction.* `pull()` applique la même validation que `push()`, plus une borne
de taille alignée sur la contrainte SQL.

### S-6 · Téléversement sans consentement — **moyenne**

Au retour de connexion, l'état `local-only` déclenchait
`Migration.resolve("local")` **automatiquement** : les données jouées sans compte
étaient associées au compte Google sans que l'utilisateur ne l'ait demandé.

Aucune donnée n'était détruite, mais l'architecture stipule (§7) que la migration
est « déclenchée uniquement sur action explicite ». Le code contredisait le
contrat, et associer durablement une progression à une identité est précisément
le genre de décision qui ne doit pas se prendre en arrière-plan.

*Correction.* Une modale demande le consentement. Le rapatriement (`remote-only`)
reste automatique : il ne fait qu'hydrater l'appareil avec les données du compte
auquel l'utilisateur vient de se connecter, sans nouvelle association.

### S-7 · Énumération inter-espaces — **faible**

`shim.key(i)` et `shim.length` déléguaient au `localStorage` brut : une
énumération exposait les clés des autres comptes de l'appareil **et les clés de
session Supabase** (`sb-*`). Le moteur n'énumère pas, mais l'adaptateur ne doit
pas offrir ce qu'il prétend cloisonner.

*Correction.* Les deux sont restreints à l'espace de noms courant. Le test le
vérifie et échoue sur la version non corrigée en affichant précisément la clé de
session exposée.

### S-8 · `redirectTo` dynamique — **information, non corrigé**

`redirectTo` vaut `window.location.origin + window.location.pathname`. Ce n'est
pas exploitable en soi — c'est la liste blanche du tableau de bord Supabase qui
fait autorité — mais un chemin dynamique pousse à déclarer une entrée générique
(`https://domaine/*`), ce qui élargit inutilement la cible.

*Recommandation, à appliquer hors code :* déclarer **une URL exacte** dans
Authentication → URL Configuration, et n'y mettre aucun joker. C'est le contrôle
qui empêche un `redirect_to` arbitraire d'exfiltrer le jeton, et il ne peut pas
être imposé depuis l'application.

---

## Points vérifiés et jugés sains

- **RLS** : activée *et* forcée ; une policy par opération ; `USING` et
  `WITH CHECK` partout. Insertion, mise à jour, suppression et réassignation
  cross-user refusées — vérifié par exécution.
- **`user_id` jamais transmis par le client** : `DEFAULT auth.uid()` côté base,
  déclencheur rendant la colonne immuable en `UPDATE`.
- **Aucune clé `service_role`** dans l'artefact ; le build échoue si elle
  apparaît, et un test le vérifie sur le fichier livré.
- **SDK embarqué**, pas de CDN : `script-src` reste sans origine externe,
  empreinte SHA-256 vérifiée au build, absence d'`eval`/`new Function` contrôlée.
- **PKCE**, URL nettoyée du code d'autorisation après échange (historique et
  `Referer`).
- **Nom d'affichage Google traité comme hostile** : posé via `textContent`. Un
  test injecte `<img onerror=…>` comme nom de compte et vérifie qu'aucun script
  ne s'exécute.
- **CSP** : `default-src 'none'`, `connect-src` limité à l'origine Supabase, sans
  joker ; test dédié.
- **Suppression de compte** : cascade vérifiée, aucun document orphelin.

---

## Limites assumées

1. **Session en `localStorage`.** Lisible par tout script de la page : une XSS
   devient une prise de compte. L'alternative (cookie `HttpOnly`) impose un
   backend, hors périmètre. Conséquence directe : l'échappement HTML et la CSP
   cessent d'être du confort et deviennent les contrôles porteurs.

2. **Le moteur tourne côté client.** N'importe qui peut écrire ce qu'il veut dans
   *sa propre* progression. RLS protège les données des autres, pas la véracité
   des siennes. Acceptable pour un outil d'entraînement personnel ; à revoir le
   jour où apparaîtraient un classement public ou un enjeu monétaire, ce qui
   imposerait une validation côté serveur.

3. **Pas de limitation de débit applicative.** Un compte authentifié peut écrire
   en boucle. Les garde-fous actuels sont la contrainte de taille (1 Mo/document)
   et la liste blanche des clés. Au-delà, cela relève des quotas Supabase.

---

## Vérifications exécutées

| Suite | Résultat | Environnement |
|---|---|---|
| Isolation RLS (10 cas) | **10 PASS** | PostgreSQL 16 réel |
| Mutations RLS (2) | **détectées** | idem |
| Isolation client (21 cas) | **21 PASS** | Chromium |
| Même suite sur la version non durcie | **7 FAIL** | Chromium |
| Moteur — non-régression Phase 2 | **79 PASS** | Node |
| Navigateur — non-régression Phase 2 | **37 PASS** | Chromium |

Le moteur donne des résultats **identiques** avec et sans la couche
d'authentification : la frontière tient.

---

## Décision

**GO conditionnel.** Le code est sain sur les axes demandés et l'isolation est
prouvée par exécution, pas seulement par lecture.

Trois actions restent **hors du code** et conditionnent la mise en production :

1. Appliquer `supabase/001_schema.sql` sur le projet, puis y exécuter
   `002_rls_tests.sql` — les policies doivent être vérifiées sur la base réelle,
   pas seulement sur le Postgres de test.
2. Déclarer une **URL de redirection exacte**, sans joker (S-8).
3. Renseigner `src/config.js` avec la clé **`anon` uniquement**.

Tant que ces trois points ne sont pas faits, l'application reste en mode invité
hors ligne — ce qui est le comportement de repli voulu, et non une panne.
