# AGENT H — PROGRESSION / GAMIFICATION

Audit de `VERSION_PRODUCTION/herolab.html` (16 410 lignes). Aucun fichier
applicatif modifié. Toutes les lignes citées renvoient à ce fichier.

Mandat : vérifier que le système de progression **représente la maîtrise
réelle**. Test appliqué à chaque élément : *quel comportement d'apprentissage
utile cela renforce-t-il ?* Si la réponse est « aucun », c'est écrit.

---

## 0. Méthode et mesures exécutées

Trois mesures ont été faites en exécutant le moteur (harness `tests/harness.js`
recopié dans un scratchpad et étendu aux modules `Judge`, `LEVELS`, `Goals` —
le fichier du dépôt n'a pas été touché). Elles servent de preuve, pas
d'illustration.

**Mesure 1 — sensibilité du verdict au niveau choisi.** Une politique triviale
(« call si possible, sinon check », jamais de fold, jamais de relance) jouée sur
60 spots générés par `Spot.generate`, mode libre, à trois niveaux :

| Niveau joué | `tolerance` | correct | acceptable | erreur | **% non-erreur** | **% correct** |
|---|---|---|---|---|---|---|
| Débutant | 0.14 | 29 | 24 | 7 | **88,3 %** | **48,3 %** |
| Professionnel | 0.05 | 2 | 24 | 34 | **43,3 %** | **3,3 %** |
| GTO | 0.04 | 2 | 13 | 45 | **25,0 %** | **3,3 %** |

La même politique, sans aucun changement de compétence, produit un taux de
bonnes décisions qui varie de **88 % à 25 %** selon un réglage que le joueur
choisit librement dans les Réglages. Aucun agrégat du système de progression ne
corrige de ce facteur.

**Mesure 2 — courbe d'XP.** `d.level = 1 + floor(sqrt(d.xp/90))` (l.4743) avec
un gain de 12/6/2 XP par décision correcte/acceptable/erronée (l.4741).

| Niveau | XP requis | Décisions **toutes correctes** | Décisions **toutes erronées** |
|---|---|---|---|
| 5 | 1 440 | 120 | 720 |
| 8 | 4 410 | 368 | 2 205 |
| 12 | 10 890 | 908 | 5 445 |

Un joueur qui se trompe **à chaque décision** atteint le niveau 8. Le niveau est
une fonction monotone du volume ; la qualité n'en change que la pente (facteur
√6 ≈ 2,45 au maximum).

**Mesure 3 — la maîtrise ne s'incrémente jamais (bug prouvé).** 250 décisions
simulées en reproduisant exactement la boucle `App.choose` (l.7286-7290) :

```
décisions: 250 · xp: 1638 · niveau: 5
mastery: {"bb-overdefend":{"seen":17,"ok":0},"too-passive":{"seen":10,"ok":0}}
un seul .ok > 0 ?  false
  bb-overdefend  → {tier:1, name:"En apprentissage", rate:0, seen:17}
                   mission: {done:17, target:20, complete:false, successRate:0}
```

Détail en §6. C'est le défaut central de tout l'édifice.

---

## 1. XP et niveaux (`Progress.data.xp/level`, l.4646-4755)

### Fonctionnement exact

```js
// l.4740-4743
const gain = a.verdict === "correct" ? 12 : a.verdict === "acceptable" ? 6 : 2;
d.xp += gain;
d.level = 1 + Math.floor(Math.sqrt(d.xp / 90));
```

- L'XP est créditée dans `Progress.record()` (l.4723), donc **à chaque décision
  de chaque mode de jeu à la table**, y compris les erreurs (2 XP).
- Elle est **indépendante de la difficulté** : ni `t.level` (six niveaux de
  tolérance, l.3709-3739) ni `t.mode` n'entrent dans `gain`. Ils sont pourtant
  stockés dans l'entrée (`mode`, `level`, l.4730) — l'information existe et
  n'est jamais lue.
- Elle est **indépendante du coût de l'erreur** : `lossBB` est enregistrée
  (l.4728) et n'entre pas non plus dans `gain`. Une erreur à −0,3 bb et une
  erreur à −18 bb rapportent le même XP.
- Les Labs (Range Detective, Profiling Lab, Blocker Finder) ne créditent **aucun
  XP** : `HRStats.record`, `PRStats.record`, `BLStats.record` ne touchent pas
  `Progress.data`.

### Où c'est affiché

Une seule fois, dans « Mon profil » : `Niveau ${s.level}` (l.7006). `nextLevelXp`
est calculé (l.4818) et **n'est lu nulle part**. Il n'existe ni barre d'XP, ni
notification de montée de niveau, ni déblocage conditionné au niveau.

### Diagnostic

**Ce que ça mesure :** le volume de décisions jouées, corrigé d'un facteur ≤ 2,45
par la qualité.

