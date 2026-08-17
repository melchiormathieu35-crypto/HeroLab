# Contre-expérience anti-farm — audit indépendant

**Question posée.** Un joueur qui ne cherche pas à bien jouer peut-il progresser
aussi vite, ou plus vite, qu'un joueur compétent ? À quel coût en qualité de poker ?

**Réponse courte, chiffrée.** Oui, presque aussi vite, et pour trois fois rien
d'effort. Le **fold-bot** — passer à chaque fois que le bouton « Passer » existe,
checker sinon, sans jamais regarder ses cartes — obtient sur 500 décisions au
niveau Débutant **88 % de l'XP du jeu parfait, le même niveau à une unité près
(8 contre 9), 94 % de « décisions justes » et un Poker Rating de 1209 contre 1421
(85 %)**. Il fait mieux, sur tous les compteurs de progression, qu'une heuristique
de poker plausible (rating 844). Son coût réel est de **0,35 bb par décision**,
dont le produit n'en comptabilise que **48,7 %** : l'autre moitié est invisible
pour tous les indicateurs affichés. En carrière NL2, il atteint l'objectif de
volume de 2 500 mains en **2 735 décisions contre 4 473 pour le jeu parfait**,
soit **1,64 × moins de clics**, avec 91,2 % de précision (l'objectif de palier en
demande 68), et décroche les badges *Précision*, *Haute précision* et *Discipline*.

Le seul compteur qui résiste est l'argent : la promotion de palier reste fermée
au fold-bot. Ce garde-fou est réel, mais il est isolé — tout le reste de la
progression visible (XP, niveau, rating, précision, compétences, missions,
badges, série quotidienne) est franchissable sans jouer au poker.

---

## 1. Méthode et garde-fous

Tout est exécuté sous Node via `tests/harness.js`, sur
`VERSION_PRODUCTION/herolab.html`. **Aucun fichier applicatif n'a été modifié** ;
les scripts vivent dans ce répertoire.

La chaîne d'écriture reproduit exactement `App.choose` (l.7264-7309) :
`Judge.evaluate` → `Progress.record` → `Player.recordMastery` sur les tags
`leak:` → `Play.step`. La main est jouée jusqu'à son terme, comme dans le produit.

### Le piège de `Spot.generate`, et comment il est neutralisé

`Spot.generate` résout `LEVELS[opt.level]` (l.3844) : il attend une **clé texte**.
Vérifié par exécution :

```
Spot.generate({level: LEVELS.gto, …}).level.name  ->  "Intermédiaire"   (retombée silencieuse)
Spot.generate({level: "gto",      …}).level.name  ->  "GTO"
```

Chaque boucle de chaque expérience appelle `guardLevel(M, t, cle)` qui lève si
`t.level !== LEVELS[cle]` (et `guardMode` de même pour `MODES`). L'expérience 2
a exécuté **2 543 à 2 588 vérifications de garde par stratégie**, toutes passées.
Sans cette garde, tous les résultats « par niveau » auraient mesuré le même niveau.

### Les stratégies

| Clé | Description | Compétence supposée |
|---|---|---|
| `oracle` | joue l'option de meilleure EV selon le juge | **borne supérieure** de compétence |
| `heuristique` | sélection préflop par force de main, c-bet en position, fold sous la cote | joueur correct, faillible |
| `fold` | passe si le bouton existe, checke sinon | aucune |
| `station` | suit toujours, ne passe et ne relance jamais | aucune |
| `allin` | tapis dès que miser/relancer est légal | aucune |
| `aleatoire` | tirage uniforme parmi les options | aucune |
| `rotation` | `options[i % n]` — le pouce sur le bouton, sans regarder l'écran | aucune |
| `minbet` | la plus petite mise légale, toujours | aucune |

`oracle` est déclaré correct par construction (`loss = 0`) : c'est un plafond
théorique, pas un humain. La comparaison honnête « bon joueur réel » est
`heuristique`.

