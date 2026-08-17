# AGENT D — Mémorisation & répétition espacée

**Périmètre** : que sait déjà HeroLab de la mémoire de l'utilisateur, et quel modèle
de révision lui greffer sans toucher au moteur DF-B.

**Aucun fichier applicatif n'a été modifié.** Toutes les valeurs chiffrées de ce
document ont été **obtenues par exécution** via `tests/harness.js` sur
`VERSION_PRODUCTION/herolab.html` (sondes jetables en scratchpad, non versionnées).
Les constantes que je n'ai pas pu mesurer sont signalées comme telles.

---

## Méthode

Quatre sondes, toutes contre le moteur réel :

| Sonde | Ce qu'elle fait |
|---|---|
| 1 | Rejoue 400 décisions `libre` en reproduisant exactement la séquence de `App.choose` (`Judge.evaluate` → `Progress.record` → `Player.recordMastery`) et inspecte l'état résultant |
| 2 | 560 décisions sur 8 modes, mesure le coût de génération/jugement et la taille de l'espace de situations réellement atteint |
| 3 | Remplit `Progress` à son plafond (3 000 décisions) et mesure le coût des agrégats |
| 4 | 350 décisions, confronte la formule de note continue proposée aux verdicts émis par le moteur |
| 5 | 25 spots × 12 évaluations répétées sur **la même table** pour mesurer le déterminisme de `Judge` |

`Judge` n'est pas exporté par le harness ; je l'ai récupéré via
`vm.runInContext("Judge", sandbox)` sans modifier `harness.js`.

---

# 1. AUDIT — ce que le système sait déjà

## 1.1 Réponse directe, item par item

| Le système peut-il savoir… | Verdict | Où / pourquoi |
|---|---|---|
| **ce qu'il a déjà vu** | **OUI, partiellement** | `Progress.data.decisions[]` (l.4726) horodate chaque décision avec `{ts, street, pos, verdict, lossBB, chosen, best, tags, mode, level}`. Mais **seules la street et la position** identifient la situation : ni texture, ni SPR, ni nombre de joueurs, ni type de pot ne sont persistés. |
| **ce qu'il n'a jamais vu** | **NON** | Il n'existe aucun référentiel des situations possibles. On ne peut pas distinguer « jamais rencontré » de « rencontré et non enregistré ». Sans espace de référence, l'absence de trace n'est pas une information. |
| **ce qu'il rate régulièrement** | **OUI** | `Progress.data.tagStats["leak:*"]` + `summary().leaks` classés par bb perdues, consommés par `worstLeak()` (l.4823) et le mode `cible`. |
| **son taux d'erreur sur un leak** | **NON** — *et c'est un bug* | Voir §1.2. `tagStats.n === tagStats.err` **dans 100 % des cas mesurés** : le dénominateur d'exposition n'existe pas. |
| **ce qu'il maîtrise** | **NON** — *bug structurel* | `Player.mastery` est censé le porter. Mesuré : `ok === 0` sur **toutes** les clés, toujours. Voir §1.2. |
| **ce qu'il confond** | **PRESQUE** | La donnée brute existe (`chosen` et `best` sont persistés par décision, l.4728) mais **rien ne l'agrège** : aucune matrice de confusion, aucun code ne lit le couple. L'information est là, inexploitée. |
| **ce qu'il oublie** | **NON** | Aucune notion de décroissance nulle part dans le fichier (recherche `decay/oubli/forget/halfLife/recency/interval` : zéro occurrence pertinente). `Rating.snapshot()` et `Journey.snapshot()` historisent des photos quotidiennes, mais rien ne modélise la perte d'une compétence acquise. Un leak corrigé il y a 3 mois pèse exactement autant qu'un leak corrigé hier. |
| **quand le reproposer** | **NON** | La sélection est soit aléatoire, soit « le leak le plus coûteux, tout le temps » (`worstLeak()` → `focusFor()`). Aucun espacement, aucune file. |

## 1.2 Deux défauts structurels trouvés par exécution

### A. `Player.mastery.ok` ne peut jamais être incrémenté

`Progress.tags()` sort **avant** de produire le moindre tag `leak:` quand la
décision n'est pas une erreur (l.4681) :

```js
const wrong = a.verdict === "erreur";
if (!wrong) return tags;          // ← aucun tag leak: ne survit à un succès
```

Or `App.choose` (l.7288) alimente la maîtrise **uniquement à partir de ces tags** :

```js
const wasOk = a.verdict !== "erreur";
for (const tag of (entry.tags || []))
  if (tag.startsWith("leak:")) Player.recordMastery(tag.slice(5), wasOk);
```

Un tag `leak:` n'existe que si `verdict === "erreur"`, donc `wasOk` vaut **toujours
`false`** sur ce chemin. C'est le seul appelant de `recordMastery` dans tout le
fichier.

