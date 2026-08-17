# AGENT C — Matrice de couverture des ranges

Audit de la « vérité poker » de HeroLab. Toutes les valeurs de ce document ont
été **mesurées par exécution** (harness Node sur `VERSION_PRODUCTION/herolab.html`),
jamais estimées. Aucun fichier applicatif n'a été modifié.

Scripts de mesure : `/tmp/claude-0/-home-user-HeroLab/59f0105b-e99e-5c11-8e24-fb29fe21bada/scratchpad/m1.js` → `m11.js`.

---

## 0. Ce que le produit contient réellement comme « vérité poker »

L'intégralité de la théorie préflop du produit tient en **4 tables**, l.2939-2958 :

| Table | l. | Clés | Combos cumulés | Étendue |
|---|---|---|---|---|
| `Ranges.OPEN` | 2939 | UTG, HJ, CO, BTN, SB | 1 756 | 5 positions |
| `Ranges.BB_DEF` | 2947 | UTG, HJ, CO, BTN, SB | 2 164 | 5 ouvreurs, **branche call uniquement** |
| `Ranges.THREEBET` | 2954 | value, bluff | 74 | **globale** |
| `Ranges.FOURBET` | 2958 | value, bluff | 36 | **globale** |

Deux ranges supplémentaires vivent dans le moteur de jugement du Range Lab et
ne sont **jamais présentées comme du contenu** :

| Range | l. | % du deck | Labels | Varie ? |
|---|---|---|---|---|
| `RangeModel.limpRange(pos, P)` | 8923 | 31,7 % | 66 | **Non** — mesuré identique pour UTG/HJ/CO/BTN/SB/BB |
| `RangeModel.callVs3betRange(pos, P)` | 8929 | 5,3 % | 14 | **Non** — mesuré identique pour `nit` et `maniac` |

Les deux fonctions **déclarent des paramètres `(pos, P)` qu'elles n'utilisent
pas** : le corps renvoie une chaîne littérale constante. La signature promet une
dépendance à la position et au profil ; le code ne la fournit pas.

---

## 1. Ranges d'ouverture — mesures

```
UTG   26 labels   160 combos   12,1 %
HJ    38 labels   226 combos   17,0 %
CO    59 labels   346 combos   26,1 %
BTN   93 labels   590 combos   44,5 %
SB    68 labels   434 combos   32,7 %
```

**Cohérence interne : bonne.** La progression UTG → BTN est strictement
croissante et **strictement imbriquée** (mesuré : `OPEN.UTG ⊂ OPEN.HJ ⊂ OPEN.CO
⊂ OPEN.BTN`, aucun label perdu à chaque élargissement). `OPEN.SB` (32,7 %) est
un sous-ensemble strict de `OPEN.BTN` amputé de 25 labels, sans ajout — ce qui
est structurellement cohérent avec une SB qui ouvre plus serré que le BTN.

**Deux contradictions chiffrées avec le coaching du tracker :**

| Point | Range moteur | Ce que le tracker enseigne | Écart |
|---|---|---|---|
| Ouverture UTG | 12,1 % — `77+, A9s+, ATo+, KTs+, KQo, QTs+, JTs, T9s, 98s` | l.15060 : « Vise **15 à 18 %** en UTG : paires **66+**, AJ+/ATs+, KQ, KJs, QJs, suited connectors **à partir de 76s** » | Le moteur est **3 à 6 points sous la cible annoncée**. Il ne contient ni `66`, ni `76s`, ni `87s`, que le texte cite nommément. Inversement il ouvre `A9s, ATo, KTs, QTs` que le texte exclut. La range écrite dans le texte de coaching vaut **11,3 %** — donc le conseil se contredit lui-même (liste = 11,3 %, cible = 15-18 %). |
| Ouverture SB | 32,7 % | l.15067 : règle `sb-loose`, sévérité **high**, se déclenche si `VPIP SB > 32` ; conseil « Ramène ton VPIP SB vers **25 à 30 %** » | Un joueur qui jouerait **exactement la range de référence SB du produit se ferait diagnostiquer une fuite prioritaire** par le produit. |

