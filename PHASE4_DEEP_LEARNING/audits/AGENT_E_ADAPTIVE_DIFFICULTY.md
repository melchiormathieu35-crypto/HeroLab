# AGENT E — DIFFICULTÉ ADAPTATIVE

Audit de la gestion actuelle de la difficulté dans HeroLab, puis conception d'un
contrôleur dynamique branché sur `Spot.generate` **sans toucher au moteur**.

Tous les chiffres de ce document ont été **mesurés en exécutant le moteur** via
`tests/harness.js` sur `VERSION_PRODUCTION/herolab.html`. Aucun n'est estimé.
Les scripts de mesure sont décrits en §4.6 et sont réexécutables.

**Lecture rapide** — les trois résultats à retenir : la difficulté est
intégralement statique (§1.1) ; le *mode* fait 1,7 fois plus varier la difficulté
que le *niveau* affiché au joueur (§1.5) ; le contrôleur proposé supprime l'ennui
et le décrochage de façon démontrée, mais ne tient pas encore la bande 70-85 %
sur le moteur réel — limite du générateur, correctif identifié (§5.1-5.2).

---

## 1. AUDIT DE L'EXISTANT

### 1.1 Verdict

> **La difficulté de HeroLab est intégralement STATIQUE.** Les quatre systèmes de
> difficulté du produit (LEVELS + trois labs) sont pilotés **exclusivement par un
> `onclick`**. Aucune ligne du fichier n'ajuste une difficulté à partir de la
> performance mesurée. Le seul mouvement automatique de tout le produit est une
> **rétrogradation de carrière déclenchée par la bankroll**, pas par la qualité de jeu.

### 1.2 Preuve : les points d'écriture de chaque difficulté

Il n'existe que sept endroits où une difficulté est affectée. Tous sont des
gestionnaires de clic ou des dérivations d'un état lui-même piloté au clic.

| Système | Écriture | Ligne | Déclencheur |
|---|---|---|---|
| `LEVELS` (jeu) | `App.set('level', k)` | 7825 | `onclick` sur un bouton de la fiche de configuration |
| `LEVELS` (carrière) | `cfg.level = Career.levelForTier(tier)` | 7208 | dérivé du palier de carrière |
| `HR_DIFFICULTY` | `HRUI.setDiff(d)` → `HRUI.difficulty = d` | 10185 | `onclick` (l. 10141) |
| `PR_DIFFICULTY` | `PRUI.setDiff(d)` → `PRUI.difficulty = d` | 12084 | `onclick` (l. 12055) |
| `BL_DIFFICULTY` | `BLUI.setDiff(d)` → `BLUI.difficulty = d` | 13395 | `onclick` (l. 13364) |
| Palier de carrière ↑ | `Career.promote()` → `d.tierIndex++` | 5753 / 5757 | `App.promote()` (l. 8372), bouton `onclick` l. 8647 |
| Palier de carrière ↓ | `Career.checkDemotion()` → `d.tierIndex--` | 5768-5772 | `Bankroll.shouldMoveDown()` — **bankroll, pas performance** |

Une recherche sur `adapt|autoLevel|escalate|difficultyAuto` dans le corps JS ne
renvoie aucun mécanisme d'ajustement : les seules occurrences de « adapt » sont
des textes descriptifs de profils adverses (l. 2962, 3097, 3113).

`Career.promote()` est bien conditionné à la performance
(`promotionStatus()` vérifie `reqHands`, `reqWinrate`, `reqAccuracy`, `reqBuyins`),
mais c'est une **porte à franchir manuellement**, pas une boucle de régulation :
le joueur doit cliquer, et rien ne le redescend s'il s'écroule — sauf la bankroll.

### 1.3 Ce que `LEVELS` fait réellement (et ce qu'il ne fait pas)

`LEVELS` (l. 3709-3739) déclare quatre champs par niveau. **Deux seulement sont
consommés.**

| Champ | Consommé ? | Où |
|---|---|---|
| `pool` | oui | `Spot.generate` l. 3872 — **écrasé par `opt.profiles` s'il est fourni** |
| `tolerance` | oui | `Judge.evaluate` l. 4169, **unique point d'usage** |
| `hint` | **non — code mort** | aucune occurrence de `level.hint` dans tout le fichier |
| `mode` | à moitié | `t.level.mode === "exploit"` déclenche un bloc d'affichage (l. 7729). **`mode: "gto"` n'est lu nulle part.** |

Conséquence documentée : le niveau **GTO** annonce « jugement sur la stratégie non
exploitable, sans tenir compte des tendances adverses ». En réalité il ne diffère
de **Professionnel** que par `tolerance` (0.04 contre 0.05) et par son pool. Le
jugement reste strictement identique — il continue de modéliser les tendances
adverses via `profile.callDown`, `profile.bluff` et `Judge.partition`.

La formule de verdict, unique dans tout le produit (l. 4169-4170) :

```js
tolerance = (1.0 * bb + pot * 0.03) * (level.tolerance / 0.1)
verdict   = loss <= tolerance * 0.35 ? "correct"
          : loss <= tolerance        ? "acceptable"
          : "erreur"
```

`level` n'agit donc que comme un **multiplicateur scalaire du seuil de sanction**.
Il ne change ni la génération du spot (hors pool), ni le modèle d'EV, ni l'IA.

### 1.4 Ce que `Spot.generate` accepte réellement

Extraction automatique des options lues dans le corps de `Spot.generate` et
`Spot.runToHero` :

```
opt.*  : level, mode, stake, players, stackRange, rake, forcePos, profiles, roster
mode.* : heads, minPlayers, stack, forceStreet, stopAt
```

**Options déclarées mais jamais lues — code mort confirmé :**

| Option | Déclarée | Lue |
|---|---|---|
| `mode.force3Bet` | `MODES.pot3bet`, l. 3748 | **nulle part** |
| `mode.force4Bet` | `MODES.pot4bet`, l. 3749 | **nulle part** |
| `opt.focus` | JSDoc de `generate`, l. 3841 | **nulle part** |
| `opt.facing` | affecté l. 7181, transmis l. 8333 | **nulle part** |

Mesure de confirmation sur 300 spots par mode, part de pots réellement 3-bet
(≥ 2 relances préflop dans le journal) :

| Mode | pots 3-bet obtenus |
|---|---|
| `libre` | 0.4 % |
| `pot3bet` | **0.0 %** |
| `pot4bet` | **0.0 %** |

Les modes « Pots 3Bet » et « Pots 4Bet » sont **strictement équivalents à
`libre`**. Quatre modes d'entraînement sur treize (`pot3bet`, `pot4bet`, plus
`cible` qui ne fait que réaiguiller `mode`) reposent sur des drapeaux inertes.

Autre mesure structurante : **`libre` produit 100 % de décisions préflop**
(281/281 spots exploitables). C'est logique — `runToHero` s'arrête au premier tour
de parole du héros — mais cela signifie que **la rue n'est contrôlable que par
`mode.forceStreet`**. La répartition 30/23/24/23 du contexte partagé décrit les
décisions d'une main *jouée jusqu'au bout* par `Play.step`, pas la sortie de
`Spot.generate`.

Enfin, `mode.stack` **écrase** `opt.stackRange` (`const sr = mode.stack || opt.stackRange`,
l. 3853) : les modes `deep`/`short` et le réglage fin de profondeur sont mutuellement
exclusifs. À l'inverse, `opt.profiles` **écrase** `level.pool` (l. 3872) : c'est le
vrai levier sur les profils adverses.

