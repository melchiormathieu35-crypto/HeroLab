# Hero Lab — Audit architectural final (phases 2 à 13 + production readiness)

Arbre au commit `dd7ab22`. Toutes les mesures ci-dessous proviennent du **code réellement présent
dans le dépôt**, vérifiées par exécution. Graphify n'a servi que d'outil secondaire, et ses écarts
sont documentés en §13.

---

## A. Score global

| axe | note | justification mesurée |
|---|---:|---|
| Architecture | **7,5 / 10** | couches nettes, persistance centralisée (1 module), inter-labs à 0, moteur pur ; mais `App` reste central (fan-out 31, fan-in 13) et 642 lignes d'écrans y subsistent |
| Maintenabilité | **7 / 10** | 99 modules nommés, contrats documentés ; 13 fonctions ≥ 100 lignes dont 3 ≥ 150 |
| Robustesse | **8,5 / 10** | 34/34 scénarios red-team, survit à JSON corrompu, quota plein et `localStorage` absent |
| Testabilité | **8 / 10** | 66 tests + 34 scénarios, empreinte moteur exacte ; aucune CI |
| Performance | **7 / 10** | boot 258 ms, 322 nœuds DOM, aucun blocage réseau ; 1 522 Ko dont 47 % d'actifs figés assumés |
| Sécurité des données | **8 / 10** | XSS neutralisé sur les deux vecteurs réels, aucun secret, surface `window` minimale ; 92 handlers inline |
| **Production readiness** | **2 / 10** → **7 / 10** | avant : aucune métadonnée, aucun `index.html`, aucun favicon, aucune preview sociale. Après corrections : tout est en place sauf l'instrumentation (volontairement non branchée) et le domaine de production (non arbitré) |

Le produit est **techniquement sain et fonctionnellement solide**. Il n'est **pas prêt à être mis
en ligne** : tout ce qui touche à la découverte, au partage et à la mesure est absent.

---

## B. Problèmes par sévérité

### P0 — peut casser le produit

**Aucun.** Aucune régression détectée, aucun test en échec, aucune erreur JS sur 34 scénarios.

### P1 — dette importante

| # | problème | preuve |
|---|---|---|
| 1 | **Aucune métadonnée SEO.** Le `<head>` ne contient que `charset` et `viewport`. Pas de `description`, `robots`, `canonical`, `theme-color`, aucun `<link>`. | §SEO |
| 2 | **Aucune preview sociale.** Ni Open Graph ni Twitter Card. Une URL partagée sur Discord, WhatsApp, X, LinkedIn ou iMessage affichera une carte nue. | 0 balise `og:`/`twitter:` |
| 3 | **Aucun `index.html`, aucune config de déploiement.** Un hébergeur statique ne sert rien. « Le fichier déployé » n'a pas de définition. | racine du dépôt |
| 4 | **Deux simulateurs concurrents** sans marqueur ; `pivot-simulateur-cashgame-17.html` est fonctionnel et ouvrable par erreur. | 2 fichiers valides |
| 5 | **Contenu indexable quasi nul** : 151 mots dans le `<body>` statique, essentiellement des libellés de navigation. Rien n'explique ce qu'est le produit. | §SEO |
| 6 | **6 `<h1>` statiques**, un par écran. Aucune hiérarchie de titres exploitable. | `h1`×6, `h2`×2, `h3`×126 |
| 7 | **Aucune instrumentation.** Impossible de mesurer acquisition, activation, première décision, drill terminé, rétention. | 0 outil, 0 événement émis |
| 8 | **Aucun favicon.** Onglet et raccourci sans identité. | `favicon.*` absent |

### P2 — amélioration utile

| # | problème | preuve |
|---|---|---|
| 9 | 3 fonctions ≥ 150 lignes : `Stats.compute` 315, `Parser.parseHandWinamax` 191, `App.renderReview` 186 | §10 |
| 10 | 10 fonctions entre 100 et 150 lignes | §10 |
| 11 | `graphify-out/` suivi décrit **l'ancienne version** (`pivot-…-17.html` au commit `b2f68de`) et se lit comme la cartographie courante | `graph.json` |
| 12 | `__pycache__/extract.cpython-311.pyc` suivi — bytecode d'un outil supprimé | commit `7e5679c` |
| 13 | `syntax-check.mjs` suppose que le JS applicatif est le **2ᵉ** bloc `<script>` : faux positif sur tout fichier au Chart.js externe | vérifié |
| 14 | Marque incohérente : 2 messages d'erreur **visibles par l'utilisateur** disent « sauvegarde Pivot » | L8525-8526 |
| 15 | `App` conserve 642 lignes d'écrans (`renderHome` 149, `renderStats` 78, `renderSetup` 77, `renderLeaks` 70, `renderTheory` 54…) | §2 |
| 16 | Centralité d'`App` en hausse depuis le refactor (betweenness 0,325 → 0,554) | §13 |

