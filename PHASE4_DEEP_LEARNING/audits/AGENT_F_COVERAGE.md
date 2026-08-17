# AGENT F — Rapport de couverture du moteur de situations

**Objet.** Mesurer empiriquement la variété réelle des situations produites par
`Spot.generate()` / `Play.step()` dans `VERSION_PRODUCTION/herolab.html`.
Aucun fichier applicatif n'a été modifié.

**Volume mesuré.** ≈ **790 000 générations de spot** réparties sur 13 modes ×
6 niveaux, plus l'énumération exhaustive des **22 100 flops** possibles.

**Scripts d'analyse** (dans ce dossier, exécutables tels quels) :

| Script | Rôle |
|---|---|
| `agent_f_lib.js` | chargement du moteur + définition des signatures et buckets |
| `agent_f_coverage.js` | 5 000 spots × 13 modes + 2 000 × 6 niveaux → unicité, entropie |
| `agent_f_session.js` | 30 sessions × 200 mains **jouées jusqu'au bout** → répétition |
| `agent_f_options.js` / `agent_f_options_ev.js` | forme et distinction EV des branches de décision |
| `agent_f_claims.js` | promesses de mode vs réalité + textures théorie/observé |
| `agent_f_holes.js` | 234 000 spots → cellules du produit cartésien jamais atteintes |
| `agent_f_axes.js` | décomposition : quel axe porte la variété, biais de la boucle de rejet |

`agent_f_lib.js` étend la liste `MODULES` exportée par `tests/harness.js` en
mutant le tableau exporté — le harness lui-même n'est pas touché.

> Contrôle de cohérence avec le contexte partagé : en politique passive, le
> harness mesure **4,66 décisions par main** (contexte partagé : 4,6). La chaîne
> de mesure reproduit donc le comportement de référence.

---

## 1. Combien de situations uniques ? — la réponse dépend de la signature

Signature du mandat : `position × rue × type de pot × nb joueurs × profondeur
(bucket) × profil adverse × texture (bucket) × action subie`.

Sur **78 000 spots** (13 modes × 6 000, niveau `intermediaire`) :

| Signature | Combinaisons uniques | Entropie (bits) | **Perplexité** (= nb effectif) |
|---|---:|---:|---:|
| Complète (8 axes, profil = multiset des vilains vivants) | **19 281** | 12,14 / 14,24 max | **4 515** |
| Complète **sans** l'axe profil | 4 768 | 10,19 | 1 168 |
| Cœur : `pos × rue × pot × nb joueurs × action subie` | **527** | 5,71 / 9,04 max | **52** |
| Stratégique : `pos × rue × pot × action subie` | **165** | 4,56 | **23,5** |

La perplexité (`2^H`) est le nombre de situations *équiprobables* qui
produiraient la même incertitude. C'est le chiffre honnête.

**Lecture.** Le nombre brut de 19 281 est réel mais trompeur : retirer le seul
axe « profil adverse » divise le total par **4,04**. L'axe profil compte à lui
seul **458 valeurs distinctes** (multisets de 1 à 5 vilains parmi 9 profils),
contre 4 à 7 valeurs pour tous les autres axes. Autrement dit, une part
dominante de la « variété » affichée vient de la permutation des étiquettes de
profil sur les sièges, pas de la structure du spot.

Sur les axes qui déterminent réellement la décision, l'application propose
**527 situations atteignables**, dont **52 seulement** portent l'essentiel de la
masse de probabilité.

### Unicité par mode (5 000 spots chacun)

| Mode | Signatures uniques | Entropie | Perplexité | Singletons |
|---|---:|---:|---:|---:|
| turn | 3 302 | 11,36 | 2 630 | 2 517 |
| flop | 3 201 | 11,29 | 2 509 | 2 382 |
| river | 3 105 | 11,20 | 2 344 | 2 331 |
| multiway | 2 254 | 10,56 | 1 510 | 1 345 |
| cible | 2 170 | 10,25 | 1 218 | 1 385 |
| pot4bet | 2 166 | 10,22 | 1 194 | 1 383 |
| preflop | 2 154 | 10,24 | 1 209 | 1 381 |
| libre | 2 120 | 10,16 | 1 146 | 1 351 |
| pot3bet | 2 118 | 10,18 | 1 161 | 1 337 |
| deep | 1 763 | 9,79 | 887 | 1 023 |
| short | 1 713 | 9,62 | 788 | 974 |
| **btnbb** | **150** | 6,64 | 100 | 5 |
| **bvb** | **74** | 5,50 | **45** | 2 |