Cohérent en revanche : `no-steal` (l.15190) conseille « 35 à 45 % depuis le
bouton », `OPEN.BTN` = 44,5 % → dans la fourchette.

---

## 2. BB_DEF — quantification de ce qui manque

```
vs UTG   224 combos  16,9 %      fold BB implicite  83,1 %
vs HJ    300 combos  22,6 %      fold BB implicite  77,4 %
vs CO    408 combos  30,8 %      fold BB implicite  69,2 %
vs BTN   602 combos  45,4 %      fold BB implicite  54,6 %
vs SB    630 combos  47,5 %      fold BB implicite  52,5 %
```

**Ce qui manque, quantifié :**

1. **La branche 3bet n'existe pas** (commentaire l.2946 : « call, hors 3bet »).
   Il n'y a donc, pour la BB, qu'**1 des 2 branches de défense sur 5 ouvreurs**
   = 5 cellules sur 10.
2. **La branche fold n'est pas déclarée** : elle n'existe que par complément
   arithmétique. Aucun code ne la lit, aucun écran ne l'affiche.
3. **Contradiction interne mesurée avec `THREEBET`** : les **10 labels de
   `THREEBET.bluff` (`A2s, A3s, A4s, A5s, KJs, QJs, JTs, T9s, 87s, 76s`) sont
   présents dans les 5 ranges `BB_DEF`**, et `QQ` — hand de `THREEBET.value` —
   est dans `BB_DEF.BTN` et `BB_DEF.SB`. La même main est simultanément « call »
   et « 3bet » pour le même joueur dans la même situation. Cela viole l'invariant
   que le fichier s'impose lui-même (« hors 3bet »).
   Conséquence chiffrée : ajouter le 3bet ne fait passer la défense BB vs BTN
   que de **45,4 % à 47,5 %** (+2,1 pts), parce que le 3bet est quasi
   intégralement inclus dans le call.
4. **Contradiction avec le tracker** : la règle `bb-underdefend` (l.15075)
   conseille « fold BB autour de **50 à 58 %** » et se déclenche au-dessus de
   62 %. Le fold BB moyen impliqué par `BB_DEF` est de **67,4 %** (65,0 % en
   comptant le 3bet). **Un joueur défendant exactement la range de référence du
   produit serait diagnostiqué comme sous-défendant sa BB.**
5. **Non-monotonie du ratio défense/attaque** — mesuré `BB_DEF[X] / OPEN[X]` :
   1,40 (UTG) → 1,33 (HJ) → 1,18 (CO) → **1,02 (BTN)** → 1,45 (SB). Face au BTN,
   la BB ne défend que 2 % plus large que le BTN n'ouvre, alors qu'elle défend
   40 % plus large face à UTG. *Signalé comme anomalie de forme ; l'arbitrage sur
   la valeur correcte est **à valider par un joueur expert** — je ne propose
   aucune range de remplacement.*
6. **`BB_DEF` est morte dans le jeu principal.** Mesuré : une seule référence
   dans tout le fichier, l.8894, à l'intérieur de `RangeModel.prior` (Range Lab).
   Le moteur de partie assigne à **tous** les joueurs `Ranges.OPEN[pos]`
   (l.3898) ; `Ranges.OPEN.BB` étant `undefined`, **la BB reçoit la range
   d'ouverture du CO (26,1 %)** via le fallback `|| Ranges.OPEN.CO`. Même
   fallback l.4003, l.4487, l.11238.

---

## 3. THREEBET / FOURBET — combien de couples devraient exister, combien existent

En 6-max, les couples ordonnés (ouvreur avant répondant) sont au nombre de
**15**, mesurés : `UTG→HJ, UTG→CO, UTG→BTN, UTG→SB, UTG→BB, HJ→CO, HJ→BTN,
HJ→SB, HJ→BB, CO→BTN, CO→SB, CO→BB, BTN→SB, BTN→BB, SB→BB`.

| Nœud de l'arbre | Couples nécessaires en 6-max | Ranges existantes | Ratio |
|---|---|---|---|
| 3bet (répondant relance) | 15 | **1** (globale) | 1 / 15 |
| Call vs 3bet (ouvreur suit) | 15 | **1** (`callVs3betRange`, globale) | 1 / 15 |
| 4bet (ouvreur re-relance) | 15 | **1** (globale) | 1 / 15 |
| Call vs 4bet / 5bet | 15 × 2 | **0** | 0 / 30 |

