# Hero Lab — Audit forensic & architectural

Cible : `pivot-simulateur-cashgame-17.html` (15 429 lignes, 764 Ko, un seul bloc `<script>` à la ligne 2067).
Passe **lecture seule**. Aucun code modifié, aucun refactor.

Méthode : toutes les affirmations ci-dessous sont vérifiées par grep/AST-lite sur le fichier source, pas
déduites du graphe Graphify. Là où Graphify se trompe, c'est signalé explicitement.

**Contrainte structurelle majeure** : le fichier n'a ni modules ES, ni `import`, ni IIFE. Les 87 « modules »
sont des objets littéraux `const X = {…}` dans **une seule portée globale**. Il n'existe donc aucune
dépendance *déclarée* — seulement des références globales résolues à l'exécution. Rien n'empêche
mécaniquement un module d'en appeler un autre : tout le cloisonnement est conventionnel.

---

## 1. BoardTex — traçage exhaustif

### 1.1 Surface

| Propriété | Valeur |
|---|---|
| Déclaration | ligne 2381 |
| Taille | 114 lignes (2381–2494) |
| API publique | `analyse(board)` @2382, `madeHand(hole, board)` @2429 |
| Dépendances sortantes | `CAT`, `HandEval` — rien d'autre |
| `this.` interne | **aucun** |
| DOM / localStorage | **aucun** |

### 1.2 Qui écrit / modifie BoardTex

**Personne.** Recherche exhaustive des assignations (`BoardTex.x =`, `BoardTex[...]`, `BoardTex =`) sur
tout le fichier : **1 seul résultat, la déclaration ligne 2381**.

`BoardTex` est un **namespace de fonctions pures**. `analyse` construit et retourne un objet neuf à chaque
appel ; `madeHand` idem. Aucun état interne, aucun cache, aucune closure mutable. Conséquence directe :
**toutes les arêtes entrantes sont des lectures**, et il ne peut y avoir ni couplage temporel, ni ordre
d'initialisation, ni effet de bord partagé entre les appelants.

### 1.3 Les 22 sites d'appel

| # | Ligne | Module | Fonction | Appel | Pourquoi |
|---|---|---|---|---|---|
| 1 | 2921 | `AI` | `postflop@2916` | `madeHand(opp.hole, board)` | l'IA doit connaître sa propre main pour décider |
| 2 | 2922 | `AI` | `postflop@2916` | `analyse(board)` | pondère l'agression par la texture |
| 3 | 3474 | `Judge` | `evaluate@3452` | `madeHand(hero.hole, board)` | force de main du héros pour l'EV |
| 4 | 3475 | `Judge` | `evaluate@3452` | `analyse(board)` | texture pour le verdict |
| 5 | 4647 | `Session` | `recordHand@4626` | `madeHand(t.hero.hole, result.board)` | catégorise la main jouée pour les stats |
| 6 | 6503 | `App` | `renderPlay@6436` | `madeHand(hero.hole, t.board)` | **affichage** du nom de main |
| 7 | 7999 | `RangeModel` | `applyAction@7998` | `analyse(board)` | texture = likelihood bayésienne |
| 8 | 8003 | `RangeModel` | `applyAction@7998` | `madeHand(item.combo, board)` | force de chaque combo de la range |
| 9–11 | 8327–8329 | `HRSpot` | `buildLine@8315` | `madeHand` ×2, `analyse` | génère la ligne de jeu du spot |
| 12–13 | 8524–8525 | `HRScore` | `sameCategory@8519` | `madeHand(...).cat` ×2 | tolérance de notation par catégorie |
| 14 | 8577 | `HRLab` | `solve@8538` | `madeHand(c.combo, board)` | calcule la range solution |
| 15 | 8780 | `HRExplain` | `realHandComment@8777` | `madeHand(spot.realCombo, …)` | commentaire pédagogique |
| 16 | 8831 | `HRExplain` | `answerFeedback@8803` | `madeHand(spot.realCombo, …)` | feedback de réponse |
| 17 | 8844 | `HRExplain` | `labelMadeHand@8841` | `madeHand(combos[0], …)` | libellé de main |
| 18–19 | 10311–10312 | `PRSpot` | `playHand@10244` | `madeHand(vill.hole, board)`, `analyse` | simule la main du vilain |
| 20–21 | 11618–11619 | `BlockerEngine` | `categorize@11616` | `madeHand(combo, board)`, `analyse` | classe value/bluff/bluffcatch |
| 22 | 12008 | `BLSpot` | `bluffQuality@11985` | `madeHand(cards, board)` | qualité du bluff |