`libre`, `preflop`, `pot3bet`, `pot4bet` et `cible` produisent des chiffres
identiques à ±2,5 % — premier indice que ces modes ne se distinguent pas.

### Unicité par niveau (2 000 spots, mode `libre`)

| Niveau | Profils au pool | Uniques | Perplexité |
|---|---:|---:|---:|
| exploit | 6 | 1 301 | 986 |
| intermediaire | 6 | 1 165 | 816 |
| debutant | 4 | 972 | 666 |
| avance | 5 | 796 | 458 |
| pro | 4 | 501 | 254 |
| **gto** | **2** | **177** | **82** |

Le niveau GTO divise la variété observée par **6,6** par rapport au niveau
intermédiaire : avec deux profils au pool (`reg`, `regAgro`), l'axe adverse
s'effondre. C'est cohérent avec l'intention (jugement non exploitant) mais le
joueur le plus avancé est aussi celui qui voit le moins de diversité.

---

## 2. Distribution : ce qui est sur-représenté, sous-représenté, absent

### 2.1 Positions (65 000 spots, tous modes)

| Position | Part | Écart / uniforme (16,7 %) |
|---|---:|---:|
| SB | 27,3 % | ×1,64 |
| BB | 23,2 % | ×1,39 |
| BTN | 21,7 % | ×1,30 |
| CO | 12,5 % | ×0,75 |
| HJ | 9,0 % | ×0,54 |
| **UTG** | **6,3 %** | **×0,38** |

Deux causes **mesurées** :

1. `positions = POS6.slice(6 - nPlayers)` — sur les tables courtes (55 % des
   spots ont 2 à 5 sièges), UTG et HJ n'existent tout simplement pas. UTG
   n'apparaît qu'aux tables 6 max.
2. La boucle de rejet de `App.newHand()` (« spot non terminé et options non
   vides », 25 essais) rejette **8,65 %** des spots générés, mais de façon très
   inégale :

| Siège du héros | Spots générés | Conservés | Taux de conservation |
|---|---:|---:|---:|
| CO / HJ / UTG / BTN / SB | — | — | 99,4 – 99,7 % |
| **BB** | 22 393 | 15 899 | **71,0 %** |

Le héros en BB est éliminé 29 % du temps parce que tout le monde se couche et
que la main se termine sans décision. C'est aussi l'origine du déséquilibre
mesuré en mode `bvb` : **SB 67,4 % / BB 32,6 %** alors que le code tire
`mode.heads[Math.random() < 0.5 ? 0 : 1]`, censé donner 50/50. Même effet en
`btnbb` : **BTN 66,0 % / BB 34,0 %**.

### 2.2 Type de pot

À la génération (première décision), tous modes confondus :

| Type de pot | Part |
|---|---:|
| non ouvert (préflop) | 49,0 % |
| SRP (un seul raise) | 44,0 % |
| limpé (postflop) | 6,2 % |
| **3bet** | **0,76 %** |
| **4bet** | **0,017 %** |
| 5bet+ | 0,003 % |

