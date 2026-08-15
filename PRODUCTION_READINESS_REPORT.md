# Hero Lab — rapport de production readiness

Branche `claude/graphifyy-cli-install-vv16zy`, PR #1. Toutes les affirmations
ci-dessous sont vérifiées par exécution. Ce qui n'a pas pu être vérifié est
marqué **NON VÉRIFIÉ**, jamais inféré.

---

## A. P0 corrigés

### A1 — Le dépôt ne pouvait pas atteindre la production : **partiellement corrigé**

Ce qui a été fait :

- `netlify.toml` déclare la cible : publication de la racine, aucune commande de
  build (rien à compiler), `/archive/*` et `/tests/*` en 404 forcé, en-têtes de
  sécurité, cache court sur `index.html` et immuable sur `assets/`.
- `DEPLOYMENT.md` documente le pipeline, l'état mesuré du découplage, l'ordre
  d'opération sûr et la stratégie de rollback.

**Ce qui reste et que je ne peux pas faire :** l'API Netlify accessible expose
la lecture de projets, les variables d'environnement et un dépôt manuel — **mais
aucune opération pour lier un dépôt Git**. Déclencher un dépôt manuel depuis
l'agent aurait reproduit exactement le problème diagnostiqué. Cette étape est
décrite pas à pas dans `DEPLOYMENT.md` et **t'appartient**.

### A2 — Une mauvaise version pouvait être déployée : **corrigé**

- `netlify.toml` répond **404 forcé** sur `/archive/*` : l'ancienne génération,
  qui démarre encore quand on l'ouvre, ne peut pas être servie.
- `robots.txt` interdit `/archive/` et `/tests/` en seconde barrière.
- `tests/production-check.mjs` échoue si `index.html` est absent, si son titre
  annonce Pivot, ou si un fichier Pivot revient à la racine.
- L'archive **n'est pas supprimée** : elle reste en référence historique.

### A3 — `main` est un piège : **documenté, non résolu par construction**

`origin/main` contient toujours **un seul fichier**, `pivot-simulateur-cashgame-17.html`,
sans `index.html`. C'est structurel : cela ne peut se résoudre que par le merge
de cette PR. `DEPLOYMENT.md` insiste sur l'ordre : **merger d'abord, lier
Netlify ensuite** — l'inverse publierait une racine en 404 exposant l'ancien
produit.

---

## B. P1 corrigés

| # | problème | correction | preuve |
|---|---|---|---|
| B1 | Crash au boot sur donnée persistée valide-mais-mal-formée | `Storage.getObject` normalise contre une forme de référence | 10 cas de corruption bootent, données valides et clés inconnues préservées |
| B2 | `canonical`/`og:url` relatifs | URLs absolues `https://herolab.eu/` | contrôle CI qui échoue si relatif (vérifié) |
| B3 | Aucune image OG réelle | `assets/og-image.png`, 1200×630, 256 Ko | composée avec les fontes et la palette du produit |
| B4 | Burger 16×21 px | padding + marge négative | **44×44** mesuré, position visuelle inchangée |
| B5 | Tiroir off-canvas focusable | `inert` + `aria-hidden` en mode tiroir uniquement | desktop reste navigable, mobile fermé inerte, ouvert navigable |
| B6 | IDs `burger`/`scrim` dupliqués | copies du tracker renommées `ft-*` | 67 identifiants, **zéro doublon** |

**Sur B1, un point d'honnêteté** : ces crashs étaient **préexistants**, pas une
régression du refactor. Les cinq mêmes cas plantent à l'identique sur la version
d'avant refactor — la couche `Storage` avait fidèlement reproduit la sémantique
d'origine, faiblesse comprise.

---

## C. P2 restants

| # | sujet | pourquoi non traité |
|---|---|---|
| C1 | Page d'acquisition séparée (`/` + `/app`) | changement d'architecture réel ; la consigne était de ne pas transformer l'app en landing page ni d'inventer une fausse page. Voir §L. |
| C2 | Instrumentation analytics | rien branché, décision produit avec conséquences RGPD ; architecture documentée dans `ANALYTICS.md` |
| C3 | Centralité d'`App` (fan-out 31) | `Router` minimal identifié, non fait ; à traiter avant toute nouvelle extraction |
| C4 | 642 lignes d'écrans dans `App` | extractibles, mais **après** le `Router` |
| C5 | `Stats.compute` 315 lignes, `Parser.parseHandWinamax` 191 | dans l'IIFE Feutre, non couvertes par les suites ; découper sans tests serait un risque net |
| C6 | 92 `onclick` inline | empêchent une CSP stricte sans `unsafe-inline` ; coût de migration élevé |
| C7 | Taxonomies de fuites (2 ids sur 10 communs) | décision produit, TODO documentée dans le code |