### 1.5 Mesure de la difficulté réelle des niveaux et des modes

Pour mesurer la difficulté sans supposer de joueur, on utilise l'**indulgence** du
spot :

```
F = card{ options : EV_best − EV_option ≤ tolerance } / card{ options }
```

`F` est la probabilité exacte qu'une action tirée au hasard **ne** soit **pas**
jugée « erreur ». `1 − F` est donc une mesure directe de la sévérité du spot,
calculée par le vrai `Judge` sur les vraies options.

**1 836 spots jugés** (6 niveaux × 9 modes × 34) :

| Niveau | `tolerance` | tol. moyenne (bb) | F | 1 − F |
|---|---|---|---|---|
| Débutant | 0.14 | 1.64 | 0.676 | 0.324 |
| Intermédiaire | 0.10 | 1.27 | 0.602 | 0.398 |
| Avancé | 0.07 | 0.81 | 0.561 | 0.439 |
| Professionnel | 0.05 | 0.58 | 0.544 | 0.456 |
| GTO | 0.04 | 0.46 | 0.490 | 0.510 |
| Exploit | 0.08 | 1.22 | 0.498 | 0.502 |

| Mode | F | 1 − F | pot moyen (bb) |
|---|---|---|---|
| BTN vs BB | 0.698 | 0.302 | 2.1 |
| Blind vs Blind | 0.706 | 0.294 | 1.9 |
| Deep stack | 0.574 | 0.426 | 2.7 |
| Partie libre | 0.572 | 0.428 | 2.8 |
| Short stack | 0.560 | 0.440 | 2.6 |
| Multiway | 0.539 | 0.461 | 3.1 |
| Flop | 0.535 | 0.465 | 8.2 |
| Turn | 0.476 | 0.524 | 16.6 |
| **River** | **0.396** | **0.604** | 31.9 |

> **Constat central de l'audit : le MODE fait plus varier la difficulté que le
> NIVEAU.** L'amplitude sur les six niveaux est de 0.186 en `1 − F`
> (0.324 → 0.510). L'amplitude sur les neuf modes est de **0.310** (0.294 → 0.604),
> soit **1,7 fois plus**. Le seul réglage présenté à l'utilisateur comme « la
> difficulté » est le moins puissant des deux, et les deux axes sont réglés
> indépendamment, sans aucune coordination.

Conséquence pratique : « Débutant + River » (1 − F ≈ 0.53) est nettement plus dur
que « GTO + BTN vs BB » (1 − F ≈ 0.33). Le libellé affiché au joueur est
trompeur dans les deux sens.

---

## 2. CONCEPTION — LES AXES DE DIFFICULTÉ

### 2.1 Principe

On sépare deux choses que le produit actuel confond :

- **la difficulté du SPOT** — combien de décisions distinctes sont acceptables, et
  à quel point l'écart entre elles est punitif ;
- **la sévérité du JUGE** — `level.tolerance`, un simple seuil.

Le contrôleur pilote un scalaire unique **D ∈ [0.12, 0.68]**, agrégat de neuf
axes indépendants, chacun **mesurable sur l'objet `table`** et **actionnable par
les options de `Spot.generate`**.

### 2.2 Les neuf axes

Chaque axe est normalisé sur [0, 1], 1 = plus difficile. Les formules ci-dessous
ne lisent que des propriétés déjà présentes sur `t` ; aucune ne fait tourner
`Judge` (coût mesuré : **2.3 ms** par tirage `generate` + indexation, contre
**50 ms** pour un `Judge.evaluate`).

Notations : `bb = t.bb`, `pot = t.pot`, `opps` = adversaires non couchés,
`eff` = tapis effectif, `ORDER = ["SB","BB","UTG","HJ","CO","BTN"]`.

| # | Axe | Formule de mesure | `r` avec `1 − F` |
|---|---|---|---|
| 1 | **Position** | `a_pos = opps.every(o => ORDER.indexOf(o.pos) < ORDER.indexOf(hero.pos)) ? 0 : 1` | 0.132 |
| 2 | **Rue** | `a_street = STREETS.indexOf(t.street) / 3` | 0.279 |
| 3 | **Taille de pot** | `a_pot = clamp(log10(1 + pot/bb) / log10(61))` | **0.463** |
| 4 | **Profondeur (SPR)** | `a_spr = clamp(1 − log10(1 + eff/max(pot,bb)) / log10(121))` | 0.394 |
| 5 | **Profil adverse** | `a_opp = moyenne(dureté(o.p))`, voir §2.3 | 0.095 |
| 6 | **Texture du board** | `a_tex = clamp(0.60·tex.danger + 0.25·[tex.paired] + 0.15·[tex.monotone])`, 0 si préflop | 0.228 |
| 7 | **Action précédente** | `a_act = clamp(0.6·min(1, t.raisesThisStreet/2) + 0.4·min(1, toCall/max(pot,bb)))` | 0.145 |
| 8 | **Largeur de range** | `a_rng = clamp(1 − moyenne(Ranges.pct(o.range)) / 60)` | 0.354 |
| 9 | **Options de décision** | `a_brd = clamp(0.7·(|opps|−1)/4 + 0.3·(1 − clamp((|options|−2)/5)))` | 0.292 |

`tex` = `BoardTex.analyse(t.board)` (l. 2965), qui expose déjà `danger`, `paired`,
`monotone`. `Ranges.pct` (l. 2745 env.) rend le pourcentage de combos d'une range.
Les corrélations sont calculées sur les 1 836 spots jugés du §1.5.

**Deux lectures contre-intuitives, à documenter :**

- **`a_rng` est inversé** : une range adverse **étroite** rend le spot **plus dur**
  (r = +0.354 pour `1 − rangePct/60`). Un adversaire large est polarisé vers le
  bas de sa range, l'écart d'EV entre les options est grand, l'erreur est évidente.
  Un adversaire étroit resserre les EV et rend le choix marginal.
- **`a_opp` est l'axe le plus faible** (r = 0.095). Le profil adverse, qui est le
  levier principal de `LEVELS`, est **le moins discriminant des neuf**. C'est
  cohérent avec le §1.5 : le pool explique peu, le mode explique beaucoup.

### 2.3 Échelle de dureté des profils

Dérivée des champs déjà présents dans `PROFILES` — aucune valeur inventée :

```js
dureté(p) = 0.55 · (1 − min(1, |p.bluff − 1|))     // équilibre bluff/value
          + 0.30 · min(1, p.aggro / 1.5)           // agressivité
          + 0.15 · (1 − min(1, |p.tight − 1| / 0.6)) // ni ultra-large ni ultra-serré
```

Justification : un adversaire est difficile quand sa fréquence de bluff est proche
de l'équilibre (`bluff ≈ 1`, aucun côté à exploiter), qu'il applique de la
pression, et que sa largeur de range n'est pas un extrême lisible. Les trois
grandeurs sont celles que `AI.preflop`/`AI.postflop` consomment réellement pour
décider.

Classement obtenu (mesuré, du plus tendre au plus dur) :

```
station < fish < maniac < nit < rec < tag < lag < regAgro < reg
```