En jeu réel (main jouée jusqu'au bout, mode `libre`, 13 378 décisions) :
SRP 55,6 % · non ouvert 23,3 % · limpé 15,0 % · **3bet 5,8 %** · **4bet 0,23 %**.

Un joueur voit donc en moyenne **1 pot 4bet toutes les 430 décisions**, soit
environ **une fois toutes les 160 mains**. Les ranges `THREEBET` et `FOURBET`
définies dans le moteur sont, en pratique, quasiment jamais sollicitées.

### 2.3 Profondeur effective (héros vs vilain le plus profond)

| Bucket | Part |
|---|---:|
| 60–100 bb | 32,2 % |
| 100–150 bb | 30,2 % |
| 40–60 bb | 16,6 % |
| 20–40 bb | 8,9 % |
| 150–200 bb | 6,8 % |
| 200+ bb | 4,8 % |
| < 20 bb | 0,64 % |

### 2.4 Les 15 signatures les plus fréquentes (sur 65 000 spots)

Toutes préflop, toutes heads-up, toutes SB ou BB :

| Signature | Occurrences | Part |
|---|---:|---:|
| `BB\|preflop\|SRP\|2w\|60-100\|fish\|preflop\|face-ouverture` | 657 | 1,011 % |
| `BB\|preflop\|SRP\|2w\|100-150\|fish\|…\|face-ouverture` | 573 | 0,882 % |
| `SB\|preflop\|unopened\|2w\|60-100\|lag\|…\|face-blinde` | 529 | 0,814 % |
| `SB\|preflop\|unopened\|2w\|60-100\|tag\|…\|face-blinde` | 517 | 0,795 % |
| `SB\|preflop\|unopened\|2w\|60-100\|rec\|…\|face-blinde` | 509 | 0,783 % |
| *(10 suivantes : mêmes deux structures, autre profil ou autre bucket)* | | |

Sur la signature **cœur** (sans profil ni profondeur), la concentration est
brutale : **les 10 premières combinaisons couvrent 57,0 % de tous les spots**.

| Signature cœur | Part |
|---|---:|
| `SB \| preflop \| non ouvert \| 2 joueurs \| face aux blindes` | 11,83 % |
| `BTN \| preflop \| non ouvert \| 3 joueurs \| face aux blindes` | 10,62 % |
| `BB \| preflop \| SRP \| 2 joueurs \| face à une ouverture` | 7,43 % |
| `CO \| preflop \| non ouvert \| 4 joueurs \| face aux blindes` | 5,08 % |
| `UTG \| preflop \| non ouvert \| 6 joueurs \| face aux blindes` | 4,53 % |
| `HJ \| preflop \| non ouvert \| 5 joueurs \| face aux blindes` | 4,39 % |
| `SB \| preflop \| SRP \| 3 joueurs \| face à une ouverture` | 3,59 % |
| `BB \| preflop \| non ouvert \| 2 joueurs \| personne n'a misé` | 3,57 % |
| `BB \| preflop \| SRP \| 3 joueurs \| face à une ouverture` | 3,34 % |
| *(10ᵉ)* | 2,6 % |

Sur `pos × rue × pot × action subie`, les 10 premières couvrent **75,9 %**.

---

## 3. Répétition : que voit un joueur sur 200 mains ?

30 sessions indépendantes de **200 mains jouées jusqu'à leur terme**
(`Play.step`), politique « joueur engagé » (30 % fold face à une mise, 55 %
call, 15 % raise ; 55 % check / 45 % bet sans mise à payer).

| Configuration | Décisions / main | Décisions | Signatures uniques | **Doublons** | % décisions dans une signature déjà vue | Répétition max |
|---|---:|---:|---:|---:|---:|---:|
| libre (engagé) | 2,70 | 540,5 | 505,6 | **6,5 %** | 11,5 % | 4,1 |
| libre (passif, ne folde jamais) | 4,66 | 931,6 | 872,9 | 6,3 % | 11,6 % | 4,3 |
| preflop | 2,65 | 530,1 | 498,2 | 6,0 % | 11,0 % | 3,9 |
| flop | 2,67 | 533,6 | 517,6 | 3,0 % | 5,8 % | 2,7 |
| **btnbb** | 2,59 | 517,3 | 362,5 | **29,9 %** | 45,8 % | 9,1 |
| **bvb** | 2,53 | 505,9 | 300,3 | **40,6 %** | 56,0 % | 13,5 |

**Réponse directe à la question posée.** Sur la signature du mandat (8 axes),
un joueur qui fait 200 mains en `libre` rencontre **506 situations distinctes
sur 540 décisions** : 6,5 % de doublons stricts, aucune signature vue plus de
4 fois. Ce n'est **pas** « 40 situations répétées 5 fois ».

Mais la même session mesurée sur les axes qui pilotent réellement la décision
donne un tout autre résultat :

| Signature retenue | Uniques / 531 décisions | Répétition moyenne |
|---|---:|---:|
| Cœur (`pos × rue × pot × joueurs × action subie`) | **188,5** | **2,8 ×** |
| Stratégique (`pos × rue × pot × action subie`) | **99,0** | **5,4 ×** |
| bvb — cœur *et* stratégique | **31,2** | **16,5 ×** |

Et en ajoutant les cartes du héros et le board (signature « ce que l'écran
montre »), le taux de doublons stricts tombe à **0,7 %** : deux mains
rigoureusement identiques n'arrivent quasiment jamais.

**Conclusion de cette section.** La sensation de répétition ne vient pas de
doublons — elle vient du fait que **99 configurations stratégiques** couvrent
une session de 200 mains, chacune revue 5,4 fois en moyenne, avec des cartes
différentes à chaque fois. En `bvb`, c'est 31 configurations revues 16,5 fois.

---

## 4. Promesses de mode vs réalité mesurée (8 000 spots par mode)

| Mode | Promesse (`desc` du code) | Mesure | Verdict |
|---|---|---|---|
| `libre` | « Situations variées, **toutes streets**, tous spots » | **100,0 % préflop** à la génération | ✗ faux à la génération |
| `preflop` | « **Uniquement** les décisions avant le flop » | 100 % préflop à la génération, mais **45,2 % préflop / 54,8 % postflop** une fois la main jouée — identique à `libre` (45,3 %) | ✗ **mode fantôme** |
| `flop` | « Toujours une décision au flop » | 100,0 % flop (1ʳᵉ décision) | ✓ |
| `turn` | « Toujours une décision au turn » | 99,99 % turn (0,01 % préflop) | ✓ |
| `river` | « Toujours une décision à la river » | 100,0 % river | ✓ |
| `pot3bet` | « Le pot est **systématiquement** 3bet » | **0,44 %** de pots 3bet à la génération ; **5,60 %** en jeu réel, contre **5,80 % en `libre`** | ✗ **mode fantôme** |
| `pot4bet` | « Le pot est **systématiquement** 4bet » | **0,00 %** de pots 4bet à la génération ; **0,14 %** en jeu réel, contre **0,23 % en `libre`** | ✗ **mode fantôme** |
| `bvb` | « SB contre BB uniquement » | 100 % heads-up ✓, mais héros **SB 67,4 % / BB 32,6 %** | ~ biaisé |
| `btnbb` | « Bouton contre grosse blinde » | héros **BTN 66,0 % / BB 34,0 %** ; **66,0 % des spots ont 3 joueurs encore vivants** (la SB n'a pas encore parlé) | ~ biaisé |
| `multiway` | « Pots à **trois** joueurs ou plus » | **9,9 % des spots sont heads-up** ; tables de **4, 5 ou 6 sièges uniquement** — jamais 3 | ✗ partiellement faux |
| `deep` | « Stacks de **150 à 300 bb** » | profondeur effective **112,7 → 378,3 bb** ; **8,4 % des spots sous 150 bb** | ~ approximatif |
| `short` | « Stacks de **20 à 45 bb** » | profondeur effective **15,4 → 57,2 bb** ; **6,5 % sous 20 bb**, 19,1 % au-dessus de 45 bb | ~ approximatif |
| `cible` | « Repropose les spots où tu te trompes » | sans historique, retombe sur `libre` (mesure : 61,0 % non ouvert vs 61,8 % en `libre`) | ✓ par conception |

### Cause racine des trois modes fantômes

```
3748:  pot3bet: { …, force3Bet: true },
3749:  pot4bet: { …, force4Bet: true },
3744:  preflop: { …, stopAt: "preflop" },
```

- `force3Bet` et `force4Bet` **n'apparaissent nulle part ailleurs** dans les
  16 410 lignes du fichier. Aucun code ne les lit. Les deux modes sont des
  alias exacts de `libre`.
- `mode.stopAt` n'est lu qu'à la ligne 3969, dans `Spot.runToHero()`. Il n'est
  **jamais consulté par `Play.advance()`** (l. 4501+), qui fait avancer la main
  après la décision du héros. Le bouton « Continuer la main » emmène donc le
  joueur au flop, au turn et à la river dans un mode intitulé « Uniquement les
  décisions avant le flop ».

`minPlayers: 3` est lu (l. 3851) mais implémenté en `Math.max(nPlayers, 4)` :
la valeur annoncée (3) et la valeur appliquée (4) diffèrent, et le filtre porte
sur les **sièges distribués**, pas sur les **joueurs encore dans le coup** au
moment de la décision — d'où les 9,9 % de spots heads-up.

---

## 5. Cellules du produit cartésien jamais atteintes

Balayage de **234 000 spots** (13 modes × 6 niveaux × 3 000).

| Croisement | Cellules attendues | Atteintes | Couverture |
|---|---:|---:|---:|
| position × rue | 24 | 24 | **100 %** |
| rue × type de pot | 20 | 20 | **100 %** |
| position × type de pot | 36 | 36 | **100 %** |
| profil × rue | 36 | 36 | **100 %** |
| profil × position | 54 | 54 | **100 %** |
| position × nb joueurs | 30 | 30 | **100 %** |
| rue × texture | 23 | 22 | 95,7 % |
| type de pot × nb joueurs | 30 | 27 | 90,0 % |
| profondeur × rue | 28 | 25 | 89,3 % |
| position × rue × type de pot | 120 | 104 | 86,7 % |

Les 9 profils définis dans `PROFILES` sont tous atteints, à toutes les
positions et à toutes les rues. Aucun profil orphelin.

### Cellules vides — analyse au cas par cas

**Vides pour raison structurelle (normal, à ne pas corriger) :**

| Cellule | Raison |
|---|---|
| `river \| arc-en-ciel` | 5 cartes sur 4 couleurs : au moins deux partagent une couleur |
| `UTG \| preflop \| SRP` (et `3bet`, `4bet`) | UTG parle en premier préflop, il ne peut pas subir d'ouverture |
| `preflop \| face-check`, `preflop \| premier-de-parole` | il n'existe pas de check avant la BB |
| `flop \| face-blinde`, `turn \| face-ouverture`, etc. | ces étiquettes sont exclusives d'une rue par construction |

**Vides pour raison de conception (vrais trous) :**

| Cellule | Ce qui manque |
|---|---|
| `200+ bb \| flop`, `200+ bb \| turn`, `200+ bb \| river` | **aucun mode ne combine deep stack et postflop** : `deep` impose `[150,300]` mais s'arrête au préflop, tandis que `flop`/`turn`/`river` utilisent `stackRange` par défaut `[40,150]`. Le joueur doit deviner qu'il faut combiner *mode river* + *réglage « Très profond »* dans les Réglages. Vérifié : cette combinaison manuelle produit bien 55,0 % de spots à 200+ bb. |
| `4bet \| heads-up` | **jamais généré en 234 000 spots**, alors que c'est la forme canonique du pot 4bet. Les seules cellules 4bet atteintes sont `4bet\|3w` et `4bet\|4w` (des joueurs encore vivants qui n'ont pas encore parlé) |
| `5bet+ \| *` | 2 occurrences sur 65 000 |
| `CO/BTN \| preflop \| 4bet` | jamais atteint : un CO ou un BTN ne subit jamais de 4bet |

---

## 6. Branches de décision : « fold, call, raise, raise, raise, raise »

### 6.1 Forme des options (20 000 spots préflop + 24 000 postflop)

| Rue | Jeu d'options le plus fréquent | Part |
|---|---|---:|
| préflop | `fold, call, 2.5 bb, 3 bb, 4 bb, Tapis` | 57,0 % |
| préflop | `fold, call, 2.5 bb, Tapis` (dédup. par min-raise) | 31,4 % |
| flop | `check, 1/3 pot, 1/2 pot, 2/3 pot, Pot, Tapis` | 77,4 % |
| turn | idem | 78,3 % |
| river | idem | 78,7 % |

Le moteur propose donc bien 4 tailles agressives préflop et 5 postflop. La
déduplication par montant en supprime au moins une dans **38,5 %** des spots
préflop et **≈ 20 %** des spots postflop (le plancher `min = max(streetBets×2, bb)`
écrase les petites tailles).

**Aucun overbet n'existe.** La plus grosse taille non-tapis est « Pot ».
Mesure : sur **84 441 options agressives** proposées au héros, **0,02 %**
dépassent le pot hors tapis ; sur **2 110 mises adverses postflop** observées,
**0 (zéro)** dépasse le pot. Or le profil `regAgro` dit au joueur :
*« Ses overbets river sont polarisées — soit très fort, soit rien. »* Le moteur
décrit un comportement qu'il ne peut pas produire, et ne donne pas au joueur
l'outil correspondant.

### 6.2 Ces tailles sont-elles **pédagogiquement** distinctes ?

Test : `Judge.evaluate()` sur ~500 spots par rue, **tapis exclu**, écarts d'EV
comparés à la tolérance du verdict de l'application elle-même
(`(1×bb + pot×0,03) × (level.tolerance / 0,1)`).

| Rue | Spots | Écart d'EV médian entre la meilleure et la pire taille | **% de spots où TOUTES les tailles sont dans la tolérance** | Paliers réellement séparés (moy.) |
|---|---:|---:|---:|---:|
| **préflop** (2.5 / 3 / 4 bb) | 357 | **0,26 bb** | **100,0 %** | **1,00** |
| flop (1/3 · 1/2 · 2/3 · pot) | 498 | 1,20 bb | 50,2 % | 1,40 |
| turn | 491 | 1,80 bb | 37,7 % | 1,67 |
| river | 482 | 2,37 bb | 33,0 % | 1,94 |

**Préflop : les trois tailles d'ouverture ne sont jamais distinctes.** Dans
**100 % des spots**, l'écart d'EV entre 2.5 bb, 3 bb et 4 bb est inférieur à la
tolérance qui décide du verdict. Le joueur a trois boutons dont le moteur est
structurellement incapable de dire qu'ils diffèrent.

**Le classement est monotone décroissant avec la taille**, ce qui est un
artefact du modèle et non de la théorie :

| Rue | Rang moyen par taille (1 = meilleure) | Taille gagnante |
|---|---|---|
| préflop | 2.5 bb : **1,12** · 3 bb : 1,98 · 4 bb : 2,77 | 2.5 bb dans **92,4 %** des spots |
| flop | 1/3 : **1,86** · 1/2 : 2,20 · 2/3 : 2,64 · pot : 2,99 | 1/3 pot dans **64,1 %** |
| turn | 1/3 : **1,74** · 1/2 : 2,13 · 2/3 : 2,63 · pot : 3,10 | 1/3 pot dans **68,4 %** |
| river | 1/3 : **1,80** · 1/2 : 2,21 · 2/3 : 2,64 · pot : 3,01 | 1/3 pot dans **66,2 %** |

Le sizing « 1/2 pot » n'est jamais la meilleure option que dans 4,8 à 5,5 % des
spots postflop, et n'est même pas toujours proposé (dédupliqué contre le
min-raise dans ~17 % des cas). C'est la branche la moins utile de l'interface.

