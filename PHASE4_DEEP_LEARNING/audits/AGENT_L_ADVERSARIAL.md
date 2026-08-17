# AGENT L — QA ADVERSARIAL

Cible : `PHASE4_DEEP_LEARNING/PHASE4_SYNTHESIS.md`. Mandat : la démonter.

**Aucun fichier applicatif modifié.** Toutes les mesures ci-dessous ont été
produites par moi, sur `VERSION_PRODUCTION/herolab.html`, via `tests/harness.js`
sous Node et via Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
Les sondes sont dans le scratchpad de session, hors dépôt. Une copie injectée de
l'artefact a été produite hors dépôt pour tester l'injection de classe B.

Chaque objection porte une preuve rejouable. Les objections que je n'ai pas pu
étayer ne figurent pas ici.

---

## 0. Verdict

> **La synthèse est exploitable après modifications.** Son inventaire de défauts
> est très majoritairement exact — j'ai tenté de le casser et il tient. Ce qui
> ne tient pas, c'est **le récit qui l'organise** : le constat central est
> surénoncé, deux chiffres de premier plan sont introuvables dans les rapports
> sources, et l'ordre du P0 est inversé par rapport à ce que coûtent réellement
> les cinq actions.

Deux objections FATALES, huit SÉRIEUSES, trois MINEURES. Sept propositions
résistent explicitement à l'attaque, dont le mécanisme d'extension.

---

## 1. Objections FATALES

### F1 — « Le produit n'enregistre que l'échec » est faux, et c'est la phrase qui porte tout le P0

La synthèse construit son constat central (§B1, §Critère de sortie) sur l'idée
qu'aucune grandeur n'a de dénominateur, donc que « la première flèche est
cassée » et que « tant que P0.1 n'est pas fait, tout le reste est cosmétique ».

**Mesuré** — 646 décisions réelles jouées (`Spot.generate` → `Judge.evaluate` →
`Progress.record`), relevé de `Progress.data.tagStats` :

```
tag                    n     err   taux réussite   dénominateur ?
street:preflop         324   121   62.7%           OUI
street:flop            157    88   43.9%           OUI
street:turn            100    64   36.0%           OUI
street:river            65    47   27.7%           OUI
pos:BTN                151    81   46.4%           OUI
pos:BB                 145    78   46.2%           OUI
pos:SB                 125    47   62.4%           OUI
pos:HJ                  91    52   42.9%           OUI
pos:CO                  79    31   60.8%           OUI
pos:UTG                 55    31   43.6%           OUI
leak:thin-value         71    71   —               NON
leak:overbluff          45    45   —               NON
… (7 autres leak:*)                —               NON
```

**10 entrées sur 19 portent un dénominateur.** `Progress.record` (l.4720-4738)
incrémente `st.n` pour *chaque* tag, et `Progress.tags` émet `street:*` et
`pos:*` **avant** le `return` anticipé de la l.4685. Le retour anticipé ne coupe
que les tags `leak:*`.

Et le produit exploite déjà ce dénominateur, à deux endroits :

```
Career.skills()  (l.5829) — affiché l.8524
   Sélection préflop   n=324   62.7%
   Jeu au flop         n=157   43.9%
   Jeu au turn         n=100   36.0%
   Décisions river     n=65    27.7%
   Jeu en position     n=230   51.3%
   Défense des blindes n=270   53.7%

Rating.skillScore(perf, volume, volumeForFull)  (l.6247)
   → « Jeu à la table » : score 33 sur volume 646
```

`Rating.skillScore` **est déjà** le bridage par confiance de volume que la
Phase 4 veut créer. `Career.skills()` **est déjà** un modèle de compétences à six
axes, calculé sur réussite, avec un seuil d'échantillon (`n < 12 → score null`).

**Conséquence.** Le défaut réel est beaucoup plus étroit que le constat central :
**les tags `leak:*` ne sont émis que sur erreur**. C'est un défaut, il est réel,
la synthèse a raison de vouloir le corriger. Mais il ne « conditionne » pas la
Phase 4 : un score de maîtrise sur `street × position` est calculable **aujourd'hui,
en lecture seule sur `decisions[]`, sans toucher au moteur ni à P0.1**.

La phrase « tant que P0.1 n'est pas fait, tout le reste est cosmétique » est
donc fausse, et c'est elle qui justifie l'ordre du P0 (voir S8).

*Objection portant aussi contre l'agent D*, qui affirme « `tagStats.n === tagStats.err`
**dans 100 % des cas mesurés** ». Vrai pour les `leak:*`, faux pour 10 tags sur 19.
La synthèse a repris la généralisation sans la retester.

