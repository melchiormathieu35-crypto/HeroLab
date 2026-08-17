# AGENT B — HeroLab comme système pédagogique

**Cible auditée** : `VERSION_PRODUCTION/herolab.html` (16 410 l.)
**Méthode** : lecture du code + exécution sous `tests/harness.js` (copie modifiée en
scratchpad pour exposer `Judge`, aucun fichier applicatif ni de test modifié).
**Convention** : `[V]` = vérifié (lu à la ligne citée ou mesuré par exécution),
`[S]` = supposé / inféré.

---

## 0. Résumé exécutif

HeroLab est un **excellent moteur d'exposition et un mauvais système
d'apprentissage**. La boucle s'arrête au maillon 4 sur 8.

La chaîne réelle du code est :

```
Exposition → Décision → Feedback (riche) → [rupture] → Agrégation statistique → Re-tirage aléatoire
```

Ce qui manque n'est pas du contenu : c'est la **notion d'item**. Le système
n'enregistre jamais *quoi* a été raté, seulement *de quelle catégorie* c'était.
`Progress.record` (l.4726-4731) stocke `{ts, street, pos, verdict, lossBB,
chosen, best, tags, mode, level}` — **ni les cartes, ni le board, ni les stacks,
ni les adversaires**. [V] Un spot manqué est donc définitivement irrécupérable :
il ne peut être ni rejoué, ni varié, ni reprogrammé. Tous les manques listés plus
bas (rappel espacé, correction, rétention, transfert) découlent de cette seule
absence.

Trois défauts sont en outre des **bugs vérifiés**, pas des choix de conception :
la maîtrise est mathématiquement plafonnée, l'amélioration est indétectable, et
la contrainte de contexte du drill principal est ignorée. Détail en §4.

---

## 1. Le modèle explicite, maillon par maillon

| # | Maillon | Statut | Où |
|---|---|---|---|
| 1 | **Connaissance** | PARTIEL — statique, non séquencée | `renderTheory` l.8268-8307 ; `LEAK_INFO` l.4849-4900 |
| 2 | **Exposition** | **COMPLET** — le point fort du produit | `Spot.generate` l.3843-3917 ; `MODES` l.3742-3756 |
| 3 | **Décision** | **COMPLET** | `App.choose` l.7264-7309 ; `renderActions` l.7502-7536 |
| 4 | **Feedback** | PARTIEL — riche en chiffres, pauvre en diagnostic | `Judge.evaluate` l.4096-4182 ; `renderReview` l.7557-7740 |
| 5 | **Correction** | **ABSENT** | aucun retry ; `continueHand` l.7312-7356 |
| 6 | **Répétition** | PARTIEL — massée, non espacée | `drillLeak` l.8327-8341 ; mode `cible` l.7235-7245 |
| 7 | **Maîtrise** | PARTIEL — affichée, structurellement inatteignable | `Player.masteryLevel` l.6151-6159 |
| 8 | **Réactivation** | PARTIEL — cadence fixe 24 h, pas par item | `startDaily` l.7158-7164 |

### 1.1 Connaissance — PARTIEL

Trois corpus existent et ne se parlent pas :

- **12 notions** en glossaire figé (`renderTheory` l.8269-8282) : page passive,
  jamais liée à une erreur, jamais ouverte par le système. [V]
- **10 fuites coachées** avec `why` + `fix` (`LEAK_INFO` l.4849-4900) —
  du vrai contenu correctif, bien écrit. [V]
- **29 fuites de tracker** avec `LEAK_PLAIN` / `LEAK_DRILL` (l.14690, l.14969),
  taxonomie **disjointe** de la précédente. [V]

Défaut central : `LEAK_INFO` n'apparaît **jamais** dans `renderReview`
(l.7557-7740). Les 15 occurrences de `LEAK_INFO` sont toutes situées dans les
écrans de diagnostic *a posteriori* (l.5343, 6461, 8013, 8064, 8199…). [V]
**Le `fix` correctif n'est donc jamais montré au moment de l'erreur** — c'est-à-dire
au seul moment où il aurait une chance d'être encodé.

Aucun pré-test, aucun placement : `renderOnboarding` (l.6915-6952) demande un
pseudo, un avatar et un mentor, puis lâche le joueur en `intermediaire`/`libre`
(`App.cfg` l.6534-6540). [V]

### 1.2 Exposition — COMPLET

