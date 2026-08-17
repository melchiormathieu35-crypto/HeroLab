# PHASE 4 — Synthèse de l'audit multi-agent

Onze agents, mandats disjoints. Quinze affirmations re-mesurées indépendamment
par l'orchestrateur (`audits/VERIFICATIONS_ORCHESTRATEUR.md`) : quinze
confirmées, dont une après une erreur de ma part. Aucun fichier applicatif
modifié.

---

## Le constat central

> **HeroLab n'est pas un produit creux qu'il faudrait remplir.
> C'est un produit débranché.**

Un motif unique revient dans neuf rapports sur onze : **un champ déclaratif porte
une promesse que rien ne lit.**

| Déclaré | Lu ? | Effet mesuré |
|---|---|---|
| `force3Bet` (mode Pots 3Bet) | non | 0,7 % de pots 3bet, comme le mode libre |
| `force4Bet` (mode Pots 4Bet) | non | 0,0 % de pots 4bet sur 3 200 mains |
| `stopAt` (mode Préflop) | à la génération seulement | 71 % de décisions **postflop** |
| `level.hint` | non | 2 niveaux annoncent une aide inexistante |
| `level.mode: "gto"` | non | le niveau GTO ne change que la tolérance |
| `opt.facing` | non | 48 % du drill « défendre ta BB » hors sujet |
| `BB_DEF` (339 mains) | Range Lab seulement | en jeu, la BB reçoit la range du CO |
| `daily.target`, `daily.best` | non | — |
| `Progress.data.streak` | calculé, jamais affiché | — |
| `hrstats` / `prstats` / `blstats` | rendus, sans lien entrant | 3 écrans inatteignables |
| `mastery.ok` | incrémenté jamais | paliers 2 à 5 inaccessibles |

C'est une bonne nouvelle stratégique : **rebrancher coûte bien moins cher que
créer**, et le risque est incomparablement plus faible.

---

## A. Forces actuelles

1. **Le moteur de cartes est irréprochable.** Distribution des textures de flop
   indiscernable du tirage exhaustif des 22 100 flops (écart max 0,23 point),
   48 classes de texture toutes atteintes, 0,7 % de doublons de mains sur
   200 mains jouées. *Rien à toucher.*
2. **Le feedback chiffré est de niveau semi-professionnel** : EV de toutes les
   options, équité combo par combo, blockers, MDF, cotes.
3. **Le tracker détecte 29 fuites** avec seuil d'échantillon minimum — il refuse
   de diagnostiquer sur 12 mains. Cette rigueur est rare.
4. **Le bilan de drill ciblé est le seul écran noté 5/5** sur les six questions
   d'orientation utilisateur. Il existe déjà : c'est le patron à généraliser.
5. **`Judge` est déterministe et rapide à l'échelle d'une décision** ; le journal
   `decisions[]` est propre (ts, verdict, lossBB, chosen, best).

## B. Faiblesses actuelles