### F2 — « Rien que du câblage, donc aucune décision de poker » est faux

Le P0 s'ouvre sur : « **Aucun contenu nouveau. Rien que du câblage, donc aucune
décision de poker.** » C'est ce qui rend le P0 acceptable sous la contrainte
n° 2 du contexte partagé.

Or P0.1 exige de définir, pour chaque fuite, **ce qui compte comme une occasion**.
Les prédicats de `Progress.tags` (l.4686-4717) sont des prédicats *d'erreur*, pas
d'occasion : `leak:thin-value` n'existe que si `decision.action ∈ {bet,raise}`
**et** `a.best.action === "check"`. Retirer la clause d'erreur ne laisse pas une
occasion, il faut en **écrire une**.

**Mesuré** — deux partitions également défendables de l'occasion, appliquées aux
mêmes 519 décisions du même joueur :

| Fuite | erreurs | occ. A (contexte seul) | taux A | occ. B (contexte + reco. de Judge) | taux B | **écart** |
|---|---:|---:|---:|---:|---:|---:|
| `thin-value` | 59 | 144 | **59 %** | 88 | **33 %** | **26 pts** |
| `overbluff` | 28 | 50 | 44 % | 40 | 30 % | 14 pts |
| `bb-overdefend` | 7 | 44 | 84 % | 31 | 77 % | 7 pts |
| `missed-value` | 8 | 61 | 87 % | 47 | 83 % | 4 pts |

*(A : « le héros tient une main marginale ». B : « le héros tient une main
marginale **et** Judge recommande check ».)*

Le même joueur, les mêmes décisions, **26 points de maîtrise d'écart** selon un
choix qui n'est écrit nulle part. Ce choix est exactement le type de décision que
la « règle non négociable » de la synthèse encadre pour les ranges — et il
échappe à cet encadrement parce qu'il est présenté comme du câblage.

**Correctif exigé** : P0.1 doit porter une table explicite des 10 occasions, avec
justification, soumise à la même règle `source` que les ranges. Sinon la maîtrise
affichée est un artefact de partition.

---

## 2. Objections SÉRIEUSES

### S1 — « 48 % du drill "défendre ta BB" hors sujet » : ce chiffre n'existe dans aucun rapport

Tableau du constat central, ligne `opt.facing`. Sources réelles :

| Source | Mesure |
|---|---|
| Agent C §7.2 / T12 | **20,4 %** de spots sans ouverture |
| Agent G, ligne 3 | héros face à une mise **305/400 = 76 %** → 24 % hors sujet |
| **Moi**, 500 spots, `{mode:"preflop", forcePos:"BB", facing:true}` | **82,4 %** face à une relance → **17,6 %** hors sujet |

`grep -rE "\b48([ ,.]|%)"` sur les onze rapports : aucune occurrence liée au
drill BB. **La synthèse multiplie par 2,4 le pire chiffre de ses propres sources.**

Et il y a une explication innocente que la synthèse écrase : `forcePos:"BB"`
**délivre déjà** l'essentiel de l'intention de `facing`, parce que le héros en BB
parle en dernier et que les vilains ont déjà agi. Le drapeau mort coûte 17,6 %,
pas 48 %. Le défaut est réel ; son ampleur est surestimée d'un facteur 2,7.

### S2 — « 74,5 ms contre 0,48 ms » : chiffres introuvables, et l'agent E dit autre chose

§E.4 pose une « contrainte dure » sur le sélecteur adaptatif à partir de ces deux
valeurs. Aucune n'apparaît dans les onze rapports.

| Source | `Judge.evaluate` | `Spot.generate` | ratio |
|---|---:|---:|---:|
| Synthèse §E.4 | 74,5 ms | 0,48 ms | 155 |
| Agent E §4.6 | 50 ms | 2,99 ms | 17 |
| Agent K §7.3 | *43,7 ms pour la chaîne complète* | — | — |
| **Moi** (600 spots, 567 jugements) | **42,65 ms** | **0,44 ms** | **98** |

Trois problèmes distincts :
1. Les figures de la synthèse ne sont sourcées nulle part.
2. **Agent E et agent K se contredisent** : 50 ms pour le seul `Judge` chez E,
   43,7 ms pour *génération + jugement + enregistrement + écriture* chez K. Les
   deux ne peuvent pas être vrais. Ma mesure (42,65 ms pour `Judge` seul,
   0,15 ms pour `record`) tranche en faveur de K sur l'ordre de grandeur et
   invalide le 2,99 ms de E.