`maniac` arrive en 3ᵉ position la plus tendre : son `bluff` extrême le rend très
exploitable. Le pool du niveau **Exploit** contient `maniac`, ce qui explique son
1 − F (0.502) plus élevé que son `tolerance` (0.08) ne le laisserait croire.

### 2.4 Agrégation — l'indice D

```
D = Σ w_i · a_i
```

Poids ajustés par moindres carrés non négatifs sous contrainte `Σw = 1`, sur les
1 836 spots jugés, cible `1 − F` :

| axe | `a_pos` | `a_street` | `a_pot` | `a_spr` | `a_opp` | `a_tex` | `a_act` | `a_rng` | `a_brd` |
|---|---|---|---|---|---|---|---|---|---|
| **w** | 0.057 | 0.069 | 0.121 | 0.096 | 0.103 | 0.099 | 0.153 | 0.116 | **0.185** |

Validation :

- `corr(D, 1 − F) = 0.592`, **R² = 0.350** (poids ajustés).
- Aucun poids nul : les neuf axes portent de l'information non redondante.
- Plage observée : **D ∈ [0.121, 0.685]**, moyenne 0.333.
- **Monotonie par décile de D** (le test qui compte : D doit *ordonner* les spots) :

| décile | D | `1 − F` observé |
|---|---|---|
| d1 | 0.11 – 0.21 | 0.196 |
| d2 | 0.21 – 0.24 | 0.251 |
| d3 | 0.24 – 0.27 | 0.322 |
| d4 | 0.27 – 0.30 | 0.343 |
| d5 | 0.30 – 0.33 | 0.470 |
| d6 | 0.33 – 0.36 | 0.489 |
| d7 | 0.36 – 0.39 | 0.547 |
| d8 | 0.39 – 0.43 | 0.504 |
| d9 | 0.43 – 0.50 | 0.556 |
| d10 | 0.50 – 0.77 | 0.698 |

Croissance monotone sur 9 transitions sur 10 (seule inversion : d7 → d8, dans le
bruit à n ≈ 180). R² = 0.35 au niveau du spot **isolé** est attendu : `1 − F` d'un
spot unique est lui-même très bruité. Ce qui est requis pour un contrôleur, c'est
que la **moyenne d'un lot** soit prédite — et elle l'est.

### 2.5 Comment faire varier D via `Spot.generate` — deux étages