### 1.4 Le vrai graphe

L'arbre proposé comportait 7 branches. **Les 7 sont réelles et directes** — mais l'arbre est
**incomplet** : il y a 12 modules appelants, pas 7.

```
BoardTex  (pur, sans état, 2 méthodes)
├── App           REAL / directe / ACCIDENTELLE  ← seul appel de présentation
├── AI            REAL / directe / NÉCESSAIRE
├── Judge         REAL / directe / NÉCESSAIRE
├── Session       REAL / directe / NÉCESSAIRE
├── RangeModel    REAL / directe / NÉCESSAIRE
├── HRSpot        REAL / directe / NÉCESSAIRE
├── BlockerEngine REAL / directe / NÉCESSAIRE
│
│   ── manquants dans l'arbre proposé, tous REAL / directs ──
├── HRScore       REAL / directe / NÉCESSAIRE
├── HRLab         REAL / directe / NÉCESSAIRE
├── HRExplain     REAL / directe / NÉCESSAIRE  (3 sites)
├── PRSpot        REAL / directe / NÉCESSAIRE
└── BLSpot        REAL / directe / NÉCESSAIRE
```

**Aucun FALSE POSITIVE, aucune dépendance INDIRECTE.** Les 22 sites sont des appels littéraux
`BoardTex.méthode(...)`, sans indirection, sans alias, sans passage par variable.

### 1.5 Nécessaire vs accidentel

11 des 12 appelants sont **nécessaires** : ils ont tous besoin de la même primitive — « que vaut cette
main sur ce board ? ». C'est la définition d'une brique de moteur correctement partagée.

**Une seule dépendance est accidentelle** : `App.renderPlay@6503`. C'est le seul site où `BoardTex` est
appelé depuis la couche de rendu, pour afficher un libellé. Le calcul y est refait alors que `Judge`
l'a déjà effectué sur la même main au même tour (`Judge.evaluate@3474`). Ce n'est pas un bug — la
fonction est pure, le recalcul est idempotent — mais c'est une fuite du moteur dans la vue.

**Verdict sur « BoardTex est le point de couplage le plus large »** : structurellement vrai (12 appelants,
le plus haut fan-in après `UI`/`Ranges`), mais **ce n'est pas une dette**. Un module pur, sans état, à
2 méthodes, largement appelé, est un *bon* hub. Le fan-in élevé mesure ici la réutilisation, pas
l'enchevêtrement. Aucune action requise.

---

## 2. App — analyse God Object

### 2.1 Métriques

| Métrique | Valeur |
|---|---|
| Étendue | 5685–7548, **1 864 lignes** (12 % du fichier) |
| Méthodes de premier niveau | **64** |
| Champs d'état | **19** (10 déclarés + 9 greffés à l'exécution) |
| Modules distincts appelés | **25** |
| Modules appelants | **5** (`CareerUI` 13, `HRUI` 2, `PRUI` 2, `BLUI` 2, `V` 1) |
| Références `App.` totales | 363 — dont **343 internes**, 20 externes |
| Écritures DOM | **49** |
| Handlers inline générés | **58** |

### 2.2 Verdict : GOD OBJECT confirmé

Les cinq marqueurs classiques sont tous présents.

**a) Responsabilités multiples et hétérogènes.** Les 64 méthodes couvrent au moins 9 domaines
disjoints : routage (`go`, `render`, `view`), onboarding (`renderOnboarding`, `obPickAvatar`,
`obPickMentor`, `obValidate`, `finishOnboarding`), profil (`renderProfile`, `saveProfile`,
`profPickAvatar`), import/export (`doExport`, `triggerImport`, `handleImport`, `exportData`,
`exportCareer`, `resetData`, `resetCareer`, `confirmWipe`), boucle de jeu (`newHand`, `choose`,
`continueHand`), rendu de table (`renderPlay`, `renderActions`, `bindSlider`, `renderReview`,
`renderResult`), défi quotidien (`renderDaily`, `dailyVerdict`, `startDaily`), session/drill
(`startSession`, `drillLeak`, `endDrill`, `endSession`, `trainLeak`, `trainSpecificLeak`), et
progression (`renderStats`, `renderLeaks`, `renderJourney`, `journeyMissions`, `journeyMastery`,
`journeyTimeline`, `masteryPanel`).

**b) Fan-out extrême, fan-in faible.** 25 modules sortants contre 5 entrants : `App` connaît presque
tout le système, presque personne ne le connaît. C'est la signature d'un orchestrateur qui a absorbé
la logique au lieu de la déléguer. La betweenness de 0,559 relevée par Graphify est confirmée
structurellement : `App` relie 7 des 8 communautés.