Le **coût réel** que je mesure n'est pas celui du produit : je cumule `a.lossBB`
sur **toutes** les décisions, y compris celles que le juge classe « correct » ou
« acceptable ». Le produit, lui, ne cumule que les erreurs (`Progress.summary`
l.4766 : `x.verdict === "erreur" ? x.lossBB : 0`). L'écart entre les deux est
l'indicateur `occulté %` ci-dessous.

---

## 2. Résultats aux trois volumes — niveau Débutant

`node exp1_strategies.js debutant 500` · `node report1.js debutant`

**50 décisions**

| Stratégie | XP | niv | juste % | rating | disc. | bb/déc réel |
|---|---:|---:|---:|---:|---:|---:|
| Oracle (EV max) | 600 | 3 | 100,0 | 611 | 43 | 0,000 |
| Fold-bot | **538** | **3** | **96,0** | **532** | **41** | **0,296** |
| Compétent heuristique | 522 | 3 | 94,0 | 495 | 36 | 0,537 |
| Station | 432 | 3 | 76,0 | 225 | 1 | 2,003 |
| Rotation mécanique | 324 | 2 | 52,0 | 143 | 0 | 4,893 |
| Aléatoire | 368 | 3 | 62,0 | 177 | 0 | 5,560 |
| Mini-mise | 266 | 2 | 44,0 | 93 | 0 | 11,386 |
| Maniaque (tapis) | 100 | 2 | 0,0 | 0 | 0 | 11,029 |

**200 décisions**

| Stratégie | XP | niv | juste % | rating | disc. | bb/déc réel |
|---|---:|---:|---:|---:|---:|---:|
| Oracle | 2400 | 6 | 100,0 | 966 | 68 | 0,000 |
| Fold-bot | **2150** | **5** | **95,0** | **836** | **63** | **0,290** |
| Compétent heuristique | 1858 | 5 | 82,5 | 454 | 13 | 1,682 |
| Station | 1710 | 5 | 77,5 | 328 | 0 | 2,382 |
| Rotation | 1320 | 4 | 56,5 | 219 | 0 | 5,284 |
| Aléatoire | 1244 | 4 | 53,0 | 202 | 0 | 8,111 |
| Mini-mise | 1198 | 4 | 52,5 | 177 | 0 | 7,336 |
| Maniaque | 408 | 3 | 1,0 | 0 | 0 | 11,407 |

**500 décisions**

| Stratégie | XP | niv | juste % | corr. % | rating | palier | disc. | bb/déc réel | mains/déc |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|
| Oracle | 6000 | 9 | 100,0 | 100,0 | 1421 | Compétent | 100 | 0,000 | 0,57 |
| **Fold-bot** | **5298** | **8** | **94,0** | **80,6** | **1209** | **Initié** | **91** | **0,348** | **0,87** |
| Compétent heuristique | 4824 | 8 | 86,8 | 69,6 | 844 | Apprenti | 44 | 1,243 | 0,64 |
| Station | 4218 | 7 | 78,4 | 55,0 | 481 | Apprenti | 3 | 2,041 | 0,22 |
| Rotation | 3314 | 7 | 57,8 | 38,6 | 328 | Débutant | 0 | 5,956 | 0,45 |
| Aléatoire | 3204 | 6 | 56,2 | 36,0 | 303 | Débutant | 0 | 6,663 | 0,43 |
| Mini-mise | 2926 | 6 | 51,0 | 30,2 | 253 | Débutant | 0 | 6,885 | 0,27 |
| Maniaque | 1026 | 4 | 1,0 | 0,2 | 0 | Débutant | 0 | 11,064 | 1,00 |

**Ratio fold-bot / oracle** : XP 88,3 %, niveau 8/9, justesse 94 %, rating 85,1 %,
discipline 91/100. Le fold-bot dépasse le joueur heuristique sur **tous** les
compteurs tout en perdant **3,6 × moins d'EV réelle** (0,348 contre 1,243 bb/déc).
Aux niveaux Intermédiaire et GTO, la hiérarchie est identique
(fold-bot rating 1189 et 1077 ; heuristique 922 et 982).