**En résumé sur ce point :** l'interface affiche 6 boutons ; le moteur en
distingue **2** (préflop : « ouvrir » / « tapis ») à **1,9** (river). Les quatre
tailles de relance ne sont pas quatre enseignements.

---

## 7. Textures de board

### 7.1 Fidélité de la distribution — le point le plus solide du moteur

Comparaison de la distribution observée (**29 997 flops** générés en mode
`flop`) à l'**énumération exhaustive des 22 100 flops** possibles, passée par
`BoardTex.analyse()` :

| Texture (bucket) | Théorie exhaustive | Observé | Écart |
|---|---:|---:|---:|
| bicolore sec | 37,14 % | 37,26 % | +0,12 |
| arc-en-ciel sec | 24,76 % | 24,99 % | +0,23 |
| pairé | 16,94 % | 16,77 % | −0,17 |
| connecté | 12,76 % | 12,67 % | −0,09 |
| monotone | 5,18 % | 5,22 % | +0,04 |
| très connecté | 2,99 % | 2,84 % | −0,15 |
| brelan au board | 0,24 % | 0,25 % | +0,01 |

Écart maximal : **0,23 point**. La distribution est celle d'un tirage
authentiquement aléatoire, sur les trois axes indépendants aussi :

| Axe | Valeurs | Théorie → Observé |
|---|---|---|
| Couleur | rainbow / bicolore / monotone | 39,76→39,78 · 55,06→55,00 · 5,18→5,22 |
| Appariement | unpaired / paired / trips | 82,82→82,98 · 16,94→16,77 · 0,24→0,25 |
| Connexion | sec / connecté / très connecté | 73,85→74,24 · 17,74→17,53 · 8,42→8,23 |
| Carte haute | high / mid / low | 40,07→39,40 · 27,62→27,83 · 32,31→32,77 |