### P3 — cosmétique

| # | problème |
|---|---|
| 17 | 4 `catch {}` silencieux (dont 1 dans Chart.js vendorisé, donc 3 réels) |
| 18 | `startSession("clé inconnue")` retombe silencieusement sur `short` sans validation ni avertissement |
| 19 | 9 occurrences de « Pivot » dans des commentaires internes |
| 20 | 92 `onclick` inline générés — fonctionnel, mais empêche une CSP stricte sans `unsafe-inline` |

---

## C. Ce qui doit absolument être corrigé (max 10)

Classé par ROI décroissant, risque produit nul ou quasi nul pour les 6 premiers.

| # | correction | sévérité | risque |
|---|---|---|---|
| 1 | Bloc de métadonnées complet : description, robots, canonical, OG, Twitter Card, theme-color | P1 | nul |
| 2 | Image sociale + favicon | P1 | nul |
| 3 | Définir le fichier canonique de production (`index.html`) et archiver explicitement l'ancienne génération | P1 | faible |
| 4 | `robots.txt` + `sitemap.xml` | P1 | nul |
| 5 | Contenu indexable minimal décrivant réellement le produit, sans bourrage | P1 | nul |
| 6 | Un seul `<h1>`, hiérarchie de titres cohérente | P1 | nul |
| 7 | Corriger les 2 messages utilisateur « Pivot » → « Hero Lab » (sans toucher au format `pivot-save`) | P2 | nul |
| 8 | Généraliser `syntax-check.mjs` | P2 | nul |
| 9 | Retirer le `.pyc` suivi, régénérer ou dater `graphify-out/` | P2 | nul |
| 10 | Pérenniser la campagne red-team dans le dépôt | P2 | nul |