C'est la partie irréprochable. 13 modes contraignant la génération, 6 niveaux,
9 profils, positions/stacks/actions préflop tirés à chaque main, adversaires qui
décident par range et cotes (`Spot.decide`, `AI.narrow` l.3958). La variabilité
de surface est réelle et non simulée. [V]

Mesuré (400 spots/config) :

```
libre           → positions BTN 72 / BB 86 / SB 103 / CO 69 / UTG 33 / HJ 37
mode river      → 100 % river, positions réparties
```

### 1.3 Décision — COMPLET

Rappel actif générateur : le joueur produit une action *avant* toute
information corrective, y compris un sizing libre au curseur (l.7527-7534). [V]
C'est de la récupération active authentique — voir §2.1 pour ses limites.

### 1.4 Feedback — PARTIEL (le point le plus discutable)

**Ce qui est bon** — et il faut le dire, c'est au-dessus du marché :
`Judge.evaluate` calcule une table d'équité combo par combo via le moteur certifié
(`comboTable` l.4296-4307), polarise la range adverse sur une ancre b/(b+P)
(`polarize` l.4315+), et dérive l'EV de **chaque** option (l.4154-4162). L'écran
affiche : classement EV de toutes les options, équité + décomposition
win/tie/lose, équité au turn projetée, grille de range adverse, mains qui
battent / que l'on domine, effet de blocage chiffré, cote du pot, MDF, ratio de
bluffs, profils adverses avec HUD et tell. [V] `picked.detail` et `best.detail`
(l.4219-4257) sont des phrases **paramétrées** par les nombres du spot, pas des
constantes.

**Ce qui est mauvais** — le diagnostic. Trois couches statiques :

1. `App.coachLine` (l.7743-7773) : **12 branches** sur `(verdict, action choisie,
   action optimale, made.strength)`. Rien d'autre. Mesuré sur 81 erreurs réelles :

   ```
   phrases distinctes produites : 11
   « Trop d'agression avec cette main… »        41 / 81   (51 %)
   « Miser sans équité ni fold equity… »        15 / 81   (19 %)
   fallback « X était la meilleure ligne. »     10 / 81   (12 %)
   ```

   Deux phrases couvrent **69 %** de toutes les erreurs. [V, exécuté]

2. `Judge.commonMistake` (l.4429-4442) : 5 branches, calculées sur **la
   situation**, pas sur l'erreur du joueur — le même encart s'affiche que la
   décision soit juste ou fausse. [V]

3. `Mentor.say` (l.6050-6051) : tirage aléatoire dans un tableau de répliques
   par verdict. Décoratif. [V]

Verdict sans complaisance : **le feedback n'est pas « correct/incorrect + une
phrase statique » — il est bien plus riche que ça en chiffres. Mais la partie
verbale, celle qui nomme la nature de l'erreur, l'est exactement.** Le joueur
reçoit un tableau d'EV et une phrase parmi douze. Le lien entre l'erreur et la
fuite nommée (`LEAK_INFO[key].fix`) qui vient d'être taguée à la ligne
précédente (l.7272 puis l.7289) n'est jamais fait à l'écran.

Angle mort mesuré : **14 % des erreurs sont « bonne action, mauvais sizing »**
(81 erreurs, 11 cas). Aucune de ces erreurs ne reçoit de tag, et `coachLine`
tombe sur le fallback générique. Le sizing n'est jamais commenté comme tel. [V]

### 1.5 Correction — ABSENT

Aucun moyen de réessayer. Après le verdict, deux boutons : « Continuer la main »
et « Nouvelle main » (l.7632-7633). [V] `continueHand` applique la décision fautive
et fait avancer le coup (l.7342). En drill, il tire directement un nouveau spot
aléatoire (l.7321-7325). [V]

Il n'existe **aucun** chemin permettant de : rejouer le même spot, voir une
variation minimale du spot (même main, board changé), ou revoir plus tard une
décision ratée. La vue « Mains à revoir » (l.16013-16050) porte **exclusivement
sur les mains importées d'un historique Winamax** — pas une seule décision
d'entraînement n'y figure. [V]

Le seul mécanisme rejouant un spot exact est `Studio` (l.2316), réservé à
`?admin=1` (l.2317) et explicitement en écriture fantôme (`t._studio`, l.7270). [V]

### 1.6 Répétition — PARTIEL