**c) État mutable partagé et greffé.** 9 des 19 champs n'existent pas dans le littéral et
apparaissent en cours d'exécution : `dailyRun` (@6245, @6407, @7414), `drillRun` (@7408, @7422),
`focusLeak` (@7265, @7302), `focusNote` (@6262, @6294, @6297, @6320), `sessionComplete` (@6426,
@7396, @7444), `_mentorRewarded` (@6348, @6647), `_obAvatar`, `_obMentor`, `_profAvatar`. La forme
réelle de `App` n'est donc lisible nulle part — il faut exécuter le programme pour la connaître.

**d) Méthodes surdimensionnées.** `renderReview` 186 lignes, `renderPlay` 144, `renderHome` 98,
`newHand` 92, `renderStats` 78, `renderSetup` 77.

**e) Couplage vue/logique.** 49 écritures DOM et 58 handlers `onclick="App.x()"` générés dans des
chaînes. Le routage, l'état et le rendu sont dans le même objet, ce qui rend `App` non testable sans
navigateur — à l'exact opposé du moteur, vérifié pur (§5.1).

### 2.3 Ce que App possède réellement

- **État de vue** : `view`, `phase` — routage et machine à états.
- **État de main courante** : `t` (table), `analysis`, `lastDecision`, `result`, `_mentorRewarded`.
- **État de session** : `session`, `sessionReport`, `sessionComplete`, `dailyRun`, `drillRun`,
  `focusLeak`, `focusNote`.
- **Configuration** : `cfg` (mode, niveau, stake, profils), `TITLES`.
- **Brouillons d'UI** : `_obAvatar`, `_obMentor`, `_profAvatar`.

### 2.4 Parties extractibles (par valeur décroissante)

| # | Extraction | Méthodes | ~Lignes | Justification |
|---|---|---|---|---|
| 1 | **`Onboarding`** | `renderOnboarding`, `obPickAvatar`, `obPickMentor`, `obValidate`, `finishOnboarding` + `_obAvatar`, `_obMentor` | ~70 | flux fermé, joué une fois, zéro lien avec la boucle de jeu |
| 2 | **`DataPort`** (import/export/reset) | `doExport`, `triggerImport`, `handleImport`, `confirmWipe`, `exportData`, `resetData`, `exportCareer`, `resetCareer` | ~75 | pure I/O sérialisation ; n'a besoin que des clés `KEY` |
| 3 | **`ProfileUI`** | `renderProfile`, `profPickAvatar`, `profPickMentor`, `saveProfile` + `_profAvatar` | ~70 | ne touche que `Player` |
| 4 | **`JourneyUI`** | `renderJourney`, `journeyHeadline`, `journeyMissions`, `journeyMastery`, `journeyTimeline`, `masteryPanel`, `trainLeak`, `trainSpecificLeak` | ~190 | miroir exact de `CareerUI`, déjà externalisé — l'asymétrie est arbitraire |
| 5 | **`DailyUI`** | `renderDaily`, `dailyVerdict`, `startDaily` + `dailyRun` | ~60 | mode autonome |
| 6 | **`SessionCtl`** | `startSession`, `endSession`, `drillLeak`, `endDrill`, `closeReport`, `promote` + `session`, `sessionReport`, `sessionComplete`, `drillRun` | ~70 | logique de session, pas de rendu |

Le précédent est déjà dans le code : `CareerUI` (378 lignes) a été sorti de `App` et l'appelle en
retour 13 fois. Les six blocs ci-dessus suivraient le même patron et retireraient ~535 lignes (29 %)
sans toucher à la boucle de jeu (`newHand`/`choose`/`continueHand`/`renderPlay`/`renderReview`), qui
est le cœur légitime de `App`.

---

## 3. Les trois relations ambiguës

### 3.1 `Career → LEVELS` — **RÉFUTÉE (FALSE POSITIVE)**

`Career` occupe 4779–5040. Recherche de `LEVELS` dans cet intervalle : **zéro occurrence.**

`LEVELS` (déclaré @3075) n'a que 6 usages réels, dans exactement 2 modules :
`Spot@3210` (sélection du pool de vilains) et `App` (@5779, @6462, @6902, @6905, @6955 — affichage).
`Career` ne le lit jamais, ni directement ni via alias.