---

## D. Tests

| suite | résultat | contenu |
|---|---|---|
| contrats (`tests/run.mjs`) | **81/81** | empreinte + pureté moteur, `Progress.summary()` 16 champs, stockage (API, 8 clés, 10 cas de corruption, quota, stockage absent), ponts Feutre↔App, intégrité du refactor, UI + 3 assertions DOM, boucle de jeu, export/import |
| red-team (`tests/redteam.mjs`) | **34/34** | onboarding, préflop/postflop, session, drill, chaîne leak→drill→progression, 3 labs, carrière, tracker, rechargement, corruption, `localStorage` absent, navigation, mobile, XSS, surface `window`, secrets, boot |
| production (`tests/production-check.mjs`) | **38/38** | fichiers requis, canonical, OG, JSON-LD, structure, robots, sitemap, netlify.toml |
| syntaxe (`tests/syntax-check.mjs`) | OK | tous les blocs inline, JS et JSON-LD |

**Total : 153 contrôles.** `tests/baseline.json` **jamais modifié** — un seul
commit sur ce fichier depuis sa création, avant la première ligne du refactor.
Aucun test supprimé, aucun neutralisé.

---

## E. CI

12 étapes, verte sur `cd115ed`. Échoue si : syntaxe invalide, contrôle de
production en échec, contrat rompu, empreinte moteur divergente, red-team en
échec, ou fichier suivi modifié pendant l'exécution.

Les deux chemins d'échec ont été **exercés réellement** : une constante moteur
modifiée rend le job rouge en nommant le hash divergent ; un `sitemap.xml` retiré
et un canonical relativisé sortent en code 1.

La CI **ne déploie pas** — le déploiement reste sous l'autorité de Netlify sur
`main`, une seule source de vérité pour la production.

---

## F. Déploiement

```
code → CI (153 contrôles) → merge dans main → Netlify → herolab.eu
                                                  ↑
                                          maillon À ÉTABLIR
```

**NON VÉRIFIÉ** : tout ce qui est en aval de Netlify. Le proxy sortant bloque
`herolab.eu` et `*.netlify.app`. Certificat, redirection HTTP→HTTPS, `www`,
en-têtes réels, contenu servi : à contrôler depuis ton navigateur, liste au
point 10 de `DEPLOYMENT.md`.

Ce qui **est** vérifié, par l'API Netlify : le déploiement courant est un dépôt
manuel du 11 août (`manual_deploy: true`, `deploy_source: "drop"`,
`commit_ref: null`), contenant **un seul fichier**, antérieur à tout ce travail.

---

## G. SEO

38 contrôles automatisés. `title`, `description`, `robots`, `canonical`
absolu, `theme-color`, 10 balises Open Graph, 3 Twitter, JSON-LD
`WebApplication` cohérent avec le canonical, favicon, `lang`, `charset`,
`viewport`, 1 `h1`, 7 `h2`, `noscript` de 218 mots, `robots.txt` avec sitemap,
`sitemap.xml` en URL absolue.

Les 8 fonctionnalités annoncées en JSON-LD correspondent chacune à un module
réel du code — aucune promesse que le produit ne peut démontrer.

**Réserve honnête sur l'aperçu social** : l'image est désormais un PNG hébergé,
ce qui est la condition nécessaire pour X et Facebook. Mais **le rendu réel sur
chaque plateforme n'est pas vérifiable tant que le domaine ne sert pas le
fichier** — à tester avec les validateurs une fois le déploiement fait.

---

## H. Sécurité

Payloads sur le pseudo joueur et sur les 7 slots d'une sauvegarde importée :
**aucune exécution**, aucun élément injecté vivant dans le DOM, le contenu
apparaît en texte échappé. Zéro secret dans la page. Surface `window` limitée à
`Feutre` avec 4 membres ; `V` et `FT` restent `undefined`.

En-têtes ajoutés : `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`,
`Permissions-Policy` vide — l'application n'utilise aucune API navigateur
sensible et n'émet aucune requête réseau.

**Limite connue** : 92 `onclick` inline empêchent une CSP stricte sans
`unsafe-inline` (C6).