Mesures de contenu :

```
THREEBET  value  5 labels   34 combos   2,6 %
          bluff 10 labels   40 combos   3,0 %
          TOTAL 15 labels   74 combos   5,6 %   ratio value/bluff = 0,85
FOURBET   value  3 labels   16 combos   1,2 %
          bluff  3 labels   20 combos   1,5 %
          TOTAL  6 labels   36 combos   2,7 %   ratio value/bluff = 0,80
```

- `FOURBET` est **entièrement inclus dans `THREEBET`** (mesuré : 0 label du
  4bet absent du 3bet). L'arbre d'escalade n'introduit donc aucune main nouvelle.
- `AKo` est simultanément **`THREEBET.value`** et **`FOURBET.bluff`**.
  Défendable en théorie, mais jamais explicité nulle part dans le produit.
- Le 3bet de référence vaut **5,6 % du deck**, alors que la règle `low-3bet`
  (l.15095) conseille « **vise 7 à 9 %** » et `high-3bet` « redescends vers
  **8 à 10 %** ». La range de référence est **sous les deux fourchettes que le
  produit enseigne**.
- Fold-to-3bet impliqué par `FOURBET ∪ callVs3betRange` (7,4 % du deck) :
  43,8 % (ouvreur UTG), 60,2 % (HJ), 71,7 % (CO), **83,4 % (BTN)**, 77,4 % (SB).
  La règle `fold-3bet` (l.15105) conseille « **50 à 58 %** » et se déclenche
  au-dessus de 65 %. **3 des 5 positions d'ouverture du produit dépassent son
  propre seuil d'alerte.** Mécaniquement : la range de continuation est globale
  et fixe (7,4 %) alors que la range d'ouverture varie de 12 à 44 % ; le taux de
  fold ne peut pas être correct partout.

---

## 4. Cold call, squeeze, blind vs blind