3. Le `Spot.generate = 2,99 ms` de l'agent E est **7× trop élevé**. Il fonde son
   « budget pire cas 40 tirages ≈ 92 ms », qu'il présente comme la limite du
   rejet. En réalité 40 tirages coûtent ≈ 18 ms. **Le filtre par rejet est bien
   moins cher que l'agent E ne l'a cru** — ce qui renforce P0.3, mais par un
   raisonnement qu'il faut refaire.

*La conclusion de §E.4 (« sélectionner sans juger ») reste correcte* — voir §4.

### S3 — P0.3 n'est pas « le verrou unique » : un filtre ne peut pas créer un nœud qui n'existe pas

§E.5 et P0.3 : « Filtre de nœud dans la génération — c'est le verrou unique qui
répare les 13 drills défaillants », contrôle « drills défensifs : 10-13 % → ~100 % ».

**Mesuré** — filtre par rejet (max 40 tirages) simulé en classe B :

```
BB face à une relance (préflop)   succès 100,0 %  | 1,4 tirage  | 0,6 ms
flop multiway 3+ joueurs          succès 100,0 %  | 1,7 tirage  | 2,4 ms
nœud de check-raise au flop       succès   0,0 %  | 40 tirages  | 61,1 ms
```

**0 sur 8 000 tirages.** La cause est structurelle : `Spot.runToHero` (l.3920-3972)
rend la main dès que c'est au héros de parler sur la rue cible. Le héros n'a donc
jamais checké au préalable sur cette rue. Aucun taux de rejet ne fabrique un
état que le générateur ne produit pas.

`no-checkraise` est nommément cité dans §B3 (« ne produit **aucun** nœud de
check-raise sur 2 000 spots ») puis rangé dans les 13 drills que P0.3 répare.
Il ne les répare pas.

**Ce qui marche, mesuré** : ne pas filtrer, **construire** — générer, jouer le
check du héros à sa place, puis relancer `Play.advance` :

```
nœuds de check-raise construits : 43 / 300 = 14,3 %  |  3,30 ms par tirage
```

C'est faisable en classe B autour de `Spot.generate`, mais ce n'est **pas un
filtre** : c'est un post-traitement qui modifie l'état de la table. Deux
mécanismes, deux risques, deux critères de contrôle. P0.3 doit être scindé.

*(Note connexe : en drill, `continueHand` l.7320-7324 appelle `App.newHand()`
après chaque décision — une main = une décision. Les nœuds de check-raise
existent bien en partie libre, où `Play.step` poursuit la main. Le défaut est
propre au drill, pas au moteur.)*

### S4 — L'injection de classe B **ne voit pas le tracker**. C'est 132 Ko et 8 vues sur 9

Agent K §2.2 : un module appendé à la fin du script du moteur voit « **toute la
portée lexicale du moteur** ». La synthèse §G le reprend tel quel.

**Testé en Chromium**, module de classe B réellement injecté avant `</script>` :

```
voit_Progress      "object"        voit_LEAK_DRILL   "undefined"
voit_Spot          "object"        voit_LEAK_PLAIN   "undefined"
voit_Ranges        "object"        voit_Store        "undefined"
voit_LEAK_INFO     "object"        voit_Parser       "undefined"
                                   voit_FT           "undefined"
                                   voit_Stats        "undefined"
window.Feutre expose : ["open","controller","drillConfig","leakTitle"]
```

Le tracker (l.13822-16405, 132 Ko, les 9 vues, les 59 KPI, les 29 règles) vit
**dans une IIFE** : `window.Feutre = (function () { … })()`. Ses `const` ne sont
pas dans la portée du moteur. Un module de classe B n'y accède que par quatre
membres publics.

Conséquences concrètes, contre §E.1 / A2 / P1 :
- `P4.taxonomy` ne peut **pas** « réconcilier les 10 + 29 clés » depuis la classe B :
  `LEAK_PLAIN` n'est pas atteignable et **rien n'expose la liste des 29 identifiants**.
  `leakTitle(id)` répond une clé à la fois, à condition de connaître la clé.
- `LEAK_DRILL` n'est lisible que par `drillConfig(id)`, id par id, et ne peut ni
  être étendu ni recevoir de nouvelle entrée.
- Le garde-fou de build proposé par K (« chaque `legacy.leakPlain` cité existe
  dans la base ») est vérifiable **au build** en lisant le HTML, mais la
  correspondance ne peut pas être appliquée **à l'exécution** sans passer par
  `Feutre.controller`, qui n'est pas la surface décrite.

**Correctif exigé** : soit ajouter au tableau de retour de l'IIFE un export des
deux tables (une ligne dans le moteur — ce qui rompt le gel, à assumer
explicitement), soit acter que la taxonomie Phase 4 est **compilée au build** à
partir du HTML et non résolue à l'exécution. La synthèse ne choisit ni l'un ni
l'autre parce qu'elle croit le problème inexistant.

