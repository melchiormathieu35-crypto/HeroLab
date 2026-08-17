# AGENT K — Architecture / Engineering

Contrat d'architecture pour la Phase 4. Ce document précède le code.

Tout chiffre ci-dessous est **mesuré par exécution** sur
`VERSION_PRODUCTION/herolab.html` (16 410 lignes, 1 513 Ko) via `tests/harness.js`,
sauf mention explicite « dérivé ». Aucun fichier applicatif n'a été modifié.

---

## 0. Résumé exécutable

| Question | Réponse |
|---|---|
| Le moteur est-il extensible sans être modifié ? | **Oui**, et c'est prouvé : aucun module n'est gelé, et un module appendé à la fin du script du moteur intercepte 250/250 `Progress.record`, 260/260 `Spot.generate`, 100 % de `RangeModel.prior`. |
| Le modèle de compétences est-il à construire ? | **Non, à réparer.** `Rating.skills()` et `Player.mastery` existent déjà. `Player.mastery` est **structurellement mort** (voir §2.3) : 0 succès enregistré sur 600 décisions. |
| Le vrai risque de la Phase 4 | Pas la taille du fichier. **La collision avec la liste blanche gelée de la Phase 3** : toute nouvelle clé `localStorage` fuit entre comptes et n'est jamais synchronisée. |
| Recommandation P0 | Une seule : **ne créer aucune clé `localStorage` nouvelle.** Voir §9. |

---

## 1. Carte des frontières actuelles

### 1.1 Ce que le fichier mélange, et ce qu'il ne mélange pas

Le fichier est mono-bloc, mais **il n'est pas spaghetti**. Il est déjà stratifié
en couches nettes ; ce qui manque, ce sont les *noms* de ces couches et les
points d'entrée déclarés. Découpage mesuré :

| Segment | Lignes | Taille | Part |
|---|---|---|---|
| `<head>` + fontes base64 | 1–34 | **521 Ko** | 34,4 % |
| Chart.js 4.4.1 embarqué | 35–51 | 200 Ko | 13,2 % |
| CSS applicatif | 52–2056 | 119 Ko | 7,8 % |
| Squelette DOM (coquilles vides) | 2057–2221 | 8 Ko | 0,5 % |
| **Script du moteur** (un seul `<script>`) | 2222–16410 | **665 Ko** | 43,9 % |

Sous-découpage du script du moteur :

| Sous-couche | Lignes | Taille |
|---|---|---|
| Jeu (Modal→CareerUI) | 2222–8490 | 283 Ko |
| Labs (RangeModel→BLUI) | 8491–13820 | 250 Ko |
| Tracker (IIFE `window.Feutre`) | 13821–16410 | 132 Ko |

### 1.2 Les quatre natures, et où elles vivent réellement

| Nature | Modules | Verdict |
|---|---|---|
| **Moteur (gelé)** | `Deck`, `HandEval`, `BoardTex`, `Equity`, `Odds`, `Table`, `Spot`, `Judge`, `AI`, `RangeModel`, `BlockerEngine`, `Parser` | Frontière propre. Pur calcul, aucune écriture de stockage, aucun DOM. |
| **Contenu (données)** | `Ranges.OPEN/BB_DEF/THREEBET/FOURBET`, `PROFILES`, `PROF_EXT`, `MODES`, `LEVELS`, `STAKES`, `TIERS`, `LEAK_INFO`, `LEAK_PLAIN`, `LEAK_DRILL`, `LEAK_COST`, `LEAK_FAMILIES`, `MENTORS`, `AVATARS`, `HR/PR/BL_DIFFICULTY` | **Déjà déclaratif.** Ce sont des littéraux objets, lus à l'exécution. C'est la couture la plus exploitable du fichier. |
| **Progression (état)** | `Progress`, `Career`, `Player`, `Rating`, `Journey`, `HRStats`, `PRStats`, `BLStats`, `Store` (tracker) | 9 clés `localStorage`, 18 méthodes `save`/`load`. Frontière **déjà unifiée par la Phase 3** au niveau du stockage. |
| **Présentation (vues)** | `UI`, `App` (l.6527–8490), `CareerUI`, `HRUI`, `PRUI`, `BLUI`, `V`, `FT`, `Charts`, `Modal` | Rendu par `innerHTML` sur des coquilles `#v-*`. Mélangé avec de l'orchestration (voir 1.3). |

### 1.3 Les deux vraies impuretés

Ce sont les seuls endroits où la stratification casse, et ce sont exactement
ceux que la Phase 4 doit toucher :

**(a) `App.newHand()` (l.7167–7259) — orchestration déguisée en vue.**
100 lignes, 4 branches (`dailyRun`, `drillRun`, `session`, `cible`), chacune
construisant un `cfg` puis rejouant la même boucle `while (tries++ < 25)
Spot.generate(cfg)`. La logique de *sélection d'exercice* est ici, dispersée et
dupliquée quatre fois. **C'est le point d'insertion du sélecteur adaptatif.**

**(b) Deux taxonomies de fuites qui ne se parlent pas.**

| | Côté jeu | Côté tracker |
|---|---|---|
| Vocabulaire | tags `leak:*` produits par `Progress.tags()` | règles `sev:` |
| Nombre de clés | **10** (`LEAK_INFO`) | **29** (`LEAK_PLAIN`) |
| Config d'entraînement | `Progress.focusFor()` — map inline de 10 entrées | `LEAK_DRILL` — 29 entrées |
| Pont | `window.Feutre.drillConfig(id)` / `leakTitle(id)` (l.8328–8330) | |

`Progress.focusFor()` et `LEAK_DRILL` disent la même chose dans deux formats
différents, avec deux vocabulaires de clés qui se recouvrent partiellement
(`fold-to-3bet` côté jeu vs `fold-3bet` côté tracker). **Unifier ce vocabulaire
est un préalable au modèle de compétences**, pas un raffinement.

### 1.4 Les coutures exploitables — inventaire

