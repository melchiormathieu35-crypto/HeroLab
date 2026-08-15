# Hero Lab — Baseline post-refactor

Phases 0 et 1 uniquement. **Aucun code modifié.** Ce document est un état des lieux mesuré,
destiné à servir de point de comparaison avant toute correction ultérieure.

Mesures prises le 2026-08-15 sur l'arbre au commit `b35cc41`.

---

## Correction préalable

L'énoncé de mission indique « 65/65 tests actuellement verts ». La mesure réelle est
**66/66**. Un 66ᵉ test (`refactor:aucun champ d'état orphelin laissé sur App`) a été ajouté
après la rédaction du rapport de refactor, à la suite d'une découverte du second passage
Graphify. Le reste de l'énoncé correspond à l'état constaté.

---

## Phase 0 — État du dépôt

### Git

| | |
|---|---|
| HEAD | `b35cc41ad814707a243e1513ac7e338e8cd283ba` |
| message | *Complete the Graphify comparison in the refactor report* |
| date | 2026-08-14 22:30:40 +0000 |
| branche | `claude/graphifyy-cli-install-vv16zy` |
| remote | `https://github.com/melchiormathieu35-crypto/HeroLab` |
| arbre de travail | **propre** — 0 modifié, 0 non suivi |
| commits non poussés | 15 (push refusé en 403, accès en lecture seule) |

### Fichier Hero Lab utilisé

**`index4.html`** — 16 537 lignes, 1 522 Ko, `<title>HeroLab — Simulateur de décisions Cash
Game`, `APP_VERSION = "1.0.0"` (ligne 2215). C'est le fichier audité, testé et refactoré.

### ⚠ P1 — Deux versions concurrentes du simulateur coexistent

| fichier | lignes | octets | titre | APP_VERSION |
|---|---:|---:|---|---|
| `index4.html` | 16 537 | 1 522 Ko | **HeroLab** — Simulateur de décisions Cash Game | `1.0.0` |
| `pivot-simulateur-cashgame-17.html` | 15 429 | 746 Ko | **Pivot** — Simulateur de décisions Cash Game | *absent* |

Les deux sont suivis par git, à la racine, sans marqueur indiquant lequel fait foi. Le second
est l'ancienne génération : nom de produit différent (« Pivot »), pas de `Modal`, pas de
`StorageGuard`, pas de `Studio`, pas de couche `Storage`, aucune des six extractions. Il est
**syntaxiquement valide et fonctionnel** — donc ouvrable par erreur sans que rien ne signale la
méprise.

Risque concret : un contributeur, un script ou un hébergeur qui prend « le fichier HTML du
dépôt » a une chance sur deux de travailler sur la version pré-refactor.

### ⚠ P1 — Aucun fichier n'est servi par défaut

Il n'existe **pas d'`index.html`**, ni de configuration de déploiement (`netlify.toml`,
`vercel.json`, `.github/workflows`, `Dockerfile` : tous absents). Un hébergeur statique pointé
sur ce dépôt ne servirait rien.

Conséquence pour la mission : la vérification demandée « le fichier déployé correspond-il au
fichier audité » **n'a pas de réponse**, faute de déploiement défini. Ce n'est pas un échec de
l'audit mais une lacune du dépôt, à trancher (renommer `index4.html` en `index.html`, ou ajouter
une configuration explicite).

### ⚠ P2 — Artefacts suivis à tort

| chemin | problème |
|---|---|
| `__pycache__/extract.cpython-311.pyc` | bytecode d'un outil jetable (`extract.py`) supprimé depuis. Commité par inadvertance en `7e5679c`. Sans usage, non ignoré. |
| `graphify-out/graph.json`, `graph.html`, `GRAPH_REPORT.md` | décrivent **`pivot-simulateur-cashgame-17.html`** au commit `b2f68de`, c'est-à-dire l'ancienne version **avant** refactor. Un lecteur les prendrait pour la cartographie courante. |

### Outillage

```
npm test      → node tests/syntax-check.mjs && node tests/run.mjs
npm run syntax → node tests/syntax-check.mjs
npm run metrics → node tests/metrics.mjs
```

| fichier | lignes | rôle |
|---|---:|---|
| `tests/contracts.mjs` | 594 | contrats, stockage, ponts, UI, boucle de jeu, export |
| `tests/metrics.mjs` | 193 | métriques architecturales statiques |
| `tests/engine-fingerprint.mjs` | 142 | empreinte + pureté du moteur gelé |
| `tests/run.mjs` | 114 | orchestrateur Playwright, comparaison au baseline |
| `tests/syntax-check.mjs` | 27 | parse du JS applicatif hors navigateur |