Origine probable de l'erreur : `Career` et `LEVELS` partagent le vocabulaire de la progression
(« niveau »), et `App` les manipule dans des vues voisines. Graphify a inféré une relation sémantique
là où il n'y a qu'une cooccurrence lexicale — ce qui est exactement ce que le tag AMBIGUOUS doit
signaler.

### 3.2 `Rating → BLStats` — **CONFIRMÉE, mais mal typée**

Réelle et directe : `Rating.skills()` @5418 appelle `BLStats.summary()` **@5422**.

```js
skills() {
  const pr = Progress.summary();   // @5419
  const hr = HRStats.summary();    // @5420
  const pf = PRStats.summary();    // @5421
  const bl = BLStats.summary();    // @5422
```

`Rating` agrège les quatre sources de statistiques pour construire ses cinq axes de compétence.
La relation existe, mais Graphify l'a étiquetée `shares_data_with`, ce qui est **incorrect** : c'est
un appel de lecture unidirectionnel `Rating → BLStats`. Aucune donnée n'est partagée dans les deux
sens, aucune structure n'est commune. Le bon libellé serait `calls` ou `reads`.

À noter : la relation n'est pas propre à `BLStats`. `Rating` lit identiquement `Progress`, `HRStats`
et `PRStats`. Isoler `BLStats` est un artefact d'échantillonnage, pas une propriété du code.

### 3.3 `Journey → Leaks` — **RÉFUTÉE (FALSE POSITIVE)**, mais sans la portée que je lui prêtais

L'arête elle-même est bien fausse. `Journey` occupe 5533–5684 ; recherche de `Leaks` : **zéro
occurrence.** Ce que `Journey` utilise réellement :
- `Progress.summary()` @5550 et @5584 → lit le champ `.leaks` de l'objet retourné ;
- `LEAK_INFO[leakKey]` @5619 pour les libellés.

> **Correction.** Une première version de cet audit concluait ici que les deux systèmes de leaks
> étaient « entièrement disjoints, sans aucun pont ». **C'est faux, et le pont est explicite.**
> L'erreur venait de la méthode : ma détection de modules ne reconnaissait que les déclarations
> `^const X =` en colonne 0. Or le tracker Feutre n'est pas un `const` — c'est une IIFE
> `window.Feutre = (function () {` @12866. Tout le sous-système a donc été mal attribué, et surtout
> sa **surface d'export**, en fin de fichier, n'a jamais été vue.

Le pont réel, vérifié dans les deux versions du fichier :

```
Feutre détecte un leak sur les mains réelles importées
   └─ V rend une carte de diagnostic avec un bouton  onclick="App.drillLeak('<id>')"   @15830 (v18)
        └─ App.drillLeak(leakId)                                        @7404 (v17) · @8210 (v18)
             ├─ window.Feutre.drillConfig(leakId) → LEAK_DRILL[id]      @15424 (v17) · @16279 (v18)
             └─ window.Feutre.leakTitle(leakId)   → LEAK_PLAIN[id].title @15425 (v17) · @16280 (v18)
                  └─ 10 spots de simulateur ciblés sur cette fuite
```

Feutre expose délibérément **deux fonctions** de pont (`drillConfig`, `leakTitle`) sur `window.Feutre`,
et `App` les consomme derrière des gardes défensives (`window.Feutre && window.Feutre.drillConfig`).
Un leak diagnostiqué sur les mains réelles **devient donc bien** un entraînement ciblé dans le
simulateur. Ce n'est pas un couplage manquant : c'est un couplage conçu, étroit et intentionnel.

**Ce qui reste vrai après correction :**

1. **Les deux taxonomies sont réellement dupliquées.** `LEAK_INFO` (@4035, simulateur) et
   `LEAK_PLAIN`/`LEAK_DRILL`/`LEAK_COST` (@13847+, tracker) décrivent des concepts recouvrants dans
   deux vocabulaires séparés. Le pont traduit entre les deux (`leakTitle`) au lieu de les unifier.
2. **`Journey` reste hors du pont.** Ses missions sont construites uniquement depuis
   `Progress.summary().leaks` + `LEAK_INFO` (@6281, @6315, @6350, @6384 en v18). Un leak détecté par
   le tracker peut déclencher un drill, mais **n'apparaîtra jamais comme mission dans la frise
   `Journey`**. C'est la version exacte — et beaucoup plus étroite — de ce que j'avançais.
3. **Le sens du pont est unidirectionnel** : tracker → simulateur. Le résultat du drill est écrit
   dans `Progress` (`pivot.v1`), jamais renvoyé au diagnostic Feutre (`feutre.v1`). Le tracker ne
   sait pas que sa fuite a été travaillée.