Le moteur est gelé. Sur les neuf axes, **cinq sont contrôlables directement** par
une option de `generate`, et **quatre ne le sont pas** (texture, largeur de range,
action précédente, et partiellement le nombre d'options). D'où une architecture
en deux étages.

#### Étage A — enveloppe de paramètres (déterministe)

Soit `u = clamp((D_cible − 0.12) / 0.56, 0, 1)`.

| Axe | Option `Spot.generate` | Loi |
|---|---|---|
| jugement | `opt.level` | `["debutant","intermediaire","avance","pro","gto"][round(4u)]` |
| rue (2) | `opt.mode` | tirage pondéré sur `[preflop, flop, turn, river]` avec poids `[max(0, 1.6−2.2u), 0.5+0.6u, 0.25+1.0u, max(0, −0.25+1.8u)]` |
| profondeur (4) | `opt.stackRange` | `[round(140 − 95u), round(230 − 140u)]` |
| adversaires (9) | `opt.players` | `u<0.3 → {2,3}` · `u<0.6 → {3,4}` · sinon `{4,5,6}` |
| profil (5) | `opt.profiles` | fenêtre glissante de 4 profils sur l'échelle §2.3, départ `round(5u)` |
| position (1) | `opt.forcePos` | avec probabilité `0.15 + 0.45u`, forcer `BB` (55 %) ou `SB` (45 %) |

Contraintes de composition **imposées par le moteur** (§1.4), à respecter
impérativement :

1. Ne **jamais** utiliser `deep`/`short` : leur `mode.stack` écraserait
   `opt.stackRange`. Les modes de rue n'ont pas de `stack` — ils composent.
2. Ne **jamais** compter sur `pot3bet`/`pot4bet` : drapeaux inertes.
3. `opt.profiles` non vide **remplace** `level.pool` : `opt.level` ne sert plus
   alors qu'à porter `tolerance`. C'est voulu — on découple sévérité et pool,
   ce que l'UI actuelle ne permet pas.
4. `opt.forcePos` n'est honoré que si la position existe dans `POS6.slice(6−n)` :
   `UTG`/`HJ` n'existent qu'à 6 et 5 joueurs. Forcer `BB`/`SB` est toujours sûr.

#### Étage B — échantillonnage par rejet (les axes non pilotables)

La texture, la largeur de range effective et l'action précédente sont produites
par le déroulé de `runToHero` : on ne peut pas les commander. On les **sélectionne**.

```js
function generateAt(Dcible, k = 8) {
  let best = null, bd = Infinity;
  for (let i = 0; i < 3 * k && i < 40; i++) {
    const t = Spot.generate(envelope(Dcible));
    if (t.finished || Spot.options(t).length < 2) continue;
    const d = indexD(t);
    if (Math.abs(d - Dcible) < bd) { bd = Math.abs(d - Dcible); best = t; }
    if (bd < 0.03) break;                       // assez proche, on arrête
  }
  return best;
}
```

Coût mesuré : `Spot.generate` = **2.99 ms**, `generate + indexD` = **2.29 ms**
(l'indexation est plus rapide que la génération sur les spots rejetés tôt).
Budget pire cas 40 tirages ≈ **92 ms**, cas typique 3-5 tirages ≈ **10 ms**.
Négligeable devant les 50 ms de `Judge.evaluate` que l'application paie déjà à
chaque décision.

**Précision atteinte** (60 tirages par cible) :

| D cible | D obtenu | écart-type |
|---|---|---|
| 0.12 | 0.134 | 0.012 |
| 0.20 | 0.195 | 0.018 |
| 0.30 | 0.306 | 0.017 |
| 0.40 | 0.395 | 0.016 |
| 0.50 | 0.498 | 0.022 |
| 0.60 | 0.593 | 0.022 |
| 0.70 | 0.680 | 0.043 |
| 0.78 | **0.674** | 0.056 |

Le générateur **sature à D ≈ 0.68**. C'est le plafond de difficulté atteignable
sans modifier le moteur ; le contrôleur doit s'y borner et le signaler plutôt que
de faire semblant (§3.7).

---

## 3. L'ALGORITHME D'ADAPTATION

### 3.1 État

```
D   ∈ [0.12, 0.68]   difficulté courante (continue, pas un palier)
p̂   ∈ [0, 1]         estimation lissée du taux de réussite
W   > 0              masse de poids de l'EWMA
n   ≥ 0              décisions depuis le dernier ajustement
dir ∈ {−1, 0, +1}    signe du dernier ajustement
```

### 3.2 Signal d'entrée — pourquoi la variance du poker n'entre pas

Point décisif, souvent mal posé : **HeroLab ne juge pas le résultat, il juge la
décision.** `Judge.evaluate` compare l'EV de l'action choisie à l'EV de la
meilleure option (l. 4165-4170). Le fait de perdre le coup n'a aucune influence
sur le verdict. **La variance des cartes ne pollue donc pas le signal.**

Ce qui reste bruité est autre chose, et il faut le traiter : la
**variance d'échantillonnage de la difficulté du spot**. Un spot peut être
extrêmement indulgent (`F = 0.86`) — le réussir n'apprend rien. On pondère donc
chaque observation par son pouvoir discriminant, disponible **gratuitement** :
`analysis.options` contient déjà l'EV de toutes les options.

```
s_i = (verdict ≠ "erreur") ? 1 : 0
F_i = |{o ∈ options : EV_best − EV_o ≤ tolerance}| / |options|
w_i = clamp(1 − F_i, 0.25, 1)
```

Le plancher à 0.25 garantit qu'un spot très indulgent compte encore un peu (on ne
veut pas qu'un joueur puisse geler le contrôleur en ne rencontrant que des spots
faciles).

### 3.3 Estimation — EWMA pondérée

```
p̂ ← (λ·W·p̂ + (1−λ)·w_i·s_i) / (λ·W + (1−λ)·w_i)
W ← λ·W + (1−λ)·w_i
n ← n + 1
```

avec **λ = 0.96**, soit une taille d'échantillon effective

```
N_eff = (1+λ)/(1−λ) = 49 décisions ≈ 10,7 mains (à 4,6 décisions/main)
```

et une demi-vie de `ln 2 / (−ln λ) = 17` décisions.

λ = 0.96 n'est pas un choix esthétique : c'est l'optimum mesuré (§4.4). En
régime stationnaire un λ plus grand est toujours meilleur (98,6 % de temps en
bande à λ = 0.98), mais **sous dérive de compétence il décroche** — c'est le test
qui départage.

### 3.4 Bande cible : 70 – 85 %

`P_lo = 0.70`, `P_hi = 0.85`, `P_mid = 0.775`.

Trois justifications convergentes, dont deux internes au produit :

1. **Cohérence avec les portes déjà posées par le produit.** `TIERS` exige
   `reqAccuracy` de **68 % (NL2) à 80 % (NL50)** (l. 4938-5002). Une bande
   [70 %, 85 %] contient l'intégralité de cette échelle : le contrôleur maintient
   le joueur exactement dans la zone où les paliers de carrière se jouent. Une
   bande plus basse rendrait la promotion inatteignable ; plus haute, triviale.
2. **Le plafond à 85 %** correspond à la « règle des 85 % » (Wilson, Shenhav,
   Straccia & Cohen, *The Eighty Five Percent Rule for Optimal Learning*, Nature
   Communications 10, 2019), qui établit pour un apprenant par descente de
   gradient un taux d'erreur optimal de 15,87 %. C'est un résultat sur des
   classificateurs à seuil, transposé ici comme **borne supérieure** et non comme
   cible ponctuelle — d'où la bande plutôt qu'un point.
3. **Le plancher à 70 %** est le seuil sous lequel l'erreur devient majoritaire
   par rapport à la référence interne du joueur. Il est aussi imposé par la
   mesure : sous 70 %, plus de 30 % des décisions produisent une entrée
   `leak:` dans `Progress.tagStats`, et le débriefing de fin de session bascule sur
   « taux d'erreurs élevé » (l. 5554-5562). Le contrôleur ne doit pas fabriquer un
   état que le produit lui-même qualifie d'échec.

**Pourquoi une bande et non une cible ponctuelle ?** Parce que c'est le premier
mécanisme anti-oscillation, et de loin le plus efficace : l'ablation (§4.4) montre
qu'une cible ponctuelle multiplie les inversions par 2,2 et fait chuter le temps
en bande de 69,8 % à 49,0 %.

### 3.5 Loi de commande

Le gain est exprimé **en espace-probabilité**, ce qui le rend indépendant du
générateur. La conversion vers D utilise la sensibilité mesurée du générateur :

```
g = |dP(succès)/dD|   mesurée sur le générateur déployé   (§4.2 : g ≈ 2.6)
```

Constantes réglées :

| Constante | Valeur | Rôle |
|---|---|---|
| `G_up` | 1.4 | gain de montée (le joueur s'ennuie) |
| `G_dn` | 2.24 | gain de descente (le joueur décroche) |
| `G_rev` | 0.7 | atténuation sur inversion de sens |
| `z` | 0.5 | garde de confiance |
| `N_min` | 25 | décisions minimales entre deux ajustements |
| `N_rev` | 38 | idem, sur inversion de sens (= 1.5 · N_min) |
| `ΔP_max` | 0.21 | correction maximale par ajustement, en probabilité |

Boucle exécutée **après chaque décision** :

```
1.  observer :  p̂, W, n  ←  mise à jour EWMA pondérée (§3.3)

2.  porte de volume :   si n < N_min           → ne rien faire
3.  incertitude :       se = sqrt( p̂(1−p̂) / N_eff )

4.  détection de bande :
      si  p̂ − z·se > P_hi  :   e = p̂ − P_hi ;  G = G_up ;  sgn = +1
      si  p̂ + z·se < P_lo  :   e = p̂ − P_lo ;  G = G_dn ;  sgn = −1
      sinon                 :   ne rien faire            ← bande morte

5.  hystérésis :
      si dir ≠ 0 et sgn ≠ dir :
          si n < N_rev  → ne rien faire
          sinon         → G ← G · G_rev

6.  pas :
      Δ = clamp( G · e / g ,  −ΔP_max/g ,  +ΔP_max/g )
      D ← clamp( D + Δ , 0.12 , 0.68 )

7.  n ← 0 ;  dir ← sgn
```

Avec g = 2.6 : `K_up = 0.54`, `K_dn = 0.86`, `Δ_max = 0.081`.

**Note d'ingénierie.** Un ajustement à `G/g` près est un pas de Newton : il vise
directement le bord de bande. Si `g` est mal estimé, l'hystérésis (étape 5)
rattrape automatiquement — une inversion de sens réduit le gain de 30 %. Le
contrôleur est donc robuste à une re-calibration approximative de `g`.

**Les quatre réponses aux quatre exigences du mandat :**

| Exigence | Mécanisme | Étape |
|---|---|---|
| Réussite excessive (ennui) | `p̂ − z·se > 0.85` → montée à gain `G_up` | 4 |
| Échec excessif (découragement) | `p̂ + z·se < 0.70` → descente à gain `G_dn = 1.6·G_up` | 4 |
| Zone proximale de développement | bande morte [0.70, 0.85], Δ = 0 à l'intérieur | 4 |
| Échec isolé non concluant | `N_min = 25` + `N_eff = 49` + pondération `w_i` | 2, 3 |
| Anti-oscillation | bande morte + `N_min` + hystérésis + plafond `ΔP_max` | 2, 4, 5, 6 |

**Asymétrie `G_dn = 1.6 · G_up` — justification chiffrée.** Le décrochage coûte
plus cher que l'ennui : un joueur qui s'ennuie reste, un joueur écrasé ferme
l'application. Le sweep du §4.4 montre que le temps de sauvetage p90 (sortir d'un
état à P ≈ 11 % vers P ≥ 70 %) tombe de **107 à 76 décisions** en passant de
`G_dn = G_up` à `G_dn = 1.6·G_up`, et **ne s'améliore plus au-delà** (75 à
`G_dn = 2.0` et `2.5`). Le coût est de 5,7 points de temps en bande
(83,1 % → 77,4 %). 1.6 est le coude de la courbe.

### 3.6 Dithering — servir une distribution, pas un point