**Classes de texture croisées : 48 théoriques, 48 observées. Aucune texture
n'est inatteignable.** Les 8 classes les plus rares (8 à 40 flops sur 22 100,
ex. `monotone-unpaired-veryconn-mid`) sont toutes apparues. **16 467 flops
distincts** sur 22 100 vus en 30 000 tirages, conforme au coupon collector.

### 7.2 Le vrai trou : aucune pondération pédagogique

Le corollaire de cette fidélité est qu'**aucune texture n'est sur-échantillonnée
pour l'apprentissage**. Sur une session de 200 mains en `libre`
(531 décisions), la répartition mesurée est :

| Texture | Part des décisions | Spots par session de 200 mains |
|---|---:|---:|
| préflop (pas de board) | 45,0 % | 239 |
| bicolore sec | 16,0 % | 85 |
| pairé | 15,7 % | 83 |
| connecté | 7,3 % | 39 |
| arc-en-ciel sec | 6,6 % | 35 |
| monotone | 6,0 % | 32 |
| très connecté | 2,2 % | 12 |
| 4 cartes à couleur | 0,6 % | 3 |
| brelan au board | 0,6 % | 3 |

Distribution rue par rue en mode dédié : les boards pairés passent de 30,3 %
(flop) à 46,6 % (river) et les monotones de 10,2 % à 17,1 %, simplement parce
qu'on ajoute des cartes. Rien dans le moteur ne corrige cette dérive ni ne
garantit une exposition minimale aux textures rares mais formatrices.