---

## 4. Les nœuds isolés

Le rapport annonçait 13 nœuds isolés ; le graphe en contient 15 à degré ≤ 1. Dix correspondent à des
identifiants réels du code, cinq sont des nœuds-concepts (abstractions extraites, sans existence
syntaxique — leur isolement n'a pas de sens en termes de code).

### 4.1 Identifiants réels — **tous vivants, aucun mort**

| Nœud | Décl. | Usages hors décl. | Consommateurs réels | Verdict |
|---|---|---|---|---|
| `CAT` | 2127 | 33 | `HandEval`, `BoardTex` | **VIVANT** — arêtes ratées |
| `MODES` | 3108 | 7 | `Spot`, `App`, `LEAK_PLAIN` | **VIVANT** — arêtes ratées |
| `STAKES` | 3062 | 7 | `Spot`, `Bankroll`, `App`, `HRSpot`, `PRSpot` | **VIVANT** — 5 arêtes ratées |
| `STREETS` | 3058 | 5 | `MODES`, `Progress`, `App` | **VIVANT** — arêtes ratées |
| `Fmt` | 3685 | 5 | `Spot`, `Judge` | **VIVANT** — arêtes ratées |
| `HR_DIFFICULTY` | 8160 | 4 | `HRSpot`, `HRUI` | **VIVANT** — arêtes ratées |
| `CATEGORY_ROLE` | 11718 | 5 | `BLSpot`, `BLExplain`, `BLUI` | **VIVANT** — arêtes ratées |
| `LEAK_COST` | 14045 | 3 | `LEAK_DRILL`, `LEAK_FAMILIES` | **VIVANT** — arêtes ratées |
| `BLScore` | 12050 | 1 | `BLUI` | **VIVANT**, faible fan-in réel |
| `BLExplain` | 12076 | 1 | `BLUI` | **VIVANT**, faible fan-in réel |

**Conclusion : zéro code mort parmi les nœuds isolés.** Dans les 8 premiers cas, Graphify a
purement et simplement raté les arêtes. La cause est structurelle : ce sont des **tables de
constantes** (`const CAT = {...}`, `const STAKES = [...]`) consommées par indexation
(`LEVELS[App.cfg.level]`, `PROFILES[profile]`). L'extraction sémantique reconnaît les appels de
méthode `X.y()` mais pas les accès indexés `X[clé]`, qui sont le mode d'usage dominant des tables de
configuration de ce fichier. C'est un angle mort systématique, pas une erreur ponctuelle.

`BLScore` et `BLExplain` sont différents : leur degré 1 est **exact**. Ils ne sont appelés que par
`BLUI`, conformément au patron de lab (§5.7).

### 4.2 Nœuds-concepts (non-code)

`CAT hand categories`, `Monte-Carlo equity vs range`, `Pot odds, MDF and fold equity`,
`Coach voice vs mentor voice`, `Leak detection & remediation loop`, `Low-lamp felt design direction`.
Ce sont des abstractions produites par l'extraction sémantique pour capter l'intention de conception.
Leur faible degré est attendu et sans signification architecturale.

---

## 5. Architecture réelle de Hero Lab

87 objets de premier niveau, une portée globale, aucune barrière mécanique. Les couches ci-dessous
sont **observées** (par pureté, accès DOM, accès `localStorage` et sens des références), pas déclarées.

### 5.1 CORE / ENGINE — *le point fort du fichier*

`Deck` (2091) · `HandEval` (2130) · `Ranges` (2246) · `BoardTex` (2381) · `Equity` (2495) · `Odds` (2580) · `CAT` (2127) · `RANKS`

- **Responsabilités** : cartes en entiers 0–51 (`rang = c>>2`, `couleur = c&3`), évaluation 7 cartes,
  notation de ranges texte (`"77+, A5s+"`) → combos, texture de board, équité Monte-Carlo, cotes/MDF/EV.
- **Entrantes** : `Ranges` 15 modules · `Deck` 12 · `BoardTex` 12 · `HandEval` 3.
- **Sortantes** : `BoardTex`→`CAT`,`HandEval` ; `HandEval`→`CAT`,`RANKS` ; `Equity`→`Deck`,`HandEval`. Aucune vers le haut.
- **Couplage** : afférent élevé, efférent quasi nul — *exactement le profil attendu d'un noyau*.
- **Risque** : **FAIBLE**. Vérification exécutée : les 8 modules ne contiennent **aucune** occurrence
  de `document`, `localStorage`, `innerHTML`, `window`, `Chart` ou `alert`. La revendication du code
  (« rien ici ne touche au DOM, tout est testable isolément ») est **confirmée sans exception**.
  Toute modification est cependant à fort rayon d'impact : `Ranges` a 50 références entrantes.

### 5.2 POKER MODELS

`PROFILES` (2621) · `PROF_EXT` (9889) · `ALL_PROFILES` (9971) · `PROFILE_FAMILY` (9974) · `AI` (2792) · `Calibrate` (4199) · `RangeModel` (7927) · `ProfileModel` (9990) · `BlockerEngine` (11527)

- **Responsabilités** : archétypes de vilains, moteur de décision adverse, calibration par palier,
  postérieurs bayésiens sur ranges et sur profils, effet de blocage.
- **Entrantes** : `PROFILES` 9 modules · `BlockerEngine` 4 · `RangeModel` 3.
- **Sortantes** : vers ENGINE uniquement (`BoardTex`, `Ranges`, `Equity`, `Deck`).
- **Couplage** : moyen. `ALL_PROFILES = Object.assign({}, PROFILES, PROF_EXT)` @9971 est un point de
  jonction propre, utilisé exclusivement par la famille `PR*`.
- **Risque** : **MOYEN**. `RangeModel` et `ProfileModel` implémentent le même algorithme bayésien
  (prior → likelihood → posterior) sur deux domaines, sans code partagé — duplication réelle,
  correctement repérée par Graphify comme `semantically_similar_to`.

### 5.3 GAME LOGIC

`Spot` (3201) · `Judge` (3448) · `Play` (3701) · `Session` (4574) · `LEVELS` (3075) · `MODES` (3108) · `STAKES` (3062) · `STREETS` (3058) · `STREET_FR` (3059)

- **Responsabilités** : génération de situations, verdict EV, déroulé de main, session d'entraînement.
- **Entrantes** : `Spot` 8 · `Session` 7 · `Judge` 2 · `Play` 1.
- **Sortantes** : ENGINE + POKER MODELS.
- **Couplage** : moyen. `Judge` est propre (7 sorties, 2 entrées). `Session` @4647 appelle `BoardTex`
  directement pour ses stats.
- **Risque** : **MOYEN-ÉLEVÉ** — `Judge.evaluate` porte la logique EV dont dépend tout le feedback.

### 5.4 STATE

`App` (5685, 19 champs) · `Player` (5257)

- **Responsabilités** : `App` détient l'état de vue/main/session ; `Player` l'identité, les avatars,
  les mentors et la maîtrise par leak.
- **Entrantes** : `Player` 3 modules mais **49 références** ; `App` 5 modules / 20 références.
- **Couplage** : **le plus élevé du fichier** (§2).
- **Risque** : **ÉLEVÉ**. Aucune couche d'état dédiée : `App` *est* l'état. Les 9 champs greffés à
  l'exécution rendent toute modification difficile à raisonner statiquement.

### 5.5 PERSISTENCE — *la faiblesse structurelle principale*

Aucun module de persistance. `localStorage` est appelé **directement depuis 14 modules** :
`Player` (10), `Store` (4), `Progress` (2), `Career` (2), `Rating` (2), `Journey` (2), `HRStats` (2),
`PRStats` (2), `BLStats` (2), `UI` (1), `App` (1), `HRExplain` (1), `BLUI` (1), `Parser` (1).

9 clés, chacune propriété du module qui la possède :
`pivot.v1` (Progress) · `pivot.career.v1` · `pivot.player.v1` · `pivot.rating.v1` · `pivot.journey.v1` ·
`pivot.hr.v1` · `pivot.pr.v1` · `pivot.bl.v1` · `feutre.v1` (Store).

- **Couplage** : dispersé. Le versionnage `.v1` est cohérent, mais chaque module gère seul sa
  sérialisation, son parsing défensif et ses `try/catch`.
- **Risque** : **ÉLEVÉ**. Une migration de schéma impose de toucher 14 endroits. `Rating.snapshot`
  @5353–5358 lit déjà en travers 6 clés d'autres modules — un embryon de couche d'accès, non
  généralisé. C'est le meilleur candidat à une extraction future.

### 5.6 PROGRESSION

`Progress` (3832) · `Career` (4779) · `Bankroll` (4415) · `Goals` (4466) · `TIERS` · `Rating` (5391) · `Journey` (5533) · `Mentor` (5232) · `MENTORS` (5203) · `LEAK_INFO` (4035)

- **Responsabilités** : historique de décisions et détection de leaks côté simulateur, bankroll,
  paliers, objectifs, notation 5 axes, missions et frise, voix du mentor.
- **Entrantes** : `Progress` 6 (30 réfs) · `Career` 5 (38) · `TIERS` 6 · `LEAK_INFO` 4.
- **Sortantes** : `Rating`→`Progress`,`HRStats`,`PRStats`,`BLStats` ; `Journey`→`Progress`,`LEAK_INFO`,`Player`.
- **Couplage** : moyen-élevé, en étoile autour de `Progress.summary()` — appelé depuis **13 sites**.
- **Risque** : **MOYEN**. `Progress.summary()` est un contrat de fait non documenté ; changer la forme
  de son retour casse 13 appelants dont `Rating`, `Journey`, `App` et `CareerUI`.

### 5.7 UI

`UI` (5041) · `Fmt` (3685) · `CareerUI` (7549) · `HRUI` (9119) · `PRUI` (11038) · `BLUI` (12342) · `Charts` (14460)

- **Responsabilités** : primitives de rendu (`UI`, **101 références entrantes** — le plus sollicité du
  fichier), formatage, écrans de carrière, interfaces des trois labs, graphiques Chart.js.
- **Couplage** : `UI` a un fan-in massif mais un fan-out de 2 — bonne primitive.
- **Risque** : **FAIBLE** pour `UI`, **MOYEN** pour les `*UI` (546, 770 et 489 lignes).
- **Anomalie relevée** : `HRUI.sparkline()` est réutilisé par `PRUI` @11477 et `BLUI` @12827. C'est
  le **seul couplage inter-labs de tout le fichier**. Un primitif de rendu générique est logé dans un
  lab spécifique ; sa place est dans `UI`. Couplage accidentel, à faible coût de correction.

### 5.8 TRACKER (Feutre)

`U` (12888) · `Parser` (12952) · `Store` (13382) · `Stats` (13476) · `Leaks` (14082) · `LEAK_PLAIN` (13847) · `LEAK_DRILL` (14003) · `LEAK_COST` (14045) · `V` (14511) · `FT` (15269) · `Charts` (14460)

- **Responsabilités** : application autonome de suivi de mains réelles, embarquée dans Pivot —
  parsing d'historiques Winamax/PokerStars → stockage → calcul → détection de leaks → vues.
- **Forme réelle** : ce n'est pas une série de `const` mais une **IIFE** — `window.Feutre = (function
  () { … })()` @12866 — qui n'expose qu'une poignée de fonctions. Les modules listés ci-dessus sont
  internes à cette closure, donc réellement encapsulés (contrairement au reste du fichier, en portée
  globale).
- **Surface de contact avec Pivot** : **trois points, tous explicites** — `Feutre.open()` (@5743,
  @7425 en v17), `Feutre.drillConfig(id)` et `Feutre.leakTitle(id)` (@15424–15425 v17,
  @16279–16280 v18), consommés par `App.drillLeak` derrière des gardes défensives. Voir §3.3.
- **Couplage** : **interne fort, externe étroit et intentionnel.** Sa propre clé (`feutre.v1`), son
  propre routeur (`FT`), ses propres utilitaires (`U`), sa propre taxonomie de leaks.
- **Risque** : **FAIBLE.** C'est le sous-système le mieux encapsulé du fichier — le seul à avoir une
  frontière mécanique plutôt que conventionnelle. Réserve : `V` fait 758 lignes avec 117 références
  sortantes, c'est le second God Object du fichier, plus petit qu'`App`.

### 5.9 ANALYTICS

`HRStats` (8989) · `PRStats` (10926) · `BLStats` (12231) · `Stats` (13476) · `Progress` (3832) · `Rating` (5391) · `Leaks` (14082)

- **Responsabilités** : agrégats par lab, statistiques du tracker, notation transversale.
- **Couplage** : `HRStats`/`PRStats`/`BLStats` sont **structurellement identiques** — même forme
  `KEY` + `summary()`, même stockage, **zéro appel croisé**. Duplication triple confirmée.
- **Risque** : **FAIBLE** individuellement, **MOYEN** collectivement : toute évolution du format de
  stats doit être répliquée trois fois, et `Rating.skills()` @5418 dépend des trois simultanément.

### 5.10 Tableau de synthèse

| Couche | Modules | Fan-in max | Couplage | Risque |
|---|---|---|---|---|
| CORE / ENGINE | 8 | `Ranges` 50 | afférent, sain | **FAIBLE** |
| POKER MODELS | 9 | `PROFILES` 27 | moyen | **MOYEN** |
| GAME LOGIC | 9 | `Spot` 18 | moyen | **MOYEN-ÉLEVÉ** |
| STATE | 2 | `Player` 49 | **très élevé** | **ÉLEVÉ** |
| PERSISTENCE | — (14 dispersés) | — | **dispersé** | **ÉLEVÉ** |
| PROGRESSION | 10 | `Career` 38 | moyen-élevé | **MOYEN** |
| UI | 7 | `UI` 101 | fan-in sain | **FAIBLE / MOYEN** |
| TRACKER | 11 | interne | étanche | **FAIBLE / ÉLEVÉ** |
| ANALYTICS | 7 | `Progress` 30 | triplé | **MOYEN** |

### 5.11 Sens réel des dépendances

```
        UI ── Fmt ── Charts          ← primitives, fan-in 101
         ▲
   App ──┼── CareerUI  HRUI  PRUI  BLUI          FT ── V ── U
    │    │      │        │     │     │            │    │
    │  STATE  PROGRESSION│     │   ANALYTICS   TRACKER (feutre.v1)
    │    │      │        │     │     │            │    │
    ▼    ▼      ▼        ▼     ▼     ▼            ▼    ▼
   GAME LOGIC ── POKER MODELS                  Parser Store Stats Leaks
         │            │
         ▼            ▼
      CORE / ENGINE  (pur — vérifié : 0 DOM, 0 localStorage)
         Deck HandEval Ranges BoardTex Equity Odds