### S5 — « Preuve par les mains » contredit la règle de stockage de l'agent K

§E.6 et P1 : « **Preuve** : relier chaque fuite détectée aux mains qui la
démontrent. »

**Mesuré.** Ce que `Progress.record` persiste réellement :

```
{"ts":…,"street":"flop","pos":"BTN","verdict":"correct","lossBB":0,
 "chosen":"check","best":"check","tags":[…],"mode":"Flop","level":"Intermédiaire"}
182 octets · contient les cartes ou le board ? NON
```

Ce que coûterait une preuve rejouable (cartes + board + sièges + tapis + journal
d'actions) : **637 octets par décision → 1 866 Ko au plafond de 3 000 décisions.**

À comparer à la contrainte que l'agent K pose lui-même en §7.3, reprise par la
synthèse en §G :

> « L'état Phase 4 doit rester O(nombre de compétences) — ≈ 48 entrées, de
> l'ordre de **5 Ko** — et **jamais** O(nombre de décisions). »

**373× le budget.** Et l'état Phase 4 doit vivre dans `pivot.player.v1`, poussé
en entier à chaque synchronisation Phase 3 (§8.3). Les deux propositions sont
incompatibles telles quelles.

*L'agent B avait vu la cause* (« ni les cartes, ni le board, ni les stacks, ni
les adversaires… un spot manqué est définitivement irrécupérable ») mais n'en a
pas tiré la conséquence sur E.6 ; la synthèse a retenu la proposition et oublié
l'obstacle.

**Correctif** : borner la preuve — anneau de N mains par compétence (N ≤ 3, soit
≈ 92 Ko pour 48 compétences), ou restreindre la preuve au **tracker**, où les
mains importées sont réellement stockées (`Store.hands`, l.14367 — le seul module
sans plafond, signalé par K).

### S6 — Le risque n° 1 n'est pas le bon. Il y en a un pire, et il est mesurable

§Risques n° 1 : « `Judge` est la vérité terrain, et c'est un modèle […] un biais
systématique sera certifié comme maîtrise. **C'est le risque le plus grave de la
Phase 4.** »

C'est vrai, mais c'est le **second** risque. Le premier est que **la vérité
terrain est réglable par l'utilisateur, dans un menu déroulant**.

**Mesuré** — 250 spots identiques, décisions identiques (« call si possible,
sinon check »), seule la tolérance du niveau change :

| Niveau | tolérance | correct | **non-erreur** |
|---|---:|---:|---:|
| Débutant | 0,14 | 38,7 % | **87,7 %** |
| Intermédiaire | 0,10 | 26,3 % | 76,5 % |
| Avancé | 0,07 | 18,1 % | 64,2 % |
| Pro | 0,05 | 11,9 % | 39,1 % |
| GTO | 0,04 | 10,3 % | **32,1 %** |

**2,7× d'amplitude sur le taux de non-erreur, à compétence rigoureusement
constante**, via `App.set('level', k)` (l.7825).

Pourquoi c'est pire que le risque n° 1 :
- Un biais de `Judge` est **constant** — il fausse le niveau absolu mais pas les
  comparaisons dans le temps, et il est calibrable a posteriori. La tolérance,
  elle, **casse la comparabilité de l'historique d'un joueur avec lui-même** :
  maîtrise, répétition espacée et sélecteur adaptatif se caleraient tous sur une
  grandeur que l'utilisateur déplace d'un clic.
- Elle défait **le critère d'acceptation de P0.1 lui-même** : « 30 décisions
  correctes → `ok > 0` » s'obtient en basculant en Débutant.
- Le risque n° 1 tel qu'écrit argumente pour traiter B5 (justesse des ranges)
  avant toute promesse de maîtrise. Celui-ci argumente pour **normaliser le
  verdict par la tolérance dès P0**, ce que la synthèse range en §D
  (« `Rating` à décorréler de la difficulté choisie »), c'est-à-dire en
  « À améliorer ».

*Ce que la synthèse invoque pour minorer ce point* — B6, « le curseur difficulté
pèse 1,7 fois moins que le choix du mode » — ne s'applique pas : cette mesure
porte sur la **difficulté du spot généré**, la mienne sur la **tolérance du
verdict**. Deux mécanismes différents. L'orchestrateur a d'ailleurs signalé le
1,7× comme « non re-vérifié par moi ».

*Point de crédit* : j'ai vérifié la prémisse de la synthèse. `Judge` **est**
déterministe — 20 évaluations sur la même table, 1 seul `lossBB` distinct
(0,1684). Le raisonnement du risque n° 1 est sain, c'est son rang qui est faux.