**Hors périmètre de cette passe, à instruire séparément** : instrumentation analytics (P1 #7) — la
mission interdit de brancher une solution payante sans accord ; architecture proposée en §F.

---

## D. Ce qu'il ne faut surtout pas toucher

| zone | raison |
|---|---|
| **Moteur poker** (`Deck`, `HandEval`, `Ranges`, `BoardTex`, `Equity`, `Odds`, `CAT`, `RANKS`) | 14 empreintes identiques à la mesure figée avant refactor, 6 modules purs, déterminisme vérifié sur 3 chargements indépendants |
| **`Equity._fnv` / `_mulberry`** | c'est ce qui rend le produit déterministe ; toute modification casse l'empreinte et l'identité produit |
| **Format `pivot-save` et les 9 clés de stockage** | compatibilité des sauvegardes existantes ; renommer une clé perd les données utilisateur |
| **`Progress.summary()`** | contrat interne consommé par 13 endroits, documenté et testé |
| **Frontière Feutre** | IIFE, `V`/`FT` non globaux, surface publique de 4 membres exactement — c'est le sous-système le mieux encapsulé du fichier |
| **Pont `drillLeak`** | chaîne leak → drill → progression vérifiée de bout en bout (scénario 13) |
| **`HRStats`/`PRStats`/`BLStats`** | formes de `summary()` réellement divergentes ; fusion = abstraction artificielle |
| **`RangeModel` / `ProfileModel`** | même algorithme, domaines différents ; duplication lisible préférée |
| **Fontes base64 et Chart.js inlinés** | 47 % du poids, mais c'est le choix « zéro réseau » assumé — voir §Performance avant tout arbitrage |

---

## E. Architecture cible (état constaté, pas projeté)

```
                    ┌──────────────────────────────────────┐
   UI               │ UI (primitives) · Modal · Charts     │
                    │ App(vues) ProfileUI DailyUI JourneyUI│
                    │ CareerUI · HRUI · PRUI · BLUI        │
                    └───────────────┬──────────────────────┘
                                    │
   CONTROLLERS      ┌───────────────▼──────────────────────┐
                    │ App(routing + boucle) · SessionCtl   │
                    │ Onboarding · DataPort · Studio       │
                    └───────────────┬──────────────────────┘
                                    │
   GAME LOGIC       ┌───────────────▼──────────────────────┐
                    │ Spot · Judge · Play · Session        │
                    │ Career · Bankroll · Goals · Rating   │
                    │ Journey · Mentor · AI · Calibrate    │
                    │ RangeModel · ProfileModel · Blocker  │
                    └───────────────┬──────────────────────┘
                                    │
   POKER ENGINE     ┌───────────────▼──────────────────────┐
                    │ Deck HandEval Ranges BoardTex        │  ← GELÉ
                    │ Equity Odds CAT RANKS                │    pur, déterministe
                    └──────────────────────────────────────┘

   PERSISTENCE      Storage ──► localStorage        (1 module, 5 accès)
                    StorageGuard = notification d'échec uniquement

   ANALYTICS        Progress · HRStats · PRStats · BLStats · Rating
                    (lecture seule vers Game Logic)

   TRACKER          window.Feutre = IIFE { open, controller,
                                            drillConfig, leakTitle }
                    Parser · Store · Stats · Leaks · V · FT  (privés)
```

**Dépendances autorisées** : de haut en bas uniquement. Vérifié : le moteur ne remonte jamais
(0 violation), les labs ne se référencent plus entre eux (0), un seul module touche le stockage.

**Écart connu** : `App` est à la fois UI et Controller, et toutes les vues extraites le rappellent
pour naviguer (`App.go` ×12) et relancer la boucle (`App.newHand` ×6). C'est la cause mesurée de sa
centralité.

---

## F. Plan d'exécution

### Corrections appliquées dans cette passe

| # | problème | impact | solution | risque | tests |
|---|---|---|---|---|---|
| 1 | pas de métadonnées | invisible pour les moteurs | bloc `<head>` complet, sémantique naturelle | nul | syntaxe + suite + red-team |
| 2 | pas de preview sociale | partage sans identité | OG + Twitter Card + image SVG inline | nul | idem |
| 3 | pas de favicon | onglet anonyme | favicon SVG en data-URI (zéro réseau) | nul | idem |
| 4 | fichier canonique indéfini | risque de servir la mauvaise version | `index.html` = source de production ; ancienne génération déplacée en `archive/` avec README | faible | tests repointés |
| 5 | pas de robots/sitemap | crawl non guidé | `robots.txt` + `sitemap.xml` | nul | — |
| 6 | contenu non indexable | produit incompréhensible sans JS | section `<noscript>` + contenu statique descriptif | nul | red-team |
| 7 | 6 `<h1>` | hiérarchie cassée | 1 `<h1>`, les autres en `<h2>` | nul | red-team + navigation |
| 8 | « Pivot » visible | marque incohérente | 2 messages → « Hero Lab » ; format `pivot-save` **inchangé** | nul | dataport ×4 |
| 9 | harnais mono-fichier | faux positif | `syntax-check.mjs` généralisé | nul | sur les 2 fichiers |
| 10 | artefacts suivis | bruit | `.pyc` retiré + ignoré ; `graphify-out/` daté | nul | — |
| 11 | red-team éphémère | non rejouable | pérennisée en `tests/redteam.mjs` | nul | 34 scénarios |

### Corrections volontairement refusées

| refus | raison |
|---|---|
| Externaliser fontes et Chart.js (−714 Ko) | contredit le choix produit « zéro réseau » ; introduit 2 dépendances réseau et un risque de FOUT. Le boot est déjà à 258 ms. **Gain non démontré, régression UX possible.** |
| Découper `Stats.compute` (315 lignes) | fonction du tracker, dans l'IIFE Feutre, non couverte par la suite. La découper sans tests dédiés est un risque net sans bénéfice mesurable. |
| Extraire `HomeUI`/`StatsUI` d'`App` | ~640 lignes, bénéfice réel — mais **augmenterait encore la centralité d'`App`** tant que le `Router` n'existe pas. À faire dans le bon ordre, pas ici. |
| Brancher une solution analytics | la mission l'interdit sans accord préalable. Architecture proposée ci-dessous. |
| Transformer l'app en landing page | l'architecture actuelle est une app ; l'acquisition doit être séparée (voir §G). |
| Remplacer les 92 `onclick` inline | fonctionne, coût de migration élevé, seul bénéfice = CSP stricte. Non prioritaire. |
| Supprimer `pivot-…-17.html` | interdit sans justification ; archivé, pas détruit. |

### G. Instrumentation — architecture minimale proposée (non branchée)

Les événements produit **existent déjà** côté code : `Progress.record`, `Session.recordDecision`,
`Session.recordHand`, `Player.recordMastery`, `HRStats/PRStats/BLStats.record`. Il manque
uniquement un point d'émission.

Proposition, sans dépendance ni coût :

```
Telemetry = {
  enabled: false,          // opt-in explicite, respecte le "zéro réseau" par défaut
  sink: null,              // fonction fournie à l'exécution (fetch, beacon, console)
  emit(event, props) {}    // no-op tant que sink est null
}
```

Événements minimaux à couvrir le parcours demandé : `app_open`, `onboarding_complete`,
`first_decision`, `session_start`, `session_end`, `drill_start`, `drill_complete`,
`leak_detected`, `tracker_import`, `export`, `return_visit`.

Le choix de la destination (Plausible, Umami auto-hébergé, endpoint maison) est une décision qui
t'appartient — aucune n'est câblée ici.

### H. Conversion / acquisition

La page actuelle est **une application, pas une page d'acquisition**. Elle n'explique nulle part
ce qu'est Hero Lab, à qui il s'adresse, ni la boucle « mains réelles → leak → drill → progression »
qui est pourtant son vrai différenciateur — et qui **fonctionne réellement**, vérifié de bout en
bout (scénario 13).

Recommandation : **ne pas** transformer l'app en landing page. Séparer :

```
/            → page d'acquisition (statique, indexable, ~1 écran)
/app         → Hero Lab (l'application actuelle)
```

Cette passe pose le minimum indexable dans l'app elle-même (métadonnées + `<noscript>`
descriptif), ce qui règle le partage social et la compréhension par les moteurs sans dénaturer le
produit. La page d'acquisition séparée reste à créer — c'est un travail de contenu, pas
d'architecture.