Existe sous forme **massée** (blocked practice) :
- `drillLeak` → 10 spots consécutifs, même mode, même position forcée
  (l.8327-8341, cfg appliquée l.7177-7182). [V]
- mode `cible` → chaque main re-vise le pire leak (l.7235-7245). [V]
- session carrière → un tiers des mains ciblent le leak dominant
  (l.7209-7218, `Math.random() < 0.34`). [V]

Aucune répétition **espacée** : recherche exhaustive de `espacée|spaced|oubli|
forgetting|leitner|SM-2|nextReview|due` → aucun résultat dans le moteur. [V]
Les timestamps existent (`entry.ts`, l.4727) et ne servent qu'à `byDay`
(l.4804-4810) et à la streak quotidienne (l.4746-4751). [V]

### 1.7 Maîtrise — PARTIEL, et cassée

Le concept est modélisé : `Player.mastery[key] = {seen, ok}` (l.6081),
5 paliers nommés Découverte → Maîtrisé (l.6151-6159), panneau dédié
(`masteryPanel` l.8193-8218), objectif de mission à 20 occurrences + 65 %
(`Journey.mission` l.6457-6474). [V]

**Il est mathématiquement inatteignable.** Voir §4.1.

### 1.8 Réactivation — PARTIEL

Le défi du jour (`startDaily` l.7158-7164) force `cfg.mode = "cible"` (l.7173) →
10 décisions sur le pire leak, une fois par 24 h, avec streak (l.6127-6139). [V]
C'est une vraie réactivation, mais à **cadence fixe et globale** : elle ne
dépend ni de ce qui a été oublié, ni de la date de dernière pratique d'une
compétence. C'est un rendez-vous, pas un rappel.

---

## 2. Les 9 mécanismes demandés

### 2.1 Rappel actif — PRÉSENT (procédural) / ABSENT (déclaratif)

`App.choose` (l.7264) exige une production avant toute correction : c'est du
rappel actif au sens strict. Les 3 Labs renforcent (`HRUI.check`, `PRUI`,
`BLUI`) : nommer la main adverse, identifier le profil, choisir le bloqueur.

Manque : aucune récupération sur la **connaissance** elle-même. Le système ne
demande jamais « quelle est ta range de défense BB ici ? », « estime ton équité
avant de voir », « nomme trois bluffs qu'il peut avoir » — alors que ce dernier
conseil est littéralement écrit dans `LEAK_INFO["river-call"].fix` (l.4863). Le
conseil existe ; l'exercice qui le ferait pratiquer, non. [V]

### 2.2 Répétition espacée — ABSENT

Zéro occurrence dans le moteur. Rien ne planifie, rien n'échoit, rien ne se
réveille. Bloqué en amont par l'absence d'item réidentifiable (§0). [V]

### 2.3 Interleaving — PRÉSENT PAR ACCIDENT, DÉTRUIT LÀ OÙ IL COMPTE

En mode `libre`, l'entrelacement position × street × profil × texture est total
— mais il est le produit du tirage aléatoire, pas d'un ordonnancement
pédagogique. Personne ne décide *quoi* alterner. [V]

Et il est **explicitement supprimé** dans le seul contexte d'apprentissage
délibéré : le drill impose 10 spots identiques en mode et position
(l.7177-7182). La littérature dit que c'est l'inverse qui produit de la
rétention. Le code fait le choix opposé, sans le documenter. [V]

### 2.4 Difficulté progressive — PARTIEL

**Ce qui existe, et qui est bien conçu :**
- `LEVELS` module la sévérité du jugement via `tolerance` 0.14 → 0.04
  (l.3709-3739), consommée à l.4169. [V]
- `TIERS` NL2 → NL50 avec `skill` 0.15 → … et pool adverse durci ; le jugement
  se durcit avec la limite (`levelForTier` l.5650-5651). [V]
- `HR_DIFFICULTY` (l.9101-9134) est un **vrai fading d'étayage** :
  `showHUD: true → false`, `infoLevel: 1 → 3`, `streets: [flop,turn] → [river]`.
  C'est la meilleure conception pédagogique du fichier. [V]
- La promotion de palier est **gated sur la performance** : `reqAccuracy` avec
  seuil de volume à 100 décisions (`Goals` l.5314-5325, `allMet` l.5371-5376). [V]