| Situation | Range dédiée ? | Preuve |
|---|---|---|
| **Cold call** (call d'une ouverture depuis un siège non-blinde : HJ vs UTG, CO vs UTG/HJ, BTN vs UTG/HJ/CO, SB vs les 4) — **10 couples** | **NON** | Aucune clé. `BB_DEF` couvre uniquement la BB. La règle `cold-call` (l.15324) enseigne pourtant un comportement (« 3-bet ou fold ») sans range de référence. |
| **Défense SB face à une ouverture** — 4 couples | **NON** | `Ranges.OPEN.SB` est une range d'**ouverture**, pas de défense. La règle `sb-overdefend` (l.15335) prescrit un fold SB > 70 % sans aucune range à opposer. |
| **Squeeze** (ouverture + call + relance) — 20 contextes en 6-max | **NON** | `grep squeeze` = **0 occurrence** dans tout le fichier. |
| **Isolation d'un limp** — 15 couples | **NON** | `limpRange` modélise le **limpeur** (le vilain), pas la range d'isolation du héros. |
| **Blind vs blind** | **PARTIEL** | Ouverture SB couverte (`OPEN.SB`, 32,7 %) et défense BB vs SB couverte (`BB_DEF.SB`, 47,5 %). Manquent : limp SB, 3bet BB vs SB, réponse SB au 3bet BB. Mode `bvb` (l.3750) et Range Lab BvB (l.9221) existent bien et sont atteignables. |
| **Multiway (3 joueurs +)** | **NON** | Mode `multiway` existe, mais toutes les ranges sont heads-up. |

---

## 5. Profondeur de stack — mesure

**Aucune range ne varie avec la profondeur. Zéro. Mesuré.**

- `RangeModel.prior(spot)` (l.8875) ne lit ni `effBB` ni la profondeur.
  Vérifié par exécution : `prior(effBB=20)`, `prior(45)`, `prior(100)`,
  `prior(300)` renvoient **590 combos et exactement la même `baseStr`**.
- `MODES.deep` (150-300 bb) et `MODES.short` (20-45 bb), l.3753-3754 : le champ
  `mode.stack` n'est lu qu'**une seule fois**, l.3854, pour tirer la taille des
  tapis. Vérifié : mode `deep` produit des tapis 116-385 bb, mode `short`
  15-57 bb — mais les ranges assignées sont identiques.
- `AI.preflop` (l.3454) : les 4 seuils (`openThresh`, `callThresh`,
  `raiseThresh`, `fourBetThresh`) dépendent uniquement de `p.vpip` et
  `p.threeBet`. **Aucun terme de profondeur.**
- Range Lab : `effBB` est tiré dans `[75, 100, 100, 100, 150, 200]` (l.9160).
  Mesuré sur 1 600 spots : jamais < 75 bb, jamais > 200 bb. **Les plages « short
  20-45 » et « deep 200-300 » annoncées par les modes n'existent pas dans le
  Range Lab**, et le prior les ignorerait de toute façon.

---

## 6. Ranges utilisées par le moteur vs ranges enseignées à l'utilisateur

| Range | Utilisée par | Montrée à l'utilisateur ? |
|---|---|---|
| `OPEN` × 5 | l.3898 (range de tous les vilains), l.4003, l.4487 (range perçue du héros), l.8892, l.11238 | **Jamais telle quelle.** Seule la version dérivée (widen par profil, puis narrow par actions) apparaît, l.7674, et uniquement comme **range de l'adversaire**. |
| `BB_DEF` × 5 | l.8894 **uniquement** (Range Lab) | **Jamais.** |
| `THREEBET` | l.8885 (Range Lab) | **Jamais.** |
| `FOURBET` | l.8888 (Range Lab) | **Jamais.** |
| `limpRange` | l.8882 (Range Lab) | **Jamais.** |
| `callVs3betRange` | l.8886 (Range Lab) | **Jamais.** |

**Conclusion mesurée : les 6 ranges du produit sont exclusivement des modèles
de l'adversaire. Aucune n'est jamais présentée au héros comme sa propre
stratégie de référence.** `UI.rangeGrid` (l.5963) n'a qu'un seul appel dans le
jeu (l.7674, « Range adverse estimée »). La vue « Positions » du tracker
(l.15900) affiche VPIP/PFR/3Bet/OR mesurés **sans aucune valeur de référence en
regard**.

Corollaire mesuré : **le jugement du produit contredit ses propres ranges.**
`Judge.evaluate` (l.4092) est purement EV — il ne consulte jamais `Ranges.OPEN`
pour arbitrer une décision d'ouverture. Sur 200 spots RFI réels (mode `preflop`,
niveau intermédiaire), accord entre « la meilleure option EV est une ouverture »
et « la main est dans `Ranges.OPEN[pos]` » :

| Niveau | Accord | Détail des désaccords |
|---|---|---|
| débutant | **75,3 %** | 33 ouvertures hors range, 4 mains de la range non ouvertes |
| intermédiaire | **72,0 %** | 42 hors range ouvertes, 14 dans la range non ouvertes |
| pro | **70,7 %** | 27 / 17 |
| **GTO** | **66,0 %** | 28 hors range ouvertes, **23 des 40 mains de la range de référence ne sont pas ouvertes (57,5 %)** |

Accord par position (niveau intermédiaire) : BTN 84 %, UTG 81 %, CO 71 %,
HJ 67 %, **SB 57 %**. Le niveau « GTO » — celui dont la description promet « la
stratégie non exploitable » — est celui qui s'écarte **le plus** des ranges de
référence.

---

## 7. Contenu déclaré mais inaccessible

### 7.1 Les modes « Pots 3Bet » et « Pots 4Bet » ne font rien

`MODES.pot3bet: { force3Bet: true }` et `MODES.pot4bet: { force4Bet: true }`
(l.3748-3749). **`grep force3Bet` et `grep force4Bet` renvoient chacun une seule
occurrence : leur déclaration.** Aucun code ne les lit. Les deux modes sont
pourtant rendus dans le sélecteur, l.7833 (`Object.entries(MODES).map(...)`).

Mesuré sur 600 spots par mode, à l'instant où le héros doit décider :