**EV comptée par le produit contre EV réelle, 500 décisions, Débutant**

| Stratégie | EV comptée | EV réelle | occultée | netBB effectif |
|---|---:|---:|---:|---:|
| Fold-bot | 84,6 | 173,9 | **51,3 %** | −133,4 |
| Compétent heuristique | 513,2 | 621,4 | 17,4 % | −62,9 |
| Station | 877,6 | 1020,3 | 14,0 % | −266,5 |
| Maniaque | 5527,0 | 5531,9 | 0,1 % | −2482,6 |

L'occultation est **maximale précisément pour la stratégie la plus farmable** :
la faute du fold-bot est de nature « beaucoup de petites pertes sous le seuil »,
soit exactement ce que le compteur ne voit pas.

---

## 3. Exploitations trouvées

### E1 — L'XP est un compteur de clics, avec un plancher à 1/6

**Mécanisme.** `Progress.record`, l.4741-4743 :

```js
const gain = a.verdict === "correct" ? 12 : a.verdict === "acceptable" ? 6 : 2;
d.xp += gain;
d.level = 1 + Math.floor(Math.sqrt(d.xp / 90));
```

Aucun terme de niveau de difficulté, de mode, de limite, de taille de pot ni de
volume. Une erreur rapporte 2 XP.

**Ampleur mesurée** (`exp3_mecanismes.json`, bloc F, et exp1) : le rapport
XP-pire-cas / XP-parfait est **exactement 0,167 à tout volume**. La compression
par la racine carrée réduit encore l'écart sur le niveau affiché : à
2 000 décisions, le pire joueur possible est **niveau 7 contre 17** (41 %). Le
fold-bot, lui, n'est pas au plancher : il touche **10,49 XP par décision sur 12
possibles** (mode Préflop, exp5), soit 87 % du maximum théorique.

### E2 — Le compteur de maîtrise ne peut structurellement jamais enregistrer une réussite

**Mécanisme.** `Progress.tags` sort avant toute production de tag `leak:` quand la
décision n'est pas une erreur (l.4685-4686) :

```js
const wrong = a.verdict === "erreur";
if (!wrong) return tags;      // -> aucun tag "leak:" n'est produit
```

`App.choose` n'appelle `Player.recordMastery` que sur ces tags (l.7287-7289) :

```js
const wasOk = a.verdict !== "erreur";
for (const tag of (entry.tags || []))
  if (tag.startsWith("leak:")) Player.recordMastery(tag.slice(5), wasOk);
```

Les deux conditions sont mutuellement exclusives : `recordMastery` n'est
**jamais** appelable avec `ok = true`.

**Ampleur mesurée** (exp1, 8 stratégies × 3 niveaux ; exp3 bloc B) :
`mastery.ok = 0` dans **24 exécutions sur 24**, y compris pour l'oracle et pour
l'heuristique. Conséquences chiffrées :

- `Player.masteryLevel().rate` vaut toujours 0 → le palier plafonne à **1
  « En apprentissage »** (l.6155). Les paliers « Familier », « Solide » et
  « Maîtrisé » sont inatteignables.
- `Journey.mission().complete` exige `successRate >= 0.65` (l.6471) → **aucune
  mission n'est complétable**, jamais.

### E3 — La barre de progression des missions est un compteur d'échecs

**Mécanisme.** `Journey.mission` calcule `done = Math.min(m.seen, 20)` (l.6463) où
`m.seen` n'est incrémenté que sur une erreur (conséquence de E2).

**Ampleur mesurée** (exp3 bloc B, 300 décisions, niveau Intermédiaire) :