Dépendance unique : `playwright@^1.49.1`. Aucune CI.

---

## Phase 1 — Baseline

### 1. Syntaxe

| fichier | résultat |
|---|---|
| `index4.html` | **OK** — 685 306 chars parsés |
| `pivot-simulateur-cashgame-17.html` | rejeté par le harnais — **faux positif, vérifié** |

Le rejet de v17 est une limite de `syntax-check.mjs`, pas un défaut du fichier : le script
suppose que le JS applicatif est dans le **second** bloc `<script>`, ce qui est vrai pour
`index4.html` (Chart.js inliné en premier) et faux pour v17 (Chart.js chargé depuis un CDN, donc
le JS applicatif est le premier bloc inline). Extraction manuelle du bon bloc puis `node
--check` : **636 090 chars, syntaxiquement valide**. Le harnais est spécifique à `index4.html` —
constat à porter au rapport final, sans conséquence sur la baseline.

### 2. Suite de régression

**66/66 PASS**, reproductible sur **3 exécutions consécutives**.

| famille | n | couverture |
|---|---:|---|
| `engine` | 16 | empreintes `Deck`, `HandEval`, `Ranges`, `BoardTex`, `Equity`, `Odds`, `CAT`, `RANKS` + gardes Studio |
| `storage` | 15 | API, 8 clés, non-renommage, JSON corrompu, clé absente, sémantique historique, quota refusé, stockage indisponible, accès direct interdit |
| `bridge` | 7 | `drillConfig`, `leakTitle`, fallbacks, workflow drill, alignement des handlers |
| `purity` | 6 | absence DOM / stockage / couche supérieure dans le moteur |
| `ui` | 5 | navigation 9 vues, rendu racine, labs, `Modal`, `sparkline` |
| `refactor` | 4 | membres fantômes, membres déplacés, champs orphelins, onboarding |
| `dataport` | 4 | payload versionné, round-trip, rejet fichier étranger, rejet illisible |
| `game` | 3 | `newHand`, `Judge.evaluate`, déterminisme du verdict |
| `contract` | 3 | `Progress.summary` (16 champs typés), forme des leaks, stabilité |
| `leaks` | 2 | recouvrement des taxonomies, résolution des libellés |
| runtime | 1 | aucune erreur JS en console |

**Aucun échec.** La condition d'arrêt de la Phase 1 n'est pas déclenchée.

### 3. Démarrage Chromium

Trois chargements indépendants, contextes neufs :

| mesure | run 1 | run 2 | run 3 |
|---|---:|---:|---:|
| `load` (document chargé) | 229 ms | 239 ms | 198 ms |
| `App` et `Storage` définis | 311 ms | 285 ms | 266 ms |

Aucune erreur JS, aucune erreur console. Boot médian ≈ **285 ms**, sur fichier local.

### 4. Empreinte et déterminisme du moteur

Empreinte globale sur trois **chargements de page distincts** :

```
5fba033ee195748a | 5fba033ee195748a | 5fba033ee195748a   → identiques
```

Empreintes par sonde, figées dans `tests/baseline.json` au commit `f60b3e1` — **avant la
première ligne modifiée du refactor** — et jamais réécrites depuis (`git log --follow` : un seul
commit sur ce fichier) :

| sonde | hash | sonde | hash |
|---|---|---|---|
| `deck_full` | `f49bc5f9858770ed` | `boardtex_analyse` | `40185847003e981d` |
| `deck_shuffle` | `53fb6b4f66f37a6f` | `boardtex_made` | `8e6627128dc740d1` |
| `deck_encoding` | `3eefef4f408f454c` | `boardtex_made2` | `82b7aa61c86919e8` |
| `handeval` | `cb73082baf134760` | `boardtex_empty` | `74234e98afe7498f` |
| `ranges` | `35b036a2610503f1` | `boardtex_made_pre` | `23ae84aef38e8d32` |
| `equity` | `3a024af7a1f75c67` | `odds` | `ee763842e7b3ed45` |
| `cat` | `11da5935e6e7f3bd` | `ranks` | `56397320b4f5cca6` |

L'empreinte est **exacte et non statistique** : `Equity` dérive son RNG d'une signature FNV de
ses entrées, et `Deck.shuffle` est piloté par ce même générateur seedé.

### 5. Pureté du moteur gelé

Lue sur `Function.toString()` du code **réellement chargé**, recherche de `document`,
`localStorage`, `sessionStorage`, `innerHTML`, `window.`, `App.`, `UI.`, `Modal.`, `alert(`,
`Chart` :