La mesure du §4.2 montre que le générateur n'est pas un actionneur linéaire : il
présente une **falaise** entre D = 0.30 (≈ 83 % de réussite) et D = 0.38 (≈ 60 %).
Un contrôleur qui sert **tous** ses spots à un D unique se retrouve à osciller
d'un bord à l'autre de la falaise — comportement mesuré au §4.3 (12 inversions
sur 1 100 décisions, moyenne temporelle rabattue sur le bord facile).

Le remède est classique en commande d'actionneur discontinu, et gratuit ici : on
**dithere** la consigne. Au lieu de servir chaque spot à `D`, on tire

```
D_i ~ Uniforme(D − δ, D + δ),   δ = 0.09
```

et on passe `D_i` à `generateAt`. Le joueur rencontre alors un mélange de spots
faciles et durs autour de la consigne ; le taux de réussite observé devient la
**moyenne** de la réponse sur la fenêtre, ce qui la **linéarise** et rend la bande
[70 %, 85 %] atteignable en régime.

**Mesure** (θ = 0.45, 220 spots par cellule, moteur réel) :

| D consigne | sans dithering | avec dithering δ = 0.09 |
|---|---|---|
| 0.22 | 98.6 % | 96.4 % |
| 0.26 | 89.5 % | 88.2 % |
| 0.30 | 80.5 % | 75.0 % |
| 0.34 | 77.7 % | 76.4 % |
| 0.38 | 68.6 % | 74.1 % |

**Ce que la mesure dit exactement — et ce qu'elle ne dit pas.** Le dithering
**comprime la réponse** : l'amplitude passe de 30,0 points (98.6 → 68.6) à
22,3 points (96.4 → 74.1), soit une pente réduite de 26 %. Il **lisse** donc bien
la falaise, ce qui est l'effet recherché pour la stabilité. En revanche il
**n'abaisse pas** le plateau : on ne peut pas moyenner son chemin vers un taux de
réussite qu'aucun D ne produit. Le dithering est un correctif de **stabilité**,
pas de **plage**.

Cette même mesure apporte un résultat plus important : **sans dithering, la
réponse est ici monotone et traverse bien la bande cible** — 80.5 % à D = 0.30,
77.7 % à D = 0.34, 68.6 % à D = 0.38. **La bande [70 %, 85 %] correspond donc à
D ∈ [0.30, 0.36] environ.** Or le contrôleur se stabilise à D ≈ 0.25 (§4.3),
soit **environ 0.06 trop bas** — un pas de commande. Ce biais est la conséquence
directe et attendue de `G_dn = 1.6 · G_up` (§3.5), amplifiée par la pente locale
élevée. Le réglage correctif est donc connu et local : réduire l'asymétrie vers
`G_dn = 1.3 · G_up` en acceptant un sauvetage p90 de 86 au lieu de 76 (§4.4),
ou décaler la bande de détection de +0.03. **À valider par une nouvelle passe du
§4.3 avant déploiement** — je ne l'ai pas mesuré et ne le présente donc pas comme
acquis.

Deux bénéfices non techniques du dithering, indépendants de ce qui précède :

- **La variété intra-session est pédagogiquement supérieure** à une difficulté
  uniforme (effet d'entrelacement), et elle évite au joueur de constater qu'on lui
  sert dix fois le même type de situation.
- **Le joueur rencontre encore des spots faciles ET des spots durs**, ce qui
  maintient à la fois le sentiment de compétence et l'exposition au difficile.

`δ = 0.09` couvre la largeur de la falaise (0.08). Coût nul : `generateAt` est
déjà appelé une fois par spot.

### 3.7 Plafond et plancher

Si `D` reste collé à `D_max = 0.68` pendant plus de `3·N_min = 75` décisions avec
`p̂ > P_hi`, le contrôleur émet un état `PLAFOND_ATTEINT` : **le générateur ne sait
pas fabriquer plus dur**, et prétendre le contraire serait un mensonge. C'est un
signal produit (le joueur a épuisé le contenu), pas un état d'erreur. Symétriquement
pour `D_min = 0.12` / `p̂ < P_lo`.

Ce cas est réel et mesuré : un joueur synthétique de compétence θ = 0.90 pin le
contrôleur à 0.68 et plafonne à **85,4 %** de réussite.

---

## 4. COMMENT TESTER QUE ÇA MARCHE

Le test complet est en trois niveaux, du plus rapide au plus lent, tous
exécutables sous Node via `tests/harness.js`.

### 4.1 Niveau 1 — utilisateur synthétique analytique (vérité connue)

C'est le test de convergence proprement dit. On remplace le moteur par un
utilisateur dont **la difficulté idéale est connue analytiquement** :

```
P(succès | D) = 1 / (1 + exp(−a·(θ − D)))        a = 8,  θ = compétence
```

La cible que le contrôleur **doit** atteindre est donc exactement

```
D* = θ − logit(0.775)/a = θ − 1.2379/8 = θ − 0.1547
```

Critère de réussite : `|D̄(200 dernières) − D*| < 0.05` **depuis n'importe quel D₀**.

Résultat, 200 réplicats × 600 décisions par cellule :

| θ | D* | D₀ | D̄ (200 dern.) | biais | écart-type | P̄ | mouv. | inversions | temps en bande |
|---|---|---|---|---|---|---|---|---|---|
| 0.30 | 0.145 | 0.12 | 0.146 | +0.000 | 0.014 | 77.3 % | 6.0 | 3.9 | 93 % |
| 0.30 | 0.145 | 0.35 | 0.147 | +0.002 | 0.016 | 76.9 % | 7.4 | 4.0 | 89 % |
| 0.30 | 0.145 | 0.68 | 0.146 | +0.000 | 0.015 | 77.2 % | 8.7 | 3.5 | 91 % |
| 0.45 | 0.295 | 0.12 | 0.273 | −0.022 | 0.027 | 79.7 % | 9.0 | 3.9 | 69 % |
| 0.45 | 0.295 | 0.68 | 0.277 | −0.018 | 0.028 | 79.1 % | 9.7 | 4.1 | 72 % |
| 0.60 | 0.445 | 0.12 | 0.427 | −0.018 | 0.026 | 79.2 % | 9.9 | 3.6 | 72 % |
| 0.60 | 0.445 | 0.68 | 0.425 | −0.020 | 0.026 | 79.4 % | 9.1 | 4.4 | 70 % |
| 0.75 | 0.595 | 0.12 | 0.577 | −0.018 | 0.024 | 79.2 % | 10.7 | 3.4 | 72 % |
| 0.75 | 0.595 | 0.68 | 0.573 | −0.022 | 0.027 | 79.7 % | 8.1 | 4.4 | 73 % |
| 0.90 | 0.680\* | 0.12 | 0.678 | −0.002 | 0.007 | 85.5 % | 14.2 | 0.2 | 0 % |

\* borné par `D_max` — cas `PLAFOND_ATTEINT` du §3.7.

**Lecture.** Convergence depuis les trois points de départ, biais ≤ 0.022 et
**toujours du côté sûr** (légèrement trop facile — conséquence directe de
`G_dn > G_up`), écart-type de position 0.014-0.028, soit ± 1 point de pourcentage
de réussite. Environ 4 inversions de sens sur 600 décisions (0,7 %) : pas de yo-yo.

**Temps d'entrée en bande** (première décision d'une fenêtre de 30 restant à
|P − 0.775| ≤ 0.075), 200 réplicats :