| Stratégie | justesse | missions affichées | barres |
|---|---:|---:|---|
| Oracle | 100 % | **0** | — |
| Fold-bot | 95,3 % | **0** | — |
| Station | 69,0 % | 4 | 90 %, 90 %, 45 %, 30 % |
| Rotation | 52,3 % | 4 | **100 %**, 85 %, 25 %, 15 % |

L'écran « Mon évolution » affiche donc une progression **strictement croissante
avec l'incompétence**, et rien du tout au joueur parfait.

### E4 — Le récit « tu t'es amélioré » se déclenche sur 15 échecs

**Mécanisme.** `Journey.story`, l.6446 :

```js
if (beforeLoss > 0 && (nowLoss < beforeLoss * 0.85 || (m && m.seen >= 15)))
```

La seconde branche suffit, et `m.seen` ne compte que des échecs (E2). `dropPct`
est ensuite ramené à 0 par `Math.max(0, …)` quand la perte a augmenté.

**Ampleur mesurée** (reproduction, seed 9001, stratégie `station`) :

```
AVANT : leak dominant bb-overdefend, perte 21,0 bb, 12 erreurs
APRÈS (400 décisions de plus) : perte 90,2 bb, 48 erreurs, mastery.seen 48, ok 0
la perte a AUGMENTÉ : true    |   condition « perte en baisse » remplie : false
Journey.story().improved = { key:"bb-overdefend", before:21, now:90.2, dropPct:0 }
```

Le produit déclare une amélioration sur un leak dont le coût a été **multiplié
par 4,3**. La condition qui se déclenche est celle du volume d'échecs.

### E5 — Le choix du niveau de difficulté est gratuit

**Mécanisme.** Le seuil de verdict est le seul endroit où `level` intervient
(`Judge.evaluate` l.4169-4170) :

```js
const tolerance = (1.0 * t.bb + pot * 0.03) * ((t.level.tolerance || 0.1) / 0.1);
const verdict = loss <= tolerance * 0.35 ? "correct" : loss <= tolerance ? "acceptable" : "erreur";
```

Le niveau se choisit librement en jeu libre et **ne pondère ni l'XP, ni le
rating, ni la précision affichée**.

**Ampleur mesurée** (exp3 bloc A — 220 décisions identiques, pertes d'EV
identiques, seul le seuil change) :

| Niveau | multiplicateur | juste % | correct % | XP | EV réelle | EV comptée | occultée |
|---|---:|---:|---:|---:|---:|---:|---:|
| Débutant | 1,4 | **95,9** | 81,8 | 2364 | 55,5 | 21,1 | **61,9 %** |
| Intermédiaire | 1,0 | 94,5 | 76,8 | 2286 | 55,5 | 25,0 | 54,9 % |
| Exploit | 0,8 | 92,7 | 75,0 | 2246 | 55,5 | 29,3 | 47,2 % |
| Avancé | 0,7 | 90,5 | 74,1 | 2214 | 55,5 | 33,3 | 40,0 % |
| Professionnel | 0,5 | 82,7 | 70,9 | 2104 | 55,5 | 44,0 | 20,6 % |
| GTO | 0,4 | 77,7 | 69,1 | 2036 | 55,5 | 49,4 | 10,9 % |

Pour **exactement le même jeu**, jouer en Débutant plutôt qu'en GTO offre
**+18,2 points de justesse** et divise la perte d'EV affichée par **2,34**.

### E6 — Le choix du mode d'entraînement est un second levier gratuit

**Mécanisme.** La tolérance est `(1 bb + 3 % du pot)`, donc quasi constante en
valeur absolue quand le pot est petit. Les modes `forceStreet` (l.3745-3747)
poussent la décision là où les pots sont gros et les erreurs chères ; `preflop`
(`stopAt`) fait l'inverse.

**Ampleur mesurée** (`exp5_modes.js`, fold-bot, 300 décisions, Débutant) :