**Limite technique de `BoardTex` à signaler :** la connexion est calculée sur
`rs.slice(0, 3)`, les **trois cartes les plus hautes** (l. 2977-2980). Sur un
turn ou une river, un board `A-K-4-3-2` est donc classé « sec » alors qu'il
porte une quinte à 5. La texture postflop est mesurée sur un sous-ensemble du
board réel.

---

## 8. Les 5 trous de couverture les plus significatifs

**1 — Trois modes sur treize ne font rien.**
`pot3bet` (`force3Bet`), `pot4bet` (`force4Bet`) : drapeaux jamais lus nulle
part dans le fichier. `preflop` (`stopAt`) : lu uniquement dans
`Spot.runToHero()`, ignoré par `Play.advance()`. Mesuré : `pot3bet` produit
**5,60 %** de pots 3bet contre **5,80 %** pour `libre` ; `pot4bet` produit
**0,14 %** de pots 4bet contre **0,23 %** pour `libre` ; `preflop` produit
**54,8 %** de décisions postflop, exactement comme `libre`. Les modes annoncés
comme le cœur de la formation préflop avancée sont des alias de la partie
libre.

**2 — Les pots 3bet et 4bet sont quasi inexistants, donc les ranges 3bet/4bet
sont du code mort.** 0,76 % de pots 3bet et 0,017 % de pots 4bet à la
génération ; 5,8 % / 0,23 % en jeu réel. Le pot 4bet **heads-up** — la forme
canonique — n'a **jamais** été généré en 234 000 spots. Ceci amplifie le trou
déjà identifié par le contexte partagé (3bet/4bet non déclinés par couple de
positions) : ces ranges ne sont pas seulement imprécises, elles ne servent
presque jamais.