| module | méthodes | violations |
|---|---:|---|
| `Deck` | 9 | aucune |
| `HandEval` | 7 | aucune |
| `Ranges` | 12 | aucune |
| `BoardTex` | 2 | aucune |
| `Equity` | 5 | aucune |
| `Odds` | 7 | aucune |

### 6. Contrats publics

| contrat | état |
|---|---|
| `Progress.summary()` | 16 champs, types conformes, stable sur appels successifs |
| 8 clés Pivot | déclarées, aucune renommée |
| `feutre.v1` | encapsulée dans l'IIFE (non observable — comportement voulu) |
| `window.Feutre` | expose exactement `open`, `controller`, `drillConfig`, `leakTitle` |
| pont drill | `drillConfig` résout 10 leaks, `leakTitle` retombe sur l'id, `SessionCtl.drillLeak` arme un `drillRun` complet |
| export | `_format: "pivot-save"`, `_version: 1`, 8 slots, round-trip sans perte |

### 7. Métriques architecturales

| métrique | valeur |
|---|---:|
| lignes totales | 16 537 |
| modules top-level | 99 |
| App — lignes | 1 416 |
| App — méthodes | 29 |
| App — état déclaré | 8 |
| App — état greffé à l'exécution | 2 (`_homeChart`, `_mentorRewarded`) |
| App — fan-out | 31 |
| App — fan-in | 13 |
| App — écritures DOM | 36 |
| modules accédant à `localStorage` | **1** |
| accès `localStorage` directs | 5 (tous dans `Storage`) |
| couche Storage | **présente** |
| modules touchant le DOM | 18 |
| dépendances inter-labs | **0** |
| moteur gelé pur | **oui** |

### 8. Poids du fichier

| bloc | taille | part |
|---|---:|---:|
| **total** | **1 522 Ko** | 100 % |
| `<style>` (dont fontes base64) | 520 Ko | 34 % |
| — dont base64 fontes seules | 514 Ko | 34 % |
| Chart.js inliné | 200 Ko | 13 % |
| JS applicatif | 675 Ko | 44 % |
| HTML restant | 127 Ko | 8 % |

**47 % du fichier est constitué d'actifs figés** (fontes + Chart.js), choisis pour le « zéro
réseau ». Toute discussion sur la taille doit partir de là et non du code applicatif.

---

## Diagnostic post-refactor — synthèse Phase 0/1

### Vert — confirmé par la mesure

- Suite **66/66**, reproductible 3 fois, zéro erreur JS.
- Moteur **déterministe** sur trois chargements indépendants ; les 14 empreintes correspondent à
  la mesure figée avant le refactor.
- Moteur **pur** : 0 violation sur 6 modules, vérifié sur le code chargé.
- Persistance **réellement centralisée** : 1 seul module, 5 accès physiques.
- Dépendances inter-labs : **0**.
- Contrats publics tenus, aucune clé renommée, export/import compatible.
- Arbre git propre, aucun fichier non suivi.

### À traiter — repéré en Phase 0, à instruire dans les phases suivantes

| # | constat | classe |
|---|---|---|
| 1 | Deux versions du simulateur coexistent sans marqueur ; l'ancienne est fonctionnelle et ouvrable par erreur | **P1** |
| 2 | Aucun `index.html` ni configuration de déploiement — « fichier déployé » indéfini | **P1** |
| 3 | `graphify-out/` suivi décrit l'**ancienne** version, présenté comme cartographie courante | **P2** |
| 4 | `__pycache__/*.pyc` suivi, résidu d'un outil supprimé | **P2** |
| 5 | `syntax-check.mjs` spécifique à `index4.html` (hypothèse « 2ᵉ bloc script ») | **P2** |
| 6 | 2 champs encore greffés sur `App` (`_homeChart`, `_mentorRewarded`) — à instruire en Phase 2 | à qualifier |
| 7 | Fan-out d'`App` à 31, fan-in à 13 — centralité en hausse, seul critère du refactor partiellement atteint | à qualifier |

### Condition d'arrêt

**Non déclenchée.** Aucun test n'échoue. Les deux « échecs » rencontrés pendant la phase
(rejet syntaxique de v17, timeout du `waitForFunction`) ont été diagnostiqués comme des défauts
de mes propres sondes, corrigés dans la sonde et non dans le produit, et ne constituent pas des
régressions.

---

## Suite

Phases 2 à 13 non entamées, conformément à la consigne. Aucune ligne de `index4.html` n'a été
modifiée depuis `b35cc41` — l'arbre est resté propre pendant toute la phase.