| Mode | XP/déc | juste % | rating | discipline | bb/déc réel | occultée |
|---|---:|---:|---:|---:|---:|---:|
| Préflop | **10,49** | **94,3** | **1002** | **77** | 0,314 | **51,7 %** |
| Libre | 10,49 | 94,3 | 1002 | 77 | 0,314 | 51,7 % |
| Short stack | 10,49 | 94,3 | 1002 | 77 | 0,312 | 52,0 % |
| Deep stack | 10,49 | 94,3 | 996 | 76 | 0,331 | 49,0 % |
| Multiway | 10,58 | 91,0 | 992 | 71 | 0,383 | 29,6 % |
| Turn | 9,78 | 84,0 | 522 | 0 | 2,916 | 5,3 % |
| Flop | 9,51 | 80,3 | 569 | 11 | 1,689 | 6,5 % |
| River | 9,57 | 78,7 | 522 | 0 | 2,830 | 2,5 % |

En combinant E5 et E6 (Débutant + Préflop), le fold-bot obtient **1002 de rating
en 300 décisions** contre 522 en mode Turn : le même geste, deux fois le score.

### E7 — L'axe « Discipline » du Poker Rating est aveugle à ce qu'il mesure

**Mécanisme.** `Rating.disciplineScore` (l.6297-6303) :

```js
const lossPerDec = pr.evLoss / pr.n;          // pr.evLoss ne somme QUE les erreurs
const perf = Math.max(0, 100 - lossPerDec * 55);
```

L'entrée `pr.evLoss` provient de `Progress.summary` l.4766, qui exclut par
construction toute perte d'EV située sous le seuil de verdict.

**Ampleur mesurée** (exp1, 500 décisions, Débutant) : le fold-bot obtient
**91/100 de « Discipline »** alors qu'il perd réellement 0,348 bb par décision ;
l'heuristique obtient 44/100 en perdant 1,243 bb/déc. Le classement est correct
en ordre, mais l'échelle est calculée sur 48,7 % seulement de la perte du
fold-bot. Le libellé affiché — « éviter les erreurs coûteuses » — décrit une
grandeur qui n'est pas celle qui est calculée.

### E8 — Le Poker Rating global est atteignable à 1819 sans jouer au poker

**Mécanisme.** `Rating.compute` (l.6309-6318) agrège cinq axes ; trois viennent
des labs. Les trois `summary()` de labs moyennent `pct`/`score` **sans pondérer
par `difficulty`** (`HRStats` l.9979, `PRStats` l.11917, `BLStats` l.13228), alors
que le champ `difficulty` est bien enregistré à chaque spot.

**Ampleur mesurée** (`exp4_labs_rating.js`, 120 spots par cellule) :

| Lab | politique | difficulté | score moyen | axe /100 |
|---|---|---|---:|---:|
| Blocker Finder | clic sur la 1re option, toujours | **Expert** | 48,3 | **48** |
| Blocker Finder | clic sur la 1re option, toujours | Débutant | 20,8 | 21 |
| Blocker Finder | option au hasard | Expert | 43,3 | 43 |
| Range Detective | case au hasard dans les 169 | Débutant | 35,4 | 35 |
| Range Detective | label au hasard dans la range vivante | Expert | 51,3 | 51 |
| Range Detective | label le plus probable du modèle | Expert | 68,0 | 68 |

Deux constats. D'abord la difficulté **n'est pas pondérée**, et pire, elle est
**anti-corrélée** au farm : cliquer toujours la première option rapporte
**48/100 en Expert contre 21/100 en Débutant**, parce que les types de spots
Expert (`callfold`, `bluff`, `advanced`) sont des choix binaires notés 100 ou 0
(`BLScore.grade` l.13014-13016) là où les types Débutant (`identify`, `compare`)
notent partiellement. Ensuite, l'échelle de crédit partiel de `HRScore.grade`
(l.9419-9451 : 90 % / 75 % / 50 % / 25 %) donne **35/100 à un clic totalement aveugle**.

