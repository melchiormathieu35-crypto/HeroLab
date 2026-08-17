# AGENT G — TRACKER / COACHING

Audit du moteur de fuites du tracker (`window.Feutre`, `VERSION_PRODUCTION/herolab.html`).
Toutes les valeurs ci-dessous ont été **mesurées en exécutant le code** via
`tests/harness.js`. Aucun chiffre n'est estimé.

## 0. Emplacements réels (rectification du contexte partagé)

| Élément | Ligne annoncée | Ligne réelle (fichier 16 410 l.) |
|---|---|---|
| `LEAK_PLAIN` | 14690 | **14813** |
| `LEAK_DRILL` | 14846 | **14969** |
| `LEAK_COST` | — | 15011 |
| `LEAK_FAMILIES` | — | 15026 |
| `Leaks` (RULES) | 15000+ | **15048** (`RULES` l.15052, 29 objets) |
| `Leaks.detect` | — | 15399 |
| `Stats.compute` | — | 14475 |
| `V.analyse` (rendu) | — | 15925 |
| `App.drillLeak` (pont moteur) | — | 8326 |
| `App.newHand` — branche drill | — | 7177 |

Vérifications d'intégrité (exécutées) :

```
RULES: 29   MIN_HANDS 150   MIN_OPP 25
sev: { high: 8, mid: 19, low: 2 }
règles sans LEAK_PLAIN : []      LEAK_PLAIN orphelins : []
règles sans LEAK_DRILL : []      LEAK_DRILL orphelins : []
LEAK_COST manquants   : []       règles sans famille  : []
why paramétré (fonction) : 29/29 · data paramétré : 29/29 · fix paramétré : 0/29
```

L'inventaire du contexte partagé est donc exact : couverture 29/29, aucune orpheline.
Le problème n'est pas la couverture — il est **en dessous**.

---

## 1. Le tableau des 29 fuites

Légende colonne « Drill » : `mode` du `LEAK_DRILL` + position forcée.
Légende colonne « Cohérence » :
**OK** = le drill place le joueur dans le type de nœud de décision où la fuite se produit ·
**DÉGRADÉ** = bon mode, mais une contrainte demandée n'est pas honorée par le moteur ·
**INADÉQUAT** = le drill n'atteint quasiment jamais le nœud de décision de la fuite.