---

## I. Performance

| mesure | valeur |
|---|---|
| `load` | 214 ms |
| application prête | 304 ms |
| First Contentful Paint | 152 ms |
| `domInteractive` | 138 ms |
| nœuds DOM initiaux | 345 |
| première interaction (nouvelle main) | 16 ms |
| requêtes réseau | **0** |

**Aucune optimisation appliquée, volontairement.** Les 714 Ko d'actifs figés
(514 Ko de fontes, 200 Ko de Chart.js) relèvent du parti « zéro réseau ». Les
externaliser ajouterait deux dépendances réseau et un risque de FOUT pour un
boot déjà à 304 ms — **gain non démontrable**.

---

## J. Accessibilité

Corrigé : cible tactile 44×44, tiroir non focusable quand masqué avec
`aria-hidden`, zéro identifiant dupliqué. Vérifié sur desktop et mobile, avec
navigation clavier réelle dans le tiroir ouvert.

**Non audité** : contrastes, ordre de tabulation complet, parcours lecteur
d'écran de bout en bout, `prefers-reduced-motion`. Un audit a11y complet n'était
pas dans le périmètre.

---

## K. Analytics

**Aucune, et rien n'a été branché.** `ANALYTICS.md` documente les points
d'accroche existants, une architecture no-op neutre, et les options avec leurs
conséquences RGPD. Le module n'est délibérément pas ajouté au code tant que la
destination n'est pas choisie.

---

## L. Architecture — premier contact

Le problème mesuré subsiste : avec JavaScript, le premier écran est de la
navigation (« Hero Lab · Cash Game · NLHE · Accueil · Défi du jour… »), sans
proposition de valeur ni appel à l'action. Sans JavaScript, le `noscript`
explique tout.

**Je n'ai pas fabriqué de landing page.** La recommandation reste de séparer
`/` (acquisition, statique, indexable) et `/app` (l'application). C'est un
travail de contenu et de positionnement produit, pas d'architecture — et
l'inventer aurait produit un discours marketing que je ne peux pas étayer.

---

## M. Rollback

Le déploiement manuel du 11 août reste dans l'historique Netlify. En cas de
problème : **Deploys → `6a7b272c185dca24423ad7d3` → Publish deploy**, retour
immédiat.

Aucune donnée utilisateur n'est en jeu : tout est dans le `localStorage` du
visiteur, jamais côté serveur. Un rollback ne fait perdre aucune progression.

---

## N. Risques restants

| # | risque | gravité |
|---|---|---|
| N1 | **Le lien Netlify ← GitHub n'existe pas.** Tant qu'il n'est pas établi, rien de ce travail n'atteint la production. | **bloquant** |
| N2 | Lier Netlify à `main` **avant** le merge publierait une racine 404 exposant l'ancien produit | **bloquant si mal ordonné** |
| N3 | Le site réellement servi n'a pas pu être inspecté (egress bloqué) | vérification à faire |
| N4 | Le rendu de l'aperçu social sur chaque plateforme n'est pas testable avant déploiement | mineur |
| N5 | Pas de page d'acquisition : le premier contact reste faible | produit |
| N6 | Aucune mesure : impossible de savoir si le produit fonctionne auprès des utilisateurs | produit |
| N7 | Centralité d'`App` en hausse depuis le refactor | dette |
| N8 | Deux fonctions > 150 lignes non couvertes dans l'IIFE Feutre | dette de test |

---

## Verdict

# READY WITH CONDITIONS

Le code est prêt : 153 contrôles verts, moteur prouvé inchangé, sécurité
vérifiée, performance bonne, accessibilité mobile corrigée, SEO complet et
honnête.

**Ce n'est pas READY**, et je ne peux pas le déclarer : le critère que tu as
posé est que le chemin `CODE → GITHUB → CI → MAIN → NETLIFY → herolab.eu` soit
**réellement démontré**. Trois maillons sur six le sont. Les trois derniers
dépendent de deux actions qui ne sont pas à ma portée :

1. **merger la PR** (checks verts) ;
2. **lier le projet Netlify au dépôt sur `main`** — l'API dont je dispose ne
   propose aucune opération de liaison Git ;
3. **vérifier le site depuis un navigateur** — le proxy sortant bloque
   `herolab.eu`.

Une fois ces trois points faits et la liste de vérification de `DEPLOYMENT.md`
passée, le verdict devient **READY**.