En combinant les valeurs mesurées — axes `table` 81 et `discipline` 91 du
fold-bot, `range` 68, `blockers` 48, `profiling` laissé à 0 — le rating agrégé
vaut **1819, palier « Avancé — des automatismes sains »**, soit 128 % du rating
de l'oracle en jeu pur (1421).

**Sous-exploitation du Profiling Lab.** `PRScore.grade` (l.11612-11616) ajoute un
terme de calibration `±10`. Vérifié par appel direct sur une réponse **fausse** :

```
confiance 0   -> score 10   (base 0, calib +10)
confiance 50  -> score 0
confiance 100 -> score 0    (calib -10, plancher à 0)
```

Mettre systématiquement le curseur de confiance à 0 rapporte **+10 points sur
chaque réponse fausse** et n'en coûte que 10 sur les réponses justes : c'est
gagnant dès que la précision est inférieure à 50 %. Une réponse « même famille »
passe de 60 à 70, une réponse « plausible » de 35 à 45.

### E9 — La série quotidienne est un compteur d'assiduité pur

**Mécanisme.** `Player.completeDaily` (l.6127-6140) : `d.streak` est incrémenté si
`d.lastDay` vaut la veille, **sans aucune condition sur `score`**. En amont,
`App.choose` l.7293-7296 compte chaque décision du défi, quelle qu'elle soit.

**Ampleur mesurée** : 30 jours consécutifs à **0 bonne réponse sur 10** →
`streak = 30`, `best = 0`. Dix folds par jour entretiennent indéfiniment la série.

### E10 — Le volume de carrière se mesure en mains, pas en décisions

**Mécanisme.** `Goals.forTier`, objectif « volume » (l.5292-5299) : `st.hands`,
alimenté par `Session.recordHand` (l.5440), lui-même appelé une fois par main
terminée. Passer préflop termine la main en une décision.

**Ampleur mesurée** (`exp2_career.js`, NL2, 2 500 mains, sessions de 500) :

| Stratégie | décisions pour 2 500 mains | mains/décision | précision NL2 | winrate | promotion |
|---|---:|---:|---:|---:|---|
| Maniaque (tapis) | **2 500** | 1,000 | 1,9 % | −849,8 bb/100 | non |
| **Fold-bot** | **2 735** | **0,914** | **91,2 %** | −95,3 bb/100 | non |
| Compétent heuristique | 3 568 | 0,701 | 83,6 % | −32,8 bb/100 | non |
| Oracle | 4 473 | 0,559 | 100 % | +296,2 bb/100 | **oui** |
| Station | 8 540 | 0,293 | 77,6 % | −253,1 bb/100 | non |

Le fold-bot remplit l'objectif de volume avec **38,9 % de clics en moins** que le
jeu parfait, et dépasse largement l'objectif de précision du palier (68 %).

### E11 — Le rapport de session félicite explicitement le fold-bot

**Mécanisme.** `Session.report` (l.5553-5562) choisit son verdict sur
`goodPlay = accuracy >= tier.reqAccuracy`, sans jamais consulter la perte d'EV.

**Ampleur mesurée** — rapport réellement produit par le moteur pour un profil de
session de fold-bot (précision 91,2 %, −95,2 bb/100, NL2 dont `reqAccuracy` = 68) :

> « Session perdante alors que tes décisions étaient bonnes. C'est de la
> variance, pas une erreur : **continue exactement comme ça.** »

Badges effectivement décrochés par le fold-bot sur 2 500 mains :
`first_session`, `acc_80` (**Précision**), `acc_90` (**Haute précision**),
`discipline` (« Session perdante mais jouée proprement : tu as tenu ta ligne »),
`vol_1000`. Cinq badges sur les onze existants, sans jamais lire une carte.

### E12 — Le filet de banqueroute annule toute sanction monétaire

**Mécanisme.** `Career.closeSession` l.5692-5697 : sous 3 caves NL2, la bankroll
est remise à 20 caves et le palier revient à 0.