**Mesuré** (400 décisions, mode libre — 176 correct / 92 acceptable / 132 erreur) :

```
Player.mastery = {"bb-overdefend":{"seen":8,"ok":0},
                  "bb-underdefend":{"seen":1,"ok":0},
                  "too-passive":{"seen":3,"ok":0}}
→ un seul ok > 0 ?  false
```

**Conséquences en cascade :**
- `Player.masteryLevel()` renvoie `rate = 0` toujours → plafonne au palier 1
  « En apprentissage » dès `seen ≥ 10`. Les paliers **« Familier », « Solide »,
  « Maîtrisé » sont inatteignables**.
- `Journey.mission().complete` exige `successRate >= 0.65` : **aucune mission ne
  peut jamais être complétée**.
- `Journey.story()` teste `m.seen >= 15` comme preuve d'amélioration — il compte
  donc des **échecs répétés** comme un progrès.

### B. `tagStats` n'a pas de dénominateur

`Progress.record` fait `st.n++` pour chaque tag et `st.err++` si erreur. Comme un
tag `leak:` n'apparaît que sur erreur, `n` et `err` sont le même nombre.
**Mesuré : 0 cellule sur 3 avec `n !== err`.** Les tags `street:` et `pos:`, eux,
sont émis inconditionnellement et ont donc un vrai dénominateur — ce sont les
**seules** statistiques d'exposition fiables du système (mesuré :
`street:preflop {n:400, err:132}`, `pos:BTN {n:80, err:25}`…).

> Ces deux points ne sont pas mon mandat, mais tout modèle de maîtrise qui se
> brancherait sur `Player.mastery` hériterait de données structurellement
> fausses. **Mon modèle n'en lit rien** et reconstruit sa propre trace.

## 1.3 Ce qui est solide et réutilisable

- `Progress.decisions[]` est un **journal chronologique propre** : `ts`, verdict,
  `lossBB`, `chosen`, `best`. C'est la matière première d'un replay hors-ligne.
- `Judge` fournit un signal **continu et coûté en bb** (`loss`, `lossBB`) et une
  **tolérance contextuelle** déjà calibrée (l.4166) : `(1.0·bb + pot·0,03) ×
  (level.tolerance / 0,1)`. Le verdict à trois niveaux en est un simple seuillage.
- `Rating.skillScore` applique déjà un **facteur de confiance lié au volume**
  (`0,35 + 0,65 · min(1, v/V)`) — la bonne intuition est présente, mais sous forme
  d'une rampe linéaire ad hoc plutôt que d'un modèle d'incertitude.
- La boucle d'`App` fait **déjà** du rejection sampling (`while (tries++ < 25)`,
  l.7248) : le point d'ancrage d'une sélection ciblée existe déjà.

## 1.4 Contraintes de performance mesurées

| Opération | Coût mesuré | Conséquence pour la conception |
|---|---|---|
| `Spot.generate` | **0,45 ms** | Échantillonner par rejet est gratuit |
| `Spot.options` | **0,013 ms** | Idem |
| **24 candidats (generate + options)** | **41,1 ms** | Budget acceptable pour une main (l'humain met des secondes) |
| `Judge.evaluate` | **39,2 ms** | **Interdit de juger les candidats.** 24 × 39 ms = 0,94 s de gel d'interface |
| `Progress.summary()` @3 000 | 2,8 ms | Utilisable une fois par main |
| `Progress` sérialisé @3 000 | **427 Ko** | Le budget `localStorage` est déjà largement entamé ; mon état doit rester petit |

**C'est la contrainte de conception numéro un :** le sélecteur ne peut noter un
spot candidat qu'avec des **caractéristiques bon marché** (street, position,
face-à-quoi, texture, nombre de joueurs, SPR) — jamais avec l'EV. Toute la
conception en découle.

## 1.5 Taille de l'espace de situations — mesurée

Sur 560 décisions réparties sur 8 modes, avec la clé
`street | pos | facing | texture | ways` :

```
560 décisions → 91 cellules distinctes → occurrences médianes : 2
top : preflop|BTN|vsBet|-|mw = 81   preflop|SB|vsBet|-|hu = 68 …
```