**Comportement renforcé :** revenir et cliquer. Rien d'autre. Aucun arbitrage
n'est modifié par l'XP puisque rien n'en dépend — pas de déblocage, pas de
seuil, pas même un affichage saillant. C'est un compteur mort qui coûte deux
champs de persistance et un risque de mauvaise interprétation (« niveau 8 » lu
comme un niveau de jeu alors qu'il signifie « 2 205 erreurs »).

**Verdict : SUPPRIMER.** Ni refonte ni conservation — il n'y a rien à sauver,
et l'information qu'il prétend porter est déjà portée, mieux, par le Rating.

---

## 2. Rating (l.6233-6364)

### Ce que la doc interne affirme

> « Le rating n'est PAS un XP déguisé : il est calculé à partir de la vraie
> performance […]. Il peut donc monter ET descendre » (l.6227-6231).

### Ce que fait le code

```js
// l.6250-6257
skillScore(perfPct, volume, volumeForFull) {
  if (!volume) return 0;
  const confidence = Math.min(1, volume / volumeForFull);
  const perf = Math.max(0, Math.min(100, perfPct));
  return Math.round(perf * (0.35 + 0.65 * confidence));
}
```

Cinq axes (l.6260-6295) : table (`Progress.correctRate`, volume plein à 400
décisions), range (`HRStats.avg`, 120 spots), profiling (`PRStats.avg`, 100),
blockers (`BLStats.avg`, 120), discipline (dérivée de `evLoss/n`, l.6297-6303).
Agrégation pondérée table 1,6 / discipline 1,1 / labs 1 chacun, × 30 →
échelle 0-3000 (l.6309-6318).

### Vérification de l'affirmation — trois réponses

**(a) Oui, il peut descendre.** `perfPct` est une moyenne de performance, pas un
cumul ; une série d'erreurs la fait baisser et le rating suit. L'affirmation
n'est pas mensongère.

**(b) Mais pendant toute la phase d'apprentissage, il monte avec le volume à
performance constante.** Le facteur `0.35 + 0.65·confidence` est strictement
croissant en volume. Mesuré, à performance figée à 70 % :

| volume (décisions) | 10 | 50 | 100 | 200 | 400 | 800 |
|---|---|---|---|---|---|---|
| score de l'axe | 26 | 30 | 36 | 47 | **70** | 70 |

Un joueur qui **ne progresse pas du tout** voit son axe « table » passer de 26 à
70 (+169 %) en jouant. Sur les 400 premières décisions — c'est-à-dire la
totalité de la phase où un débutant apprend — le rating est bel et bien un
compteur de volume habillé en classement. Corollaire mesuré :
`skillScore(90 %, 20 spots) = 34` contre `skillScore(60 %, 400 spots) = 60` : le
joueur deux fois moins bon affiche un score presque double.

**(c) Passé le plafond de confiance, il devient quasi inerte.** `perfPct` pour
l'axe table est `Progress.summary().correctRate`, calculée sur **toute** la
fenêtre `decisions[]`, bornée à 3 000 entrées (l.4672). À 3 000 décisions, une
session de 100 décisions parfaites déplace la moyenne d'au plus ~3,3 % de
l'écart. Un joueur qui corrige réellement un défaut ne le verra pas dans son
rating avant des milliers de décisions. Même chose pour les labs (fenêtres de
500 spots, l.9950 et équivalents PR/BL).

**(d) Le rating est indifférent à la difficulté.** `correctRate` mélange les six
niveaux de `LEVELS` ; `HRStats.avg` mélange les quatre `HR_DIFFICULTY`
(l.9101-9133) — la difficulté est bien stockée dans chaque spot (`difficulty`,
l.9958) et n'entre jamais dans la moyenne. Compte tenu de la mesure 1
(88 % contre 25 % pour la même politique), **le chemin le plus rapide vers un
rating élevé est de baisser la difficulté**. Le système récompense exactement le
comportement qu'un outil d'apprentissage doit décourager.

**(e) Le plafond structurel.** Un joueur qui ne fait que jouer à la table, même
parfaitement, plafonne à `(100×1,6 + 100×1,1)/5,7 × 30 = 1 421`, soit à peine le
seuil « Compétent » (1 350, l.6326). Les trois labs valent 3/5,7 = **53 % du
rating**. Farmer trois labs en difficulté « débutant » rapporte plus que jouer
parfaitement à la table.

### Diagnostic

**Ce que ça mesure :** un mélange non pondéré de performance, de volume et de
difficulté choisie, sur une fenêtre trop longue pour refléter l'état actuel.

**Comportement renforcé :** jouer beaucoup, à la difficulté la plus basse, en
touchant aux trois labs. Un seul de ces trois comportements est utile
(l'ampleur : toucher aux trois labs plutôt qu'un seul est un vrai objectif
pédagogique, et le poids donné à `table` = 1,6 est un bon jugement).

**Verdict : REFONDRE** (voir §9). C'est la meilleure fondation disponible — les
cinq axes sont les bons axes — mais trois de ses quatre ingrédients sont faux :
pondération par le volume, absence de pondération par la difficulté, absence de
récence.

---

## 3. Career / TIERS (l.4923-5004, `Goals` l.5280-5377, `Career.promote` l.5753)

### Ce qui déclenche un passage de palier

`Career.promotionStatus()` (l.5738-5751) exige **`Goals.allMet(goals) && Bankroll.canMoveUp(...)`**.
Les objectifs (l.5286-5361) :

| # | Objectif | Source | Nature |
|---|---|---|---|
| 1 | `reqHands` mains au palier (2 500 → 20 000) | `st.hands` | **volume** |
| 2 | winrate > `reqWinrate` bb/100 (2,0 → 1,5) | `st.bb / st.hands` | résultat, dépend de la variance |
| 3 | `reqAccuracy` % de décisions non erronées (68 → 80) | `st.accurate / st.decisions` | **qualité** |
| 4 | `reqBuyins` caves du palier suivant (30 → 40) | bankroll | **argent** |
| 5 | réduire de 30 % le leak principal | `leakBaseline/leakRecent` | qualité — **facultatif** (l.5357, l.5374) |

Donc : **non, ce n'est pas la bankroll seule.** Il y a un critère de compétence
(#3) et un critère de correction de défaut (#5). C'est la meilleure partie du
système — l'intention est juste.

### Ce qui ne va pas

**(a) Le seul critère de compétence est battu par un bot trivial.** Le jugement
d'une session de carrière utilise `cfg.level = Career.levelForTier(tier)`
(l.7208), soit `["debutant","intermediaire","avance","avance","pro"]` (l.5651).
Au palier NL2, on joue donc en tolérance « débutant », où la mesure 1 donne
**88,3 % de décisions non erronées à une politique qui ne fait que call/check**.
Le seuil `reqAccuracy` de NL2 est de **68 %**. La barre de compétence de la
promotion NL2 → NL5 est vingt points **en dessous** de ce qu'obtient une
politique sans aucune compétence. Elle n'est donc contraignante qu'aux paliers
hauts, où la tolérance se resserre — mais elle n'est jamais calibrée *contre* la
tolérance, ce qui rend les cinq seuils incomparables entre eux.

**(b) L'accuracy est cumulée sur toute la vie du palier**, jamais fenêtrée
(`st.accurate += report.accurate`, l.5679). Un joueur qui débute mal à NL25
accumule 12 000 mains (~55 000 décisions) : la moyenne devient inertielle au
point qu'aucune amélioration récente ne peut plus la faire franchir 77 %. Le
critère de qualité punit le fait d'avoir appris **dans** le palier, ce qui est
exactement ce qu'on veut encourager.

**(c) L'objectif dominant reste le volume.** 2 500 mains × 4,6 décisions =
~11 500 décisions pour la première promotion. Les objectifs 1, 2 et 4 sont tous
des fonctions croissantes du temps passé. Le 3 est plafonné bas. Le 5 est
explicitement non bloquant (l.5364-5375). En pratique : **on monte de limite
parce qu'on a grindé, avec un garde-fou de qualité lâche.**

**(d) Le critère « leak » est mesuré sur un dénominateur absent.** `leakBaseline[k]`
= `n / report.decisions` (l.5700-5704) où `n` est un **nombre d'erreurs de ce
type** (§6). Le taux est donc « erreurs de type k par décision toutes situations
confondues », pas « erreurs de type k par occasion de type k ». Jouer moins de
spots BB fait baisser le « leak BB » sans qu'on ait rien appris.

**(e) La descente est purement financière.** `checkDemotion()` (l.5768-5777) ne
regarde que `Bankroll.shouldMoveDown` — < 15 caves (l.5253). Un joueur dont
l'accuracy s'effondre mais qui court bien reste au palier. Le système sait
monter sur la compétence, il ne sait redescendre que sur l'argent.

**(f) Une porte dérobée théorique dans `allMet`** (l.5371-5376) : les objectifs
verrouillés sont exclus, et il suffit de 3 objectifs « core » atteints. Si
`accuracy` était encore verrouillé (< 100 décisions), volume + winrate +
bankroll suffiraient. Le seuil de volume (2 500 mains) rend ce cas inatteignable
en pratique — c'est de la fragilité, pas un exploit exploitable.

### Diagnostic

**Ce que ça mesure :** du temps passé, de la chance, et un plancher de qualité
non calibré.

**Comportement renforcé :** jouer du volume en carrière. La partie utile —
« ne monte pas de limite tant que tu n'as pas prouvé que tu bats celle-ci » —
est présente dans l'intention et diluée dans l'exécution.

**Verdict : REFONDRE** — c'est la structure la plus proche d'un vrai système de
maîtrise, il lui manque un examen (§9.3).

---

## 4. Les 16 succès (`Career.BADGES` l.5780-5792 + badges de palier l.5762)

11 badges déclarés + 5 badges `tier_*` créés dynamiquement à la promotion
(l.5762) = **16**, dont 15 réellement atteignables (`tier_NL2` n'est jamais
décerné : on démarre à NL2 sans promotion).

| Badge | Condition (ligne) | Mesure |
|---|---|---|
| `first_session` | 1 session terminée (5807) | **volume** |
| `grinder` | 10 sessions (5808) | **volume** |
| `vol_1000` | 1 000 mains (5809) | **volume** |
| `vol_5000` | 5 000 mains (5810) | **volume** |
| `vol_20000` | 20 000 mains (5811) | **volume** |
| `tier_NL5/NL10/NL25/NL50` | promotion (5762) | volume + qualité (§3) |
| `winner` | une session `netBB > 0` (5814) | **résultat / variance** |
| `big_win` | une session ≥ +100 bb (5815) | **résultat / variance** |
| `acc_80` | session complète ≥ 80 % (5812) | qualité (non calibrée) |
| `acc_90` | session complète ≥ 90 % (5813) | qualité (non calibrée) |
| `discipline` | session perdante, ≥ 80 % d'accuracy, ≥ 40 mains (5816) | **qualité pure** |
| `fixer` | leak principal réduit de 30 % (5819-5821) | **maîtrise démontrée** |

**Décompte : 5 volume purs, 2 résultat/variance, 4 palier (mixtes), 4 qualité,
dont 2 seulement (`discipline`, `fixer`) mesurent une maîtrise que la variance
ne peut pas offrir.**

Nuances :

- `acc_80` / `acc_90` ne fixent pas le niveau de jugement. Mesure 1 : une
  politique triviale atteint 88,3 % en tolérance « débutant ». `acc_80` est donc
  **décerné automatiquement** à qui joue une session NL2 ; `acc_90` est
  marginalement plus dur. Aux paliers hauts, `acc_90` devient quasi impossible.
  Un même badge signifie deux choses opposées selon quand on l'obtient.
- `big_win` récompense explicitement la variance — l'app passe par ailleurs son
  temps à expliquer au joueur que le résultat n'est pas le jeu
  (`verdictText`, l.5555-5562). Contradiction directe avec son propre discours.
- `discipline` est le meilleur badge du fichier : il récompense de bien jouer
  **en perdant**. C'est le modèle à généraliser.
- L'écran des badges affirme : *« Ils marquent des étapes réelles de
  progression, pas des récompenses de participation »* (l.8671). Cinq badges sur
  onze sont des récompenses de participation.
- Bug d'affichage : le compteur (l.8665) affiche `d.badges.length / Career.BADGES.length`
  alors que `d.badges` reçoit aussi les badges `tier_*` → il peut afficher
  « 15 / 11 ».

**Comportement renforcé :** rester connecté (5 badges), avoir de la chance
(2 badges), bien jouer (2 badges).

**Verdict : REFONDRE** — garder `discipline` et `fixer` tels quels, requalifier
les badges de volume en volume **qualifié**, supprimer `big_win`.

---

## 5. Les deux streaks

### `Progress.data.streak` (l.4652, l.4745-4751)

```js
const day = new Date().toDateString();
if (d.lastDay !== day) {
  const yest = new Date(Date.now() - 864e5).toDateString();
  d.streak = d.lastDay === yest ? d.streak + 1 : 1;
  d.lastDay = day;
}
```

Incrémentée à la **première décision de la journée**, quelle que soit sa qualité
et quel qu'en soit le nombre. Une décision par jour suffit. Elle est renvoyée
par `summary()` (l.4817) et **n'est affichée nulle part** — recherche exhaustive
sur `streak` dans le fichier : les seules occurrences d'affichage concernent
`daily.streak` (l.6857, l.7120) et les séries des labs. **C'est du code mort qui
écrit dans le stockage.**

### `Player.daily.streak` (l.6080, l.6127-6140)

Incrémentée dans `completeDaily(score, total)` — appelée dès que le défi atteint
10 décisions (l.7328), **sans aucun seuil de score**. Un 0/10 entretient la
série aussi bien qu'un 10/10. De plus, le défi du jour hérite du niveau de
difficulté réglé par le joueur (`cfg` copié de `App.cfg`, l.7167 ; seul `mode`
est forcé à « cible », l.7173) : la série peut être entretenue en « Débutant ».

**Ce que ça mesure :** l'assiduité. Rien d'autre.

**Comportement renforcé :** revenir chaque jour — ce qui a une vraie valeur
pédagogique (la pratique espacée bat la pratique massée) — mais **sans aucune
exigence de qualité ni de difficulté**, donc sans distinguer « revenir pour
travailler » de « revenir pour cliquer dix fois ».

**Verdict :** `Progress.streak` → **SUPPRIMER** (mort). `Player.daily.streak` →
**REFONDRE** : une série ne doit se maintenir que sur un défi réussi.

---

## 6. Mentors (3) et avatars (12) — et le bug de `mentorBond` / `mastery`

### Avatars (l.6011)

`AVATARS` est une liste de 12 symboles. Sélection à l'onboarding (l.6932) et
dans le profil (l.7000). Affiché dans le rail (l.6619) et le profil (l.6995).
**Aucun effet mécanique, aucun déblocage** : les 12 sont disponibles dès la
première seconde. C'est de l'identité, pas une récompense — et c'est très bien
ainsi (voir §9.6).

### Mentors (l.6017-6069)

Trois personnages, chacun avec 3 répliques × 3 verdicts = 9 lignes. Utilisation
totale (l.7568-7569) :

```js
const _mentorLine = _mentor ? Mentor.say(a.verdict) : null;
if (_mentor && !App._mentorRewarded) { Mentor.reward(a.verdict); App._mentorRewarded = true; }
```

`Mentor.say` tire une réplique **au hasard** dans le tableau du verdict
(l.6048-6052). Aucune influence sur : la génération de spot, le jugement, la
sélection des drills, le contenu du débrief. **Effet mécanique : nul.** Le
mentor est un habillage du verdict déjà calculé.

### `mentorBond` (l.6054-6068)

+0,8 par décision correcte, +0,2 par acceptable, **jamais de baisse** (le
commentaire l.6053 dit « Se dégrade à peine sur erreur » — le code ne la dégrade
pas du tout). Plafond 100, donc atteint en ~125 décisions correctes. Cinq
paliers nommés (l.6061-6068).

`bondLevel()` est lu **une seule fois**, pour afficher un badge et une barre
dans « Mon profil » (l.7010). **Il ne débloque rien, ne change rien, ne se
perd jamais.** Il est en outre **global et non par mentor** : changer de mentor
(l.7052-7059) conserve le bond — on peut être « Loyauté niv.5 » avec un mentor
rencontré il y a dix secondes.

**Ce que ça mesure :** le nombre de décisions correctes, plafonné à 125.
C'est un troisième compteur d'XP, encore plus dégradé que le premier.

**Comportement renforcé :** aucun. `mentorBond` est décoratif au sens strict de
la règle du mandat.

**Verdict :** mentors → **REFONDRE** (leur donner un effet, §9.6) ;
`mentorBond` → **SUPPRIMER en l'état** ; avatars → **GARDER** tels quels
(identité, jamais récompense).

### Le bug qui casse la maîtrise (`Player.mastery`) — P0

`Progress.tags()` (l.4678-4720) ajoute d'abord les tags de contexte
(`street:*`, `pos:*`), puis :

```js
// l.4685-4686
const wrong = a.verdict === "erreur";
if (!wrong) return tags;          // ← aucune étiquette leak: si la décision est bonne
```

Les tags `leak:*` **n'existent que sur les erreurs**. Or `App.choose` fait
(l.7286-7290) :

```js
const wasOk = a.verdict !== "erreur";
for (const tag of (entry.tags || []))
  if (tag.startsWith("leak:")) Player.recordMastery(tag.slice(5), wasOk);
```

`wasOk` est donc **toujours `false`** dans cette boucle. Conséquences prouvées
par la mesure 3 :

1. `Player.data.mastery[k].ok` **vaut 0 à vie**, pour toutes les clés.
2. `masteryLevel()` (l.6151-6159) : `rate = 0`, donc dès `seen ≥ 10` on retombe
   sur `rate < 0.5` → **tier 1 « En apprentissage », définitivement**. Les
   paliers « Familier », « Solide », « Maîtrisé » sont **inatteignables**.
   Le panneau « Ta maîtrise par notion » (l.8193-8215) et l'écran
   « Mon évolution » (l.8140) affichent donc éternellement le même palier.
3. `Journey.mission().complete` exige `successRate >= 0.65` (l.6471) sur une
   valeur épinglée à 0 : **aucune mission n'est achevable**. Le badge
   `✓ accompli` (l.8127) est du code mort.
4. `m.seen` compte les **erreurs**, pas les occasions. La barre de mission
   `done/20` (l.6463, l.8130) **progresse quand le joueur se trompe**. Un joueur
   qui corrige son défaut voit sa mission se figer ; un joueur qui l'aggrave voit
   sa mission « avancer ».
5. Même racine dans `Progress.summary().leaks` : `tagStats["leak:x"].n === err`
   toujours (l.4734-4738), donc `leaks[].n` n'est pas un nombre d'occasions mais
   un doublon du nombre d'erreurs.

**Aucun dénominateur d'occasion n'est instrumenté nulle part dans
l'application.** C'est la cause racine : sans « combien de fois la situation
s'est présentée », il est *mathématiquement impossible* de mesurer une maîtrise.
Tout ce qui reste mesurable est un décompte — c'est-à-dire du volume. Cela
explique mécaniquement pourquoi XP, bond, badges, missions et objectifs de
carrière convergent tous vers le volume : **le système ne dispose d'aucune autre
grandeur**.

---

## 7. Journey (l.6375-6524) — actif ou vestigial ?

**Actif**, et branché sur une vraie vue (`App.view === "journey"` → l.6584 →
`renderJourney` l.8042-8102, entrée de menu « Mon évolution », l.6550).

| Composant | État |
|---|---|
| `snapshot()` l.6390 | **actif** — appelé l.8045 (vue) et l.8446. Photo quotidienne des leaks + précision, 120 jours glissants. Données réelles. |
| `story()` l.6424 | **actif** — triptyque avant/depuis/maintenant, l.8075-8095. |
| `timeline()` l.6500 | **actif** — agrégation hebdomadaire, l.8160-8188. Affiché seulement si ≥ 2 semaines de données. |
| `activeMissions()` l.6494 | **actif mais cassé** — rendu l.8113-8138, `complete` inatteignable, barre inversée (§6). |
| `MISSION_TARGET = 20` l.6457 | seuil arbitraire sur un compteur d'erreurs. |
| `Journey.data.missions` / `seen` | **vestigiaux** — initialisés (l.6380-6384), persistés, **jamais écrits ni lus**. |

`snapshot` / `story` / `timeline` sont la meilleure idée du fichier : ils
historisent l'état pour produire une comparaison honnête dans le temps, et le
commentaire l.6373 (« Ne prétend JAMAIS un gain d'argent — parle de maîtrise »)
est exactement la bonne ligne éditoriale.

**Comportement renforcé :** revenir sur son propre défaut principal et le
retravailler (`trainLeak`, `trainSpecificLeak` l.8186-8192). C'est le seul
endroit de l'app où la boucle *diagnostic → travail ciblé → re-mesure* est
complète — et le seul dont la mesure finale est cassée.

**Verdict : GARDER et réparer.** C'est le squelette de l'architecture cible.

---

## 8. Synthèse : élément / mesure quoi / comportement renforcé / verdict

| Élément | Lignes | Mesure réellement | Comportement d'apprentissage renforcé | Verdict |
|---|---|---|---|---|
| XP + niveau | 4741-4743, 4818, 7006 | volume (qualité = pente ×2,45 max) | **aucun** (rien n'en dépend, affiché 1 fois) | **SUPPRIMER** |
| Rating (5 axes) | 6233-6364 | perf × volume, sans difficulté ni récence | ampleur (toucher aux 3 labs) — bon ; le reste : farmer en difficulté basse | **REFONDRE** |
| Career TIERS + Goals | 4923-5004, 5280-5377 | volume + variance + plancher qualité non calibré | ne pas monter trop vite (intention juste, exécution diluée) | **REFONDRE** |
| Badges (16) | 5780-5825, 5762 | 5 volume, 2 variance, 4 palier, 4 qualité (2 solides) | `discipline` et `fixer` : très bon. Le reste : présence et chance | **REFONDRE** (garder 2, requalifier 5, supprimer `big_win`) |
| `Progress.streak` | 4745-4751 | 1 décision/jour, jamais affichée | **aucun** — code mort | **SUPPRIMER** |
| `Player.daily.streak` | 6127-6140, 7120 | jours consécutifs d'ouverture du défi (0/10 compte) | revenir (utile) sans exigence de réussite | **REFONDRE** |
| Mentors (3) | 6017-6069, 7568 | rien — répliques tirées au hasard | **aucun** (habillage du verdict) | **REFONDRE** (leur donner un effet) |
| `mentorBond` | 6054-6068, 7010 | décisions correctes, plafond ~125, jamais décroissant, global | **aucun** — décoratif | **SUPPRIMER** |
| Avatars (12) | 6011, 6932 | rien, tous disponibles d'emblée | identité (légitime, non-récompense) | **GARDER** |
| `Player.mastery` | 6143-6159 | **des erreurs** ; `ok` toujours 0 (bug prouvé) | inversé : la barre monte quand on échoue | **RÉPARER (P0)** |
| Journey snapshot/story/timeline | 6390-6523 | historique réel des leaks et de la précision | diagnostic → travail ciblé → re-mesure | **GARDER** |
| Journey missions | 6459-6497, 8113 | erreurs cumulées ; `complete` inatteignable | inversé (voir mastery) | **RÉPARER** |
| `Journey.missions/seen` | 6380-6384 | rien | **aucun** | **SUPPRIMER** |

---

## 9. Incohérences

### I1 — Sept échelles nommées, trois notions de « niveau », deux fois le mot « Débutant »

| Échelle | Lignes | Valeurs | Nature |
|---|---|---|---|
| `Progress.level` | 4743 | 1…∞ | gagné (volume) |
| `Rating.tier` | 6321-6335 | Débutant → Maître (7) | gagné (perf × volume) |
| `Career TIERS` | 4923 | NL2 → NL50 (5) | gagné (volume + argent) |
| `LEVELS` | 3709 | Débutant → GTO (6) | **choisi par le joueur** |
| `HR/PR/BL_DIFFICULTY` | 9101, 11121, 12690 | Débutant → Expert (4 ×3) | **choisi par le joueur** |
| `masteryLevel` | 6151 | Découverte → Maîtrisé (5) | gagné (cassé) |
| `bondLevel` | 6061 | Méfiance → Loyauté (5) | gagné (décoratif) |

Le joueur peut simultanément être « Rating : Débutant », « Niveau 7 », « NL10 »,
en jouant au réglage « Avancé », avec une maîtrise « En apprentissage » et un
mentor « Loyauté ». **Sept nombres, aucune relation définie entre eux, dont
deux sont des réglages qu'il a lui-même choisis et qui portent le même
vocabulaire que les récompenses.** Le mot « Débutant » désigne à la fois un
niveau de tolérance choisi et un rang mérité.

### I2 — La difficulté choisie inflate toutes les mesures de qualité

`tolerance = (1·bb + pot·0.03) × (level.tolerance / 0.1)` (l.4169), soit ×1,4 en
Débutant contre ×0,4 en GTO — un facteur **3,5** sur la largeur de la bande
« correct/acceptable ». Or `Progress.correctRate` (→ Rating axe table, poids
1,6), `st.accurate/st.decisions` (→ objectif de promotion), `report.accuracy`
(→ badges `acc_80`/`acc_90`, verdict de session l.5554), `HRStats.avg` /
`PRStats.avg` / `BLStats.avg` (→ 53 % du Rating) ignorent tous le niveau. **Six
mesures de qualité, un même biais, aucune normalisation.** Le joueur qui monte
en difficulté — le comportement à encourager — voit toutes ses métriques
chuter.

### I3 — Deux mesures contradictoires de la maîtrise d'un défaut

- `Career.mainLeak` (l.5722-5735) : `baseline` vs `recent`, taux d'erreurs par
  décision, par palier, mis à jour en fin de session.
- `Player.masteryLevel` (l.6151) : `ok/seen` par catégorie, mis à jour par
  décision, **cassé** (`ok` = 0).
- `Journey.story` (l.6440-6450) : troisième formule, sur les bb perdues
  (`nowLoss < beforeLoss × 0.85`) **ou** `mastery.seen ≥ 15` — c'est-à-dire
  qu'elle déclare « tu progresses » quand le joueur a commis **15 erreurs** de
  ce type.

Trois définitions, trois résultats possibles, affichés côte à côte dans la même
vue (l.8067-8138).

### I4 — Deux séries qui mesurent la même chose, l'une invisible

`Progress.data.streak` et `Player.daily.streak` mesurent toutes deux
l'assiduité, avec deux règles différentes, dans deux clés de stockage
différentes. La première n'est jamais affichée.

### I5 — Trois compteurs monotones du même signal

`Progress.xp` (12/6/2 par décision), `mentorBond` (0,8/0,2/0 par décision) et
`skillScore` en phase de montée mesurent tous « le joueur a produit des
décisions ». Trois implémentations, trois persistances, un seul signal.

### I6 — Le discours contredit le code

L'app explique correctement au joueur que le résultat n'est pas le jeu
(`verdictText` l.5555-5562 ; note l.8151 « pas des gains en argent réel ») —
et décerne `winner` et `big_win` sur le résultat brut (l.5814-5815), impose un
objectif de winrate pour la promotion (l.5303-5312), et fait descendre de palier
sur la seule bankroll (l.5768-5777).

### I7 — Le Rating plafonne le joueur de table et récompense le farm de labs

53 % du rating provient de trois labs dont la difficulté est libre et non
pondérée ; un joueur qui joue parfaitement à la table sans y toucher plafonne à
1 421/3000 (« Compétent »).

### I8 — Compteur de badges faux

`d.badges.length / Career.BADGES.length` (l.8665) : le numérateur inclut les
badges `tier_*`, pas le dénominateur → affichage possible « 15 / 11 ».

---

## 10. Proposition : une architecture de progression unifiée

Principe directeur : **une seule grandeur de progression, dérivée d'une seule
mesure, et un seul rite de passage.** Tout élément qui ne se ramène pas à
« maîtrise démontrée sur une situation identifiée » est supprimé.

### 10.1 — Fondation : instrumenter l'occasion (le dénominateur)

Rien d'autre n'est possible avant. Aujourd'hui `Progress.tags()` n'émet une
étiquette de catégorie **que sur erreur** (l.4685-4686).

**Changement :** séparer le *contexte* du *verdict*. Pour chaque décision, émettre
une étiquette `ctx:<catégorie>` décrivant la situation rencontrée —
indépendamment du résultat — et conserver `leak:<catégorie>` uniquement sur
erreur. Les catégories existent déjà : les dix conditions de `Progress.tags`
(l.4689-4718) décrivent chacune une *situation* (défense BB face à une
ouverture, décision river face à une mise, spot de value fine…) doublée d'une
*réponse fautive*. Il suffit de tester la situation avant de tester la faute.

On obtient alors, pour la première fois :

```
maîtrise(catégorie) = f(ok, occasions, difficulté, récence)
```

Effets en cascade, sans autre changement : `Player.mastery` devient juste ;
`masteryLevel` retrouve ses 5 paliers ; les missions de Journey deviennent
achevables et leur barre s'oriente dans le bon sens ; `summary().leaks` gagne un
taux (`err/n`) au lieu d'un décompte ; l'objectif « leak » de la carrière
(l.5340-5359) mesure enfin une fréquence d'erreur par occasion.

### 10.2 — Le score unique : une **maîtrise** par compétence, pas un XP

Une seule primitive, appliquée à chaque unité de compétence :

```
score(c) = borne_basse_de_confiance( réussites pondérées / occasions pondérées )
```

avec trois pondérations, toutes déjà disponibles dans les données enregistrées :

1. **Difficulté** — poids issu de `level.tolerance` (l.3709-3739) et de
   `HR/PR/BL_DIFFICULTY`. Une décision correcte en tolérance 0,04 vaut plus
   qu'en 0,14 ; une décision correcte en Débutant compte, mais ne peut pas à
   elle seule porter le score au-delà d'un plafond propre à ce niveau.
   *Corrige I2, supprime le farm de difficulté basse.*
2. **Récence** — pondération exponentielle (demi-vie de l'ordre de 200-300
   décisions) au lieu de la fenêtre plate de 3 000 (l.4672) et de 500
   (l.9950). *Rend le score capable de descendre vite et de monter vite ; un
   progrès réel devient visible en une session.*
3. **Confiance** — la borne basse remplace le facteur arbitraire
   `0.35 + 0.65·confidence` (l.6256). Elle monte avec le volume **parce que
   l'incertitude baisse**, converge vers la performance réelle, et ne
   récompense plus le volume au-delà du point où il informe. C'est la
   différence entre « je ne sais pas encore » et « tu es meilleur ».

Le Rating (0-3000) reste **l'unique nombre affiché**, agrégat de ces scores. Les
cinq axes actuels (l.6260-6295) sont conservés — ils sont bien choisis. Deux
corrections : le poids des labs est ramené sous celui du jeu à la table (I7), et
chaque axe expose son intervalle plutôt qu'un point (« 62 ± 9 » se lit comme
« continue, on n'est pas sûrs » et rend la mesure honnête).

**Supprimés :** `Progress.xp`, `Progress.level`, `nextLevelXp`, `mentorBond`,
`Progress.streak`, `Journey.data.missions`, `Journey.data.seen`.

### 10.3 — Le palier de carrière : un examen, pas un compteur

Le passage de limite doit signifier **« j'ai démontré que je bats cette
limite »**. Trois conditions, dans cet ordre de priorité :

1. **Maîtrise minimale sur les compétences cœur du palier.** Chaque palier
   déclare déjà ce qu'il exige : `TIERS[i].lesson` et `traits` (l.4931-4937,
   4947-4952, …) décrivent en français ce que le joueur doit savoir faire.
   Chaque palier liste les 3-4 catégories `ctx:` correspondantes et exige un
   score ≥ seuil, **avec assez d'occasions pour que la borne basse soit
   informative**. NL2 = value-betting et sélection préflop (c'est écrit l.4937) ;
   NL5 = défense de blinde et jeu au flop (l.4953) ; NL10 = adaptation à
   l'image (l.4969) ; NL25 = décisions marginales (l.4985) ; NL50 = minimiser
   ses propres erreurs (l.5001). **Le contenu existe déjà : il n'est simplement
   relié à rien.**

2. **Un examen de passage.** Un set fixe de N spots (30-40), généré au niveau de
   jugement du palier **suivant** (`levelForTier(tier+1)`, l.5650-5652), sans
   indice, sans possibilité de changer la difficulté, sans enregistrement dans
   les statistiques courantes, échouable et repassable après un délai. Réussite
   = seuil calibré **contre la tolérance de ce niveau** (mesuré une fois avec la
   méthode de la mesure 1 : le seuil doit être significativement au-dessus de ce
   qu'obtient une politique triviale — au niveau « débutant », 88,3 %, ce qui
   condamne le `reqAccuracy: 68` actuel). *Comportement renforcé : réviser avant
   de monter, et se confronter une fois à un jugement plus dur que celui du
   quotidien — c'est un transfert, pas une répétition.*

3. **La bankroll comme garde-fou, plus comme moteur.** `reqBuyins` (l.4938…)
   reste une condition bloquante — la règle est juste et vraie au poker — mais
   elle cesse d'être l'axe de progression : c'est un prérequis, pas un but.
   Symétriquement, la descente (l.5768) doit s'ouvrir sur la compétence : si le
   score de maîtrise du palier repasse durablement sous le seuil d'admission, le
   système **propose** de redescendre (et le dit dans le vocabulaire de gestion
   déjà présent l.5262 : « ce n'est pas un échec, c'est de la gestion »).

**Volume et winrate cessent d'être des objectifs** et redeviennent ce qu'ils
sont : des conditions de lisibilité de la mesure. Ils s'affichent comme
« ta mesure est fiable à partir de X mains », pas comme des barres à remplir.

### 10.4 — Les succès : uniquement des maîtrises démontrées

Filtre unique : *un badge est décerné si et seulement si le joueur a démontré
quelque chose que la variance et le temps ne peuvent pas produire seuls.*

- **Supprimés :** `big_win` (pure variance), `vol_1000` / `vol_5000` /
  `vol_20000` / `first_session` / `grinder` sous leur forme actuelle.
- **Requalifiés :** le volume devient du **volume qualifié** — « 1 000 mains
  jouées **au-dessus du seuil de maîtrise de ton palier** ». Même compteur, une
  condition en plus, un sens qui change entièrement.
- **Conservés tels quels :** `discipline` (bien jouer en perdant — le meilleur
  badge du fichier, l.5789) et `fixer` (défaut réduit de 30 %, l.5790), qui
  deviennent enfin mesurables grâce à §10.1.
- **Recalibrés :** `acc_80` / `acc_90` doivent porter le niveau de jugement dans
  leur libellé et leur seuil, sinon ils signifient deux choses opposées selon le
  palier (§4).
- **Nouveaux, dans l'esprit de `fixer`** : « une catégorie passée de "En
  apprentissage" à "Maîtrisé" », « examen de palier réussi du premier coup »,
  « maîtrise maintenue 30 jours après l'avoir atteinte » (rétention — la seule
  preuve d'apprentissage durable).
- Corriger le compteur `d.badges.length / BADGES.length` (I8).

### 10.5 — Une seule série, conditionnée à la réussite

Suppression de `Progress.streak` (morte). `Player.daily.streak` ne s'incrémente
que si le défi du jour est **réussi** (seuil explicite, par exemple 7/10) et
**au niveau de jugement recommandé par le système**, pas au réglage libre du
joueur (l.7167). La pratique espacée est un vrai levier d'apprentissage : elle
mérite d'être récompensée pour ce qu'elle est — *revenir et réussir* — pas pour
l'ouverture de l'application.

### 10.6 — Mentors : un effet ou rien

Trois options, par ordre de préférence :

1. **Leur donner un rôle mécanique** : chaque mentor définit une politique de
   sélection de spots et un mode de jugement — Vera → `mode: "gto"` (l.3729),
   Marco → `mode: "exploit"` (l.3733), Kai → priorité aux drills de profiling.
   Le choix du mentor devient un choix pédagogique, et le joueur qui en change
   change réellement d'entraînement.
2. Remplacer `mentorBond` par un **retrait progressif de l'étayage** : plus la
   maîtrise d'une catégorie monte, moins l'indice est affiché (`hint`, l.3712).
   Le « lien » devient la mesure de l'autonomie acquise — c'est le seul usage de
   ce concept qui renforce un comportement d'apprentissage (fading).
3. À défaut : garder les répliques (elles ont une valeur de ton, pas de
   progression) et **supprimer le bond**, la barre et les cinq paliers nommés.

Les **avatars restent purement cosmétiques et immédiatement disponibles**. C'est
la bonne décision : l'identité ne doit jamais être une récompense, sinon elle
devient un motif de retour sans contenu.

### 10.7 — Journey devient la vue canonique de la progression

`snapshot` / `story` / `timeline` sont conservés et deviennent la seule
narration : « ce que tu maîtrisais il y a N jours / ce que tu maîtrises
maintenant / ton chantier ». Les missions redeviennent honnêtes une fois §10.1
appliqué : la barre mesure des **occasions travaillées**, l'achèvement mesure un
**taux de réussite sur ces occasions**, et la troisième formule de progression
de `story()` (l.6446, `mastery.seen >= 15`) est supprimée au profit de la mesure
unique.

---

## 11. Recommandation P0

**Instrumenter l'occasion : émettre une étiquette de contexte `ctx:<catégorie>`
sur *chaque* décision, indépendamment du verdict — au lieu de n'étiqueter que
les erreurs (l.4685-4686).**

Pourquoi c'est le P0 et pas la refonte du Rating ou de la carrière :

1. **C'est un bug prouvé, pas une opinion.** Mesure 3 : `mastery[*].ok === 0`
   après 250 décisions. Trois écrans livrés affichent des données fausses
   (maîtrise figée à « En apprentissage », missions inachevables, barre de
   mission qui progresse à chaque erreur).
2. **C'est la cause racine de tout le reste.** Sans dénominateur, la seule
   grandeur mesurable est un décompte — c'est-à-dire du volume. C'est
   *mécaniquement* pour cela que l'XP, le bond, cinq badges sur onze, les
   objectifs de carrière et la phase de montée du Rating mesurent tous la même
   chose. On ne peut pas construire « chaque récompense correspond à une
   maîtrise démontrée » tant que la maîtrise n'est pas calculable.
3. **Le coût est faible et localisé.** Les dix conditions de `Progress.tags`
   (l.4689-4718) décrivent déjà chacune une situation + une faute ; il s'agit de
   dissocier les deux tests. Aucun changement de moteur (contrainte 1 du
   contexte partagé : DF-B reste gelé — on lit `a.verdict` et `a.best`, on ne
   recalcule aucun poker). Ajout d'une clé dans `tagStats`, rétro-compatible :
   les anciens `leak:*` restent lisibles.

**P0 bis, immédiat et sans risque :** neutraliser les deux affichages faux qui
en découlent — le palier de maîtrise figé et la barre de mission inversée —
plutôt que de continuer à montrer au joueur une progression qui décrit ses
échecs.

**P1 :** normaliser toutes les mesures de qualité par la tolérance du niveau
joué (I2) — c'est le second levier par ordre d'impact, parce qu'il retire au
joueur l'incitation à baisser la difficulté, incitation que le système lui
donne aujourd'hui sur six métriques simultanément.