| # | id | Stat déclencheuse | Seuil `need` | Condition `test` | Sév. | Coût | `why` | Drill (mode / pos) | Cohérence | Ce qui manque pour un parcours complet |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `utg-loose` | VPIP UTG | `byPos.UTG.vpipOpp >= 40` | `posStats[0].vpip > 20` | high | 3.0 | spécifique (chiffré) | preflop / **UTG** | **DÉGRADÉ** — position UTG obtenue **93/200 = 46,5 %** | pos garantie ; en 9-max `normPos` fond MP/UTG+1/UTG-1 dans « UTG » |
| 2 | `sb-loose` | VPIP SB | `byPos.SB.vpipOpp >= 40` | `posStats[4].vpip > 32` | high | 4.0 | spécifique | preflop / **SB** | OK (**200/200**) | drill identique à `sb-overdefend` (doublon) ; pas de distinction open vs défense |
| 3 | `bb-underdefend` | Fold BB | `foldBBOpp >= 40` | `FBB > 62` | mid | 3.5 | spécifique | preflop / **BB** + `facing` | **DÉGRADÉ** — `facing` **jamais lu par le moteur** ; héros face à une mise 305/400 = 76 % | honorer `facing` ; borne de « bonne » fréquence pour le retest |
| 4 | `bb-overdefend` | Fold BB | `foldBBOpp >= 40` | `FBB < 38` | mid | 2.5 | spécifique | preflop / **BB** + `facing` | **DÉGRADÉ** — idem | idem ; conseil contradictoire avec `cold-call` (cf. §2.4) |
| 5 | `low-3bet` | 3Bet % | `tbOpp >= 40` | `TB < 5` | high | 2.0 | spécifique | preflop | OK | pas de garantie « exactement une relance devant » ; 3bet non décliné par couple de positions |
| 6 | `high-3bet` | 3Bet % | `tbOpp >= 40` | `TB > 13` | mid | 2.5 | spécifique | preflop | OK | idem |
| 7 | `fold-3bet` | Fold to 3Bet | `ftbOpp >= 20` | `FTB > 65` | mid | 2.5 | spécifique | **pot3bet** | **INADÉQUAT** — `force3Bet` **n'est lu nulle part** : 6/1500 = **0,4 %** de vrais pots 3bet, identique à `libre` (9/1500) | implémenter `force3Bet` ; `ftbOpp>=20` = conjonction open × 3bet, la plus rare des 29 |
| 8 | `call-station` | AF postflop | `calls+bets+raises >= 60` | `AF < 1.3` | high | 5.5 | spécifique | flop | **INADÉQUAT** — la fuite est « je paie » : le héros fait face à une mise **12,8 %** des spots flop | filtre de nœud « défenseur face à une mise » ; AF mesuré sur 3 rues, drillé au flop |
| 9 | `maniac` | AF + W$SD | `calls+bets+raises >= 60` | `AF > 4.5 && WSD < 48` | mid | 4.0 | spécifique | flop | OK (nœud d'agresseur, ~87 %) | seuil `AF>4.5` extrême (cf. §3) ; `AF` peut valoir `Infinity` → `"AF de Infinity"` affiché |
| 10 | `no-value` | W$SD + WTSD | `wtsdOpp >= 60` | `WSD > 58 && WTSD < 22` | mid | 3.0 | spécifique | river | OK | double conjonction très restrictive ; message quasi identique à `river-undervalue` |
| 11 | `fold-flop` | Fold to CBet | `fcbOpp >= 30` | `FCB > 58` | high | 4.0 | spécifique | flop | **INADÉQUAT** — nœud « face à une cbet » atteint **12,8 %** | filtre de nœud ; `fcbOpp` compte toute mise adverse au flop, pas seulement celle de l'agresseur préflop |
| 12 | `cbet-low` | CBet flop | `cbFOpp >= 30` | `CBF < 45` | mid | 2.5 | spécifique | flop | OK | pas de contrainte de texture (le `fix` parle de flops A72r/K83r, le drill ne les cible pas) |
| 13 | `cbet-high` | CBet flop | `cbFOpp >= 30` | `CBF > 82` | low | 2.0 | spécifique | flop | OK | idem (le `fix` cible 765/J98) |
| 14 | `no-steal` | Steal % | `stealOpp >= 40` | `STEAL < 28` | mid | 4.5 | spécifique | preflop / **BTN** | **DÉGRADÉ** — BTN obtenu **175/200 = 87,5 %** ; aucune garantie de pot vierge | forcer « pot non ouvert » ; `stealOpp` mélange CO/BTN/SB, le drill ne cible que BTN |
| 15 | `limp` | limps / mains | `n >= 200` | `limped/n > 0.06` | mid | 3.5 | spécifique | preflop | OK | recouvre `vpip-pfr-gap` et `cold-call` (§2.3) |
| 16 | `vpip-pfr-gap` | VPIP − PFR | `n >= 200` | `VPIP-PFR > 10` | mid | 3.0 | spécifique | preflop | OK | idem |
| 17 | `nit` | VPIP | `n >= 200` | `VPIP < 16` | mid | 2.0 | spécifique | preflop | OK | — |
| 18 | `loose` | VPIP | `n >= 200` | `VPIP > 32` | high | 5.0 | spécifique | preflop | OK | recouvre `utg-loose` / `sb-loose` (coûts cumulés) |
| 19 | `giveup-turn` | GIVEUPT | `giveupTOpp >= 25` | `GIVEUPT > 62` | high | 3.5 | spécifique | turn | OK (nœud d'agresseur) | **doublon strict de `turn-barrel-low`** (§2.1) ; se déclenche aussi quand le flop a été checké (§2.2) |
| 20 | `river-callstation` | CALLR | `callROpp >= 25` | `CALLR > 62` | high | 4.5 | spécifique | river | **INADÉQUAT** — nœud « face à une mise river » atteint **10,3 %** | filtre de nœud défenseur river |
| 21 | `multiway-overfold` | MWFOLD | `mwOpp >= 25` | `MWFOLD > 55` | mid | 2.0 | spécifique | **multiway** | **INADÉQUAT** — mode `multiway` produit **400/400 = 100 % de spots PRÉFLOP** et 7 % de spots à 2 joueurs ; la fuite est un fold **au flop** à 3+ | `multiway` doit combiner `minPlayers` **et** `forceStreet:"flop"` **et** nœud défenseur |
| 22 | `bet-too-big` | BETBIG | `betBigOpp >= 30` | `BETBIG > 55` | mid | 2.5 | spécifique | flop | OK (les tailles 1/3, 1/2, 2/3, pot, tapis sont proposées) | seuil quasi inatteignable (§3) ; pot reconstruit avec un léger sur-comptage (§2.6) |
| 23 | `bet-too-small` | BETSMALL | `betSmallOpp >= 30` | `BETSMALL > 60` | low | 2.0 | spécifique | flop | OK | mesuré sur 3 rues, drillé au flop uniquement |
| 24 | `turn-barrel-low` | CBT | `cbTOpp >= 25` | `CBT < 38` | mid | 2.5 | spécifique | turn | OK | **doublon strict de `giveup-turn`** (§2.1) |
| 25 | `river-undervalue` | CBR | `cbROpp >= 22` | `CBR < 30` | mid | 3.0 | spécifique | river | OK | message quasi identique à `no-value` |
| 26 | `no-checkraise` | CR | `crOpp >= 40` | `CR < 4` | mid | 2.0 | spécifique | flop | **INADÉQUAT** — sur **2000 spots flop générés, 0 nœud de check-raise** (héros ayant checké puis faisant face à une mise) | nœud check-raise inexistant dans le moteur ; dénominateur `crOpp` faussé (§2.5) |
| 27 | `cold-call` | COLD | `coldOpp >= 40` | `COLD > 12` | mid | 2.5 | spécifique | **pot3bet** | **INADÉQUAT** — mauvais contexte (la fuite porte sur le call d'une **ouverture simple**, pas d'un 3bet) **et** `pot3bet` est un no-op | mode « face à une ouverture unique » ; `coldOpp` compte les calls BB comme cold-calls (§2.4) |
| 28 | `sb-overdefend` | FSB | `foldSBOpp >= 40` | `FSB < 70` | mid | 3.0 | spécifique | preflop / **SB** | **DÉGRADÉ** — pas de `facing`, drill strictement identique à `sb-loose` | distinguer « ouvrir en SB » de « défendre la SB face à une ouverture » |
| 29 | `showdown-curious` | WTSD | `wtsdOpp >= 60` | `WTSD > 34` | mid | 3.5 | spécifique | river | **INADÉQUAT** — le `fix` dit « abandonne **plus tôt** » (flop/turn) mais le drill est river ; et le nœud défenseur river n'apparaît que **10,3 %** du temps | drill flop+turn en défense, pas river |

**Colonne `why`** : les 29 règles ont un `why` **paramétré** (fonction de `s`) et un `data`
paramétré. Les 29 `fix` sont des **chaînes statiques** — aucun conseil n'est calibré sur les
chiffres du joueur.

**Aggravant, mesuré à la l.15939-15947** : le mode d'affichage par défaut est
`V.leakMode = "debutant"`. Dans ce mode, `why` **et** `fix` sont remplacés par le texte
statique de `LEAK_PLAIN`, et la ligne `data` est masquée
(`${beginner ? "" : '<div class="data">…'}`). **Par défaut, le joueur ne voit donc aucun de
ses propres chiffres** — ni la stat, ni le seuil, ni l'échantillon. Le seul `why` paramétré
du moteur n'apparaît que si l'utilisateur bascule en mode « Expert ».

---

## 2. Anomalies structurelles prouvées par exécution

### 2.1 `giveup-turn` et `turn-barrel-low` sont la même règle (doublon strict)

Les deux compteurs partagent **exactement** le même dénominateur (l.14664-14688 :
`lastStreetAggressor === hero`, `!betBefore`, première action du héros existante) et des
numérateurs complémentaires. Mesuré sur 5 mains construites (2 barrels, 3 abandons) :

```
giveupTOpp 5  giveupT 3  GIVEUPT 60
cbTOpp     5  cbT     2  CBT     40
GIVEUPT + CBT = 100
```

`GIVEUPT > 62` ⟺ `CBT < 38` (62 + 38 = 100). Les deux fuites se déclenchent donc **toujours
ensemble ou jamais**. Conséquences : deux cartes identiques dans la même famille
`turn-river`, deux boutons d'entraînement vers le même mode `turn`, et un **double comptage
de 6,0 bb/100** (3,5 + 2,5) dans le « coût total estimé de tes fuites » affiché l.15990.

### 2.2 `giveup-turn` se déclenche sur des mains où le héros n'a jamais misé le flop

Le titre, le `why` et le `fix` disent tous « après avoir misé au flop ». Le code ne le teste
pas : il teste `lastStreetAggressor === hero`, qui reste vrai si le flop est checké des deux
côtés (le héros est encore l'agresseur préflop). Main témoin (héros relance préflop, flop
checké-checké, héros checke le turn) :

```
giveupTOpp = 1   giveupT = 1   GIVEUPT = 100
cbFOpp = 1  cbF = 0   (le héros n'a jamais misé le flop)
```

Le diagnostic accuse le joueur d'un comportement qu'il n'a pas eu.

### 2.3 `pot3bet` et `pot4bet` sont des modes vides

`force3Bet` / `force4Bet` sont déclarés l.3748-3749 et **lus nulle part** dans le fichier
(vérifié par recherche exhaustive). Distribution du nombre de relances déjà faites au moment
de la décision du héros, sur 1500 spots par mode :

| mode | 0 relance | 1 relance | **2 relances (vrai pot 3bet)** |
|---|---|---|---|
| `libre` | 911 | 580 | 9 |
| `preflop` | 934 | 555 | 11 |
| **`pot3bet`** | 928 | 566 | **6 (0,4 %)** |
| `pot4bet` | 940 | 555 | 5 |

Sur les 10 spots d'un drill `fold-3bet`, l'espérance est de **0,04 spot pertinent**.

### 2.4 `coldOpp` compte les défenses de grosse blinde comme des cold-calls

L.14591-14596 : `coldOpp++` est incrémenté dans le bloc `if (raisesBefore === 1)`, sans
exclure la BB. Un call de défense BB face à une ouverture est donc compté comme un cold-call.
Conséquence directe : le `fix` de `bb-underdefend` (« défends plus, garde les paires, les
suited connectors ») **augmente mécaniquement** `COLD`, donc pousse vers le déclenchement de
`cold-call`, dont le `fix` dit « 3-bet ou fold, ne garde le call que rarement ». Les deux
cartes peuvent s'afficher côte à côte en se contredisant.

### 2.5 `no-checkraise` mesure les checks, pas les occasions de check-raise

L.14666-14671 : `crOpp++` est incrémenté à **chaque check** du héros sur chaque rue postflop,
qu'une mise suive ou non. Main témoin (héros checke flop/turn/river, adversaire checke
derrière à chaque fois — aucune occasion de check-raise n'a existé) :

```
crOpp = 3   cr = 0   CR = 0
```

`CR` affiché = `CR` réel × (checks suivis d'une mise / tous les checks). Le seuil de 4 % est
donc appliqué à une valeur diluée par un facteur inconnu et non mesuré : un joueur qui
check-raise à une fréquence saine peut être diagnostiqué fautif. Le drill associé, lui, ne
peut rien corriger (0 nœud sur 2000).

### 2.6 Reconstruction du pot pour les stats de sizing

L.14700-14710 : `potBefore` additionne les `post` de blindes **et** le `to` des relances. Or
un `raise ... to X` de Winamax inclut déjà la blinde postée par ce joueur. Le sur-comptage
vaut donc la somme des blindes postées par des joueurs ayant ensuite relancé (≤ SB + BB).
Vérifié : mise de 0,15 € dans un pot réel de 0,30 € (50 %) → le tracker calcule
0,15 / 0,32 = 46,9 %, classée ni « grosse » ni « petite ». **Biais faible et connu** (il
sous-estime la fraction, donc sous-déclenche `bet-too-big` et sur-déclenche `bet-too-small`),
mais il rend les deux seuils non exactement interprétables.

### 2.7 `Leaks.MIN_OPP = 25` est du code mort

Déclaré l.15050, **jamais référencé**. Chaque règle code son propre seuil `need` en dur
(valeurs observées : 20, 22, 25, 30, 40, 60, 200). Aucune politique de taille d'échantillon
n'est centralisée.

### 2.8 Deux vocabulaires de fuites disjoints

| Vocabulaire | Où | Taille |
|---|---|---|
| Tracker (import) | `Leaks.RULES` / `LEAK_PLAIN` / `LEAK_DRILL` / `LEAK_COST` / `LEAK_FAMILIES` | **29** |
| Moteur de jeu (en partie) | `LEAK_INFO` l.4849 + `Progress.focusFor` l.4830 + tags `leak:` du Judge | **10** |

Intersection mesurée : **2 ids seulement** (`bb-underdefend`, `bb-overdefend`).
`fold-to-3bet` (moteur) ≠ `fold-3bet` (tracker) : orthographes différentes, jamais reliées.

Conséquence : `Player.recordMastery(key, ok)` (l.6141) et `Player.masteryLevel` ne
s'alimentent qu'avec le vocabulaire du moteur. **27 des 29 fuites du tracker ne peuvent
jamais accumuler de maîtrise.** Un drill lancé depuis le diagnostic ne crédite pas la fuite
qu'il est censé corriger.

### 2.9 Le drill est intégralement éphémère

`App.drillRun` (l.8331) est un objet en mémoire : `{leak, title, cfg, label, i, total,
correct, acceptable, finishing}`. Rien n'est écrit dans `localStorage`. L'écran de bilan
(l.7392-7418) affiche le score puis propose « Refaire 10 spots » ou « Retour au diagnostic » —
et le score disparaît. **Aucune trace** : pas d'historique de drills, pas de courbe, pas de
seuil de maîtrise, pas de rappel espacé, pas de comparaison avant/après.

---

## 3. Fuites qui ne peuvent (quasiment) jamais se déclencher

**Aucune règle n'est logiquement contradictoire** : pour les 29, il existe un état `s` qui
satisfait simultanément `need` et `test`. Les blocages sont statistiques ou structurels.

| id | Nature du blocage | Détail |
|---|---|---|
| `fold-3bet` | **Échantillon** | `ftbOpp >= 20` exige la conjonction « le héros ouvre » × « un adversaire 3bet » — le produit d'événements le plus rare des 29 dénominateurs. Exigence d'historique d'un ordre de grandeur au-dessus des autres règles. |
| `bet-too-big` | **Seuil** | `BETBIG > 55` exige que **plus de la moitié** des premières mises du joueur fassent ≥ 90 % du pot, alors que le moteur ne compte qu'une mise par rue et que la reconstruction du pot (§2.6) sous-estime la fraction. |
| `maniac` | **Seuil + conjonction** | `AF > 4.5` **et** `WSD < 48`. Le repère usuel d'un profil hyper-agressif est AF ≈ 3 ; 4,5 place le seuil très au-delà. Cas limite : si `calls === 0`, `AF = Infinity` et le `why` affiche littéralement « AF de Infinity » (`Infinity.toFixed(2)`). |
| `no-value` | **Conjonction** | `WSD > 58` **et** `WTSD < 22` simultanément, sur `wtsdOpp >= 60`. |
| `no-checkraise` | **Inverse : sur-déclenchement** | Dénominateur faussé (§2.5) : la règle se déclenche pour des joueurs qui check-raisent correctement. |
| `giveup-turn` | **Inverse : sur-déclenchement** | Se déclenche sur des flops checkés (§2.2). |
| `cold-call` | **Inverse : sur-déclenchement** | Les défenses BB gonflent `COLD` (§2.4). |
| `turn-barrel-low` | **Jamais seule** | Strictement liée à `giveup-turn` (§2.1). |
| `utg-loose` | **Échantillon positionnel** | `byPos.UTG.vpipOpp >= 40` → en 6-max, UTG = exactement 1/6 des mains, donc **≥ 240 mains** requises, au-dessus de `MIN_HANDS = 150`. En 9-max, `normPos` (l.14465) fond MP / UTG+1 / UTG-1 / UTG-2 dans « UTG » : le seuil de 20 % s'applique alors à un mélange de 4 sièges. |

---

## 4. Le tracker a-t-il une notion de PREUVE ? — **Non.**

Chaîne vérifiée de bout en bout :

1. `Stats.compute(hands)` (l.14475) construit **un objet de compteurs scalaires**. Aucun des
   ~60 champs (`byPos`, `byHole`, `byHour`, `byDay`, `curve`) ne stocke d'identifiant de main.
   `byHole[label] = { n, profit, bb, won }` — pas d'`ids[]`.
   Seules exceptions : `biggestWin` / `biggestLoss` gardent une référence de main — non
   exploitées par les fuites.
2. `Leaks.detect(s, hands)` (l.15399) **reçoit** `hands` et le transmet à
   `holeLeaks(s, hands)` — dont le corps **n'utilise jamais** le paramètre `hands` (il lit
   `s.byHole`). Le paramètre est mort.
3. Chaque item produit est `{ id, sev, title, why, fix, data }`. **Aucun champ de preuve.**
4. Le rendu `V.analyse` (l.15925) n'affiche `data` (une ligne de fréquence agrégée) qu'en
   mode « Expert », donc **jamais par défaut**.
5. La vue « mains » (`V.hands`, l.16080) possède 11 filtres — `AA`, `KK`, `AK`, `pair`, `sc`,
   `sa`, `won`, `lost`, `big`, `allin`, `sd` — plus un filtre de position et une recherche
   plein texte sur `hole + label + board + pos + table + id`. **Aucun filtre de fuite**,
   aucun lien depuis une carte de diagnostic vers une liste de mains.
6. `Store.sessions[].handIds[]` existe (l.14350) mais ne sert qu'au regroupement par session
   d'import, jamais à une fuite.

**Verdict : la chaîne stat → fuite est unidirectionnelle et sans retour.** Le joueur ne peut
pas voir une seule main qui démontre la fuite dont on l'accuse. C'est le trou pédagogique le
plus grave : le diagnostic est une assertion, pas une démonstration.

---

## 5. Architecture proposée : le « leak path »

### 5.1 Le problème à résoudre

Aujourd'hui, **ajouter une fuite impose de toucher 5 tables distinctes** dans le fichier
applicatif : `Leaks.RULES` (l.15052), `LEAK_PLAIN` (14813), `LEAK_DRILL` (14969),
`LEAK_COST` (15011), `LEAK_FAMILIES` (15026) — et il n'existe aucune vérification que les
cinq restent alignées. La cohérence 29/29 actuelle est tenue à la main.

### 5.2 Registre unique, déclaratif

Un seul objet par fuite, dans un registre `LEAK_PATHS` (un `const` en tête de l'IIFE
`Feutre`, ou un bloc `<script type="application/json" id="leak-paths">` lu une fois au
démarrage — la deuxième forme rend le registre éditable sans toucher au JS et survit à la
couche de stockage de la Phase 3).

```jsonc
{
  "id": "river-callstation",
  "family": "turn-river",
  "sev": "high",
  "cost": 4.5,

  // 1. STAT + 2. DIAGNOSTIC — remplace RULES : plus de fonctions, des données
  "detect": {
    "stat": "CALLR",              // clé calculée par Stats.compute
    "opp":  "callROpp",           // dénominateur
    "minOpp": 25,
    "cmp": ">", "threshold": 62,
    "healthy": [40, 55]           // sert au retest ET aux "strengths"
  },

  // 3. HYPOTHÈSE — la phrase testable, affichée avant la preuve
  "hypothesis": "Tu paies des mises river que tu ne peux pas battre assez souvent.",

  // 4. PREUVE — prédicat déclaratif évalué par un matcher générique sur Store.hands
  "evidence": {
    "match": { "street": "river", "heroRole": "defender",
               "heroAction": "call", "result": "lost" },
    "sort": "loss", "limit": 5,
    "caption": "Les 5 mains où ce call t'a coûté le plus."
  },

  // 5. COURS COURT — deux registres, référence obligatoire (contrainte n°2)
  "lesson": {
    "plain": { "title": "…", "why": "…", "fix": "…" },
    "expert": { "title": "…", "why": "…", "fix": "…" },
    "ref": "cote du pot / fréquence de bluff minimale",
    "readMs": 40000
  },

  // 6. DRILL — contraintes de génération, y compris le NŒUD
  "drill": {
    "mode": "river",
    "node": { "role": "defender", "facing": "bet", "players": 2 },
    "spots": 10, "label": "T'entraîner : payer ou passer à la river"
  },

  // 7-8. RÉPÉTITION + MAÎTRISE
  "mastery": { "passRate": 0.8, "minSpots": 20, "sessions": 2,
               "spacingDays": [1, 3, 7] },

  // 9-10. RETEST + ÉVOLUTION
  "retest": { "stat": "CALLR", "opp": "callROpp", "minOpp": 25,
              "target": [40, 55], "window": "sinceMastered" },
  "next": ["river-undervalue"]
}
```

### 5.3 Ce que le moteur exécute (générique, écrit une fois)

| Champ | Consommateur générique | État actuel |
|---|---|---|
| `detect` | `Leaks.detect` devient une boucle sur `LEAK_PATHS` : `s[opp] >= minOpp && cmp(s[stat], threshold)` | à écrire, remplace 29 paires de closures |
| `evidence.match` | **`Evidence.find(hands, match)`** — un matcher sur la structure `h.actions[street]` déjà produite par le Parser | **manque totalement** |
| `lesson` | rendu existant (`V.analyse`), avec `plain`/`expert` déjà en place | existe |
| `drill.node` | `Spot.generate` doit accepter un **filtre de nœud** (`role`, `facing`, `players`) et rejeter les spots non conformes | **manque — c'est le seul blocage moteur réel** |
| `mastery` | `Player.recordMastery(path.id, ok)` appelé depuis `App.drillRun` avec **l'id du path**, plus `nextDue` en `localStorage` | mécanique existe, jamais câblée sur les 29 ids |
| `retest` | recalcul de `Stats.compute` sur la fenêtre `[dateMastered, now]` — `Store.sessions[].handIds` fournit déjà le découpage | à écrire, données disponibles |
| `next` | file d'attente du parcours | à écrire |

**Où stocker.** Le registre lui-même : dans le mono-fichier (bloc JSON ou `const`), versionné
avec l'appli. L'état par joueur (`{ leakId: {status, masteredAt, drillHistory[], statAtDetect,
statAtRetest} }`) : une **10ᵉ clé `localStorage`** dédiée, `hl.leakpaths.v1` — séparée de
`Progress` et de `Player` pour ne pas alourdir des objets déjà écrits à chaque décision, et
pour rester une seule clé à migrer sous la couche de stockage de la Phase 3.

**Propriété visée : ajouter une fuite = ajouter un objet JSON.** Elle est atteinte à une
condition, et une seule : que `Spot.generate` sache honorer `drill.node`. Sans ce filtre,
`bb-underdefend` (`facing:true` ignoré depuis toujours), `no-checkraise` (0/2000),
`multiway-overfold` (0 spot flop), `call-station`, `fold-flop`, `river-callstation`,
`showdown-curious` et `fold-3bet` resteront non entraînables quelle que soit la qualité du
registre.

---

## 6. Écart entre la chaîne cible et la chaîne réelle

| Étape cible | État mesuré |
|---|---|
| stat | ✅ `Stats.compute`, ~60 compteurs |
| diagnostic | ✅ 29 règles, familles, coûts, tri par coût |
| hypothèse | ❌ inexistant — le diagnostic assène, il ne propose pas |
| **preuve** | ❌ **inexistant** — aucune main reliée à aucune fuite (§4) |
| cours court | ⚠️ existe (`LEAK_PLAIN` / `why`+`fix`), mais `fix` statique 29/29 et chiffres masqués par défaut |
| drill | ⚠️ 16 cohérents / 5 dégradés / **8 inadéquats** |
| répétition | ❌ « Refaire 10 spots » manuel, sans espacement ni mémoire |
| maîtrise | ❌ `recordMastery` existe mais 27/29 ids ne l'atteignent jamais (§2.8) |
| retest | ❌ aucune notion de fenêtre temporelle ni de snapshot de stat |
| évolution | ❌ aucun enchaînement entre fuites |

**4 étapes sur 10 fonctionnent, 2 partiellement, 4 sont absentes.**

---

## 7. Recommandations, par ordre de rendement

1. **P0 — Filtre de nœud dans `Spot.generate`** (`role: aggressor|defender`,
   `facing: bet|raise|none`, `street`, `players`). C'est le seul verrou moteur ; il débloque
   d'un coup les 8 drills inadéquats et les 5 dégradés, rend `facing:true` (déjà écrit,
   jamais lu) opérant, et c'est la précondition unique de toute l'architecture `leak path`.
   Mesure de contrôle : le taux « héros face à une mise » doit passer de 10-13 % à ~100 % sur
   les drills défensifs, et le nœud de check-raise de 0/2000 à un taux non nul.
2. **P0 bis — `Evidence.find`** : un matcher déclaratif sur `Store.hands` + un bloc « les
   mains qui le montrent » sous chaque carte de diagnostic. Le coût est faible (les actions
   par rue sont déjà structurées par le Parser, `V.handRow` sait déjà rendre une main
   dépliable) et c'est ce qui transforme une accusation en démonstration.
3. **P1 — Fusionner `giveup-turn` et `turn-barrel-low`** (une seule fuite, un seul coût) et
   corriger son test pour exiger une mise réelle au flop. Retire 2,5-3,5 bb/100 de
   double-comptage du total affiché.
4. **P1 — Réparer 3 dénominateurs** : `crOpp` (ne compter que les checks suivis d'une mise),
   `coldOpp` (exclure la BB), `fcbOpp` (exiger que le miseur soit l'agresseur préflop).
5. **P1 — Implémenter ou retirer `force3Bet` / `force4Bet`**, aujourd'hui déclarés et morts.
6. **P2 — Unifier les deux vocabulaires** (29 tracker / 10 moteur, 2 en commun) sur les ids du
   registre, condition de tout suivi de maîtrise.
7. **P2 — Persister les drills** (clé `hl.leakpaths.v1`) pour ouvrir répétition, maîtrise et
   retest.
8. **P3 — Afficher les chiffres du joueur en mode débutant** (au minimum la stat, son seuil et
   la taille d'échantillon), sans quoi le diagnostic reste invérifiable par celui qu'il vise.

---

### Annexe — méthode

Tous les chiffres proviennent de `tests/harness.js`, chargé avec
`FEUTRE_MODULES` étendu en mémoire à `["Leaks", "LEAK_COST", "LEAK_FAMILIES"]` et `MODULES`
à `["LEAK_INFO"]` (le harness expose ces tableaux ; **aucun fichier applicatif ni de test n'a
été modifié**). Les mains témoins (§2.1, 2.2, 2.5, 2.6) sont des historiques Winamax
synthétiques passés dans `Parser.parseFile` puis `Stats.compute` — ce sont des **sondes du
moteur**, pas des statistiques de joueur. Les taux de génération (§2.3 et colonne
« Cohérence ») proviennent de `Spot.generate` + `Spot.options`, sur les effectifs indiqués
à chaque ligne (200 à 2000 spots).