**Ce qui manque :** aucune adaptation automatique hors carrière. Les 6 niveaux
et les 4 niveaux de chaque Lab se choisissent au bouton (`setDiff` l.10185,
12084, 13395) et restent sur `intermediaire` par défaut. Rien ne propose de
monter après une série réussie, rien ne redescend après un échec. Le drill à
10 spots n'escalade pas. [V]

**Reliquat mort** : `LEVELS[*].hint` (l.3712, 3717, 3722, 3727) n'est lu nulle
part dans le fichier. L'étayage préalable a été prévu puis abandonné. [V]

### 2.5 Qualité du feedback après erreur — PARTIEL, verbalement pauvre

Voir §1.4. Résumé chiffré : analyse quantitative de premier ordre (EV de toutes
les options, équité par combo, range grid, blockers, MDF) + **11 phrases
distinctes** pour 81 erreurs, dont 12 % de fallback générique, et **jamais** le
nom ni la correction de la fuite qui vient d'être détectée. [V, exécuté]

### 2.6 Correction d'erreur — ABSENT

Ni retry, ni variation, ni revisite. Voir §1.5. [V]

### 2.7 Notion de maîtrise — PRÉSENTE MAIS CASSÉE

Voir §4.1. Le vocabulaire, l'UI et les seuils existent ; le compteur qui les
alimente ne peut pas monter. [V, exécuté]

Note secondaire : `Rating.skillScore` (l.6250-6257) est un bon design —
performance × confiance liée au volume, plafond bridé à faible volume. Mais il
consomme `pr.correctRate`, une **moyenne à vie** (l.4815). Une mauvaise première
semaine pèse indéfiniment ; un niveau actuel excellent ne peut pas s'exprimer.
Le rating mesure l'histoire, pas l'état. [V]

### 2.8 Rétention — ABSENT

Le système ne sait pas ce qui a été oublié, et ne peut pas le savoir : aucune
mesure n'est fenêtrée par le temps.

- `tagStats[k].loss` est une somme **monotone croissante**, jamais décrémentée
  (l.4734-4738). [V]
- `summary().leaks` trie sur cette somme cumulée, **sans fenêtre ni filtre
  d'occurrence** (l.4787-4790). [V]
- `worstLeak()` renvoie donc le leak le plus coûteux *depuis toujours*
  (l.4823-4826) — un défaut corrigé il y a deux mois reste en tête de liste et
  continue d'aspirer le mode `cible` et le défi du jour. [V]
- Asymétrie de troncature : `decisions[]` est fenêtré à 3 000 (l.4672),
  `tagStats` ne l'est pas. Au-delà, la page « où se concentrent tes erreurs »
  (fenêtrée) et la liste des leaks (à vie) décrivent deux joueurs différents. [V]
- `Journey.timeline` (l.6512-6521) affiche une « tendance hebdomadaire » qui est
  la moyenne de snapshots de la **moyenne à vie** (`rate: s.correctRate`,
  l.6397). Doublement amortie : une mauvaise semaine ne peut pas apparaître. [V]

### 2.9 Transfert — ABSENT

Aucun mécanisme ne teste une compétence dans une situation nouvelle de manière
délibérée. Au contraire, `focusFor` (l.4829-4843) et `LEAK_DRILL` (l.14969-15003)
figent chaque fuite sur **un** contexte unique : `bb-underdefend` sera toujours
préflop-BB, `river-call` toujours river. Le joueur apprend le déclencheur de
surface, pas le principe. Le seul écart de contexte disponible (jouer le même
principe au turn plutôt qu'à la river, en CO plutôt qu'en BB) n'est jamais
proposé. [V]

---

## 3. Où la boucle se rompt exactement

```
Connaissance    LEAK_INFO.fix (l.4849)  ─────────────┐  jamais affiché
                                                      │  au moment utile
Exposition      Spot.generate (l.3843)   ██████████   │
Décision        App.choose   (l.7264)    ██████████   │
Feedback        Judge.evaluate(l.4096)   ███████░░░ ←─┘  chiffres OK, diagnostic pauvre
Correction      —                        ░░░░░░░░░░     aucun retry
Répétition      drillLeak    (l.8327)    ████░░░░░░     massée, non espacée
Maîtrise        masteryLevel (l.6151)    ██░░░░░░░░     plafonnée par bug
Réactivation    startDaily   (l.7158)    ████░░░░░░     cadence fixe, pas par item
```

Le point de rupture est unique et identifiable : **entre le maillon 4 et le
maillon 5**, parce que `Progress.record` jette le spot.