---

## §SEO — état mesuré avant correction

| élément | état |
|---|---|
| `<html lang>` | ✅ `fr` |
| `charset` | ✅ `utf-8` |
| `viewport` | ✅ avec `viewport-fit=cover` |
| `<title>` | ✅ « HeroLab — Simulateur de décisions Cash Game » |
| `description` | ❌ absente |
| `robots` | ❌ absente |
| `canonical` | ❌ absente |
| `theme-color` | ❌ absente |
| Open Graph | ❌ 0 balise |
| Twitter Card | ❌ 0 balise |
| favicon | ❌ absent |
| manifest | ❌ absent |
| `robots.txt` | ❌ absent |
| `sitemap.xml` | ❌ absent |
| Schema.org | ❌ absent |
| `<h1>` | ⚠ 6 (un par écran) |
| texte indexable sans JS | ⚠ 151 mots, uniquement de la navigation |
| contenu dupliqué | ✅ aucun (fichier unique) |

## §Performance — état mesuré

| mesure | valeur |
|---|---|
| `load` | 208 ms |
| `App` défini | 258 ms |
| `domInteractive` | 137 ms |
| nœuds DOM initiaux | 322 |
| requêtes réseau échouées | 0 |
| scripts externes | **0** (Chart.js inliné) |
| poids total | 1 522 Ko |
| — fontes base64 | 514 Ko (34 %) |
| — Chart.js inliné | 200 Ko (13 %) |
| — **JS applicatif réel** | **675 Ko (44 %)** |
| — HTML/CSS restant | 127 Ko (8 %) |
| instances Chart.js | 2, avec `destroy()` avant recréation |

Les 714 Ko d'actifs figés sont **distincts du code applicatif** et relèvent d'un choix produit
assumé. Le boot est bon ; l'optimisation la plus rentable serait le `font-display` déjà présent
(`swap`) et une éventuelle réduction des graisses embarquées — 8 variantes Inter, dont plusieurs
peut-être inutilisées. **Mesure à faire avant tout retrait.**

## §13 — Graphify vs code réel

Écarts confirmés du second passage, à connaître avant de réutiliser l'outil :

- **Faux négatifs systématiques** : Graphify reconnaît `X.y()` mais rate `X[clé]`. Or ce fichier
  consomme ses tables ainsi — `RANKS` ×45, `STREET_FR` ×20, `ALL_PROFILES` ×19, `PROFILES` ×18,
  `LEAK_INFO` ×18, `TIERS` ×10. Ces arêtes sont invisibles au graphe.
- **IIFE mal modélisée** : la première passe attribuait le sous-système Feutre au mauvais module
  parce qu'il est `window.Feutre = (function(){…})()` et non un `const`.
- **Vrai positif utile** : le second passage a détecté deux champs morts (`App.session`,
  `App.sessionReport`) qu'aucun test ne voyait. Corrigé.
- **Conclusion** : bon détecteur d'anomalies, mauvaise source de vérité sur les dépendances.


---

## §Phase 15 — corrections appliquées

Onze corrections, en cinq commits atomiques, chacune testée avant commit.