### S7 — Les 48 cellules de compétence reproduisent le défaut qu'elles corrigent

Agent K §3.1, repris en §E.1-E.2 : granularité `street × position × potType`,
« 48 cellules est le maximum soutenable », la cellule la plus rare recevant
« ≈ 42 observations au plafond de 3 000 décisions ».

**Mesuré** — 960 décisions réelles, occupation extrapolée au plafond :

```
cellules 4×6×2 = 48 théoriques · atteintes : 42
au plafond de 3 000 décisions :
   cellules avec n ≥ 12 (seuil déjà utilisé par Career.skills)  : 35 / 48
   cellules avec n ≥ 30 (palier « Familier » de masteryLevel)   : 28 / 48

les plus rares :  turn|HJ|3bet+ 3 · river|HJ|3bet+ 3 · flop|HJ|3bet+ 6
                  preflop|SB|3bet+ 6 · preflop|CO|3bet+ 6 · river|UTG|simple 16
```

**20 cellules sur 48 ne peuvent jamais atteindre « Familier »**, et 13 n'atteignent
même pas le seuil d'échantillon que le produit s'impose déjà. Et le plafond est
**glissant** (`d.decisions = d.decisions.slice(-3000)`, l.4672) : ce n'est pas un
cap qu'on finit par dépasser, c'est un régime permanent.

L'estimation « ≈ 42 observations » de l'agent K est fausse d'un facteur 5 à 14 :
il a croisé les marginales rue × position et **oublié l'axe `potType` qu'il
propose lui-même**. Les cellules `3bet+` sont les grandes perdantes.

C'est exactement le défaut §B1 que la Phase 4 prétend réparer — des paliers de
maîtrise inatteignables par construction — reproduit à une granularité plus fine.

**Correctif** : granularité adaptative (fusionner `3bet+` dans `simple` tant que
`n < 30`), ou abandonner l'axe `potType` et rester à 24 cellules.

### S8 — L'ordre du P0 est inversé. P0.4 coûte une déclaration CSS ; P0.1 coûte un modèle de données

La synthèse affirme que P0.1 conditionne tout et ne chiffre le coût d'aucune des
cinq actions. J'ai chiffré P0.4.

**Cause racine trouvée en Chromium**, chaîne d'ancêtres du premier onglet à 360 px :

```
BUTTON.ft-nav-item   rect [-308, 136, 158, 32]
NAV                  rect [-318,  81, 332, 451]
ASIDE.sidebar        rect [-318,  81, 332, 451]   transform: matrix(1,0,0,1,-332,0)
```

Le bloc d'intégration l.1707-1711 neutralise `position`, `width`, `flex`,
`height`, `background`, `border-right` et `z-index` de la sidebar du tracker avec
`!important` — **et oublie `transform`**. Le `@media (max-width:760px)` l.2042-2046
réapplique donc `transform:translateX(-100%)` et pousse la navigation hors écran.
Le tiroir qui devait la ramener a par ailleurs été neutralisé volontairement :

```js
// l.16389-16391
// Neutralise le menu mobile de Feutre (Pivot gère sa propre navigation).
FT.openMenu = function () {};
FT.closeMenu = function () {};
```

**Correctif testé** — une seule déclaration, injectée à chaud, aucun fichier
modifié :

```css
#v-tracker .sidebar { transform: none !important }
```

```
360 px : onglets visibles AVANT 0/9  →  APRÈS 9/9  · vue « analyse » atteinte au clic
390 px : 0/9 → 9/9 · idem
412 px : 0/9 → 9/9 · idem
```

Le contrôle exact que la synthèse fixe à P0.4 (« 9 onglets atteignables à
360 px ») est atteint **par une déclaration CSS**. Et comme la CSP de la Phase 3
est `style-src 'unsafe-inline'`, la classe B peut l'injecter à l'exécution : zéro
chirurgie sur le fichier, zéro impact sur `marks[1]`.

Mis en regard :

| Action | Coût réel mesuré | Débloque | Réversible ? |
|---|---|---|---|
| **P0.4** Tracker mobile | **1 déclaration CSS** | 8 vues, 59 KPI, 29 détections, le drill — **pour la cible principale du produit** | oui |
| P0.1 Instrumenter l'occasion | 10 prédicats d'occasion à écrire + partition à justifier (F2) + champ de version (Risque 4) | maîtrise par fuite | **non** — change la partition des compétences |