---

## 4. Trois bugs pédagogiques vérifiés par exécution

### 4.1 La maîtrise ne peut jamais dépasser « En apprentissage » — CRITIQUE

`Progress.tags` sort **avant** de produire le moindre tag `leak:` quand la
décision n'est pas une erreur :

```js
// l.4685-4686
const wrong = a.verdict === "erreur";
if (!wrong) return tags;
```

`App.choose` alimente ensuite la maîtrise en itérant sur ces mêmes tags :

```js
// l.7287-7290
const wasOk = a.verdict !== "erreur";
for (const tag of (entry.tags || [])) {
  if (tag.startsWith("leak:")) Player.recordMastery(tag.slice(5), wasOk);
}
```

Un tag `leak:` n'existe que si `verdict === "erreur"` ⇒ `wasOk` vaut **toujours
`false`** ⇒ `m.ok` reste à 0 à vie. `recordMastery` n'a aucun autre point
d'appel dans le fichier. [V]

Exécuté (40 décisions dont 30 correctes sur le même leak) :

```
mastery: {"river-call":{"seen":10,"ok":0}}
masteryLevel: {"tier":1,"name":"En apprentissage","rate":0,"seen":10}
```

**Conséquences en cascade :**
- Les paliers 2/3/4 (« Familier », « Solide », « Maîtrisé ») sont du code mort.
- `masteryPanel` (l.8215) affiche la légende « Un palier se gagne en répétant
  les bonnes décisions » sous une barre qui ne bougera jamais.
- `Journey.mission.complete` exige `successRate >= 0.65` (l.6471) : **aucune
  mission ne peut être terminée**.
- Effet de bord statistique : pour toute clé `leak:`, `tagStats[k].n === err`
  toujours — le « taux d'erreur par fuite » vaut structurellement 100 %.

### 4.2 « Ton amélioration » ne peut pas être détectée par la mesure prévue

```js
// l.6446
if (beforeLoss > 0 && (nowLoss < beforeLoss * 0.85 || (m && m.seen >= 15)))
```

`beforeLoss` et `nowLoss` sont la **même quantité cumulée** lue à deux dates
(`snapshot` l.6398 ← `summary().leaks[].loss`). Cette somme étant monotone
croissante (§2.8), `nowLoss >= beforeLoss` **toujours** ⇒ la première clause est
morte. Seule survit `m.seen >= 15`, c'est-à-dire **avoir répété 15 fois l'erreur**.
[V]

Résultat : `dropPct = Math.max(0, …)` vaut 0 → l'écran affiche « en cours »
(l.8084) et la ligne de récit « Tu progresses vraiment » (l.8105-8106) se
déclenche sur du volume d'échec, jamais sur une amélioration réelle.

### 4.3 La contrainte de contexte du drill BB est ignorée

`focusFor` (l.4831-4832) et `LEAK_DRILL` (l.14983-14984) produisent
`{ forcePos: "BB", facing: true }`. `newHand` la recopie fidèlement (l.7181).
Mais **`Spot.generate` ne lit jamais `opt.facing`** — `forcePos` est honoré
(l.3867), `facing` ne l'est nulle part dans le fichier. [V]

Mesuré (400 spots par configuration, « face à une ouverture » = préflop avec
`toCall > bb`) :

```
cible  {libre, BB, facing:true}     → 206/400 face à une ouverture  (52 %)
drill  {preflop, BB, facing:true}   → 235/400 face à une ouverture  (59 %)
```

**~45 % du drill « défendre ta grosse blinde » se joue dans des pots où la fuite
ne peut pas se manifester.** Le joueur croit travailler sa défense BB ; une main
sur deux, il regarde un pot limpé.

### 4.4 Défauts mineurs relevés au passage

- `App.focusLeak` est écrit deux fois (l.8187, 8224) et **jamais lu**. [V]
- `trainLeak` / `trainSpecificLeak` écrivent dans `App.cfg.mode` (l.8186, 8223),
  écrasant durablement le mode choisi par le joueur — exactement ce que le
  commentaire de `newHand` (l.7170-7172) dit qu'il ne faut pas faire. [V]
- `worstLeak()` n'applique aucun seuil d'occurrence, alors que l'écran de
  diagnostic exige `err >= 2` et 30 décisions (l.7997, 7984). Le mode `cible` et
  le défi du jour peuvent donc se verrouiller sur **une seule erreur isolée**. [V]