| θ | D₀ | médiane | p90 | échecs |
|---|---|---|---|---|
| 0.30 | 0.12 | 21 | 21 | 0/200 |
| 0.30 | 0.68 | 102 | 142 | 0/200 |
| 0.60 | 0.12 | 101 | 151 | 0/200 |
| 0.60 | 0.68 | 116 | 209 | 0/200 |

Soit **5 à 25 mains** pour caler un joueur inconnu, jamais plus de 45 mains au p90.

**Suivi d'un joueur qui progresse** (θ : 0.30 → 0.90 sur 1 200 décisions) :

| décision | θ | D | P(succès) |
|---|---|---|---|
| 0 | 0.30 | 0.200 | 69.0 % |
| 150 | 0.38 | 0.120 | 88.5 % |
| 300 | 0.45 | 0.307 | 75.8 % |
| 600 | 0.60 | 0.410 | 82.0 % |
| 900 | 0.75 | 0.449 | 91.8 % |
| 1050 | 0.82 | 0.640 | 81.4 % |

La difficulté suit la compétence. Le retard moyen mesuré est de **+0.031 en D**,
soit environ 60 décisions de latence — le prix de la robustesse au bruit.

### 4.2 Niveau 2 — courbe de réponse du moteur réel

On mesure `P(succès | D, θ)` en faisant jouer un utilisateur synthétique **contre
le vrai moteur**, jugé par le vrai `Judge`. Le joueur estime l'EV avec un bruit
proportionnel à l'étendue d'EV du spot — modèle sans échelle, valable à toute
taille de pot :

```
ê_j = EV_j + σ·N(0,1),   σ = σ₀·(1 − θ)·max(EV_max − EV_min, 0.5·bb),   σ₀ = 0.75
```

Ce modèle a une propriété qu'on veut : un spot dont les options sont proches
produit des erreurs même chez un bon joueur, ce qui est exactement le comportement
humain que la bande cible doit réguler.

Résultat, **n = 200 par cellule, 4 800 spots joués et jugés** :

| D | θ = 0.30 | θ = 0.55 | θ = 0.80 | `1 − F` moyen |
|---|---|---|---|---|
| 0.15 | 99.5 % | 99.5 % | 100.0 % | 0.174 |
| 0.22 | 98.0 % | 99.0 % | 100.0 % | 0.209 |
| **0.30** | **83.0 %** | **83.5 %** | 90.5 % | 0.382 |
| **0.38** | **60.0 %** | **63.0 %** | 82.0 % | 0.614 |
| 0.45 | 66.5 % | 69.5 % | 88.5 % | 0.530 |
| 0.52 | 58.0 % | 67.5 % | 80.0 % | 0.654 |
| 0.60 | 51.0 % | 68.0 % | 83.0 % | 0.772 |
| 0.68 | 61.0 % | 68.5 % | 90.0 % | 0.746 |

**C'est ce test qui a corrigé la conception, et c'est aussi lui qui révèle la
limite dure du système.** Deux résultats, dans cet ordre.

**(a) La pente réelle est le double de la pente supposée.** Autour de la bande,
`g ≈ 2.6` par unité de D (83 % à D = 0.30 → 60 % à D = 0.38), contre 1.4 pour le
modèle analytique. Avec les gains réglés au niveau 1 (exprimés directement en D),
le contrôleur dépassait systématiquement la bande — mesuré à 84-89 % au lieu de
70-85 %. D'où la reformulation du gain en espace-probabilité (§3.5) :
`Δ = G·e/g`. Un gain exprimé en D n'est pas transférable d'un générateur à
l'autre ; un gain exprimé en probabilité l'est.

**(b) Le générateur gelé n'expose pas de plateau dans la bande cible.** La
réponse est une **falaise suivie d'un plateau bruité** :

- `1 − F` (l'indulgence mesurée par le Juge) croît **de façon monotone** sur toute
  la plage, 0.174 → 0.772. L'indice D est donc valide de bout en bout.
- Mais la **réussite du joueur** ne décroît que de D = 0.22 à D = 0.38 (98 % → 60 %),
  puis **cesse de décroître** : elle oscille entre 51 % et 69 % pour θ = 0.30 et
  entre 67 % et 69 % pour θ = 0.55, sans tendance.

Au-delà de D ≈ 0.38 les spots deviennent contraints — SPR bas, peu d'options
légales, souvent un tapis face à une mise — ce qui les rend **paradoxalement plus
faciles à jouer correctement** alors même que le Juge les sanctionne plus fort.
Sévérité et difficulté décisionnelle se découplent.

Conséquence chiffrée, à assumer :

> **La bande [70 %, 85 %] est traversée en 0.08 unité de D** (de 0.30 à 0.38).
> La seule zone monotone exploitable est **D ∈ [0.22, 0.38]**, et la bande cible
> n'y occupe qu'une fenêtre de largeur 0.08 — à peine plus que la dispersion de
> placement du contrôleur en régime stationnaire (σ ≈ 0.026, §4.1) combinée à la
> dispersion du tirage par rejet (σ ≈ 0.02).

La régulation est donc possible mais **serrée** : le contrôleur peut viser la
bande, il ne peut pas s'y verrouiller avec le générateur actuel. Le facteur
limitant n'est pas l'algorithme — c'est que `Spot.generate`, non modifiable ici,
ne produit pas de continuum de difficulté au-delà de D ≈ 0.38.

### 4.3 Boucle fermée sur le moteur réel

Contrôleur complet + `generateAt` + vrai `Judge`, gains convertis avec g = 2.6
(`K_up = 0.538`, `K_dn = 0.862`, `Δ_max = 0.081`), 400 décisions par ligne :

| θ | D₀ | D final | D̄ (150 dern.) | taux global | taux 150 dern. | mouv. | inversions |
|---|---|---|---|---|---|---|---|
| 0.35 | 0.15 | 0.274 | 0.237 | 91.8 % | 92.0 % | 9 | 4 |
| 0.35 | 0.50 | 0.270 | 0.270 | 83.8 % | 86.7 % | 6 | 1 |
| 0.55 | 0.15 | 0.262 | 0.269 | 89.8 % | 88.7 % | 10 | 4 |
| 0.55 | 0.50 | 0.234 | 0.257 | 84.3 % | 89.3 % | 9 | 3 |
| 0.80 | 0.15 | 0.399 | 0.337 | 91.5 % | 92.0 % | 8 | 0 |
| 0.80 | 0.50 | 0.661 | 0.602 | 87.3 % | 88.7 % | 13 | 1 |

**Ce que ça montre, sans enjolivement.** Le contrôleur converge bien vers une
zone commune (D ≈ 0.24-0.27) indépendamment de D₀, avec peu d'inversions (0 à 4
sur 400 décisions) — le comportement dynamique est sain et reproduit celui du
niveau 1. **Mais le taux de réussite se stabilise à 84-92 %, au-dessus de la
bande.** L'écart avec le niveau 1 (77-79 %) ne vient pas de l'algorithme : il
vient de la falaise du §4.2. Entre D = 0.27 (≈ 90 %) et D = 0.38 (≈ 60 %) il n'y
a rien à viser ; le contrôleur se stabilise sur le bord haut de la falaise, ce
qui est le comportement correct d'un régulateur face à une non-linéarité — il
préfère 90 % à 60 %, et il a raison au regard de sa fonction de coût asymétrique
(§3.5).

**Course longue (1 100 décisions) — débit ou blocage ?** Il fallait écarter
l'hypothèse d'un contrôleur simplement trop lent :