| Mode | Promesse | 3bet+ délivrés |
|---|---|---|
| `libre` | — | 0,4 % |
| **`pot3bet`** | « Le pot est systématiquement 3bet » | **0,9 %** |
| **`pot4bet`** | « Le pot est systématiquement 4bet » | **0,0 %** (0 spot sur 559) |

Sur **3 200 mains générées tous modes confondus, le héros n'a jamais fait face à
un 4bet.** L'intégralité du contenu 4bet du jeu principal est inatteignable.

**Conséquence en cascade sur le coaching** : deux drills de fuite pointent vers
`mode: "pot3bet"` — `fold-3bet` (« T'entraîner : réagir face aux 3bet », l.14981)
et `cold-call` (« T'entraîner : 3bet ou fold », l.15000). Mesuré : ces drills
délivrent **0,4 % et 0,5 %** de spots réellement 3bet. Un utilisateur
diagnostiqué « tu abandonnes trop face au 3bet » qui clique sur l'entraînement
ne verra pratiquement jamais un 3bet.

### 7.2 Le drapeau `facing` des drills est ignoré

`LEAK_DRILL["bb-underdefend"] = { mode:"preflop", forcePos:"BB", facing:true }`
(l.14983). `cfg.facing` est bien posé (l.7181) et transporté (l.8333), mais
**`opt.facing` n'est jamais lu par `Spot.generate`**. Mesuré : dans le drill
« défendre ta grosse blinde », **20,4 % des spots n'ont aucune ouverture à
défendre**.

### 7.3 `forcePos` échoue silencieusement aux tables courtes

l.3867 : `if (opt.forcePos && positions.includes(opt.forcePos))`. Le nombre de
joueurs est tiré dans `[6,6,6,5,4,3,2]` (l.3848) et `positions = POS6.slice(6-n)`
supprime UTG dès 5 joueurs. Mesuré sur 571 spots du drill `utg-loose` :
**le héros est réellement à UTG dans 40 % des cas seulement** (BTN : 89 %).

### 7.4 Le Range Lab n'atteint jamais UTG

`HRSpot.positions` (l.9220) code en dur **6 couples** + 1 couple BvB. Mesuré sur
1 600 spots, les positions rencontrées sont `BB, SB, BTN, CO, HJ` — **UTG
n'apparaît jamais**, ni comme héros ni comme vilain. 25 cellules
(potType × couple) distinctes au total, réparties ainsi :

| Difficulté | Cellules distinctes | Concentration |
|---|---|---|
| débutant | 12 | 3 cellules = 39 % des spots |
| intermédiaire | 18 | — |
| avancé | 13 | **1 cellule (BvB) = 40,5 % des spots** |
| expert | 19 | BvB = 23,5 % |

Le 4bet n'existe qu'en difficulté **expert** (≈ 24 % de ses spots). Le limp
n'existe qu'en **débutant/intermédiaire**. La difficulté **expert ne joue jamais
flop ni turn** (`streets: ["river"]`, l.9130).

### 7.5 Distribution des positions du héros dans le jeu principal

Mesuré sur 3 000 mains (mode libre) : **UTG 7,3 %**, HJ 10,5 %, CO 13,8 %,
BTN 17,6 %, SB 25,8 %, BB 25,0 %. Rapport SB/UTG = **3,5×**. Les positions
précoces — celles où les erreurs de sélection coûtent le plus — sont les moins
entraînées.

### 7.6 Composition réelle des pots préflop

Mesuré (mode libre, 565 spots) : **60,0 % des décisions préflop du héros ont
lieu dans un pot où personne n'a ouvert** ; 39,6 % face à une ouverture ; 0,4 %
face à un 3bet. En postflop forcé : 26-28 % des spots sont des pots limpés,
70-72 % des SRP, 1,4-1,8 % des pots 3bet. Le produit entraîne donc
majoritairement des situations pour lesquelles **il ne possède aucune range**
(pots limpés côté héros, pots non ouverts).

---

## 8. LA MATRICE

Convention : une **cellule** = (contexte de position préflop × action non-fold
qui requiert une range). Le fold est le complément et n'est jamais déclaré.

- **COUVERTE** : une range dédiée existe pour ce couple exact de positions.
- **PARTIELLE** : une range existe mais est **globale** — elle est appliquée à
  tous les couples indistinctement.
- **ABSENTE** : aucune range, sous aucune forme.

### 8.1 Matrice principale — RFI

| Héros | Adversaire | Action | Statut | Range / ligne |
|---|---|---|---|---|
| UTG | table | open | COUVERTE | `OPEN.UTG` 12,1 % — l.2940 |
| HJ | table | open | COUVERTE | `OPEN.HJ` 17,0 % — l.2941 |
| CO | table | open | COUVERTE | `OPEN.CO` 26,1 % — l.2942 |
| BTN | table | open | COUVERTE | `OPEN.BTN` 44,5 % — l.2943 |
| SB | table | open | COUVERTE | `OPEN.SB` 32,7 % — l.2944 |
| BB | — | (ne peut ouvrir) | s.o. | — |
| toutes | table | **limp / iso** | ABSENTE | `limpRange` modélise le vilain, pas le héros |

**5 / 5 couvertes.**

### 8.2 Matrice principale — face à une ouverture (15 couples × 2 actions)

| Ouvreur ↓ / Répondant → | HJ | CO | BTN | SB | BB |
|---|---|---|---|---|---|
| **UTG** | call ABS · 3bet PART | call ABS · 3bet PART | call ABS · 3bet PART | call **ABS** · 3bet PART | **call COUV** `BB_DEF.UTG` 16,9 % l.2948 · 3bet PART |
| **HJ** | — | call ABS · 3bet PART | call ABS · 3bet PART | call **ABS** · 3bet PART | **call COUV** `BB_DEF.HJ` 22,6 % l.2949 · 3bet PART |
| **CO** | — | — | call ABS · 3bet PART | call **ABS** · 3bet PART | **call COUV** `BB_DEF.CO` 30,8 % l.2950 · 3bet PART |
| **BTN** | — | — | — | call **ABS** · 3bet PART | **call COUV** `BB_DEF.BTN` 45,4 % l.2951 · 3bet PART |
| **SB** | — | — | — | — | **call COUV** `BB_DEF.SB` 47,5 % l.2952 · 3bet PART |

PART = `THREEBET` globale (5,6 %, l.2954) appliquée aux 15 couples.
**Couvertes 5 · Partielles 15 · Absentes 10** (les 10 cold-calls hors BB).

### 8.3 Matrice principale — face à un 3bet (15 couples × 2 actions)

| Nœud | Couples 6-max | Statut | Range |
|---|---|---|---|
| Ouvreur **call** le 3bet | 15 | PARTIELLE ×15 | `callVs3betRange` globale 5,3 % — l.8929, args ignorés |
| Ouvreur **4bet** | 15 | PARTIELLE ×15 | `FOURBET` globale 2,7 % — l.2958 |

**Couvertes 0 · Partielles 30 · Absentes 0.**

### 8.4 Matrice principale — face à un 4bet et au-delà

| Nœud | Couples 6-max | Statut |
|---|---|---|
| 3betteur **call** le 4bet | 15 | **ABSENTE** |
| 3betteur **5bet / tapis** | 15 | **ABSENTE** |

**Absentes 30.**

### 8.5 Matrice principale — multiway préflop

| Nœud | Contextes 6-max | Statut |
|---|---|---|
| **Squeeze** (ouvreur + caller + squeezeur) | 20 triplets | **ABSENTE** (0 occurrence de `squeeze`) |
| Réponse de l'ouvreur au squeeze | 20 | **ABSENTE** |
| **Isolation d'un limpeur** | 15 couples | **ABSENTE** |
| Modèle du limpeur (vilain) | 6 positions | PARTIELLE ×6 (`limpRange` 31,7 %, constante) |

**Partielles 6 · Absentes 55.**

### 8.6 Total — axe position × action

| | Cellules | % |
|---|---|---|
| **COUVERTES** | **10** | **6,4 %** |
| **PARTIELLES** (range globale) | **51** | **32,7 %** |
| **ABSENTES** | **95** | **60,9 %** |
| **TOTAL** | **156** | 100 % |

### 8.7 Axe profondeur de stack

| Profondeur | Ranges spécifiques | Preuve |
|---|---|---|
| Short 20-45 bb (`MODES.short`) | **0** | `prior` identique à 20 et 300 bb ; Range Lab ne tire jamais < 75 bb |
| Standard 40-150 bb | 10 couvertes / 51 partielles | tables l.2939-2958 |
| Deep 150-300 bb (`MODES.deep`) | **0** | idem ; Range Lab ne tire jamais > 200 bb |

Matrice complète 156 × 3 = **468 cellules**, dont **10 couvertes (2,1 %)**,
51 partielles, **407 absentes (87,0 %)**.

### 8.8 Axe rue

| Rue | Ranges de référence | Mécanisme réel |
|---|---|---|
| Préflop | 6 tables (dont 4 globales) | tables statiques l.2939-2958 |
| Flop | **0** | `AI.narrow` (l.3631) coupe par ratio fixe ; `Judge.polarize` (l.4123) |
| Turn | **0** | idem |
| River | **0** | idem |

Il n'existe **aucune range postflop de référence** dans le produit. Le postflop
est entièrement procédural : `narrow()` conserve un ratio codé en dur (raise
0,45 / bet 0,85 / call 0,80 / check 0,92 board-aware, l.3655-3661) appliqué à un
classement de force, sans aucune notion de range d'ouvreur vs range de
défenseur. C'est un choix d'architecture défendable, mais il signifie que
**3 des 4 rues n'ont pas de vérité poker déclarée, seulement une heuristique**.

---

## 9. Contradictions — récapitulatif chiffré

| # | Affirmation A | Affirmation B | Écart mesuré |
|---|---|---|---|
| 1 | `MODES.pot3bet` : « le pot est systématiquement 3bet » (l.3748) | Aucun code ne lit `force3Bet` | 0,9 % délivré vs 100 % promis |
| 2 | `MODES.pot4bet` : « systématiquement 4bet » (l.3749) | Aucun code ne lit `force4Bet` | **0,0 %** sur 559 spots |
| 3 | `BB_DEF` = range de call « hors 3bet » (l.2946) | `THREEBET.bluff` ⊂ `BB_DEF` pour les 5 positions ; `QQ` ∈ `BB_DEF.BTN/SB` ∩ `THREEBET.value` | 10 labels sur 15 en collision |
| 4 | `Ranges.OPEN.SB` = 32,7 % | Règle `sb-loose` (high) se déclenche à VPIP SB > 32 % | La référence déclenche l'alerte |
| 5 | `BB_DEF` → fold BB 67,4 % moyen | Règle `bb-underdefend` : cible 50-58 %, alerte > 62 % | +5,4 pts au-dessus du seuil d'alerte |
| 6 | `THREEBET` = 5,6 % | Règles `low-3bet`/`high-3bet` : cibles 7-9 % / 8-10 % | −1,4 à −4,4 pts |
| 7 | Fold-to-3bet impliqué : 71,7 % (CO), 83,4 % (BTN), 77,4 % (SB) | Règle `fold-3bet` : cible 50-58 %, alerte > 65 % | 3 positions sur 5 au-dessus de l'alerte |
| 8 | Texte de coaching UTG : « 15-18 %, 66+, 76s » (l.15060) | `OPEN.UTG` = 12,1 %, `77+`, ni 76s ni 87s | −3 à −6 pts ; la liste du texte vaut elle-même 11,3 % |
| 9 | `Judge` décide par EV pure (l.4092) | `Ranges.OPEN` = référence déclarée | 28 % de désaccord (34 % en GTO) |
| 10 | `limpRange(pos, P)` / `callVs3betRange(pos, P)` | Corps constant, args non lus | 0 variation sur 6 positions et 2 profils |
| 11 | `BB_DEF` existe (5 ranges, 2 164 combos) | Le jeu principal donne à la BB `OPEN.CO` (26,1 %) via fallback l.3898 | `BB_DEF` inerte hors Range Lab |
| 12 | `LEAK_DRILL.facing = true` (l.14983) | `opt.facing` jamais lu par `Spot.generate` | 20,4 % des spots du drill BB sans ouverture |

---

## 10. Les 5 trous les plus graves, classés par impact pédagogique

**T1 — Tout le contenu 3bet/4bet du jeu principal est inatteignable.**
Deux modes annoncés délivrent 0,9 % et 0,0 %. Deux drills de fuite (`fold-3bet`,
`cold-call`) y renvoient. Un utilisateur ne peut pas s'entraîner sur le nœud
préflop le plus coûteux du 6-max. *Cause : 2 drapeaux déclarés jamais lus.*

**T2 — Aucune range n'est jamais enseignée au héros.**
Les 6 ranges sont exclusivement des modèles de l'adversaire ; aucune grille de
range personnelle n'existe ; la vue Positions affiche des mesures sans
référence. Et quand une référence existe en interne, le jugement la contredit
dans 28 % des ouvertures (34 % en GTO).

**T3 — Le 3bet/4bet n'est pas décliné par couple de positions.**
1 range pour 15 couples, sur 3 nœuds → 45 cellules en partiel, et 30 cellules
totalement absentes au-delà du 4bet. L'asymétrie de position dans la guerre de
relances est le cœur du 6-max ; le produit la traite comme une constante. Effet
mesurable : le fold-to-3bet impliqué varie de 43,8 % à 83,4 % selon l'ouvreur
alors qu'une seule range de continuation existe.

**T4 — La défense de blinde est soit fausse, soit absente.**
`BB_DEF` (la seule range de défense du produit) n'est jamais utilisée par le
moteur de jeu — la BB y hérite de la range d'ouverture du CO. La défense SB
n'existe pas du tout, alors qu'une règle de coaching (`sb-overdefend`) prescrit
un comportement. Le cold-call non-BB (10 couples) n'existe pas non plus.

**T5 — La profondeur de stack n'a aucun effet sur la théorie.**
468 cellules dans la matrice complète, 10 couvertes (2,1 %). Deux modes
(`deep`, `short`) promettent un entraînement différencié et ne changent que la
taille des tapis affichée. Le Range Lab ne quitte jamais la plage 75-200 bb.

---

## 11. Recommandation P0

**Rendre réel ce qui est déjà déclaré, avant d'ajouter la moindre range.**

Le produit ne souffre pas d'abord d'un manque de théorie : il souffre d'un
**écart entre ce qu'il annonce et ce qu'il exécute**. Trois des cinq trous
majeurs (T1, T4-partie BB, et le drapeau `facing`) sont des cellules déjà
*payées* en contenu et rendues inertes par un branchement manquant. Ce sont des
corrections de câblage, pas des décisions de poker — donc réalisables **sans
inventer aucune range**, ce que la contrainte du projet interdit.

Ordre proposé :

1. **Câbler `force3Bet` / `force4Bet` dans `Spot.runToHero`** (l.3920+), de sorte
   que le mode tienne sa promesse. Cela rend accessibles d'un coup : les deux
   modes, les deux drills qui y pointent, et les ranges `THREEBET`, `FOURBET`,
   `callVs3betRange` déjà écrites. **Critère d'acceptation mesurable : ≥ 95 % de
   spots réellement 3bet/4bet à l'instant de la décision du héros** (baseline
   actuelle : 0,9 % / 0,0 %).
2. **Brancher `BB_DEF` dans le moteur de jeu** en remplacement du fallback
   `Ranges.OPEN[pos] || Ranges.OPEN.CO` pour la BB (l.3898). Aucune range
   nouvelle : on utilise celle qui existe déjà et qui dort.
3. **Lire `opt.facing`** dans `Spot.generate` pour que les drills de défense de
   blinde tiennent leur contexte (baseline : 20,4 % hors sujet).
4. **Publier la matrice de couverture dans le produit** — ce que le produit
   couvre et ce qu'il ne couvre pas — plutôt que de laisser l'utilisateur
   supposer une exhaustivité que les 156 cellules démentent.

Ensuite seulement, et **uniquement avec validation d'un joueur expert**, traiter
les contradictions numériques du §9 (#3 à #8). Elles opposent deux contenus
existants ; les arbitrer demande une décision de poker, pas une décision
technique. **Je ne propose aucune valeur de remplacement** : chacun de ces
écarts est signalé, chiffré, sourcé — et laissé ouvert.