**3 — Les tailles de mise ne sont pas des branches pédagogiques.** Préflop,
**100 %** des spots ont leurs trois tailles d'ouverture à l'intérieur de la
tolérance du verdict, avec un classement mécaniquement monotone (2.5 bb gagne
92,4 % du temps). Postflop, 1/3 pot gagne 64–68 % des spots et de 33 % (river)
à 50 % (flop) des spots n'ont **aucune** taille distinguable. Aucun overbet
n'est proposé ni joué par l'IA, alors que le texte du profil `regAgro` en
promet.

**4 — La couverture est extrêmement concentrée sur les axes qui comptent.**
527 situations « cœur » atteignables, perplexité **52** ; 10 signatures
couvrent **57 %** des spots ; sur `pos × rue × pot × action subie`, 10
signatures couvrent **75,9 %**. La variété brute (19 281 signatures) est portée
à 80 % par un seul axe — la permutation des profils adverses sur les sièges.
Les modes heads-up sont le cas extrême : `bvb` = **31 configurations
stratégiques** revues **16,5 fois** sur une session de 200 mains.

**5 — Déséquilibres non intentionnels de la boucle de rejet et du choix de
table.** La boucle `while (tries++ < 25)` conserve 99,4–99,7 % des spots pour
CO/HJ/UTG/BTN/SB mais seulement **71,0 %** pour BB. Combiné à
`POS6.slice(6 - nPlayers)` (UTG et HJ n'existent qu'aux tables 6 max), cela
produit **UTG 6,3 % contre SB 27,3 %** — un facteur **4,3** — et casse le
50/50 explicitement codé dans les modes heads-up (**SB 67 % / BB 33 %**).
Trous connexes : `200+ bb × postflop` inatteignable par un mode (il faut
combiner *mode river* + réglage *Très profond*), `multiway` livre 9,9 % de
spots heads-up et jamais de table à 3 sièges, `deep` descend à 113 bb et
`short` monte à 57 bb.