| θ | D₀ | D final | D̄ (300 dern.) | taux 300 dern. | mouv. | inv. | trajectoire de D par pas de 200 |
|---|---|---|---|---|---|---|---|
| 0.35 | 0.15 | 0.230 | 0.254 | 90.7 % | 23 | 12 | 0.15 → 0.28 → 0.28 → 0.28 → 0.29 → 0.24 |
| 0.55 | 0.15 | 0.249 | 0.265 | 88.0 % | 23 | 8 | 0.15 → 0.29 → 0.24 → 0.26 → 0.23 → 0.22 |

**Ce n'est pas un problème de débit.** Le contrôleur atteint D ≈ 0.28 dès la
200ᵉ décision puis y reste 900 décisions de plus. Il a fait 23 mouvements, il
n'est pas bloqué : il a trouvé son point fixe. Le taux y est de 88-91 %.

**Dispersion à D fixe — la cause profonde** (θ = 0.45, 220 spots par point) :

| D servi | `1 − F` moyen | **écart-type de `1 − F`** | P(succès) |
|---|---|---|---|
| 0.24 | 0.241 | 0.130 | 95.9 % |
| 0.30 | 0.412 | **0.241** | 83.2 % |
| 0.36 | 0.497 | **0.246** | 82.3 % |

Deux enseignements. D'abord, **la dispersion intra-D est énorme** : à consigne
D = 0.30, la sévérité réelle des spots servis a un écart-type de 0.241 pour une
moyenne de 0.412 — le coefficient de variation dépasse 58 %. C'est la traduction
directe du R² = 0.35 (§2.4). Ensuite, **le passage de D = 0.30 à D = 0.36 ne
change plus rien** (83.2 % → 82.3 %) : le plateau commence dès 0.30 pour ce
joueur.

Comparaison avec la difficulté fixe, même joueur synthétique θ = 0.45, 200 spots
par point :

| réglage | taux de réussite |
|---|---|
| D fixe = 0.15 | 100 % — ennui total |
| D fixe = 0.30 | 80.5 % |
| D fixe = 0.60 | 58.0 % — décrochage |
| **adaptatif (D₀ quelconque)** | **84-88 %** |

**Bilan honnête de ce niveau de test.** Le contrôleur atteint son objectif
premier — **supprimer les deux extrêmes** — de façon robuste et depuis n'importe
quel point de départ : 100 % et 58 % sont ramenés à 84-88 %. Il **n'atteint pas**
l'objectif secondaire de maintenir 70-85 %, parce que le générateur gelé n'offre
aucun D qui produise durablement moins de ~82 % pour ce joueur (tableau de
dispersion ci-dessus). Cette seconde promesse ne doit pas être affichée tant que
le §3.6 n'a pas été validé par la mesure.

### 4.4 Niveau 3 — réglage des constantes par balayage

Chaque constante a été choisie sur un coude de courbe mesuré, pas par principe.
Protocole : 300-400 réplicats, deux métriques antagonistes —
**temps en bande** (régime stationnaire) et **temps de sauvetage** (nombre de
décisions pour sortir d'un état à P ≈ 11 %, c'est-à-dire le risque de décrochage).

**Garde de confiance `z`**

| z | temps en bande | inversions | sauvetage p90 |
|---|---|---|---|
| 0.0 | 79.9 % | 8.1 | 99 |
| **0.5** | **76.6 %** | **7.8** | **77** |
| 1.0 | 71.4 % | 5.7 | 81 |
| 1.5 | 63.0 % | 3.3 | 96 |

`z = 0.5` minimise le sauvetage p90. **Ce résultat a invalidé mon réglage initial
(z = 1.0)** : la garde de confiance, prise seule, était contre-productive — la
bande morte et `N_min` traitent déjà le bruit.

**`N_min`** (sous dérive de compétence)

| N_min | temps en bande | choc médiane | choc p90 | inversions /1500 |
|---|---|---|---|---|
| 15 | 78.3 % | 27 | 45 | 7.2 |
| 20 | 79.7 % | 33 | 51 | 6.9 |
| **25** | **80.3 %** | **35** | **59** | **5.7** |
| 30 | 78.3 % | 42 | 70 | 5.0 |
| 40 | 79.0 % | 55 | 96 | 3.4 |

**`λ`** (sous dérive θ : 0.30 → 0.80 sur 1 500 décisions)

| λ | N_eff | temps en bande | retard D*−D | choc médiane | choc p90 |
|---|---|---|---|---|---|
| 0.90 | 19 | 59.3 % | +0.031 | 33 | 60 |
| 0.94 | 32 | 73.3 % | +0.029 | 35 | 60 |
| **0.96** | **49** | **80.4 %** | +0.031 | 37 | 60 |
| 0.98 | 99 | 68.9 % | +0.045 | 45 | 71 |

λ = 0.98 gagne en régime stationnaire (98,6 %) mais perd sous dérive (68,9 %) :
**seul le test sous dérive départage**, et il désigne 0.96.

### 4.5 Ablation — chaque mécanisme gagne-t-il sa place ?

300 réplicats × 800 décisions, θ ∈ {0.35, 0.50, 0.65}, D₀ = 0.35.

| variante | amplitude de D | inversions | temps en bande | biais |
|---|---|---|---|---|
| **complet** | **0.140** | **5.8** | **69.8 %** | −0.018 |
| sans bande morte (cible ponctuelle) | 0.244 | 12.8 | 49.0 % | −0.010 |
| sans `N_min` (N_min = 1) | 0.292 | 23.1 | 65.0 % | −0.027 |
| sans hystérésis | 0.165 | 7.0 | 69.5 % | −0.021 |
| sans garde de confiance (z = 0) | 0.119 | 8.4 | 80.4 % | −0.019 |
| sans reset EWMA | 0.138 | 5.5 | 71.7 % | −0.017 |
| gain symétrique `G_dn = G_up` | 0.117 | 5.5 | 82.8 % | −0.007 |
| sans plafond de pas | 0.141 | 5.7 | 72.5 % | −0.016 |

**Conclusions, y compris celles qui me donnent tort :**

- **La bande morte est le mécanisme anti-oscillation dominant** : la retirer
  double presque l'amplitude et les inversions. Indispensable.
- **`N_min` est le second** : sans lui, 23 inversions — le yo-yo caractérisé.
- **L'hystérésis apporte peu** (0.165 → 0.140) mais coûte trois lignes. Conservée.
- **Le reset de l'EWMA après ajustement est inerte** (0.138 vs 0.140 ; 71,7 % vs
  69,8 % de temps en bande, soit légèrement *pire*). Je l'avais conçu contre
  l'emballement de l'intégrateur ; la mesure montre qu'il ne sert à rien.
  **Il est retiré de la spécification finale** (§3.5, l'étape 7 ne fait plus que
  `n ← 0 ; dir ← sgn`).
- **Le plafond de pas est presque inerte** en régime stationnaire (0.141 vs 0.140)
  mais il borne le transitoire depuis un D₀ absurde. Conservé comme garde-fou.
- **L'asymétrie de gain coûte 13 points de temps en bande** (82,8 % → 69,8 %).
  C'est le prix explicite de la protection contre le décrochage (§3.5). Le choix
  est un arbitrage produit assumé, chiffré, et réversible en une constante.