**L'ordre correct est P0.4 → P0.5 → P0.3 → P0.2 → P0.1**, du moins cher et
irréversible au plus cher et irréversible. La thèse « P0.1 conditionne tout »
tombe avec F1 : un score de maîtrise sur `street × position` est disponible
aujourd'hui en lecture seule. P0.1 l'affine ; il ne le débloque pas.

---

## 3. Objections MINEURES

**M1 — « Préflop, 100 % des spots ont 2.5/3/4 bb dans la tolérance du verdict »**
(§B8). L'agent F mesure autre chose : l'écart d'EV **entre les trois tailles**
comparé à `(1×bb + pot×0,03) × (tolérance/0,1)`. Mesuré par le verdict réel de
`Judge.evaluate` sur 181 spots : **77,9 %** où les trois sont non-erreur, **61,3 %**
où le verdict est identique, écart max de `lossBB` **1,045 bb**. La restitution
littérale de la synthèse (« le joueur n'est jamais pénalisé ») est fausse dans
22 % des cas. *La conclusion de B8 survit* : les 4 boutons sont bien un seul
enseignement, et l'absence d'overbet est confirmée (0 option d'overbet non-tapis
sur 200 spots de flop, `Spot.options` l.4051-4060 plafonne à « Pot »).

**M2 — `Progress.data.streak`, « calculé, jamais affiché ».** Exact (l.4749,
exposé l.4817, aucun consommateur). Mais il existe une **seconde** série,
`Player.data.daily.streak`, qui fonctionne et **est** affichée (l.6857, l.7120).
Le champ mort est un doublon inerte, pas une promesse rompue. La synthèse le
range dans le tableau central avec effet « — » : correct, mais il gonfle un
tableau qui tire son autorité de son taux de sévérité.

**M3 — `VERIFICATIONS_ORCHESTRATEUR` §12 : « le bouton menu est visible mais son
clic ne fait rien ».** Imprécis. Le burger **du tracker** est
`display:none!important` (l.1706) et son gestionnaire est neutralisé (l.16390).
Le burger visible est celui de Pivot (l.2105), câblé sur `App.openMenu` → `#rail`,
qui n'a jamais eu vocation à ouvrir la navigation du tracker. Le diagnostic
« inaccessibilité totale » est juste ; le mécanisme décrit ne l'est pas — et
c'est le mécanisme qui donne le correctif (S8).

---

## 4. Ce qui résiste à l'attaque

J'ai essayé de casser les points suivants et je n'y suis pas arrivé. Ils sont
solides.

**R1 — Le motif « un champ déclaratif porte une promesse que rien ne lit » est
réel.** Quatre vérifications indépendantes, au-delà des quatre demandées :

- `force3Bet` / `force4Bet` : **exactement une occurrence chacun** dans les
  16 410 lignes, l.3748-3749, la déclaration. Aucune lecture. Les clés de mode
  `pot3bet`/`pot4bet` ne sont lues que par `LEAK_DRILL` et `focusFor`, pour
  *choisir* le mode, jamais pour forcer une relance.
- `stopAt` : lu **une seule fois**, l.3969, dans `Spot.runToHero` — la génération.
  `Play.advance` (l.4492-4530), qui poursuit la main après la décision du héros,
  ne le consulte pas. **Mesuré sur 378 mains jouées jusqu'au bout en mode
  Préflop : préflop 29,2 % · flop 23,7 % · turn 23,8 % · river 23,2 %** — contre
  28,9 / 24,1 / 24,1 / 22,9 en mode libre. **70,8 % de décisions postflop**, et le
  mode est indiscernable du mode libre. Le « 71 % » de la synthèse est exact.
- `opt.facing` : **0 occurrence**. `Spot.generate` (l.3843-3917) ne lit que
  `level, mode, stake, players, stackRange, profiles, forcePos, roster, rake`.
  `cfg.facing` est bien posé l.7181 et transporté l.8333 — puis ignoré.
- `hrstats` / `prstats` / `blstats` : rendus (l.6575-6579), aucun `App.go(` ne les
  cible, aucun `data-v` ne les nomme, et les deux seuls appels dynamiques
  (`modeCard` l.6864, `b.dataset.v` l.8447-8449) tirent d'ensembles qui ne les
  contiennent pas. **Trois écrans réellement inatteignables.**
- `level.hint` : les 6 occurrences sont les 6 déclarations (l.3712-3736). Les
  autres `hint` du fichier sont des classes CSS et le champ `hint` de
  `Rating.skills` — homonymes, pas des lectures.
- `daily.target: 8` : jamais lu ; `startDaily` code `total: 10` en dur (l.7161) et
  l'affichage utilise `daily.total || 10` (l.7115). `daily.best` écrit l.6132,
  jamais affiché.
- `mastery.ok` : **0 sur les 9 clés après 646 décisions**. Confirmé.

**R2 — L'injection de classe B fonctionne, pour le moteur de jeu.** Testée en
Chromium sur une copie injectée hors dépôt :
- `Progress`, `Spot`, `Ranges`, `LEAK_INFO` visibles depuis la portée lexicale ;
- **double interception propre** : deux enveloppes empilées sur `Progress.record`
  voient chacune **46 / 46** décisions réelles, aucune erreur de page. Le mode de
  défaillance « deux modules interceptent la même fonction » n'en est pas un tant
  que chacun appelle la fonction capturée ;
- **la CSP ne pose pas de problème** : `PHASE3_AUTH_SECURED/build.js` l.73-74 écrit
  `script-src 'unsafe-inline'`, sans épinglage SHA256 des scripts en ligne.
  Modifier le contenu du `<script>` du moteur est donc sûr — c'était mon
  hypothèse d'attaque la plus prometteuse, elle échoue ;
- **`marks[1]` est préservé** : la copie injectée compte toujours 2 balises
  `<script>`. L'invariant de l'agent K §6.1 tient, et le chaînage P4 → P3 est
  correct dans cet ordre (la Phase 3 recalcule tout sur l'artefact reçu).

*Le seul mode de défaillance réel que j'aie trouvé est S4* : la portée s'arrête à
l'IIFE du tracker.

**R3 — La contrainte de §E.4 (« sélectionner sans juger ») est correcte**, malgré
S2. Mesuré : `Judge.evaluate` **42,65 ms** contre `Spot.generate` **0,44 ms** —
un facteur **98**. La conclusion de conception est juste ; seules les valeurs
citées sont à re-sourcer.

**R4 — P0.2 (fenêtrer les agrégats) est justifié, et je le renforce.**
`decisions[]` est **déjà** une fenêtre glissante (`slice(-3000)`, l.4672) tandis
que `tagStats` est cumulé à vie et jamais amorti (l.4734-4738). Les deux
grandeurs vivent donc sur deux horizons différents dans le même module — une
incohérence que ni les agents ni la synthèse ne relèvent, et qui rend P0.2 plus
urgent qu'annoncé, pas moins.

**R5 — Les biais de génération de §B9 sont exacts**, lisibles directement :
`multiway: {minPlayers: 3}` (l.3751) puis `if (mode.minPlayers) nPlayers =
Math.max(nPlayers, 4)` (l.3852) — **3 sièges impossibles par construction** ;
`depth = rnd(sr[0], sr[1])` puis `st = depth × rnd(0.75, 1.3) × bb` (l.3856, 3876)
→ plancher deep 150 × 0,75 = **112,5 bb** et plafond short 45 × 1,3 = **58,5 bb**.
Les chiffres 113 et 57 de la synthèse sont justes.

**R6 — `Judge` est déterministe.** 20 évaluations de la même décision sur la même
table : un seul `lossBB` (0,1684), un seul verdict. La prémisse du risque n° 1
tient (c'est son rang que S6 conteste).

**R7 — Le diagnostic global n'est pas de la fausse profondeur.** Sur les sept
propositions de §E, cinq répondent à un défaut que j'ai vérifié moi-même et
qu'aucune fonctionnalité existante ne couvre : filtre/construction de nœud (S3),
écran de fin, fenêtrage, taxonomie unique, sélecteur non-jugeant. Deux sont à
reprendre : le modèle de compétences et le score de maîtrise (F1, S7) parce
qu'ils **existent déjà en partie** (`Career.skills`, `Rating.skillScore`) et que
la synthèse ne le dit pas.

---

## 5. Ce que onze agents ont collectivement raté

1. **Personne n'a lu `Career.skills()` (l.5829) ni `Rating.skillScore()` (l.6247).**
   Un modèle de compétences à 6 axes avec dénominateur, et un score bridé par la
   confiance de volume, existent déjà et sont affichés (l.8524). L'agent K cite
   `skillScore` comme brique à réutiliser mais ne voit pas que `Career.skills`
   **fait déjà** ce que §E.1-E.2 propose de créer. Onze audits, et la
   fonctionnalité la plus proche de la cible n'est nulle part dans le tableau
   « À conserver ».
2. **Personne n'a mesuré le coût de ce qu'il propose.** Aucun des onze rapports
   ne chiffre l'effort d'une seule action de P0. Une déclaration CSS et une
   refonte du modèle de données sont présentées au même rang.
3. **Personne n'a testé la frontière de la classe B.** L'agent K a prouvé ce que
   l'injection *peut* faire (250/250, 260, 100 %) et jamais ce qu'elle *ne peut
   pas* faire. Le test négatif — `typeof LEAK_DRILL` depuis la classe B — coûte
   une ligne et invalide une partie du plan (S4).
4. **Personne n'a mesuré la sensibilité de ses propres conclusions.** F2 montre
   que la maîtrise varie de 26 points selon une définition non écrite ; S7 que la
   granularité proposée est infaisable à un facteur 5-14 près. Ce sont des
   analyses de sensibilité, pas des mesures supplémentaires.
5. **La contradiction E ↔ K sur le coût de `Spot.generate` (2,99 vs 0,44 ms) est
   passée au travers**, alors que les deux rapports sont dans le même dossier et
   que la synthèse cite les deux.
6. **Le risque n° 5 de la synthèse s'applique à la synthèse elle-même.** Elle
   reconnaît que ses tests « vérifient des propriétés du rendu, jamais qu'un
   parcours soit accomplissable ». Le même angle mort produit ici trois chiffres
   non sourcés (S1, S2) et un « verrou unique » qui ne verrouille pas (S3) : le
   contrôle est écrit, mais aucun n'a été exécuté avant d'être promis.

---

## 6. Modifications exigées avant exploitation

| # | Modification | Objection |
|---|---|---|
| 1 | Réécrire le constat central : le défaut est « **les tags `leak:*` ne sont émis que sur erreur** », pas « le produit n'enregistre que l'échec ». Ajouter `Career.skills` / `Rating.skillScore` à §C. | F1 |
| 2 | Retirer « aucune décision de poker » du P0 ; ajouter une table des 10 occasions, soumise à la règle `source`. | F2 |
| 3 | Corriger « 48 % » → **17,6 %** (mesuré) ou 20,4 % (agent C). | S1 |
| 4 | Re-sourcer 74,5 / 0,48 ms → **42,65 / 0,44 ms**, et arbitrer la contradiction E ↔ K. | S2 |
| 5 | Scinder P0.3 en **filtre** (BB, multiway : 100 %, ≤ 2 tirages) et **construction de nœud** (check-raise : 0 % par filtre, 14,3 % par construction). | S3 |
| 6 | Acter que la classe B ne voit pas le tracker ; choisir entre export dans l'IIFE (rompt le gel) et taxonomie compilée au build. | S4 |
| 7 | Borner la « preuve par les mains » (anneau ≤ 3 mains/compétence) ou la restreindre au tracker. | S5 |
| 8 | Promouvoir « la tolérance du verdict est réglable par l'utilisateur » au rang de risque n° 1 ; normaliser le verdict dès le P0. | S6 |
| 9 | Ramener la granularité à 24 cellules, ou fusionner `3bet+` tant que `n < 30`. | S7 |
| 10 | Réordonner le P0 : **P0.4 → P0.5 → P0.3 → P0.2 → P0.1**, avec le coût de chaque action. | S8 |

Aucune de ces dix modifications n'invalide l'audit sous-jacent. Elles corrigent
le récit, les chiffres de premier plan et l'ordonnancement — pas les faits.

---

## Annexe — méthode

**Mesuré par exécution sous Node** (`tests/harness.js`) : distribution des rues à
la génération et sur mains jouées (7 modes) ; `tagStats` sur 646 décisions ;
`Career.skills` / `Rating.skills` / `Player.mastery` sur les mêmes ; rendement des
drills `LEAK_DRILL` sur 500 spots chacun ; filtre par rejet et construction de
nœud ; `Judge.evaluate` / `Spot.generate` / `Progress.record` sur 600 spots ;
déterminisme de `Judge` (20 répétitions) ; verdicts à tolérance variable sur pool
constant ; taille d'une entrée persistée et d'un replay minimal ; occupation des
48 cellules sur 960 décisions ; verdicts des sizings préflop et options d'overbet.

**Mesuré en Chromium** (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) :
onglets visibles du tracker à 360 / 390 / 412 / 768 / 1280 px ; chaîne d'ancêtres
et styles calculés de `.ft-nav-item` ; effet du correctif CSS et atteignabilité de
la vue après clic ; portée lexicale d'un module de classe B réellement injecté ;
double interception de `Progress.record` sur 46 décisions jouées via `App.choose`.

**Non mesuré, signalé comme tel** : le 1,7× mode/niveau de l'agent E (déjà signalé
non re-vérifié par l'orchestrateur) ; la bande 70-85 % du contrôleur adaptatif ;
la justesse poker des 12 contradictions de ranges de l'agent C — hors de ma
compétence et hors de mon mandat.

**Fichiers touchés** : aucun, hors la création de ce rapport. La copie injectée de
l'artefact et les 16 sondes vivent dans le scratchpad de session, hors dépôt.