---

## 9. Verdict

**La variété annoncée n'est réelle que sur un axe : les cartes et le board.**

Ce qui est authentiquement varié, mesuré et vérifié :
la distribution des flops est indiscernable d'un tirage exhaustif (écart max
0,23 point sur 22 100 flops énumérés), les 48 classes de texture sont toutes
atteignables, les 9 profils sont tous rencontrés à toutes les positions et
toutes les rues, aucun couple `position × rue`, `rue × type de pot`,
`profil × position` n'est vide, et deux mains rigoureusement identiques
n'apparaissent quasiment jamais (0,7 % de doublons sur la signature complète
avec cartes).

Ce qui est annoncé et n'existe pas :
trois modes sur treize sont des alias de la partie libre ; « toutes streets »
signifie 100 % préflop à la génération ; « systématiquement 3bet » signifie
0,44 % ; « uniquement avant le flop » laisse passer 54,8 % de décisions
postflop ; « trois joueurs ou plus » donne 9,9 % de heads-up ; quatre boutons
de relance correspondent à un seul enseignement préflop ; et les overbets
décrits dans les profils adverses ne sont ni jouables ni joués.

**Le chiffre à retenir :** l'application propose **527 situations
stratégiquement distinctes**, dont **52 en nombre effectif** (perplexité). Une
session de 200 mains en produit **99 distinctes, revues 5,4 fois chacune** en
moyenne. La variété perçue main après main est réelle ; la variété
*d'apprentissage* — le nombre de problèmes différents à résoudre — est environ
un ordre de grandeur plus faible que ce que l'inventaire des modes laisse
supposer.

Le moteur de cartes est sain. C'est la couche de contrainte au-dessus — les
modes, les tailles, l'échantillonnage des positions et des types de pot — qui
ne tient pas ses promesses.
