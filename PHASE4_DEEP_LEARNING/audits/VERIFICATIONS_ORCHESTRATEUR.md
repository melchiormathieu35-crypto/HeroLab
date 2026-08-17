# Contre-vérifications indépendantes

Les rapports d'agents sont des affirmations. Ce fichier ne consigne que ce que
j'ai **re-mesuré moi-même**, sur l'artefact de production, avec la commande qui
l'établit. Tout ce qui figure ici peut être rejoué.

| # | Affirmation | Agent | Verdict |
|---|---|---|---|
| 1 | `worstLeak` trie sur le coût cumulé à vie | J | **confirmé** |
| 2 | `focusFor` replie 10 fuites sur 5 configurations | J | **confirmé** |
| 3 | Deux jours d'absence ramènent une série de 30 à 1 | J | **confirmé** |
| 4 | `daily.target` et `daily.best` jamais relus | J | **confirmé** (0 occurrence) |
| 5 | Le compteur de maîtrise ne peut jamais monter | B, D, H, K | **confirmé** |
| 6 | 29 fuites → 10 configurations d'exercice | A | **confirmé après correction** |
| 7 | `tagStats` sans dénominateur (`n === err`) | D | **confirmé** |
| 8 | `force3Bet` / `force4Bet` jamais lus | C, G | **confirmé** |
| 9 | `BB_DEF` inutilisée en jeu | C | **confirmé** |
| 10 | La range SB de référence déclenche l'alerte `sb-loose` | C | **confirmé** |
| 11 | `reloadEngine` de la Phase 3 est un no-op | K | **confirmé en navigateur** |
| 12 | Tracker inaccessible sur mobile | I | **confirmé, et aggravé** |
| 13 | `level.hint` n'est lu nulle part | E | **confirmé** (0 occurrence) |
| 14 | `level.mode:"gto"` jamais consommé | E | **confirmé** (lu 1 fois, pour `exploit` seul) |
| 15 | Le niveau GTO promet un jugement qu'il ne rend pas | E | **confirmé** |

---

## 6. Une correction que j'ai dû faire sur moi-même

J'ai d'abord mesuré **27** configurations d'exercice distinctes et cru l'agent A
en erreur. Je comparais les objets `LEAK_DRILL` entiers, `label` compris — or le
`label` est du texte d'affichage qui ne change rien au spot généré. En ne
comparant que les champs fonctionnels (`mode`, `forcePos`, `facing`), on obtient
**10**. L'agent avait raison.

```
 8 fuites → {mode:"flop"}      dont cbet-low ET cbet-high, bet-too-big ET bet-too-small
 6 fuites → {mode:"preflop"}   dont loose ET nit, low-3bet ET high-3bet
 4 fuites → {mode:"river"}
```

Des fuites **opposées** partagent le même exercice. La leçon vaut d'être notée :
un champ cosmétique peut faire passer 10 pour 27, et donner à un audit
l'apparence d'une réfutation.

## 8. Les modes 3bet / 4bet, mesurés

800 spots générés par mode, comptage des relances préflop dans le journal :

| Mode | Promesse | Pots 3bet+ | Pots 4bet+ |
|---|---|---|---|
| Partie libre | — | 0,7 % | 0,1 % |
| Pots 3Bet | « systématiquement 3bet » | 0,7 % | 0,0 % |
| Pots 4Bet | « systématiquement 4bet » | 0,9 % | 0,0 % |

Les deux modes sont indiscernables du mode libre.

## 11. `reloadEngine`, en navigateur réel

```
modules visibles via window[...] : 0
modules réellement présents      : 8
XP de A avant bascule            : 4242
XP en mémoire après bascule vers B : 4242
```

## 12. Tracker sur mobile — et pourquoi c'est pire qu'annoncé

```
360×800   0 onglet visible / 9
390×844   0 / 9
412×915   0 / 9
768×1024  9 / 9
1280×800  9 / 9
```

L'agent I décrivait une navigation hors champ. J'ai poussé la vérification d'un
cran : le bouton menu du tracker **est présent et visible**, mais son clic ne
change rien — 0 onglet visible avant, 0 après.

Ce n'est donc pas un problème de découvrabilité, où l'utilisateur ne trouverait
pas l'entrée. C'est une **inaccessibilité totale** : huit vues sur neuf, les 59
indicateurs, les 29 détections de fuites et l'exercice ciblé qui en découle sont
hors d'atteinte sur mobile.

## Ce que ces vérifications disent de mes propres tests

Deux défauts majeurs (11 et 12) portent sur du code que j'ai écrit ou validé en
Phase 2 et 3, avec des suites que je croyais sérieuses.

- Mes tests d'isolation vérifiaient le **stockage** après un changement
  d'identité, jamais l'**état en mémoire**.
- Mes tests mobiles vérifiaient l'absence de débordement et la taille des cibles
  tactiles, jamais qu'une vue soit **atteignable**.

Le point commun : ils contrôlent des **propriétés du rendu**, jamais la
**possibilité d'accomplir un parcours**. C'est l'angle mort à corriger dans la
stratégie de test de la Phase 4 — un test doit pouvoir échouer parce que
l'utilisateur ne peut pas faire quelque chose, pas seulement parce qu'un nombre
est hors bornes.


## 13-15. Les niveaux de difficulté, champ par champ

```
debutant       tolerance 0.14   hint:true    mode:-        4 profils
intermediaire  tolerance 0.10   hint:true    mode:-        6 profils
avance         tolerance 0.07   hint:false   mode:-        5 profils
pro            tolerance 0.05   hint:false   mode:-        4 profils
gto            tolerance 0.04   hint:false   mode:gto      2 profils
exploit        tolerance 0.08   hint:false   mode:exploit  6 profils
```

`level.hint` : **0 occurrence** hors déclaration. Les deux `debutant` et
`intermediaire` annoncent une aide qui n'existe pas.

`level.mode` : lu **une seule fois** (l.7729), et uniquement pour `"exploit"`.
La valeur `"gto"` n'est donc jamais consommée. Or ce niveau se décrit ainsi :

> « Jugement sur la stratégie non exploitable, sans tenir compte des tendances
> adverses. »

Il promet un **type** de jugement différent ; il ne livre qu'une tolérance de
0,04 au lieu de 0,05 et un vivier d'adversaires réduit. Le jugement lui-même est
identique à celui de tous les autres niveaux.

C'est le même motif que les modes Pots 3Bet et Pots 4Bet : un champ déclaratif
porte une promesse que rien ne lit.

## Une mesure de l'agent E qui mérite d'être retenue

Sur 1 836 spots jugés, le **mode** fait varier la difficulté réelle **1,7 fois
plus** que le **niveau** (amplitude 0,310 contre 0,186). Le curseur présenté à
l'utilisateur comme « la difficulté » est donc le moins puissant des deux
leviers — le choix du thème pèse davantage que le choix du niveau.

Non re-vérifié par moi : la mesure demande de rejouer le protocole complet de
l'agent. Signalée comme telle.
