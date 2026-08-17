# Phase 4.1 — Arbitrages fondateurs

Les deux arbitrages qui conditionnent toute la spécification. Aucun n'est
tranché par opinion : chacun l'est par une expérience reproductible.

---

## Arbitrage n°1 — Qu'est-ce qu'une occasion ?

### La définition existe déjà dans le code

Elle n'est pas à inventer. **Les 29 règles du tracker portent déjà, chacune, son
dénominateur d'occasion** — c'est le champ `need` :

```
bb-underdefend   need: s.foldBBOpp >= 40    test: s.FBB > 62
cbet-low         need: s.cbFOpp   >= 30     test: s.CBF < 45
no-checkraise    need: s.crOpp    >= 40     test: s.CR  < 4
cold-call        need: s.coldOpp  >= 40     test: s.COLD > 12
```

Et ces compteurs sont réellement calculés (21 champs `*Opp` recensés), sur le
modèle :

```js
if (pos === "BB" && anyRaiseBefore) {      // ← l'OCCASION
  c.foldBBOpp++;
  if (didFold && !didVoluntary) c.foldBB++; //   le COMPORTEMENT
}
```

L'occasion est donc **la précondition situationnelle**, testée
indépendamment de ce que le joueur a fait. C'est exactement le pipeline demandé,
et il est déjà implémenté — **du côté du tracker seulement**.

> **Décision : ne rien inventer. Porter les définitions d'occasion du tracker
> vers le moteur de jeu.** Cela résout simultanément l'arbitrage n°1, la
> réconciliation des deux taxonomies (10 côté moteur / 29 côté tracker) et le
> blocage de la maîtrise.

### Forme canonique

```
OCCASION(compétence, spot) ⟺
   1. préconditions de situation réunies   (position, rue, action subie, type de pot)
   2. le héros atteint effectivement ce nœud de décision
   3. l'action discriminante est disponible dans les options
   4. le contexte d'évaluation est connu
```

Enregistrée **avant** le verdict. Jamais dérivée d'une erreur.

### Règle anti-double-comptage

Une décision peut ouvrir plusieurs occasions (défendre sa BB *et* jouer un pot
3bet). Règle : **une occasion par couple (compétence, nœud de décision)**, jamais
deux pour la même compétence sur le même nœud. Les compétences opposées
(`cbet-low` / `cbet-high`) partagent **la même occasion** et se distinguent par
le comportement observé — elles ne doivent donc pas être deux compétences, mais
**une compétence à deux modes d'échec** (cf. §9).

### Cas non évaluables

Trois catégories, à exclure du dénominateur :
1. le nœud n'est pas atteint (main terminée avant) ;
2. l'action discriminante n'est pas proposée ;
3. toutes les options sont dans la tolérance — le spot **ne discrimine pas**
   (mesuré : 77,9 % des spots préflop ont 2.5/3/4 bb tous acceptables).

Le point 3 est essentiel : compter une occasion là où aucune erreur n'est
possible gonfle artificiellement la maîtrise.

---

## Arbitrage n°2 — La maîtrise doit être comparable entre niveaux

### L'expérience qui tranche

**Protocole A — mêmes spots, mêmes décisions, seul le niveau change.**
200 spots figés, rejugés à chacun des 6 niveaux.

| Niveau | tolérance | non-erreurs | **lossBB moyen** |
|---|---|---|---|
| debutant | 0,14 | 98,5 % | **0,2766** |
| intermediaire | 0,10 | 96,0 % | **0,2766** |
| avance | 0,07 | 93,5 % | **0,2766** |
| pro | 0,05 | 88,5 % | **0,2766** |
| gto | 0,04 | 79,0 % | **0,2766** |
| exploit | 0,08 | 94,0 % | **0,2766** |

> Le verdict varie de **19,5 points**. Le coût en bb est **strictement
> identique à la quatrième décimale**.

C'est mécanique : `verdict = (lossBB > tolerance)`. La tolérance est un réglage
d'affichage ; `lossBB` est une grandeur du moteur.