| Couture | Nature | Consommateurs | Exploitable pour |
|---|---|---|---|
| `Ranges.OPEN[pos]` | lu à chaud, 5 sites | `Opponent.widen` ×2, `AI` l.4003, `Play` l.4487, `PRLab` l.11238 | ranges par position |
| `Ranges.THREEBET` / `FOURBET` | lu à chaud, **1 seul site** | `RangeModel.prior` uniquement | ranges 3bet/4bet par couple |
| `RangeModel.prior(spot)` | méthode remplaçable | `HRSpot` l.9176, `HRLab` l.9490 | ranges déclinées |
| `Spot.generate(opt)` | méthode remplaçable | `App.newHand` ×3, `HRSpot`, `BLSpot` | sélecteur adaptatif |
| `Progress.record(t,a,d)` | méthode remplaçable, **retourne `entry`** | `App.choose` l.7272 | flux d'événements |
| `MODES` | objet extensible | `Spot.generate`, `App` | nouveaux modes |
| `Player.recordMastery(k,ok)` | méthode remplaçable | `App.choose` l.7289 | mastery |
| `window.Feutre` | **seul global réel** | `App` ×4 | pont jeu ↔ tracker |
| `window.localStorage` | substituable | 28 sites | persistance (pris par la Phase 3) |

---

## 2. Le mécanisme d'extension — deux classes d'injection

C'est la découverte structurante de cet audit, et elle change la façon de
penser toute la Phase 4.

### 2.1 Pourquoi la recette de la Phase 3 ne suffit pas

Le script du moteur déclare ses ~90 modules en `const` **au niveau supérieur
d'un script classique**. Or un `const` de haut niveau vit dans l'environnement
lexical global, **pas** dans l'objet global. Vérifié :

```
window.Progress = undefined   |   window.Legacy = object   (var, pour comparaison)
```

Conséquence : `grep -c "^\s*window\.[A-Za-z]+\s*="` sur le moteur renvoie **1**.
`window.Feutre` est le **seul** module réellement exposé.

**Un script injecté AVANT le moteur (recette Phase 3) est donc structurellement
aveugle au moteur.** Il ne peut atteindre que `window.localStorage`,
`window.Feutre`, le DOM et les événements. C'était suffisant pour la Phase 3,
qui ne visait que le stockage. Ce n'est pas suffisant pour la Phase 4.