**B1 — Le produit n'enregistre que l'échec.** `Progress.tags()` sort avant
d'émettre le moindre tag quand la décision est juste. Conséquences en cascade,
toutes mesurées :
- `mastery.ok` vaut 0 à vie → paliers « Familier / Solide / Maîtrisé » morts ;
- `tagStats` a `n === err` → **aucun taux**, donc aucune comparaison possible ;
- `tagStats.loss` est monotone → **une fuite ne peut mathématiquement pas
  reculer** → trois fonctionnalités écrites sont mortes (détection
  d'amélioration, titre « Tu progresses vraiment », badge « Correcteur ») ;
- sans dénominateur, la seule grandeur mesurable est un décompte → **tout le
  système de progression converge vers le volume**. Un joueur toujours faux
  atteint le niveau 8.

**B2 — Le Tracker est inaccessible sur mobile.** 0 onglet sur 9 à 360, 390 et
412 px ; 9 sur 9 dès 768. Le bouton menu est visible mais son clic ne fait rien.
8 vues, 59 indicateurs, 29 détections et l'exercice ciblé sont hors d'atteinte
pour la cible principale du produit.

**B3 — Le ciblage ne cible pas.** 29 fuites → **10 configurations d'exercice**.
Des fuites opposées partagent le même exercice (`cbet-low` avec `cbet-high`,
`bet-too-big` avec `bet-too-small`, `loose` avec `nit`). 8 drills sont
inadéquats : `no-checkraise` ne produit **aucun nœud de check-raise** sur
2 000 spots ; `multiway-overfold` (fuite au flop) génère 100 % de spots préflop.

**B4 — 90 % des erreurs sont invisibles.** Sur 600 décisions et 218 erreurs,
21 seulement reçoivent une étiquette. 4 catégories sur 10 se déclenchent.

**B5 — La vérité poker est mince et se contredit.** Matrice position × action :
**10 cellules couvertes sur 156** (6,4 %). 3bet et 4bet non déclinés (1 range
globale pour 15 couples). Aucune range n'est enseignée au joueur — elles servent
uniquement à modéliser l'adversaire. 12 contradictions chiffrées, dont : **la
range SB de référence (32,7 %) déclenche l'alerte `sb-loose` du produit
(seuil 32 %)**.

**B6 — Aucune adaptation.** Les 4 systèmes de difficulté n'ont que des points
d'écriture manuels. Le seul mouvement automatique est une rétrogradation
déclenchée par la bankroll, pas par la performance. Et le curseur « difficulté »
pèse **1,7 fois moins** que le choix du mode.

**B7 — Les parcours ne concluent pas.** Fin du Défi : le texte dit « regarde tes
décisions ratées », l'écran n'offre que « retour à l'accueil ». Sortie de lab :
aucun bilan alors que tout est enregistré. Import terminé : aucun lien vers le
diagnostic. Note produit sur les 6 questions d'orientation : **3,1/5**.

**B8 — Les 4 boutons de relance sont un seul enseignement.** Préflop, 100 % des
spots ont 2.5/3/4 bb dans la tolérance du verdict. Zéro overbet possible ni joué
(0 sur 2 110 mises adverses).

**B9 — Biais de génération non intentionnels.** UTG 6,3 % contre SB 27,3 %
(×4,3), dû à une boucle de rejet qui ne conserve que 71 % des spots en BB.
`multiway` ne produit jamais 3 sièges ; `deep` (150-300 bb) descend à 113 bb et
`short` (20-45 bb) monte à 57 bb — les plages se chevauchent.

**B10 — Deux taxonomies de fuites disjointes** : 10 côté moteur, 29 côté
tracker, **2 identifiants en commun**. 27 fuites sur 29 ne peuvent donc jamais
accumuler de maîtrise.

## C. À conserver sans y toucher

Moteur de cartes et textures · `HandEval` · `Judge` (sous réserve du §Risques) ·
le journal `decisions[]` · le bilan de drill ciblé (patron d'écran de fin) ·
`Journey` (historique réel) · les 3 labs · les succès `discipline` et `fixer` ·
les 12 avatars.

## D. À améliorer

Les 29 règles de fuites (garder les seuils, réparer les dénominateurs :
`no-checkraise`, `giveup-turn` et `cold-call` sur-déclenchent ; `giveup-turn` et
`turn-barrel-low` sont un **doublon strict** double-compté dans le coût total) ·
`Rating` (à décorréler de la difficulté choisie) · carrière (promotion par
examen plutôt que par bankroll) · série quotidienne (gels au lieu de remise à 1).

## E. À créer

1. **Modèle de compétences** — taxonomie unique réconciliant les deux
   vocabulaires (10 + 29).
2. **Score de maîtrise** par compétence, calculé sur réussite, difficulté,
   récence et variété.
3. **Répétition espacée** — unité = *situation paramétrée*, pas *fait*.
   Décroissance qui réduit la **confiance** sans réduire la **maîtrise** :
   on ne devient pas mauvais, on redevient incertain.
4. **Sélecteur adaptatif** — sous contrainte dure : `Judge.evaluate` coûte
   **74,5 ms** contre **0,48 ms** pour générer un spot. Toute sélection doit se
   faire sur des caractéristiques calculables **sans** juger.
5. **Filtre de nœud** dans la génération (`role`, `facing`, `street`, `players`) —
   c'est le verrou unique qui répare les 13 drills défaillants.
6. **Preuve** : relier chaque fuite détectée aux mains qui la démontrent.
7. **Écran de fin unique**, généralisé depuis le bilan de drill.

## F. Contenu manquant

3bet et 4bet par couple de positions (15 couples, 1 range aujourd'hui) ·
défense BB par branche (call / 3bet / fold) · défense SB (0 range) · cold-call
non-BB · squeeze (0 occurrence) · variation par profondeur de tapis
(`prior(20bb)` et `prior(300bb)` renvoient **la même range**) · aucune range de
référence postflop.

> **Règle non négociable** : aucune range ne sera inventée. Toute valeur
> nouvelle porte un champ `source` obligatoire, vérifié au build, et reste à
> valider par un joueur expert. Les 12 contradictions relevées opposent deux
> contenus **existants** : elles sont chiffrées et laissées ouvertes.

## G. Architecture

- **Injection de classe B** (démontrée) : un module ajouté **à la fin** du script
  du moteur partage sa portée lexicale et peut intercepter `Progress.record`,
  `Spot.generate`, `RangeModel.prior` — **sans modifier une ligne du moteur**.
  La recette Phase 3 (injection *avant*) est aveugle au moteur : les modules
  sont des `const`, invisibles depuis `window`.
- **Quatre abstractions**, chacune avec ≥ 2 usages : `P4.bus`, `P4.taxonomy`,
  `P4.state`, `P4.content`. Refusées : façade moteur, DSL de règles, registre de
  plugins, seconde couche de persistance.
- **Aucune nouvelle clé `localStorage`.** `APP_KEYS` (Phase 3) est figé sur liste
  blanche : une clé nouvelle échapperait au préfixage par identité et rouvrirait
  la fuite A→B. L'état Phase 4 vit sous `Player.data.p4`.
- **Budget** : ≤ 120 Ko (+7,9 %), vérifié au build. Le risque est le volume
  d'état (199 o/décision), pas le CPU.
- **Défaut Phase 3 à corriger dans la foulée** : `reloadEngine()` est un no-op
  (lit `window[nom]`), donc l'état mémoire de A est servi à B après une bascule
  de compte. Non déployé. Voir `audits/DEFAUT_PHASE3_reloadEngine.md`.

## H. Priorités

### P0 — Rendre vrai ce qui est déjà déclaré

Aucun contenu nouveau. Rien que du câblage, donc aucune décision de poker.

| # | Action | Débloque | Contrôle |
|---|---|---|---|
| P0.1 | **Instrumenter l'occasion** : émettre le contexte sur *chaque* décision, pas seulement sur les erreurs | maîtrise, taux, fenêtres, 4 écrans qui affichent du faux | 30 décisions correctes → `ok > 0` |
| P0.2 | **Fenêtrer les agrégats** (14 j / N dernières) au lieu du cumul à vie | « une fuite peut reculer », détection d'amélioration, badge, missions | une fuite corrigée doit décroître |
| P0.3 | **Filtre de nœud** dans la génération (`facing`, `street`, `role`, `players`) | 13 drills défaillants, `opt.facing`, les 3 modes fantômes | drills défensifs : 10-13 % → ~100 % |
| P0.4 | **Rebrancher le Tracker sur mobile** | 8 vues, 59 KPI, 29 fuites, le drill | 9 onglets atteignables à 360 px |
| P0.5 | **Écran de fin unique** généralisé depuis le bilan de drill | fin du Défi, sortie des labs, écrans orphelins | aucun parcours sans « et ensuite » |

### P1 — Rendre le produit adaptatif
Modèle de compétences unifié · score de maîtrise · sélecteur adaptatif
(bande morte, hystérésis, portes) · preuve par les mains · répétition espacée
invisible.

### P2 — Approfondir le contenu
3bet/4bet par couple de positions · défense BB par branche · défense SB ·
variation par profondeur · sizings réellement distincts (dont overbet).

### P3 — Progression et rétention
Progression unifiée (7 échelles nommées aujourd'hui, dont 3 « niveaux ») ·
promotion par examen · série saine avec gels · Daily Session composée.

---

## Risques et points ouverts

1. **`Judge` est la vérité terrain, et c'est un modèle.** Le score de maîtrise
   mesurera l'**accord avec `Judge`**, jamais la justesse. `Judge` étant
   déterministe, un biais systématique ne sera pas moyenné par le bruit : il sera
   certifié comme maîtrise. **C'est le risque le plus grave de la Phase 4**, et il
   argumente pour traiter B5 (justesse des ranges) avant d'afficher toute
   promesse de maîtrise.
2. **Le contrôleur adaptatif ne tient pas encore sa cible.** Il supprime l'ennui
   et le décrochage (démontré), mais se cale à 88-91 % là où la bande vise
   70-85 %. À ne pas annoncer avant mesure.
3. **Constantes non calibrées** (fenêtres, seuils, intervalles) : aucune donnée
   utilisateur réelle. Livrer conservateur et instrumenter.
4. **Changer la partition des compétences invalide l'historique.** Prévoir un
   champ de version dès le premier jour.
5. **Mes propres suites de test ont un angle mort** : elles vérifient des
   propriétés du rendu, jamais qu'un parcours soit accomplissable. Deux défauts
   majeurs (Tracker mobile, `reloadEngine`) sont passés au travers. La Phase 4
   doit ajouter des tests de **parcours**.

## Critère de sortie

La Phase 4 ne se termine pas quand les fonctionnalités sont codées, mais quand
cette boucle tient bout à bout et est **mesurée** :

```
décision → mesure (avec dénominateur) → maîtrise → sélection adaptée
   → révision espacée → progression visible → nouvelle décision plus difficile
```

Aujourd'hui, la première flèche est cassée : la mesure n'enregistre que l'échec.
Tant que P0.1 n'est pas fait, tout le reste est cosmétique.