### 4.6 Protocole d'exécution

Les quatre scripts, à placer dans `tests/` :

| Script | Contenu | Durée mesurée |
|---|---|---|
| `adaptive-index.js` | reconstitue les 9 axes, échantillonne N spots, calcule `corr(D, 1−F)` et le tableau de monotonie par décile | ~4 min (1 400 spots) |
| `adaptive-converge.js` | utilisateur analytique, 200 réplicats × 5 θ × 3 D₀, vérifie `|D̄ − D*| < 0.05` | ~40 s |
| `adaptive-engine.js` | courbe de réponse `P(succès | D, θ)` sur le vrai moteur, en déduit `g` | ~15 min |
| `adaptive-ablation.js` | table d'ablation §4.5 | ~60 s |
| `adaptive-dither.js` | réponse avec et sans dithering, valide le §3.6 | ~8 min |

**Assertions de non-régression proposées :**

```
1. corr(D, 1−F) ≥ 0.50                          sur ≥ 1 000 spots
2. monotonie de 1−F sur ≥ 8 des 9 transitions de décile de D
3. |D̄(200 dern.) − D*| < 0.05                   pour θ ∈ {0.30, 0.45, 0.60, 0.75}, D₀ ∈ {0.12, 0.35, 0.68}
4. inversions de sens ≤ 8 par 600 décisions
5. temps d'entrée en bande, p90 ≤ 250 décisions
6. |D(cible) − D(obtenu)| ≤ 0.03                pour cible ∈ {0.20, 0.30, 0.40, 0.50, 0.60}
7. les 79 tests moteur et 37 tests navigateur restent verts
```

L'assertion 6 est la sentinelle la plus utile : elle échoue immédiatement si
quelqu'un modifie `Spot.generate`, `MODES`, `PROFILES` ou `BoardTex` d'une façon
qui déplace l'échelle de difficulté.

---

## 5. LIMITES MESURÉES ET DÉPENDANCES

1. **Limite dominante : plage utile étroite et réponse non linéaire.** C'est le
   résultat le plus important de cet audit. La réponse `P(succès | D)` du
   générateur gelé n'est exploitable que sur **D ∈ [0.22, 0.38]** : au-delà, elle
   cesse de décroître (§4.2). Sur cette fenêtre elle est très raide — 30 points
   de réussite pour 0.16 unité de D — de sorte que **la bande [70 %, 85 %]
   n'occupe qu'environ D ∈ [0.30, 0.36]**, soit une fenêtre de l'ordre du pas de
   commande lui-même. Réguler y est possible mais serré ; il n'y a aucune marge
   d'erreur sur le gain.
2. **Biais résiduel mesuré : le contrôleur se cale ~0.06 trop bas.** Il converge
   de façon stable et reproductible à D ≈ 0.25 (88-91 % de réussite) là où la
   bande demande D ≈ 0.33 (§4.3, §3.6). Le comportement dynamique est sain
   (0,7 à 1,1 % d'inversions, point fixe atteint dès la 200ᵉ décision, insensible
   à D₀) ; c'est le **point de consigne** qui est décalé, par l'asymétrie
   `G_dn = 1.6 · G_up`. Correctif identifié et local (§3.6), **non mesuré** :
   à valider avant déploiement.

   En l'état, la promesse démontrée du système est **« supprimer l'ennui et le
   décrochage »** — 100 % et 58 % ramenés à 84-88 % depuis n'importe quel point
   de départ (§4.3). La promesse **« maintenir 70-85 % »** est démontrée contre un
   actionneur linéaire (§4.1 : 77-79 %, biais ≤ 0.022) mais **pas encore sur le
   moteur réel**. Ne pas l'afficher avant d'avoir refait la passe §4.3 avec le
   gain corrigé.
3. **Le levier « profil adverse » est faible** (r = 0.095, §2.2). Élargir la plage
   de difficulté passe par la rue, le pot et le nombre d'adversaires, pas par les
   profils. Cela contredit frontalement la conception actuelle de `LEVELS`, dont
   le pool est le levier principal.
4. **Sévérité et difficulté décisionnelle se découplent en haut de plage.** Au-delà
   de D ≈ 0.38, `1 − F` continue de croître (le Juge sanctionne plus) alors que le
   taux de réussite cesse de baisser : les spots deviennent contraints (SPR bas,
   peu d'options), donc plus faciles à jouer juste tout en étant jugés plus dur.
   L'indice D reste valide comme mesure de sévérité, mais **ne doit pas être lu
   comme une prédiction de difficulté au-delà de 0.38**.
5. **Quatre axes ne sont pas commandables**, seulement sélectionnables par rejet
   (§2.5). Si `force3Bet` était implémenté, l'axe « action précédente » (w = 0.153,
   le 2ᵉ poids) deviendrait directement pilotable et la plage s'élargirait. C'est le
   correctif à plus fort levier sur cet axe, mais il touche le moteur : hors mandat.
6. **`R² = 0.35` au niveau du spot isolé.** L'indice ordonne correctement (monotonie
   par décile) mais ne prédit pas un spot unique. C'est suffisant pour un
   contrôleur qui régule sur `N_eff = 49` observations, insuffisant pour afficher
   au joueur « ce spot vaut 0.42 de difficulté ». Ne pas exposer D dans l'UI comme
   une note.
7. **Dépendance Phase 3.** L'état du contrôleur (`D`, `p̂`, `W`, `n`, `dir`) est cinq
   nombres. Il doit vivre dans `Progress.data` (10ᵉ clé `localStorage`), qui est
   déjà la structure porteuse de `decisions[]` et `tagStats`. La couche de stockage
   intercalée par la branche `claude/phase3-google-auth` doit donc la sérialiser
   — coût nul, mais à ne pas oublier.
8. **Le modèle d'utilisateur synthétique n'est pas un humain.** Les niveaux 1 et 2
   valident que **le contrôleur converge**, pas que 70–85 % est le bon confort
   pour un joueur réel. Cette seconde question ne se tranche que par de la donnée
   d'usage. La bande est une constante isolée, réglable sans retoucher
   l'algorithme.

---

## 6. RÉCAPITULATIF DES CONSTANTES

```
BANDE          P_lo = 0.70    P_hi = 0.85    P_mid = 0.775
ESTIMATION     λ = 0.96       N_eff = 49     w_i = clamp(1 − F_i, 0.25, 1)
PORTES         N_min = 25     N_rev = 38     z = 0.5
GAINS          G_up = 1.4     G_dn = 2.24    G_rev = 0.7    ΔP_max = 0.21
CONVERSION     Δ = clamp(G·e/g, ±ΔP_max/g)   g = 2.6  (à re-mesurer par §4.2)
DITHERING      D_i ~ U(D − δ, D + δ)          δ = 0.09
BORNES         D_min = 0.12   D_max = 0.68   (monotone : 0.22 – 0.38 ; bande ≈ 0.30 – 0.36)
POIDS D        pos .057  street .069  pot .121  spr .096  opp .103
               tex .099  act .153  rng .116  brd .185
```

**Aucun fichier applicatif n'a été modifié.** Toutes les mesures de ce document
ont été produites par des scripts de lecture seule dans le répertoire de travail
temporaire, via `tests/harness.js` et `vm.runInContext` pour exposer `Judge`,
`LEVELS`, `PROFILES`, `BoardTex` et `Ranges` sans altérer le fichier source.