> **Corollaire — un défaut de la Phase 3.** `auth-sync.js` §`reloadEngine()`
> (l.191–202) itère `ENGINE_MODULES` et lit `window[name]`. Ces huit lectures
> renvoient `undefined` : **la fonction est un no-op silencieux**, y compris sur
> les quatre chemins qui l'appellent (l.306, 327, 437, 510). Effet : au
> changement d'identité, le stockage bascule correctement d'espace de noms mais
> **le moteur conserve en mémoire les données du compte précédent** jusqu'au
> rechargement de la page. Le `try/catch` par module masque l'absence de tout
> effet.
> *Méthode de vérification* : sémantique ES démontrée sous `vm` (Node partage
> l'implémentation de l'environnement lexical global avec les navigateurs), et
> corroborée par le commentaire de `tests/harness.js` l.14-15 qui documente
> précisément ce comportement. **Non rejoué dans un vrai navigateur** : aucun
> binaire Chromium n'est installé dans cet environnement (`npx playwright
> install chromium` échoue). À confirmer en navigateur avant correction.

### 2.2 Classe A et Classe B

| | **Classe A** — script injecté avant le moteur | **Classe B** — module appendé à la fin du script du moteur |
|---|---|---|
| Emplacement | nouveau `<script>` avant l.2222 | à l'intérieur du `<script>` du moteur, avant `</script>` l.16410 |
| Voit | `window.*`, DOM, événements | **toute la portée lexicale du moteur** |
| S'exécute | avant `load()` | après les définitions, **avant `DOMContentLoaded → App.init`** (l.8481) |
| Usage | Phase 3 (identité, stockage) | **Phase 4 (compétences, SRS, sélecteur, ranges)** |
| Coût sur `build.js` de la Phase 3 | ajoute des `<script>` → **casse l'heuristique `marks[1]`** | n'ajoute aucun `<script>` → **transparente** |

Le point décisif : `const X = {…}` **interdit la réaffectation de la liaison,
pas la mutation de l'objet**. Et aucun module du moteur n'est gelé.

### 2.3 Preuves d'exécution

Module Phase 4 appendé à la fin du script du moteur, 250 mains jouées :

```
modules gelés dans le moteur   : false      (Progress, Ranges, MODES, RangeModel, Spot, App)
MODES après ajout Phase 4      : 14         (13 d'origine + 1)
Progress.record intercepté     : 250 / 250
Spot.generate intercepté       : 260 appels
RangeModel.prior intercepté    : 100 %
  dont range 3bet CO>BTN posée : oui, puis Ranges.THREEBET restauré à l'identique
```

`awk 'NR>2222 && /Object\.freeze|Object\.seal|writable: *false/'` sur le moteur :
**aucun résultat**. (Les 1 occurrences de `Object.freeze` du fichier sont dans
Chart.js, l.42.)

**La Classe B est donc un mécanisme d'extension réel, vérifié, et qui ne
modifie pas une ligne du moteur.**

### 2.4 Le modèle de maîtrise existant est structurellement mort

`Player.recordMastery(key, ok)` (l.6143) est appelé en un seul endroit,
`App.choose` l.7289 :

```js
const wasOk = a.verdict !== "erreur";
for (const tag of (entry.tags || [])) {
  if (tag.startsWith("leak:")) Player.recordMastery(tag.slice(5), wasOk);
}
```

Le commentaire au-dessus dit « (réussie ou non) ». Mais `Progress.tags()`
l.4682 contient `const wrong = a.verdict === "erreur"; if (!wrong) return tags;`
— **les tags `leak:*` ne sont émis que sur erreur**. Donc `wasOk` vaut
*toujours* `false` quand un tag `leak:` est présent.

Mesuré sur 600 décisions réelles :

```
décisions correctes/acceptables : 461 — dont avec tag leak: :   0
décisions erreur                : 139 — dont avec tag leak: :  17
Player.mastery après 600 décisions : total « ok » cumulé = 0
tier maximal atteignable : 1 (« En apprentissage ») — jamais au-delà
```

Deux défauts cumulés :
1. `mastery[k].ok` ne peut jamais s'incrémenter → `rate = 0` → les paliers
   *Familier*, *Solide*, *Maîtrisé* sont **inatteignables par construction**.
2. Seules **17 décisions sur 600 (2,8 %)** alimentent la maîtrise, faute de
   couverture du vocabulaire de tags.

`App.masteryPanel()` (l.8193) affiche donc une échelle à cinq paliers dont
quatre sont hors d'atteinte. **Le mastery score de la Phase 4 ne peut pas
s'appuyer sur cette base ; il doit d'abord réparer le flux d'attribution.**

---

## 3. Où vit chaque brique de la Phase 4

Six modules, tous en **Classe B**, tous appendés à la fin du script du moteur,
dans cet ordre (le suivant dépend du précédent) :

```
[moteur inchangé — l.2222 à 16409]
├─ p4-taxonomy.js     contenu   — vocabulaire unifié compétences ⇄ fuites
├─ p4-content.js      contenu   — ranges déclinées, parcours (données pures)
├─ p4-observer.js     état      — enveloppe Progress.record → flux d'événements
├─ p4-mastery.js      état      — score de maîtrise par compétence
├─ p4-scheduler.js    état      — répétition espacée (échéances)
├─ p4-selector.js     moteur*   — sélection d'exercice (enveloppe Spot.generate)
└─ p4-ui.js           vue       — panneaux, greffés sur App.render*
[fin du <script> — l.16410]
```
\* « moteur » au sens *logique de décision*, pas au sens DF-B : le moteur DF-B
n'est ni lu ni modifié, seulement appelé.

### 3.1 Modèle de compétences → `p4-taxonomy.js` + `p4-mastery.js`

**Où** : `p4-taxonomy.js` déclare le référentiel ; `p4-mastery.js` calcule.

**Comment ça se branche, sans toucher au moteur** :

```js
// p4-mastery.js — s'abonne au flux, ne remplace rien du moteur
P4.bus.on("decision", ({ t, a, decision, entry }) => {
  for (const skillId of P4.taxonomy.skillsOf(t, a, decision)) {
    P4.mastery.observe(skillId, a.verdict !== "erreur", a.lossBB);
  }
});
```

`P4.taxonomy.skillsOf()` **remplace** la dérivation cassée de la §2.4 : elle
attribue une compétence à **chaque** décision (pas seulement aux erreurs), à
partir de `t.street`, `t.hero.pos`, `t.raisesThisStreet`, `a.best.action`.

**Ce qui n'est PAS touché** : `Progress.tags()`, `Progress.record()`,
`Player.recordMastery()` restent tels quels. `Player.mastery` reste alimenté
comme avant (donc toujours cassé) — **et c'est un choix** : le réparer *dans* le
moteur violerait le gel. `p4-ui.js` remplacera `App.masteryPanel` par une vue
lisant `P4.mastery`, et l'ancien champ deviendra du legacy inerte.

**Granularité recommandée** : `street × position × potType`, soit 4×6×2 = 48
cellules. *Dérivé* (pas mesuré) : avec la distribution de rues du contexte
partagé (préflop 30 / flop 23 / turn 24 / river 23) et la distribution de
positions mesurée ici en préflop (SB 26 %, BB 21 %, BTN 21 %, CO 15 %, HJ 10 %,
UTG 6 %), la cellule la plus rare (`river × UTG`) reçoit ≈ 1,4 % des décisions
— soit ≈ 42 observations au plafond de 3 000 décisions. **48 cellules est le
maximum soutenable** ; 4×6×2×(profil) serait invivable.

### 3.2 Mastery score → `p4-mastery.js`

**Où** : module dédié. **Réutiliser `Rating.skillScore(perf, volume, volumeForFull)`**
(l.6247) plutôt que d'en écrire un second : il implémente déjà exactement le
bridage par confiance de volume dont la Phase 4 a besoin (`perf × (0,35 + 0,65 ×
min(1, volume/plein))`). L'appeler depuis la Classe B est trivial.

**Comment ça se branche** : lecture seule sur `Rating`, écriture dans son propre
espace d'état (§5.2). `Rating.compute()` reste la source du Poker Rating global ;
`P4.mastery` est la vue fine par compétence. Deux échelles, deux usages, aucune
duplication de formule.

### 3.3 Répétition espacée → `p4-scheduler.js`

**Où** : module dédié, **sans aucun contact avec le moteur**. Il ne connaît que
la taxonomie et l'horloge.

**Comment ça se branche** : il n'intercepte rien. Il expose
`P4.scheduler.due(now)` → liste ordonnée de `skillId`, et
`P4.scheduler.review(skillId, ok, ts)` appelé par `p4-mastery.js`. C'est
`p4-selector.js` qui le consulte.

Cette absence de couplage est délibérée : l'algorithme de répétition espacée est
la brique la plus susceptible d'être remplacée. Il doit rester une fonction pure
`(état, résultat, temps) → nouvel état`, testable sous Node sans le moteur.

### 3.4 Sélecteur d'exercices adaptatif → `p4-selector.js`

**Où** : enveloppe de `Spot.generate`. **Pas** une réécriture de `App.newHand()`.

**Comment ça se branche** :

```js
const __gen = Spot.generate;
Spot.generate = function (opt) {
  const enriched = P4.selector.enrich(opt);   // n'ajoute que des champs cfg existants
  return __gen.call(this, enriched);
};
```

`enrich()` ne fabrique **aucun** champ nouveau : il ne pose que des clés que
`Spot.generate` sait déjà lire — `mode`, `forcePos`, `stackRange`, `level`,
`facing`, `force3Bet`. Le moteur reçoit une config ordinaire.

**Pourquoi cette couture et pas `App.newHand`** : les quatre branches de
`newHand()` (défi, drill, session, cible) convergent toutes vers
`Spot.generate(cfg)` — mesuré : 260 appels pour 250 mains, boucle de retry
comprise. Envelopper `Spot.generate` couvre les quatre branches d'un coup ;
envelopper `newHand` obligerait à réimplémenter les quatre.

**Garde-fou obligatoire** : `enrich()` doit être **neutre par défaut**. Un
sélecteur qui modifie la config du Studio (`t._studio`), du défi du jour ou d'un
drill explicite casserait des fonctions existantes. Il ne s'active que si
`opt.mode === "p4_adaptatif"` ou si l'appelant l'a marqué.

### 3.5 Ranges déclinées par position → `p4-content.js` (données) + `p4-ranges.js` (branchement)

Deux cas distincts, à ne pas confondre :

**Cas 1 — `OPEN` / `BB_DEF` (déjà déclinées, 5 positions).**
Aucun code. Étendre ou corriger le contenu se fait en **fusionnant dans l'objet
existant**, lu à chaud par ses 5 consommateurs :
```js
Object.assign(Ranges.OPEN, P4.content.ranges.OPEN);   // propagation immédiate, 0 modification
```

**Cas 2 — `THREEBET` / `FOURBET` (globales — le trou identifié).**
Mesuré : ces deux champs ont **un seul consommateur**, `RangeModel.prior()`
l.8880–8890. Ils ne sont **jamais lus par le moteur de jeu** (`Spot`, `Judge`,
`AI` n'utilisent que `Ranges.OPEN`). **Le trou 3bet/4bet n'affecte donc que le
Range Detective, pas le jeu à la table** — information à remonter à l'agent C :
le périmètre du correctif est bien plus étroit qu'il n'y paraît.

Branchement, prouvé en §2.3 :
```js
const __prior = RangeModel.prior;
RangeModel.prior = function (spot) {
  const over = P4.content.threebet(spot.preflopAggressor, spot.villainPos, spot.potType);
  if (!over) return __prior.call(this, spot);
  const saved = Ranges.THREEBET;
  Ranges.THREEBET = over;
  try { return __prior.call(this, spot); } finally { Ranges.THREEBET = saved; }
};
```
La substitution est **portée et restaurée dans un `finally`** : le moteur ne voit
jamais un `Ranges` dans un état intermédiaire, y compris si `prior()` lève.

### 3.6 Parcours de fuites → `p4-content.js` (données) + `p4-selector.js` (exécution)

**Où** : le parcours est **du contenu**, pas du code — une séquence d'étapes,
chacune étant une compétence + un critère de sortie. Son exécution est déjà
supportée par le moteur : `App.drillRun` (l.8331) sait dérouler N spots ciblés
avec compteur et rapport, et `Feutre.drillConfig(id)` est déjà le pont
jeu ↔ tracker (l.8328).

**Comment ça se branche** : un parcours produit, étape après étape, un
`App.drillRun` — mécanisme existant, aucune écriture dans le moteur. Le seul
ajout est la persistance de l'étape courante, dans l'état Phase 4 (§5.2).

---

## 4. Abstractions minimales

Règle appliquée : **au moins deux usages concrets déjà identifiés, sinon
l'abstraction est refusée.** Quatre retenues, quatre refusées.

### Retenues

| # | Abstraction | Surface | Usage 1 | Usage 2 | Usage 3 |
|---|---|---|---|---|---|
| **A1** | `P4.bus` — bus d'événements | `on(evt, fn)`, `emit(evt, payload)`. Une seule enveloppe de `Progress.record` alimente tous les abonnés. | `p4-mastery` observe chaque décision | `p4-scheduler` planifie la prochaine échéance | `p4-selector` mesure si l'exercice proposé a porté |
| **A2** | `P4.taxonomy` — vocabulaire unique | `skillsOf(t, a, decision) → [skillId]`, `leakToSkill(leakKey)`, `label(skillId)` | attribution du mastery (§3.1) | réconciliation des **deux** taxonomies de fuites (10 côté jeu / 29 côté tracker, §1.3) | ciblage du sélecteur et des parcours |
| **A3** | `P4.state` — un espace d'état unique | `get(ns)`, `set(ns, v)`, `flush()`. Sérialise **dans une clé existante** (§5.2). | mastery par compétence | échéances de répétition espacée | étape courante des parcours |
| **A4** | `P4.content` — registre de contenu | `register(kind, data)`, `get(kind)`. Fusionne au chargement, valide la forme. | ranges (`OPEN`, `THREEBET` par couple) | compétences | parcours de fuites |

**A1 est justifiée par la parcimonie autant que par la réutilisation** : sans
elle, trois modules envelopperaient `Progress.record` séparément, empilant trois
niveaux d'indirection sur le chemin le plus chaud du produit. Avec elle, il y a
**exactement une** enveloppe sur le moteur.

### Refusées, et pourquoi

| Abstraction tentante | Refus |
|---|---|
| Un « adaptateur de moteur » (`P4.engine.generate/judge/record`) | Une façade sur un moteur gelé n'a qu'un implémenteur. Elle ajoute une couche pour zéro variation. On appelle `Spot`/`Judge` directement. |
| Un moteur de règles générique pour la taxonomie | Un seul consommateur (`skillsOf`). Une fonction de 40 lignes suffit. Un DSL de règles est le mécanisme qui a produit les deux taxonomies divergentes de §1.3. |
| Un système de plugins / registre de modules | Les modules Phase 4 sont six, connus, ordonnés à la compilation. Un registre dynamique n'a aucun second usage. |
| Une couche de persistance Phase 4 | **Elle existe déjà** : la Phase 3 en a construit une, unique et auditée. En ajouter une seconde recrée exactement le problème que la Phase 3 a résolu (§8.1). |

---

## 5. Contenu extensible sans toucher au code

### 5.1 Format

**JSON pur, un fichier par nature**, sous `PHASE4_DEEP_LEARNING/content/`.
JSON et non JS : un fichier de contenu ne doit pas pouvoir exécuter de code —
c'est aussi ce qui permet de le valider en CI et de conserver `script-src` sans
origine externe.

```
PHASE4_DEEP_LEARNING/content/
  skills.json     — référentiel de compétences
  ranges.json     — ranges, y compris déclinées par couple de positions
  paths.json      — parcours de fuites
```

**`ranges.json`** — reprend exactement la syntaxe déjà acceptée par
`Ranges.parse()` / `Ranges.expand()` (`77`, `AKs`, `TT+`, `A5s+`, `T9s-65s`,
`A2s-AJs`). Aucune nouvelle grammaire à écrire ni à tester.

```json
{
  "schema": "herolab.ranges/1",
  "OPEN":   { "UTG": "…", "HJ": "…" },
  "BB_DEF": { "UTG": "…" },
  "THREEBET_BY_PAIR": {
    "BTN>CO": { "value": "QQ+, AKs, AKo", "bluff": "A5s, A4s",
                "source": "<référence documentée — obligatoire>" }
  },
  "FOURBET_BY_PAIR": { "CO>BTN": { "value": "…", "bluff": "…", "source": "…" } }
}
```

La clé `"BTN>CO"` se lit *« le 3betteur est BTN, l'ouvreur est CO »*. Elle est
dérivable à l'exécution : `RangeModel.prior` reçoit déjà `spot.villainPos`,
`spot.heroPos`, `spot.preflopAggressor` et `spot.potType`.

Le champ **`source` est obligatoire et vérifié par le build** : contrainte n° 2
du contexte partagé (« ne jamais inventer de théorie poker »). Une range sans
source fait **échouer la compilation**, comme `service_role` fait échouer le
build de la Phase 3. C'est le seul moyen de rendre cette règle exécutable au
lieu de déclarative.

**`skills.json`** — le référentiel qui réconcilie les deux vocabulaires de §1.3 :

```json
{
  "schema": "herolab.skills/1",
  "skills": [
    { "id": "pf.bb.defend", "label": "Défense de grosse blinde",
      "match": { "street": "preflop", "pos": "BB", "facing": true },
      "legacy": { "leakInfo": ["bb-underdefend", "bb-overdefend"],
                  "leakPlain": ["bb-underdefend", "bb-overdefend"] },
      "drill": { "mode": "preflop", "forcePos": "BB", "facing": true },
      "volumeForFull": 120 }
  ]
}
```

Le bloc `legacy` est ce qui rend la migration possible **sans rien casser** : il
mappe les 10 clés `LEAK_INFO` et les 29 clés `LEAK_PLAIN` sur un identifiant
unique. Le bloc `drill` remplace la map inline de `Progress.focusFor()` **et**
`LEAK_DRILL`, en un seul endroit.

**`paths.json`** — un parcours est une liste d'étapes, chacune convertible en
`App.drillRun` :

```json
{ "schema": "herolab.paths/1",
  "paths": [ { "id": "path.bb", "label": "…",
    "steps": [ { "skill": "pf.bb.defend", "spots": 10, "passRate": 0.7 } ] } ] }
```

### 5.2 Chargement — et où l'état atterrit

**Chargement du contenu** : le contenu est **compilé dans l'artefact** au build
(§6), pas chargé par `fetch`. Trois raisons contraignantes :
la CSP `default-src 'none'` ne permet aucune requête ;
le produit doit rester un fichier unique livrable ;
le fichier s'ouvre en `file://`, où `fetch` échoue.

Le build sérialise chaque JSON dans `p4-content.js` et `P4.content` le fusionne
au démarrage. **Étendre le contenu = éditer un JSON + relancer le build. Zéro
ligne de code.**

**Persistance de l'état** — la contrainte forte, détaillée en §8.1 :

> **L'état de la Phase 4 s'écrit dans `pivot.player.v1`, sous une racine `p4`.
> Aucune clé `localStorage` nouvelle n'est créée.**

```js
// p4-state.js — écrit à travers Player, donc à travers l'adaptateur Phase 3
P4.state = {
  root() { Player.load(); return (Player.data.p4 = Player.data.p4 || {}); },
  get(ns) { return this.root()[ns]; },
  set(ns, v) { this.root()[ns] = v; Player.save(); }
};
```

`Player.blank()` copie les clés manquantes au chargement (l.6091) et
`Player.importAll` conserve les champs qu'il reconnaît. Une racine `p4` inconnue
d'`importAll` serait **perdue à l'import** : `p4-state.js` doit donc aussi
envelopper `Player.importAll` pour la préserver — une enveloppe, en Classe B.

`pivot.player.v1` est le bon porteur : il est déjà dans `APP_KEYS` **et** dans
`DOC_OF_KEY` de la Phase 3, il est petit (quelques Ko), et il porte déjà
`mastery` — la même nature de donnée.

---

## 6. Chaîne de build

### 6.1 Faut-il généraliser `build.js` ? Oui, mais très peu.

Le `build.js` de la Phase 3 fait trois choses bien : il **refuse de produire un
artefact dangereux** (`service_role`, SHA256 du SDK, `eval`), il **resserre la
CSP**, il **injecte à un point repéré**. Le modèle est bon. Le généraliser
intégralement serait sur-ingénieré : les deux phases n'injectent pas la même
classe de code (§2.2) et n'ont pas les mêmes garde-fous.

**Proposition : deux builds qui se chaînent, pas un build unifié.**

```
VERSION_PRODUCTION/herolab.html                      (base gelée, jamais modifiée)
        │
        ▼  node PHASE4_DEEP_LEARNING/build.js
   ─────────────────────────────────────────────────────────────
   · valide les JSON de contenu (schéma + `source` obligatoire)
   · concatène p4-*.js et les sérialise en fin de <script> moteur
   · N'AJOUTE AUCUNE BALISE <script>            ← invariant capital
   ─────────────────────────────────────────────────────────────
        │
        ▼  build/herolab-p4.html      ← livrable autonome, hors ligne, sans compte
        │
        ▼  node PHASE3_AUTH_SECURED/build.js --in build/herolab-p4.html
   ─────────────────────────────────────────────────────────────
   · CSP + SDK Supabase + config + auth-sync + auth-ui
   ─────────────────────────────────────────────────────────────
        │
        ▼  build/herolab-p4-auth.html   ← livrable complet
```

**Le seul changement requis dans la Phase 3** : `build.js` code en dur
`BASE = VERSION_PRODUCTION/herolab.html` (l.18). Il lui faut un argument `--in`,
symétrique du `--out` existant. C'est **trois lignes**, et rien d'autre.

**L'invariant qui rend le chaînage sûr** : la Phase 3 localise le moteur par
`marks[1]`, l'index du **second** `<script>` (l.80–85). Si la Phase 4 injectait
ses propres balises `<script>`, `marks[1]` désignerait un module Phase 4 et la
couche d'identité s'installerait **après** le moteur — l'adaptateur de stockage
arriverait trop tard, après le premier `load()`. **La Classe B élimine ce risque
par construction** : elle ne crée aucune balise, le compte reste à 2, et le
build de la Phase 3 fonctionne à l'identique.

### 6.2 Point d'injection Phase 4, et garde-fous

Point d'injection : la **fin du contenu** du `<script>` identifié par
`m[1].includes('const RANKS = "23456789TJQKA"')` — exactement la signature déjà
utilisée par `tests/harness.js` l.103 et robuste à toute injection Phase 3
antérieure.

Garde-fous à faire échouer le build, sur le modèle Phase 3 :

| Contrôle | Motif |
|---|---|
| Le script du moteur est trouvé par sa signature `RANKS` | sinon injection à l'aveugle |
| **Le nombre de `<script>` de l'artefact est inchangé** | protège `marks[1]` de la Phase 3 (§6.1) |
| Aucun `p4-*.js` ne contient `localStorage.` en dur | §8.1 — l'état passe par `P4.state` |
| Aucun `p4-*.js` ne contient `\bnew Function\b|\beval\s*\(` | conserve la CSP |
| Chaque range de `ranges.json` porte un `source` non vide | contrainte n° 2 du contexte partagé |
| Chaque `legacy.leakInfo` / `legacy.leakPlain` cité existe dans la base | interdit les taxonomies orphelines |
| **La taille de l'artefact ≤ budget (§7)** | le budget n'est tenu que s'il est vérifié |
| `node tests/regression.js build/herolab-p4.html` → 79 PASS | contrainte n° 4 |
| `node tests/browser.js build/herolab-p4.html` → 37 PASS | contrainte n° 4 |

Les deux suites existantes acceptent déjà une cible en argument
(`tests/browser.js` l.12, `regression.js` idem) : **elles s'exécutent telles
quelles sur l'artefact Phase 4**, sans modification. C'est la meilleure garantie
de non-régression disponible, et elle est gratuite.

---

## 7. Budget de taille et de performance

### 7.1 D'où vient réellement le poids

| Poste | Taille | Part |
|---|---|---|
| Fontes base64 | **521 Ko** | 34,4 % |
| Chart.js | 200 Ko | 13,2 % |
| Moteur JS | 665 Ko | 43,9 % |
| CSS | 119 Ko | 7,8 % |
| **Total** | **1 513 Ko** | |
| gzip -9 | 675 Ko | |
| brotli | **615 Ko** | |

La moitié du fichier (721 Ko) est de l'actif tiers embarqué, pas du code
HeroLab. À titre de comparaison, la Phase 3 ajoute **245 Ko** (1 513 → 1 758 Ko),
essentiellement le SDK Supabase.

### 7.2 Budget proposé

| | Budget | Justification |
|---|---|---|
| Code Phase 4 (`p4-*.js`) | **≤ 80 Ko** non minifié | 6 modules ≈ 13 Ko chacun. Le module de stockage de la Phase 3 fait 22 Ko pour un périmètre comparable. |
| Contenu compilé (3 JSON) | **≤ 40 Ko** | `LEAK_PLAIN` + `LEAK_DRILL` + `LEAK_COST` + `LEAK_FAMILIES` pèsent déjà ≈ 20 Ko pour 29 fuites. 40 Ko couvre 48 compétences, les ranges par couple et les parcours. |
| **Total Phase 4** | **≤ 120 Ko (+ 7,9 %)** | Vérifié par le build (§6.2), sans quoi le budget n'est pas un budget. |
| Artefact Phase 4 | ≤ 1 633 Ko | |
| Artefact Phase 4 + Phase 3 | ≤ 1 878 Ko | |

**Comment le tenir** — par ordre de rendement décroissant, et **aucun de ces
gains n'est nécessaire pour rester dans le budget** ; ils sont listés parce
qu'ils sont disponibles si le budget se tend :

1. **Sous-ensembler les fontes.** 521 Ko pour une interface française :
   un sous-ensemble latin-1 des trois familles diviserait ce poste par 3–4
   (≈ 350 Ko économisés — **3× le budget total de la Phase 4**).
2. **Servir en brotli.** 1 513 → 615 Ko sur le réseau, sans toucher au fichier.
   Le `netlify.toml` de la Phase 3 est le bon endroit.
3. **Pas de minification.** Elle rendrait l'artefact invérifiable et casserait
   la signature `RANKS` sur laquelle reposent le harness *et* les deux builds.
   Le gain ne vaut pas la perte d'auditabilité.

### 7.3 Performance — le risque n'est pas le CPU

Mesuré sur l'état de progression, en faisant varier le nombre de décisions :

| Décisions | `pivot.v1` | `Progress.save()` | `Progress.summary()` |
|---|---|---|---|
| 500 | 103 Ko | 0,39 ms | 1,78 ms |
| 1 500 | 309 Ko | 1,00 ms | 1,17 ms |
| **3 000** (plafond) | **618 Ko** | **1,88 ms** | **2,34 ms** |

Coût unitaire mesuré : **199 octets par décision**, **43,7 ms par décision** pour
la chaîne complète (génération + jugement + enregistrement + écriture) — dominée
par `Spot.generate` et `Judge.evaluate`, pas par la persistance.

**Conclusions :**

- Le CPU n'est pas menacé. `save()` reste sous 2 ms au plafond. Le budget de la
  Phase 4 sur le chemin chaud est de **≤ 5 ms par décision** (≈ 11 % du coût
  existant) : l'enveloppe unique de `Progress.record` (A1) est essentielle pour
  le tenir, et un `flush()` différé sur `P4.state` évite un `JSON.stringify`
  supplémentaire à chaque décision.
- **Le volume de stockage, lui, est déjà tendu**, et c'est là que la Phase 4 doit
  se retenir : 618 Ko pour la seule progression, et `feutre.v1` (tracker) est
  **le seul module sans plafond** — `Store.save()` (l.14367) sérialise
  `Store.hands` en entier, sans `slice`, contrairement aux 7 autres modules qui
  bornent tous leur historique (3 000 / 600 / 500 / 500 / 200 / 120 / 120).
  Sous la Phase 3, ce volume est **dupliqué par compte** sur l'appareil.
  **L'état Phase 4 doit rester O(nombre de compétences) — soit ≈ 48 entrées, de
  l'ordre de 5 Ko — et jamais O(nombre de décisions).**

---

## 8. Compatibilité Phase 3 / Phase 4

### 8.0 Correction factuelle préalable

Le contexte partagé indique que la Phase 3 est « non fusionnée ici ». Vérifié :
`git merge-base claude/phase4-deep-learning claude/phase3-google-auth` =
`b9ea209` = **le sommet de `claude/phase3-google-auth`**. La branche Phase 4
**descend** de la Phase 3 ; `PHASE3_AUTH_SECURED/` est présent dans l'arbre de
travail et identique à la branche (`git diff --stat` vide).

**Il n'y aura donc pas de fusion d'arbres divergents.** Le seul problème réel est
la **composition des deux chaînes de build et des deux couches d'état** — ce qui
est plus facile, mais aussi moins visible.

### 8.1 Conflit n° 1 — la liste blanche gelée (**bloquant**)

`auth-sync.js` l.21–25 déclare `APP_KEYS` en `Object.freeze([…9 clés])`, et
`Store.isAppKey` l.70 est une **liste blanche stricte** :

```js
physical(k) { return Store.isAppKey(k) ? Identity.prefix + k : k; }
```

Le choix de la liste blanche est délibéré et bien argumenté (« une liste noire
laisserait passer toute clé future »). Mais il produit ceci : **toute clé
`localStorage` créée par la Phase 4 — `pivot.skills.v1`, `pivot.srs.v1`… —
n'est pas reconnue, donc :**

1. **Écrite sans préfixe d'identité.** Sur un appareil partagé, l'utilisateur B
   qui se connecte après A hérite du mastery, des échéances et des parcours de
   A. C'est **exactement la faille que `ARCHITECTURE.md` §2 présente comme « la
   plus grave de ce type d'architecture »** — la Phase 4 la rouvrirait par une
   porte que la Phase 3 n'a pas verrouillée.
2. **Absente de `DOC_OF_KEY`** (l.28–38) → **jamais synchronisée**. L'état
   Phase 4 est perdu au changement d'appareil, silencieusement.
3. **Non purgée à la déconnexion** (`Store.purge` itère `APP_KEYS`) → l'état
   reste lisible par le compte suivant.
4. **Absente de `Player.exportAll`** (l.6161) → perdue à l'export/import.

**Résolution (P0)** : §5.2 — l'état Phase 4 vit sous `Player.data.p4`, dans
`pivot.player.v1`, qui est déjà dans les quatre mécanismes. **Zéro modification
de la Phase 3.**

*Résolution alternative, si un jour l'état Phase 4 devient trop gros pour
`pivot.player.v1`* : ajouter `"pivot.p4.v1"` aux **quatre** endroits —
`APP_KEYS`, `DOC_OF_KEY`, la liste blanche `doc_key` SQL de `user_documents`
(`ARCHITECTURE.md` §3.2), et `Player.exportAll`/`importAll`. Trois de ces quatre
sont hors du fichier HTML, dont un en base de données. **N'y aller que
consciemment.**

### 8.2 Conflit n° 2 — `reloadEngine()` est inopérant (**latent, aggravé par la Phase 4**)

Détaillé en §2.1. Aujourd'hui l'effet est borné : au changement de compte, les
vues affichent les données du compte précédent jusqu'au rechargement. Avec la
Phase 4, l'état en mémoire porte en plus le mastery et les échéances — et le
sélecteur adaptatif **proposerait à B des exercices calculés sur les faiblesses
de A**, puis écrirait le résultat dans l'espace de B.

**Résolution** : la Classe B rend la correction triviale, sans toucher au moteur.
`p4-observer.js` publie les modules dans un registre dédié, et `auth-sync.js`
préfère ce registre :

```js
// p4-observer.js (Classe B — a accès à la portée lexicale)
window.HeroLabEngine = { Progress, Career, Player, HRStats, PRStats,
                         BLStats, Rating, Journey, App };
```
```js
// auth-sync.js — une ligne
const mod = (window.HeroLabEngine || window)[name];
```

Sans la Phase 4, cette correction exigerait de modifier le moteur gelé. **La
Phase 4 est donc ce qui rend la Phase 3 réparable** — argument à porter au
dossier de séquencement.

### 8.3 Conflit n° 3 — la synchronisation pousse des documents entiers

`Queue.markDirty()` est appelé à **chaque** `setItem` d'une clé applicative
(`auth-sync.js` l.83), avec un débounce de 2 500 ms, et `Sync.push()` envoie les
documents complets. Or `Progress.save()` est appelé à chaque décision, et
`pivot.v1` atteint **618 Ko** au plafond.

Ce n'est pas un défaut créé par la Phase 4, mais elle l'aggrave : le sélecteur
adaptatif et le SRS écrivent à chaque décision, eux aussi. **Écrire l'état
Phase 4 dans `pivot.player.v1` (quelques Ko) plutôt que dans `pivot.v1`
(618 Ko) réduit le volume poussé** — c'est un argument supplémentaire pour §5.2.
Sujet à traiter côté Phase 3 (synchronisation par document modifié plutôt que
globale) ; **hors périmètre Phase 4**, à signaler.

### 8.4 Conflit n° 4 — ordre d'injection et `marks[1]`

Détaillé en §6.1. Résolu par construction par la Classe B, **et vérifié par un
garde-fou du build** (§6.2) : le nombre de balises `<script>` doit rester
inchangé après le build Phase 4.

### 8.5 Non-conflits vérifiés

| Sujet | Statut |
|---|---|
| CSP | La Phase 4 n'ouvre aucune origine : contenu compilé, aucun `fetch`. `connect-src` reste celui de la Phase 3. |
| `service_role`, SHA256 du SDK | Garde-fous Phase 3 inchangés — la Phase 4 n'y touche pas. |
| Suites de tests | `regression.js` et `browser.js` acceptent une cible en argument et repèrent le moteur par la signature `RANKS`, robuste aux deux injections. |
| `netlify.toml` | Inchangé (`frame-ancestors 'none'`). |

---

## 9. Recommandation P0

**Une seule, et elle n'est pas négociable : l'état de la Phase 4 ne crée aucune
clé `localStorage`. Il vit sous `Player.data.p4`, dans `pivot.player.v1`.**

C'est la seule décision de cet audit qui soit **irréversible en pratique** :
toutes les autres (granularité des compétences, algorithme de répétition
espacée, format des parcours) se corrigent par une migration de données. Un
mauvais choix de clé, lui, se paie en fuite de données entre comptes sur
appareil partagé — la faille que la Phase 3 a été construite pour fermer — et
n'apparaît qu'en production, chez un utilisateur qui partage un ordinateur.

**Ce qui la rend applicable dès aujourd'hui** :

1. `pivot.player.v1` est déjà dans `APP_KEYS`, dans `DOC_OF_KEY`, dans la liste
   blanche `doc_key` SQL et dans `exportAll`/`importAll`. **Quatre mécanismes
   acquis, zéro modification de la Phase 3.**
2. Il est petit (quelques Ko contre 618 Ko pour `pivot.v1`) : la synchronisation
   par document entier de la Phase 3 (§8.3) reste supportable.
3. Il porte déjà `mastery` : même nature de donnée, même cycle de vie.
4. Le garde-fou est mécanisable immédiatement — le build refuse tout `p4-*.js`
   contenant `localStorage.` en dur (§6.2). La règle devient exécutable au lieu
   d'être une consigne.

**Séquencement recommandé** (chaque étape livre une valeur vérifiable) :

| P | Étape | Vérifiable par |
|---|---|---|
| **P0** | `p4-state.js` + garde-fou de build + enveloppe de `Player.importAll` | build refusé si `localStorage.` apparaît ; suites 79/37 vertes |
| **P0** | `p4-observer.js` : `P4.bus` + `window.HeroLabEngine` (répare aussi §8.2) | comptage des événements = nombre de décisions |
| **P1** | `p4-taxonomy.js` : réconcilie 10 + 29 clés de fuites | zéro clé orpheline, vérifié au build |
| **P1** | `p4-mastery.js` sur `Rating.skillScore` | > 0 succès enregistré — le contraire de la §2.4 |
| **P2** | `p4-content.js` + les trois JSON, `source` obligatoire | build refusé si une range n'a pas de source |
| **P2** | `p4-ranges.js` : `THREEBET`/`FOURBET` par couple | périmètre réel : **Range Detective seul** (§3.5) |
| **P3** | `p4-scheduler.js`, `p4-selector.js`, `p4-ui.js` | neutralité par défaut du sélecteur |

**Et une demande à porter à la Phase 3, seule modification requise chez elle :**
`build.js` doit accepter `--in`, symétrique du `--out` existant (trois lignes,
§6.1). Sans elle, les deux chaînes ne se composent pas.

---

## Annexe — méthode et limites

**Mesuré par exécution** (`tests/harness.js` sous `vm`) : découpage en octets et
compression ; 199 o/décision et 43,7 ms/décision sur 400 mains ; échelle
`save`/`summary` à 500/1 500/3 000 décisions ; stérilité de `Player.mastery` sur
600 décisions ; interception 250/250, 260 et 100 % par un module appendé ;
absence de `Object.freeze` dans le moteur ; `window.Progress === undefined` sous
`vm` ; distribution des positions en préflop.

**Dérivé, non mesuré** (signalé comme tel dans le texte) : le taux d'occupation
de la cellule la plus rare du référentiel de compétences (§3.1), obtenu en
croisant la distribution de rues du contexte partagé avec la distribution de
positions mesurée ici.

**Limites assumées :**

- **`reloadEngine()` n'a pas été rejoué dans un vrai navigateur.** Aucun binaire
  Chromium n'est disponible (`npx playwright install chromium` échoue dans cet
  environnement). La conclusion repose sur la sémantique ES de l'environnement
  lexical global, démontrée sous `vm`, et sur le commentaire de
  `tests/harness.js` l.14-15 qui documente le même comportement. **À confirmer
  en navigateur avant toute correction.**
- La mesure de 43,7 ms/décision porte sur une décision par main (première
  décision du héros), pas sur une main déroulée entièrement. Elle majore donc le
  coût de génération par décision et minore la diversité des rues — raison pour
  laquelle §3.1 s'appuie sur la distribution de rues du contexte partagé plutôt
  que sur une mesure propre.
- Aucun fichier applicatif n'a été modifié. Les preuves d'injection ont été
  produites sur une copie temporaire hors du dépôt.