| # | correction | commit | vérification |
|---|---|---|---|
| 1 | Métadonnées SEO complètes (description, robots, canonical, theme-color) | `ebd9153` | 66/66 + 34/34 |
| 2 | Open Graph + Twitter Card + image sociale SVG inline | `ebd9153` | idem |
| 3 | Favicon + apple-touch-icon en data-URI | `ebd9153` | idem |
| 4 | JSON-LD `WebApplication` | `ebd9153` | JSON validé par le harnais |
| 5 | `index4.html` → **`index.html`** (source canonique) | `79c272f` | tests repointés |
| 6 | Ancienne génération → `archive/` + README justifiant l'écart | `79c272f` | 10 modules absents documentés |
| 7 | `robots.txt` + `sitemap.xml` | `79c272f` | XML + namespace validés |
| 8 | `syntax-check.mjs` généralisé à tous les blocs inline | `79c272f` | testé sur les 2 fichiers + contrôle négatif |
| 9 | Hiérarchie de titres : **6 `<h1>` → 1** | `bafe965` | styles calculés identiques sur 6 éléments |
| 10 | Contenu indexable `<noscript>` : **151 → 369 mots** | `bafe965` | 34/34 |
| 11 | Marque « Pivot » → « Hero Lab » dans 2 messages utilisateur | `3dbdbd2` | round-trip export/import préservé |
| 12 | `.pyc` suivi retiré, `graphify-out/` daté comme historique | `3dbdbd2` | — |

### Métriques avant / après (référence = avant refactor)

| métrique | avant | après | delta |
|---|---:|---:|---:|
| `<h1>` | 6 | **1** | −5 |
| texte indexable sans JS | 151 mots | **369 mots** | +218 |
| balises `meta` | 2 | **17** | +15 |
| balises `<link>` | 0 | **3** | +3 |
| fichiers SEO racine | 0 | **2** | +2 |
| App — lignes | 1 957 | 1 416 | −541 |
| App — état greffé | 13 | 2 | −11 |
| modules `localStorage` | 10 | **1** | −9 |
| dépendances inter-labs | 2 | **0** | −2 |
| moteur pur | oui | **oui** | = |
| boot (`App` prêt) | — | **252 ms** | — |
| tests | 0 | **66 + 34** | +100 |

### Tests

- Suite unitaire : **66/66**, à chaque commit.
- Red-team : **34/34** scénarios, pérennisée dans `tests/redteam.mjs`.
- Empreinte moteur : **inchangée**, toujours identique à la mesure figée en `f60b3e1`.
- Aucun test neutralisé, aucun échec masqué.

### Risques résiduels

| # | risque | portée |
|---|---|---|
| 1 | `canonical`, `og:url` et `sitemap.xml` sont **relatifs** — le domaine de production n'est pas arbitré. À rendre absolus avant soumission à un moteur. | bloquant pour l'indexation |
| 2 | L'image sociale est un data-URI : X et Facebook ne la rendront pas et retomberont sur titre + description. Un PNG 1200×630 hébergé reste préférable. | preview partielle |
| 3 | **Aucune instrumentation** — impossible de mesurer acquisition, activation, rétention. Architecture proposée en §G, non branchée (décision produit). | mesure produit |
| 4 | Pas de page d'acquisition séparée. Le `<noscript>` explique le produit, mais ne remplace pas une vraie page d'entrée. | conversion |
| 5 | Centralité d'`App` toujours en hausse (fan-out 31). Le `Router` reste la correction identifiée. | dette architecturale |
| 6 | 642 lignes d'écrans encore dans `App` ; extraction à faire **après** le `Router`, pas avant. | dette architecturale |
| 7 | `Stats.compute` (315 lignes) et `Parser.parseHandWinamax` (191) non couverts par la suite — dans l'IIFE Feutre. | dette de test |
| 8 | Aucune CI : les suites ne tournent qu'à la main. | process |

### Recommandations — prochaine phase

1. **Arbitrer le domaine**, puis rendre `canonical`, `og:url` et `sitemap.xml` absolus, et produire une image sociale hébergée.
2. **Ajouter une CI** exécutant `npm test` + la red-team à chaque push — le harnais existe, il ne manque que le déclencheur.
3. **Décider de l'instrumentation** (§G) : l'architecture est prête, les événements produit existent déjà côté code.
4. **Créer la page d'acquisition** séparée (`/` statique, l'app en `/app`).
5. **Introduire le `Router`**, puis seulement ensuite extraire `HomeUI`/`StatsUI`.
6. **Couvrir `Stats.compute` et le parser Winamax** par des tests avant toute découpe.