La distribution est **très concentrée** (le préflop domine, parce que `runToHero`
s'arrête à la première décision du héros) et la queue est **très creuse**. À
volume réaliste, une clé fine produit des cellules à n = 1 ou 2. **Un modèle
« une carte = une situation exacte » ne peut donc pas fonctionner** : il n'y aura
jamais assez d'observations par cellule. C'est ce qui impose la hiérarchie du §2.

---

# 2. CONCEPTION — un modèle de rétention pour le poker

## 2.0 Pourquoi pas SM-2 / Anki

Sept écarts, chacun motivé par une propriété du poker ou une mesure ci-dessus.

| # | SM-2 / Anki | HeroLab | Justification |
|---|---|---|---|
| 1 | La note vient d'une **auto-évaluation** 0–5 | Note **objective** dérivée de `lossBB` / tolérance | Il n'y a pas d'auto-évaluation à demander : le moteur mesure déjà l'erreur, en bb. Un signal objectif et continu domine strictement une note déclarative. |
| 2 | L'item est **déterministe** : rappelé ou non | Observation **bruitée** : la cellule tire une main facile ou difficile | Une cellule « défense BB » produit tantôt AA tantôt J7o. Une observation ne peut pas trancher. → posterior Beta, pas un scalaire. |
| 3 | **Ease factor** ajusté à la main | **Pas d'ease factor** | L'EF n'existe dans SM-2 que parce qu'il n'y a pas de modèle d'incertitude. Une fois qu'on a un posterior, l'espacement se déduit de sa borne basse. Un paramètre libre non identifiable en moins. |
| 4 | Toutes les cartes se valent | Priorité **pondérée par les bb en jeu** | Une erreur en pot 3bet coûte 10× une erreur d'open UTG. L'objectif n'est pas « tout retenir », c'est « arrêter de perdre ». La file est classée en bb/100, pas en probabilité d'oubli. |
| 5 | Intervalle qui **expire** | Rétention qui **décroît**, sans changer la moyenne | Le temps ne rend pas faux, il rend incertain. Ma décroissance érode `α` et `β` symétriquement : `m` est inchangé, seule la confiance chute, ce qui ramène la cellule vers son parent. Sémantique correcte de l'oubli. |
| 6 | L'utilisateur **tire des cartes** | L'utilisateur **joue des mains** | La révision passe par le biais du générateur (échantillonnage par rejet), pas par une file qu'on dépile. Rien n'est jamais « présenté ». |
| 7 | Échec = « again » | Échec **typé** : `chosen → best` | La donnée existe déjà et n'est pas exploitée. « Tu paies là où il faut relancer » est actionnable ; « tu rates cette carte » ne l'est pas. |

Ce que je **garde** de SM-2 : l'espacement croissant après succès et la
décroissance exponentielle de la trace. Ce sont les deux points sur lesquels la
littérature converge et ils tombent ici comme conséquences, pas comme postulats.

## 2.1 L'unité : la cellule, pas la carte

```
cellKey = street | posClass | facing | texture | ways | spr
```

| Dimension | Valeurs | Dérivation (coût nul, avant `Judge`) |
|---|---|---|
| `street` | preflop / flop / turn / river | `t.street` |
| `posClass` | préflop : les 6 positions · postflop : `{IP,OOP} × {agresseur,suiveur}` | ordre `POS6` + `t.aggressor` |
| `facing` | unopened / vsBet / vsRaise / vs3bet+ | `t.toCall(hero)` et `t.raisesThisStreet` |
| `texture` | — / dry / mid / wet | `BoardTex.analyse(board).danger` seuillé à 0,25 et 0,50 |
| `ways` | hu / mw | `t.live().length` |
| `spr` | short <3 / mid 3–8 / deep >8 | `hero.stack / t.pot` |

**Postflop, la position pertinente n'est pas le siège mais la position relative +
l'initiative** — c'est une propriété de l'ordre de parole, pas une opinion
stratégique. Les seuils de texture réutilisent l'échelle `danger` déjà définie
l.2993, ils n'introduisent aucune théorie nouvelle.

**Hiérarchie.** Chaque cellule a un parent grossier `street | posClass | facing`
(~40 cellules) et un grand-parent `street` (4). Vu la mesure du §1.5 (médiane 2
observations par cellule fine), c'est **le parent qui porte l'essentiel de
l'information** au début, et la cellule fine ne prend le dessus que lorsqu'elle
a accumulé assez de preuve. C'est un empirical Bayes, et c'est ce qui rend le
modèle utilisable dès la première session au lieu d'exiger des milliers de mains.

## 2.2 Note continue `q` — **validée par exécution**

À partir de deux grandeurs disponibles au moment du jugement :

```
tolBB = (1 + 0,03 · potBB) · (level.tolerance / 0,10)     ← recopie de Judge l.4166
q     = 1 / (1 + lossBB / tolBB)                          ← ∈ ]0, 1]
```

Analytiquement : `q(0) = 1`, `q` à la frontière correct/acceptable (r = 0,35)
vaut `0,741`, `q` à la frontière acceptable/erreur (r = 1) vaut exactement `0,5`.

**Vérifié contre 350 décisions réelles jugées par le moteur :**

```
correct     n=121   q ∈ [0,746 … 1,000]   médiane 1,000
acceptable  n= 65   q ∈ [0,502 … 0,740]   médiane 0,615
erreur      n=164   q ∈ [0,025 … 0,499]   médiane 0,237
```

**Séparation parfaite, aucun recouvrement.** `q` n'est pas une note inventée :
c'est la **forme continue de la partition que le moteur fait déjà**. Elle ajoute
l'information que le verdict à 3 niveaux jette — la distance à la frontière —
sans jamais la contredire.

## 2.3 Poids de preuve `ω` — toutes les décisions n'enseignent pas

Un spot où toutes les options ont la même EV n'apprend rien : réussir n'y prouve
rien, échouer non plus. Le moteur trie déjà les options par EV, l'écart est
gratuit :

```
gapBB = (options[0].ev − options[1].ev) / bb
ω     = clamp( gapBB / (gapBB + 0,5), 0,05 , 1 )
```

**Mesuré** : `gapBB` médian = **0,56 bb** (p25 = 0,12 · p75 = 1,41). La constante
de demi-saturation 0,5 bb est donc **posée sur la médiane observée** — ω ≈ 0,53
sur le spot médian, ~0,19 sur un spot indifférent, ~0,74 sur un spot tranché.
Elle recoupe aussi le commentaire du moteur l.4164 (« un écart < ~1 bb n'est pas
un enseignement fiable »).

## 2.4 Maîtrise, confiance, rétention

### État persisté par cellule (clé `pivot.srs.v1`, distincte de tout l'existant)

```js
Cell = {
  k,            // cellKey
  A, B,         // accumulateurs Beta décroissants (succès / échecs pondérés)
  n,            // expositions brutes (diagnostic, jamais utilisé dans les formules)
  errN,         // nombre d'erreurs
  lossSum,      // Σ lossBB sur les erreurs   → coût moyen
  worst,        // max lossBB observé
  streak,       // succès consécutifs (q ≥ 0,5)
  conf: {},     // matrice de confusion  "call>raise": 4
  tFirst, tLast,// horodatages (ms)
  H,            // stabilité courante (jours), mémorisée pour la décroissance
  ver           // version de schéma — indispensable, cf. risque 3
}
```

Poids : ~40 cellules grossières + ~250 fines × ~120 octets ≈ **35 Ko**, à comparer
aux 427 Ko déjà consommés par `Progress`.

### Mise à jour, O(1), à chaque décision

```
Δt   = (t − tLast) / 86 400 000                  jours
λ    = 2^(−Δt / H)                               décroissance depuis la dernière fois
A   ← λ·A + ω·q
B   ← λ·B + ω·(1 − q)
tLast ← t ;  n++ ;  streak ← (q ≥ 0,5) ? streak+1 : 0
si q < 0,5 : errN++ ; lossSum += lossBB ; worst = max(worst, lossBB)
             conf[chosen + ">" + best]++
```

### Lecture, à l'instant `now`

```
Δ      = (now − tLast) / 86 400 000
λ      = 2^(−Δ / H)
Ae, Be = λ·A , λ·B
n_eff  = Ae + Be                                     preuve effective

κ      = 6                                           force du prior parent
mp     = m(parent)                                   récursif ; racine = taux global de non-erreur
α      = κ·mp + Ae
β      = κ·(1 − mp) + Be

MAÎTRISE      m    = α / (α + β)
CONFIANCE     c    = n_eff / (n_eff + κ)                    ∈ [0, 1[
VARIANCE      var  = α·β / ((α+β)² · (α+β+1))
MAÎTRISE PESSIMISTE   m⁻ = max(0, m − 1,65·√var)            ← borne basse à 95 %
RÉTENTION     R    = 2^(−Δ / H)
```

> **Point central :** la décroissance multiplie `A` et `B` par le *même* λ. Elle
> ne modifie donc pas `m` — elle réduit `n_eff`, donc `c`, donc laisse le prior
> parent reprendre le dessus. **On ne devient pas mauvais avec le temps, on
> redevient incertain**, et l'incertitude ramène vers la moyenne de la famille.
> C'est le comportement correct, et SM-2 ne sait pas le produire.

`m⁻` répond directement aux deux exigences de variance du mandat :
- *réussir une fois ne prouve pas la maîtrise* — 1 observation (ω=1, q=1) sur un
  parent à 0,60 donne `n_eff = 1`, `c = 0,14`, `m` ne monte que de 1/7 de l'écart ;
- *échouer une fois ne prouve pas l'oubli* — strictement symétrique.

### Stabilité `H` — l'espacement, sans ease factor

```
H = H_min · (H_max / H_min)^(m⁻)        avec H_min = 1 j, H_max = 90 j
  = 90^(m⁻)   jours
```

| `m⁻` | `H` | Prochaine révision |
|---|---|---|
| 0,00 | 1,0 j | 0,3 j |
| 0,19 (cellule qui échoue) | 2,3 j | 0,8 j |
| 0,29 (cellule neuve, parent correct) | 3,8 j | 1,2 j |
| 0,50 | 9,5 j | 3,1 j |
| 0,82 (cellule maîtrisée, 20 obs) | 39 j | 12,6 j |
| 1,00 | 90 j | 29 j |

L'expansion des intervalles **n'est pas programmée** : chaque succès augmente `m`
*et* `n_eff`, donc `m⁻`, donc `H`. Chaque échec fait l'inverse. Deux constantes
interprétables remplacent l'ease factor et ses règles ad hoc.

### Échéance

```
θ       = 0,80                       rétention cible au moment de revoir
dueAt   = tLast + H · log₂(1/θ)  =  tLast + 0,3219 · H     (jours)
```

Réviser autour de 80–90 % de rétention est l'optimum classique de la difficulté
désirable. **`θ` est le seul paramètre que j'emprunte à la littérature sans
pouvoir le mesurer ici** — voir risque 1.

## 2.5 Priorité — une file en bb/100, pas en probabilité d'oubli

```
U = clamp( Δ / (0,3219 · H) , 0 , 3 )        urgence : 1 à l'échéance, plafonnée à 3
L̄ = errN > 0 ? lossSum / errN : L̄(parent)    coût moyen d'une erreur ici, en bb
f = n / n_total                              fréquence réelle de la cellule
V = (1 − m) · L̄ · f · 100                    bb/100 récupérables en corrigeant
N = 1 + 2 / (1 + n_eff)                      exploration : ×3 sur cellule vierge → ×1
G = porte de dépendance ∈ {0, 1}             cf. ci-dessous

P = U · V · N · G
```

`P` est **homogène à des bb/100 mains** : la file est interprétable et affichable
telle quelle (« ce spot te coûte 1,8 bb/100 »). C'est l'écart le plus important
avec SM-2 : on n'optimise pas la mémoire, on optimise l'argent.

## 2.6 Dépendances de compétences

Arêtes du DAG, **structurelles uniquement** — elles décrivent l'arbre de jeu, pas
une opinion stratégique (contrainte n° 2) :

1. `street s` dépend de `street s−1` à même `posClass`/`facing` — une décision
   river est conditionnée par la range qui a survécu au turn.
2. Pot 3bet/4bet dépend du pot single-raised correspondant — emboîtement des
   types de pot.
3. Multiway dépend du heads-up correspondant — emboîtement du nombre de joueurs.

```
G(cell) = 1 si ∀ p ∈ prereq(cell) : m⁻(p) ≥ 0,45 , sinon 0
si G = 0 :  P(p) += 0,5 · P(cell)     la masse remonte vers le prérequis
```

Seuil 0,45 : **en dessous** de la frontière `q = 0,5` (acceptable/erreur). On
n'exige pas de maîtriser le prérequis, seulement de ne pas être cassé dessus.

## 2.7 Sélection invisible

Par main, avant `Spot.generate` :

```
1. Si Math.random() ≥ ρ (ρ = 0,40) → main non biaisée. Retour immédiat.
2. Sinon : classer les cellules par P, garder le top-8.
3. Tirer la cible T par softmax  p(i) = P_i / Σ P_j   (tirage, PAS argmax).
   Refuser T si T == cible de la main précédente.
4. Traduire T en indices de génération : mode (extension de la table focusFor
   existante), forcePos si préflop, stackRange si spr = short/deep,
   players si ways = mw.
5. Échantillonnage par rejet, ≤ 24 candidats :
      match(t,T) = Σ_dim w_dim · [dim(t) == dim(T)]
      w = { street 3, posClass 2, facing 2, texture 1, ways 1, spr 1 }   (Σ = 10)
      accepter dès match ≥ 8 ; sinon garder le meilleur des 24.
6. Aucun candidat exploitable → main non biaisée. On ne force jamais.
```

Trois garanties d'invisibilité :
- **ρ = 40 %** : la majorité des mains reste un tirage naturel. La distribution
  réelle des spots est elle-même une information (les fréquences vraies) et la
  détruire appauvrirait l'entraînement.
- **Softmax et non argmax** : pas de motif détectable, pas de matraquage.
- **Mise à jour ambiante** : *toute* décision met à jour sa cellule, biaisée ou
  non. Même à ρ = 0 le modèle apprend. L'utilisateur ne révise jamais — il joue,
  et le système lit par-dessus son épaule.

Coût mesuré : **41 ms** pour 24 candidats. La boucle existante fait déjà jusqu'à
25 `Spot.generate` : aucun ordre de grandeur nouveau n'est introduit.

---

# 3. INTÉGRATION — sans toucher au moteur gelé

Aucune ligne du moteur n'est modifiée. Un module additif `Recall`, chargé
**après** le script du moteur, s'y branche par enveloppement de trois fonctions.
Toutes les enveloppes sont protégées : si `Recall` lève, le moteur poursuit
exactement comme avant.

### Couture 1 — lecture (observation)

```js
const _record = Progress.record.bind(Progress);
Progress.record = function (t, a, decision) {
  const entry = _record(t, a, decision);              // comportement d'origine intact
  try { Recall.observe(t, a, decision, entry); } catch (e) { /* jamais bloquant */ }
  return entry;
};
```

`t` et `a` sont tous deux disponibles : `q`, `ω`, la texture, le facing et le SPR
se calculent au vol, **sans rappeler `Judge`** (coût additionnel ≈ 0,05 ms).
`App.choose`, `Session.recordDecision`, le mode Studio (`t._studio` → non appelé)
continuent de fonctionner sans les connaître.

### Couture 2 — écriture (génération biaisée)

```js
const _gen = Spot.generate.bind(Spot);
Spot.generate = function (opt) {
  const T = Recall.target(opt);                 // null si non biaisé / Studio / labs
  if (!T) return _gen(opt);
  let best = null, bestScore = -1;
  for (let i = 0; i < 24; i++) {
    const c = _gen(Recall.applyHints(opt, T));
    if (c.finished || !Spot.options(c).length) continue;
    const s = Recall.match(c, T);
    if (s > bestScore) { best = c; bestScore = s; }
    if (s >= 8) break;
  }
  return best || _gen(opt);
};
```

Composition correcte avec la boucle appelante : celle-ci ne réessaie que si la
table est injouable, or l'enveloppe garantit déjà une table jouable quand elle
retourne un candidat. Sinon elle délègue et le comportement d'origine reprend.

### Couture 3 — persistance

Nouvelle clé `pivot.srs.v1`, **aucune écriture dans les 9 clés existantes**.

⚠️ **`Player.exportAll()` / `importAll()` énumèrent les clés en dur** (l.6166+).
La nouvelle clé serait perdue à chaque export/import. L'enveloppe doit donc aussi
patcher ces deux fonctions (ajouter/lire une section `srs`), sinon l'historique de
rétention ne survit pas à une sauvegarde. **Point à ne pas oublier.**

Pour la Phase 3 : la couche d'identité s'intercale **sous** le moteur au niveau du
stockage ; une clé supplémentaire est transparente pour elle. En revanche l'état
`Recall` est par-utilisateur et doit être purgé au changement de compte, comme les
autres clés.

### Couture 4 — interface

**Aucune.** C'est le but. Optionnellement, `App.focusNote` — chaîne déjà affichée
par l'UI existante (l.7211) — peut porter l'étiquette explicative sans qu'une
seule ligne de rendu soit ajoutée.

---

# 4. TESTABILITÉ

### a. Tests unitaires de formules (`tests/recall-unit.js`)

Fonctions pures, aucune dépendance moteur. Identités à assurer :

| Assertion | Valeur attendue |
|---|---|
| `q(lossBB=0)` | exactement 1 |
| `q` à `r = 0,35` / `r = 1` | 0,7407 / 0,5000 |
| `m` sans aucune preuve | `= m(parent)` à 1e-12 |
| décroissance seule (Δ > 0, aucune obs) | `m` invariant, `c` strictement décroissant |
| `H(m⁻=0)` / `H(m⁻=1)` | 1 j / 90 j |
| `m⁻ ≤ m` | toujours |
| 1 succès puis 1 échec identiques | `m` revient à ±1e-9 de sa valeur initiale |

### b. Apprenant simulé — **le test qui décide** (`tests/recall-sim.js`)

Agent synthétique à compétence **vraie et connue** `s[cell] ∈ [0,1]`, qui répond
juste avec probabilité `s`, dont la compétence **monte quand on la travaille**
(`s ← s + η(1−s)`) et **décroît sinon** (demi-vie connue). 5 000 décisions.

1. **Récupération** — `RMSE(m, s_vrai)` en fonction du nombre d'expositions.
   *Cible : < 0,10 après 15 expositions par cellule.* Un modèle qui ne retrouve
   pas une compétence qu'on lui a fabriquée est faux.
2. **Calibration** — regrouper les cellules par décile de `m` prédit, comparer au
   taux de succès observé. *Cible : ECE < 0,05.*
3. **Gain de planification** — même apprenant, deux fois : sélection aléatoire vs
   sélection `Recall`. Comparer les **bb cumulées perdues** à 5 000 décisions.
   *C'est le seul critère qui compte.* Si le planificateur ne bat pas l'aléatoire
   sur un apprenant qui progresse réellement quand on le fait travailler, le
   modèle ne sert à rien et doit être abandonné.
4. **Test nul** — apprenant à compétence **uniforme et statique**. Le
   planificateur ne doit **pas** battre l'aléatoire au-delà du bruit. S'il gagne
   quand même, la métrique fuit.
5. **Sensibilité aux paramètres** — courbe bb-économisées en fonction de `κ`,
   `θ`, `H_max`, `ρ`. Refuser tout paramètre dont la courbe est **plate** (il ne
   sert à rien) ou **en pic étroit** (il est fragile).

### c. Replay sur données réelles (`tests/recall-replay.js`)

`Progress.decisions[]` est un journal chronologique exploitable tel quel. Découpe
**temporelle** 70/30 : ajuster sur les 70 % anciens, prédire le verdict des 30 %
récents. Comparer l'AUC à deux références : (i) taux de base global, (ii) taux
d'erreur par street. **Si le modèle cellulaire ne bat pas la référence par street,
il est sur-dimensionné et doit être simplifié.**

> Limite honnête : texture, facing et SPR **ne sont pas dans le journal
> historique** (§1.1). Le replay ne peut donc valider que la cellule grossière
> `street × pos`. La validation complète exige de nouvelles données, collectées
> après l'installation de la couture 1.

### d. Test d'invisibilité (suite navigateur)

Sur 200 mains simulées, planificateur actif :
- fraction de mains biaisées ≤ ρ + 5 points ;
- aucune cellule ciblée deux mains de suite ;
- distribution street × position comparée à une session non biaisée par un
  **χ²** : rejet si p < 0,01 (le biais doit rester statistiquement discret).

### e. Non-régression

Les 79 tests moteur et 37 navigateur doivent rester verts **avec les enveloppes
installées**. Ajouter un test qui charge l'application avec `Recall` désactivé et
vérifie que `Progress.record` produit un `entry` **strictement identique** à la
version sans enveloppe, sur une graine fixée.

### f. Test de stabilité du juge (adossé au risque 2)

Ré-évaluer la **même table** 12 fois et vérifier que `best.action` et `lossBB` ne
bougent pas. **Déjà exécuté : 25 spots × 12 évaluations → 0 % de variation,
`lossBB` identique au centième.** `Judge` est parfaitement déterministe : le
chemin `comboTable` est exact et la repli Monte-Carlo n'est pas emprunté postflop.
Ce test doit rester en place comme sentinelle — le jour où il devient rouge,
toutes les notes `q` deviennent bruitées et le modèle doit être gelé.

---

# 5. RISQUES DE MON PROPRE MODÈLE

### Risque 1 — Le jeu de constantes n'est calibré sur rien

`κ = 6`, `H_max = 90 j`, `θ = 0,80`, `ρ = 0,40`, le seuil de porte `0,45`, le
plafond d'urgence `3`. Seule la demi-saturation `0,5 bb` de `ω` est adossée à une
mesure (médiane du gap = 0,56 bb) et seul `θ` vient de la littérature. **Il
n'existe aujourd'hui aucune donnée utilisateur HeroLab permettant de les ajuster.**
Si `H_max` est trop grand, des cellules mal acquises sortent de la file pendant
des semaines — et **aucun test unitaire ne peut le détecter**, parce que le modèle
reste cohérent avec lui-même.
*Atténuation :* toutes les constantes dans un unique objet de configuration ; le
test 5.b.5 mesure leur sensibilité ; livrer avec `H_max = 30 j` (conservateur, on
révise trop plutôt que trop peu) et ne l'ouvrir que sur données réelles.

### Risque 2 — `Judge` est la vérité terrain, et `Judge` est un modèle

Chaque `q` descend de `Judge.evaluate`, qui repose sur un facteur de réalisation
d'équité codé en dur (0,95 IP / 0,82 OOP), un modèle de polarisation approché et
une ancre bluff/value théorique. **Mesuré : `Judge` est parfaitement déterministe
— ce qui aggrave le risque au lieu de le réduire.** Il n'y a pas de bruit
d'échantillonnage à moyenner : s'il a un **biais systématique** dans une cellule,
ce biais est parfaitement reproductible, mon appareil d'incertitude le prendra
pour un signal stable, et le planificateur **entraînera l'utilisateur dans
l'erreur du moteur** en lui affichant une maîtrise validée. Mon modèle ne mesure
que l'accord avec `Judge`, jamais la justesse.
*Atténuation :* ne jamais présenter `m` comme « niveau de jeu », seulement comme
« accord avec l'évaluateur » ; plafonner `H` plus bas sur les cellules dont le
`gapBB` médian est faible (là où `Judge` s'avoue lui-même peu fiable) ; croiser
avec l'audit de l'agent qui couvre le moteur d'évaluation.

### Risque 3 — La partition en cellules est peut-être la mauvaise abstraction, et c'est irréversible

L'état s'accumule **par clé de cellule**. Trop grossière, `m` moyenne des spots
hétérogènes et ne veut rien dire (excellent avec AK, catastrophique avec 76s dans
la même cellule → « acceptable »). Trop fine, chaque cellule reste à n = 1 et le
prior parent fait tout le travail : le modèle **dégénère en taux d'erreur par
street, avec beaucoup d'appareillage en plus**. Or **c'est déjà mesuré** : 91
cellules pour 560 décisions, médiane **2** expositions — la clé fine est *déjà*
dans le régime trop creux à volume réaliste. Et la main du héros n'est pas dans la
clé (c'est délibéré : la main, c'est la variance), ce qui est peut-être une
erreur. Surtout : **changer la clé plus tard invalide tout l'historique stocké.**
*Atténuation :* livrer d'abord la clé **grossière** (`street × posClass × facing`,
~40 cellules) ; conserver les coordonnées fines dans un journal d'événements
borné (≈ 12 par cellule, ~50 Ko) pour pouvoir **recalculer rétroactivement** une
clé plus fine sans perdre le passé ; champ `ver` obligatoire dès le premier jour ;
ne scinder une cellule que lorsqu'un test d'hétérogénéité interne rejette
l'homogénéité — jamais par intuition.

---

## Annexe — pseudo-code compact

```js
const K = { kappa: 6, Hmin: 1, Hmax: 90, theta: 0.80, rho: 0.40,
            gate: 0.45, omegaHalf: 0.5, Umax: 3, Cmax: 24, accept: 8 };

// ---- observation (couture 1) -------------------------------------------
observe(t, a, decision) {
  const potBB = t.pot / t.bb;
  const tolBB = (1 + 0.03 * potBB) * ((t.level.tolerance || 0.1) / 0.1);
  const q     = 1 / (1 + a.lossBB / tolBB);
  const gap   = a.options.length > 1 ? (a.options[0].ev - a.options[1].ev) / t.bb : 0;
  const w     = clamp(gap / (gap + K.omegaHalf), 0.05, 1);

  for (const cell of [fineKey(t), coarseKey(t), t.street]) {   // toute la hiérarchie
    const c = get(cell), d = days(now - c.tLast), lam = Math.pow(2, -d / c.H);
    c.A = lam * c.A + w * q;
    c.B = lam * c.B + w * (1 - q);
    c.n++; c.tLast = now;
    c.streak = q >= 0.5 ? c.streak + 1 : 0;
    if (q < 0.5) { c.errN++; c.lossSum += a.lossBB; c.worst = Math.max(c.worst, a.lossBB);
                   bump(c.conf, decision.action + ">" + a.best.action); }
    c.H = Math.pow(K.Hmax / K.Hmin, mMinus(c)) * K.Hmin;       // stabilité réévaluée
  }
}

// ---- lecture ------------------------------------------------------------
read(c) {
  const lam = Math.pow(2, -days(now - c.tLast) / c.H);
  const Ae = lam * c.A, Be = lam * c.B, nEff = Ae + Be, mp = read(parent(c)).m;
  const al = K.kappa * mp + Ae, be = K.kappa * (1 - mp) + Be, s = al + be;
  const m = al / s, v = al * be / (s * s * (s + 1));
  return { m, c: nEff / (nEff + K.kappa), var: v,
           mMinus: Math.max(0, m - 1.65 * Math.sqrt(v)),
           R: lam, H: c.H, due: c.tLast + 0.3219 * c.H * 864e5 };
}

// ---- priorité -----------------------------------------------------------
priority(c, nTotal) {
  const r = read(c), d = days(now - c.tLast);
  const U = clamp(d / (0.3219 * c.H), 0, K.Umax);
  const L = c.errN ? c.lossSum / c.errN : parentLoss(c);
  const V = (1 - r.m) * L * (c.n / nTotal) * 100;              // bb/100
  const N = 1 + 2 / (1 + (r.c * K.kappa) / (1 - r.c));         // n_eff dérivé de c
  const G = prereqs(c).every(p => read(p).mMinus >= K.gate) ? 1 : 0;
  return U * V * N * G;
}

// ---- cible (couture 2) --------------------------------------------------
target(opt) {
  if (opt._studio || isLab(opt) || Math.random() >= K.rho) return null;
  const top = allCells().map(withPriority).sort(byP).slice(0, 8)
                        .filter(c => c.k !== lastTarget);
  return top.length ? softmaxPick(top) : null;                 // tirage, pas argmax
}
```