```

Une seule flèche relie Pivot et Feutre (`V`→`App`). Les couches basses ne remontent jamais.

---

## 6. Conclusions

**Ce qui est sain.** Le moteur est réellement pur et vérifiable — c'est la meilleure propriété du
fichier, et elle tient sans exception sur 8 modules. `BoardTex`, désigné comme le plus gros risque de
couplage, n'en est pas un : un namespace pur à 2 méthodes avec 12 appelants est de la réutilisation
réussie. Le tracker Feutre est presque parfaitement étanche (1 seule arête sortante). `UI` est une
primitive correctement dimensionnée.

**Ce qui pose problème, par ordre de gravité.**

1. **`App` est un God Object** — 1 864 lignes, 64 méthodes, 19 champs dont 9 greffés à l'exécution,
   25 modules sortants pour 5 entrants. Six blocs sont extractibles pour ~535 lignes (29 %) sans
   toucher à la boucle de jeu. Le patron existe déjà : `CareerUI`.
2. **Aucune couche de persistance** — 14 modules appellent `localStorage` directement sur 9 clés.
   Toute migration de schéma est une modification en 14 points.
3. **Deux taxonomies de leaks dupliquées** — simulateur (`Progress` + `LEAK_INFO`) et tracker
   (`Leaks` + `LEAK_PLAIN`/`DRILL`/`COST`) décrivent des concepts recouvrants dans deux vocabulaires
   séparés. Un pont explicite existe bien (`App.drillLeak` → `window.Feutre.drillConfig`, §3.3) et
   traduit entre les deux au lieu de les unifier ; il est unidirectionnel (tracker → simulateur) et
   ne couvre pas `Journey`, dont les missions ignorent les leaks du tracker.
4. **`V` est un second God Object** (758 lignes, 117 références sortantes), à surveiller.
5. **Triple duplication** de `HRStats`/`PRStats`/`BLStats`, et duplication de l'algorithme bayésien
   entre `RangeModel` et `ProfileModel`.
6. **`HRUI.sparkline`** mal placé — seul couplage inter-labs, corrigeable à faible coût.

**Sur la fiabilité de Graphify.** Sur les échantillons vérifiés ici : les god nodes sont exacts
(`App`, `BoardTex` confirmés), mais **2 des 3 arêtes ambiguës sont fausses** (`Career→LEVELS`,
`Journey→Leaks`), la troisième est réelle mais mal typée, l'arête « surprenante »
`HRSpot→ALL_PROFILES` est fausse (`HRSpot` utilise `PROFILES`, pas `ALL_PROFILES` — celui-ci n'est
lu que par la famille `PR*`), l'arbre de `BoardTex` était incomplet de 5 branches sur 12, et
**8 des 10 nœuds isolés étaient des faux isolements**. La cause est systématique : l'extraction
reconnaît les appels `X.y()` mais rate les accès indexés `X[clé]`, mode d'usage dominant des tables
de constantes de ce fichier. Le graphe est un bon instrument d'orientation ; il n'est pas une source
de vérité sur les dépendances.