**Ampleur mesurée** : le maniaque perd **21 244 bb** sur 2 500 mains
(−849,8 bb/100) et termine avec une bankroll de **40 €, exactement son point de
départ**. Le compteur d'argent, seul garde-fou réel du système, est donc borné
par le bas et ne peut jamais s'aggraver.

### E13 — La porte de promotion est calibrée 110 × au-dessus de son propre énoncé

**Mécanisme.** `Goals.allMet` exige les quatre objectifs à 100 %, et
`Career.promotionStatus` exige **en plus** `Bankroll.canMoveUp`. Or l'objectif
bankroll NL2→NL5 vaut 30 caves de **NL5** (150 €) depuis un dépôt de 20 caves de
**NL2** (40 €).

**Ampleur mesurée** (exp3 bloc E) :

| Grandeur | Valeur |
|---|---:|
| Bankroll de départ | 40 € |
| Bankroll exigée | 150 € |
| Gain nécessaire | +110 € = **+5 500 bb NL2** |
| Volume minimal du palier | 2 500 mains |
| Winrate impliqué par la bankroll | **220 bb/100** |
| Winrate exigé par l'objectif affiché | 2,0 bb/100 |
| Écart | **× 110** |
| Mains nécessaires au winrate affiché | **275 000** |

Ce n'est pas un vecteur de farm, c'est son symétrique : un joueur réellement bon
mais humain ne franchira jamais NL2. Seul l'oracle y parvient, à **296 bb/100** —
un chiffre qui n'a pas de sens comme cible de progression humaine et qui indique
au passage que le modèle d'EV du juge est très largement battable contre le pool
NL2 simulé.

---

## 4. Axes où je n'ai PAS trouvé d'exploitation

Un audit qui ne trouve que des problèmes n'est pas crédible. Ces vecteurs ont été
testés et n'ont rien donné.

1. **Sanctuarisation du Studio.** `App.choose` l.7270-7272 : `ghost = !!t._studio`
   court-circuite toute écriture (`Progress`, `Session`, maîtrise). Aucune fuite
   d'XP par les spots fabriqués.
2. **Verrous de volume sur les objectifs.** L'objectif winrate est verrouillé sous
   300 mains (l.5309) et l'objectif précision sous 100 décisions (l.5322) : on ne
   peut pas valider un palier sur trois mains chanceuses. Vérifié dans les traces
   de session (`locked: true` sur la première session courte).
3. **Facteur de confiance du rating.** `Rating.skillScore` (l.6250-6257) borne le
   score à `perf × (0.35 + 0.65 × volume/plein)`. Mesuré : 120 spots de lab à
   48 % ne rapportent pas plus de 48/100, et 5 spots parfaits plafonnent à 35.
   Le volume ne peut pas être troqué contre de la performance.
4. **Le seuil de verdict n'est pas contournable par le sizing.** La stratégie
   `minbet` (toujours la plus petite mise légale), conçue pour exploiter le fait
   que la fold equity et la polarisation dépendent de `frac`
   (`Judge.partition` l.4373, `Judge.polarize` l.4326), obtient le **plus mauvais
   rating de toutes les stratégies passives** (253 à Débutant) pour 6,885 bb/déc.
   Le juge résiste correctement à cet angle.
5. **Le tapis systématique n'est pas farmable.** 1,0 % de justesse, rating 0 à 8,
   XP au plancher : la stratégie la plus brutale est aussi la plus sanctionnée.
   Le système n'est donc pas indistinctement permissif — il l'est très
   spécifiquement envers la passivité.
6. **Aucun mécanisme d'anti-spam n'existe** (aucune occurrence de cooldown /
   throttle / limite de cadence dans le moteur), mais je n'ai trouvé **aucun
   moyen d'écrire une décision sans passer par `Judge.evaluate`** : le coût de
   calcul lui-même (~43 ms) est la seule limite de cadence, et elle est réelle.