- `Career.mainLeak` (l.5732) sélectionne sur `baseline` — le taux mesuré à la
  **toute première session** du palier — et jamais sur `recent`. L'objectif
  « corriger ton leak principal » est donc figé sur la photo du jour 1. [V]
- 50 % des erreurs ne reçoivent aucun tag `leak:` et sont donc invisibles à toute
  la boucle corrective (mesuré, 140 décisions / 74 erreurs). La forme la plus
  fréquente parmi les non-taguées : `preflop / raise → fold` (16 cas), c'est-à-dire
  l'ouverture trop large — une fuite majeure que la taxonomie du tracker connaît
  (`"loose"`, `"utg-loose"`, l.14971-14973) mais que `Progress.tags` ignore. [V]

---

## 5. Mesures exécutées (reproductibles)

| Mesure | Valeur | Protocole |
|---|---|---|
| Phrases de coach distinctes / 81 erreurs | **11** | jeu aléatoire, `mode: libre`, `App.coachLine` |
| Couverture des 2 phrases dominantes | **69 %** | idem |
| Fallback générique | **12 %** | idem |
| Erreurs « bonne action, mauvais sizing » | **14 %** | idem |
| Erreurs sans aucun tag `leak:` | **50 %** | 140 décisions / 74 erreurs |
| `mastery.ok` après 30 décisions correctes | **0** | simulation du chemin `App.choose` |
| Palier de maîtrise maximum atteignable | **tier 1 / 4** | idem |
| Drill BB effectivement face à une ouverture | **52 %** | 400 spots `{libre, BB, facing}` |

Scripts en scratchpad (`ped.js`, `ped2.js`, `ped4.js`, `ped5.js`) ; ils
n'écrivent que dans `localStorage` stubbé du harness.

---

## 6. Recommandation P0 — unique

> **Persister le spot dans `Progress.record`, et rien d'autre pour l'instant.**

Ajouter au `entry` (l.4726-4731) une graine reconstructible du spot :
`{seed, holeCards, board, heroPos, stacks, oppProfiles, log}` — le strict
nécessaire pour que `Spot` puisse le régénérer à l'identique. `Studio` prouve
déjà que le moteur sait reconstruire un spot exact de façon déterministe
(l.2450-2469) : le mécanisme existe, il n'est simplement pas branché sur la
progression.

**Pourquoi celle-ci et pas une autre.** Les trois bugs du §4 se corrigent en
quelques lignes et doivent l'être — mais aucun ne débloque un maillon. Persister
le spot débloque **quatre maillons d'un coup**, parce que chacun des mécanismes
absents s'écrit trivialement une fois qu'un item existe :

| Débloqué | Ce que ça devient |
|---|---|
| **Correction** | bouton « Rejouer ce spot » après une erreur ; puis « une variation » (même main, board voisin) |
| **Répétition espacée** | file d'attente `{spotId, dueAt}` ; le défi du jour tire dans cette file au lieu de tirer au hasard |
| **Rétention** | « tu avais raté ce spot le 3 mars — le revoici » ; le système sait enfin ce qui a été oublié |
| **Transfert** | même graine, position ou street décalée : la compétence est testée hors de son contexte d'apprentissage |

Et une fois l'item persisté, le correctif du §4.1 (`recordMastery` alimenté par
les réussites, pas seulement les échecs) devient mesurable pour de bon : la
maîtrise se calcule sur des items revus, pas sur un compteur d'erreurs.

**Coût.** `Progress.save()` borne déjà `decisions[]` à 3 000 (l.4672) ; il faudra
soit réduire cette borne, soit ne persister le spot que pour les décisions dont
`verdict === "erreur"` (~53 % des décisions en jeu aléatoire, nettement moins en
jeu réel). La Phase 3 intercalant une couche de stockage sous le moteur
(cf. contexte partagé §5), c'est le bon moment pour dimensionner ce champ.

**Ce que je ne recommande pas en P0** : enrichir `coachLine`. Ajouter des
branches à un arbre de 12 phrases produira 20 phrases et zéro apprentissage
supplémentaire. Le feedback verbal doit être repris *après*, en le branchant sur
`LEAK_INFO[key].fix` au moment de l'erreur — mais ce n'est utile que si le
joueur peut ensuite faire quelque chose de ce conseil, c'est-à-dire réessayer.