**Protocole B — spots générés à chaque niveau** (le vivier de profils change) :

| Niveau | lossBB moyen | non-erreurs |
|---|---|---|
| debutant | 0,2549 | **98,0 %** |
| intermediaire | 0,2684 | 93,0 % |
| avance | 0,2498 | 97,0 % |
| pro | 0,3042 | 87,0 % |
| gto | **0,2084** | **72,5 %** |
| exploit | 0,2794 | 91,5 % |

Le verdict balaie **25,5 points**. Le `lossBB` reste dans une bande étroite —
et surtout **son ordre s'inverse** : le niveau nominalement le plus dur (gto)
produit le **plus faible** coût en bb. Explication poker cohérente : son vivier
ne contient que `reg` et `regAgro`, contre lesquels une politique triviale perd
moins d'EV que face à des `fish` ou `maniac`, où de gros écarts exploitants
existent.

### Décision

> **La maîtrise se calcule sur `lossBB`, jamais sur le verdict.**

Conséquences :
- choisir « débutant » n'améliore plus le score — la voie de farm la plus
  évidente est fermée **à la source**, sans correctif *a posteriori*, sans
  stockage par niveau ;
- le niveau retrouve son rôle légitime : régler l'exigence **affichée** et le
  vivier d'adversaires, sans toucher à la mesure ;
- il reste une variation résiduelle de difficulté (0,208 à 0,304, facteur 1,46)
  qui n'est **pas** monotone avec le niveau. Elle est donc traitée par une
  pondération de difficulté **par spot**, pas par niveau.

### Fonction de qualité

Une qualité continue, bornée, indépendante du niveau :

```
q(lossBB) = exp( − lossBB / c )        c = 1 bb (constante FIXE)
```

- `q(0) = 1` (décision optimale) · `q(0,5 bb) = 0,61` · `q(2 bb) = 0,14`
- `c` est une constante du produit, **jamais** la tolérance du niveau — sinon la
  dépendance au niveau se réintroduit par la porte de derrière. *(C'est le
  défaut du modèle proposé en audit, qui posait `q = 1/(1+lossBB/tolBB)`.)*

Le verdict `correct/acceptable/erreur` reste affiché à l'utilisateur — il est
pédagogiquement utile et lisible. Il n'entre simplement plus dans le calcul.

---

## Ce qui reste à spécifier

| § | Sujet | État |
|---|---|---|
| 1-2 | Arbitrages | **tranchés par l'expérience** |
| 3 | Protocole anti-farm (5 stratégies A→E) | à simuler |
| 4 | 15 objets d'architecture | à concevoir |
| 5 | Curriculum | à dériver du contenu réellement existant |
| 6 | Ordonnanceur de révision | contrainte : sélectionner sans juger (facteur ≈ 100) |
| 7 | Difficulté adaptative | base mesurée disponible (9 axes pondérés) |
| 8 | Espace de situations efficace | mesures de couverture disponibles |
| 9 | Table des 29 fuites → compétences | dénominateurs déjà extraits |
| 10-12 | Tracker→coaching, progression, J1→J90 | à concevoir |
| 13 | Tests anti-exploitation | à écrire |

**Aucun fichier applicatif modifié.**

---

## Note de méthode

Le protocole B a d'abord produit un résultat plat (93-94 % partout) qui
contredisait le protocole A. Cause : `Spot.generate` résout le niveau par
`LEVELS[opt.level]`, donc attend une **clé texte** ; je passais l'objet. Les six
exécutions retombaient toutes sur `intermediaire` — je mesurais six fois la même
chose.

Consigné parce que c'est le mode de défaillance le plus dangereux de cette
phase : une expérience qui s'exécute sans erreur, produit des chiffres
plausibles, et ne mesure pas ce qu'elle prétend mesurer. La parade employée est
une assertion dans la boucle (`if (t.level !== LEVELS[k]) throw`) — toute
expérience de la Phase 4.1 doit en porter une.