7. **Rejeu du même spot.** `Spot.generate` (l.3843) construit une `Table` neuve
   à chaque appel, avec son propre paquet mélangé, et ne conserve aucun état
   entre deux appels : il n'existe ni cache ni identifiant de spot réutilisable
   sur lequel se brancher. Vecteur écarté sur lecture du code, non par mesure.
8. **La promotion de carrière résiste au farm.** C'est le seul objectif corrélé à
   l'argent réellement gagné. Fold-bot, station, maniaque et heuristique échouent
   tous les quatre sur `winrate` et `bankroll` (voir E10). Ce garde-fou
   fonctionne — c'est aussi le seul.

---

## 5. Réponse à la question posée

**Un joueur qui ne cherche pas à bien jouer peut-il progresser aussi vite ?**

Sur tout ce que le produit montre au joueur au quotidien — XP, niveau, taux de
décisions justes, Poker Rating, palier de rating, compétences par street et par
position, badges, série quotidienne, barres de mission, rapport de session — la
réponse est **oui, à 85-94 % de la vitesse du jeu parfait, et plus vite que celle
d'un joueur correct mais faillible**. La stratégie gagnante ne demande aucune
connaissance : appuyer sur « Passer », en mode Préflop, au niveau Débutant.

**À quel coût en qualité de poker ?**

**0,35 bb par décision** d'espérance abandonnée en jeu libre, **0,31 bb/décision**
dans la configuration optimisée — dont le produit n'en montre que la moitié. En
carrière NL2, cela se traduit par **−95,3 bb/100 sur 2 500 mains**, soit
**−2 383 bb**, pendant que l'application affiche 91,2 % de précision, deux badges
de précision, un badge de discipline et le conseil « continue exactement comme ça ».

L'écart entre les deux — un joueur qui perd deux mille bb en étant félicité pour
sa discipline — est le résultat central de cette contre-expérience.

---

## 6. Reproductibilité

Toutes les commandes s'exécutent depuis `PHASE4_DEEP_LEARNING/audits/blind/`.

```bash
node exp1_strategies.js debutant 500 20260817      # + intermediaire, gto
node report1.js debutant intermediaire gto         # tableaux ci-dessus
node exp2_career.js fold 2500 long                 # + oracle, station, heuristique, allin
node exp3_mecanismes.js 220                        # seuils, maîtrise, missions, récit, promotion, XP
node exp4_labs_rating.js 120                       # axes range / blockers / calibration profiling
node exp5_modes.js 300                             # farm par le mode
```

Sorties : `exp1_*.json`, `exp2_*.json`, `exp3_mecanismes.json`, `exp4_labs.json`,
`exp5_modes.json`. Bibliothèque commune : `lib_af.js` (garde de niveau et de mode,
générateur déterministe, stratégies, mesure).

Le PRNG est fixé par graine pour la reproductibilité, mais les stratégies
consomment des quantités différentes d'aléa : elles ne voient donc pas des
séquences de spots identiques au-delà de la première main. Les volumes retenus
(500 décisions par cellule, 2 500 mains en carrière, 120 spots par cellule de lab)
sont là pour absorber cet écart ; les hiérarchies rapportées sont stables aux
trois niveaux de difficulté testés indépendamment.

---

## 7. Indépendance

Conformément au mandat, les fichiers `spec/01_ARBITRAGES.md`,
`spec/03_ANTI_FARM.md` et `spec/experiments/*` n'ont pas été ouverts (`ls` sur
`spec/` confirme par ailleurs que `03_ANTI_FARM.md` n'existe pas à ce jour).
Le protocole, les stratégies, les métriques et les seuils de cet audit ont été
définis à partir du seul code source et de `audits/_CONTEXTE_PARTAGE.md`.
**Aucune proposition de correctif n'a été rencontrée**, et aucune n'est formulée
ici : ce document mesure, il ne répare pas.
