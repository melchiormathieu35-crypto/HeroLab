# §3 — Protocole anti-farm

Six politiques, 1 000 décisions chacune, mains jouées jusqu'à leur terme.
Chaque décision est notée **deux fois sur la même partie** : selon le verdict
(système actuel) et selon `q = exp(−lossBB / 1bb)` (arbitrage n°2).

Script : `experiments/antifarm.js` · Données : `experiments/antifarm-1000.json`
Garde active : `if (t.level !== LEVELS[clé]) throw` à chaque tirage.

---

## Résultats à 1 000 décisions

| Stratégie | bb perdu/déc. | Verdict OK | **M actuelle** | **M proposée** | Familles | Répétition | Positions |
|---|---|---|---|---|---|---|---|
| **compétente** (réf.) | 0,000 | 100 % | 1,000 | 1,000 | 164 | 58 % | 6 |
| A — aléatoire | 6,192 | 49,9 % | 0,499 | 0,419 | 209 | 47 % | 6 |
| B — passive | 2,250 | 67,7 % | 0,677 | **0,592** | 232 | 36 % | 6 |
| C — tolérance | 0,005 | 100 % | 1,000 | 0,995 | 174 | 58 % | 6 |
| **D — répétition** | **0,000** | **100 %** | **1,000** | **1,000** | **72** | **73 %** | **3** |
| E — niveau facile | 1,622 | 78,6 % | 0,786 | **0,620** | 213 | 45 % | 6 |

Progression 50 → 1 000 : les écarts sont **stables dès 200 décisions**. Aucune
stratégie ne converge vers la référence avec le volume ; les positions relatives
sont acquises tôt.

---

## Ce que la correction ferme

**B (passive) et E (niveau facile) sont neutralisées.**

- E est le cas le plus démonstratif : elle *paraît* correcte à **78,6 %** tout en
  perdant **1,622 bb par décision**. La notation au verdict lui accorde 0,786 ;
  la notation au coût la ramène à **0,620**. L'écart de 0,166 est exactement le
  privilège que lui offrait la tolérance indulgente du niveau débutant.
- B perd 2,250 bb/décision pour un verdict à 67,7 % : 0,677 → **0,592**.

Le vecteur « choisir un niveau facile » ne rapporte plus rien.

## Ce que la correction ne ferme pas — la faille D

**D obtient 1,000 aux deux formules.** Elle est indétectable par toute mesure de
qualité de décision, pour une raison simple :

> **D ne joue pas mal. D joue étroit.**

Elle restreint sa génération à une famille facile (préflop, position tardive) et
y joue parfaitement. Sa signature est ailleurs :

| | compétente | D | écart |
|---|---|---|---|
| Familles de situations | 164 | **72** | **−56 %** |
| Répétition exacte | 58 % | **73 %** | +15 pts |
| Positions rencontrées | 6 | **3** | **−50 %** |

### Mécanisme exact

Rien n'est cassé dans le code : c'est une conséquence structurelle. La maîtrise
est un **agrégat de qualité sans domaine de définition**. Un taux de réussite ne
porte aucune information sur *ce sur quoi* il a été obtenu. Tant que la maîtrise
est un scalaire global, jouer 1 000 fois le même spot facile et jouer 1 000 spots
variés produisent le même nombre.

---

## Le piège que je n'avais pas anticipé

**La diversité rencontrée est anti-corrélée avec la qualité du jeu.**

| Stratégie | Familles vues | bb perdu |
|---|---|---|
| B passive | **232** | 2,250 |
| A aléatoire | 209 | 6,192 |
| compétente | **164** | 0,000 |

Le joueur compétent voit **30 % de situations en moins** que le joueur passif.
Explication : bien jouer, c'est souvent se coucher tôt ou clore la main ; mal
jouer prolonge les mains et engendre plus de nœuds postflop variés.

**Conséquence de conception, décisive :** toute solution qui exigerait une
« couverture minimale » comme condition de maîtrise **pénaliserait le bon joueur
et récompenserait le mauvais**. Un seuil de couverture global est donc à
proscrire. C'est précisément le genre de correctif qui aurait passé le test D
tout en dégradant le produit.

---

## Solutions candidates

### Candidate 1 — Maîtrise par compétence, avec occasions propres

1. **Hypothèse** — D n'est exploitable que parce que la maîtrise est un scalaire
   global. Rendue *par compétence*, chacune avec son propre compteur d'occasions
   (§1), D ne peut maximiser que les compétences qu'elle pratique réellement.
2. **Modification conceptuelle** — plus de score global. `mastery[skill]` avec
   `occasions[skill]`. La progression du curriculum exige un seuil de maîtrise
   sur un **ensemble** de compétences, pas une moyenne.
3. **Test** — rejouer D et mesurer le nombre de compétences atteignant le seuil.
   Attendu : D maximise ~3 compétences positionnelles et reste à zéro ailleurs,
   faute d'occasions.
4. **Résultat** — *non encore exécuté* (exige la table des compétences, §5).
5. **Régression possible** — aucune sur B/E, qui restent traitées par le coût.
   Risque : un joueur légitimement spécialisé (tournois courts) progresse moins.
6. **Décision** — **candidate retenue en tête.** Elle ne pénalise pas le bon
   joueur, ne fabrique aucun seuil arbitraire, et découle de l'architecture
   plutôt que d'un correctif ajouté.

### Candidate 2 — Pondération par difficulté du spot

1. **Hypothèse** — si chaque occasion est pondérée par la difficulté mesurée du
   spot, farmer des spots faciles rapporte proportionnellement moins.
2. **Modification** — `M = Σ(wᵢ · qᵢ) / Σwᵢ` avec `wᵢ` la difficulté (9 axes déjà
   pondérés et mesurés en audit).
3. **Test** — rejouer D avec pondération.
4. **Résultat** — *non exécuté*. **Réserve sérieuse** : une moyenne pondérée
   reste une moyenne. D jouant *parfaitement*, tous ses `qᵢ` valent 1 et la
   moyenne pondérée vaut 1 quelle que soit la pondération. **Cette candidate ne
   peut pas fonctionner seule** — la démonstration est algébrique, pas empirique.
5. **Régression** — sans objet.
6. **Décision** — **rejetée comme solution autonome**, conservée comme
   complément de la candidate 1 (pour comparer deux joueurs à couverture égale).

### Candidate 3 — Décroissance par absence d'occasion récente

1. **Hypothèse** — si la confiance d'une compétence décroît faute d'occasions
   récentes, D voit s'éroder tout ce qu'elle ne pratique pas.
2. **Modification** — deux grandeurs distinctes : `maîtrise` (ce qu'on sait) et
   `confiance` (à quel point la mesure est fraîche). Seule la confiance décroît.
3. **Test** — simuler D sur 30 jours et mesurer la confiance moyenne.
4. **Résultat** — *non exécuté*.
5. **Régression** — risque de punir une absence, ce qui heurte la règle « aucun
   dark pattern ». Atténué si seule la **confiance** baisse, jamais la maîtrise.
6. **Décision** — **retenue en complément**, pas comme parade principale : elle
   traite l'oubli, pas l'étroitesse.

### Candidate 4 — Sélection imposée par l'ordonnanceur

1. **Hypothèse** — si c'est le système qui choisit les spots, D n'existe plus.
2. **Modification** — l'utilisateur ne choisit plus librement son mode en
   session guidée.
3. **Test** — sans objet.
4. **Résultat** — supprime le symptôme, pas la cause : le mode libre doit rester
   libre, et la maîtrise doit rester juste **aussi** en jeu libre.
5. **Régression** — coût produit important (perte d'autonomie).
6. **Décision** — **rejetée** comme parade. L'ordonnanceur est utile (§6) mais ne
   doit pas être la seule défense.

---

## Critères d'acceptation définitifs

Un système de progression est accepté si, sur 1 000 décisions :

| # | Critère | Seuil |
|---|---|---|
| AC1 | Aucune stratégie perdant > 1 bb/décision n'atteint une maîtrise > 0,70 | mesuré |
| AC2 | Le changement de niveau ne modifie pas la maîtrise de plus de ±0,03 à jeu identique | protocole A du §2 |
| AC3 | Une stratégie couvrant < 50 % des familles de la référence ne peut valider plus de 40 % des compétences du curriculum | à mesurer après §5 |
| AC4 | Le joueur compétent n'est **jamais** pénalisé par un critère de couverture | vérifié contre la référence, pas dans l'absolu |
| AC5 | Toute nouvelle défense est testée contre les 5 stratégies **et** contre la référence | régression obligatoire |

AC4 est la garde issue du piège ci-dessus : c'est le critère qui empêche de
« réussir » le test D en dégradant le produit.

---

## Ce que ce protocole n'a pas démontré

- **La stratégie C n'a pas trouvé de surface d'attaque** : jouer la pire option
  encore acceptable coûte 0,005 bb/décision. La bande de tolérance est étroite
  en EV. Je ne présente donc pas C comme « neutralisée par la correction » —
  elle n'était pas un exploit. Mon implémentation de C est peut-être trop
  timide ; à ré-attaquer par la contre-expérience indépendante.
- **Aucune candidate n'est encore mesurée.** Les candidates 1 et 3 exigent la
  table des compétences (§5). Elles sont documentées comme hypothèses, pas comme
  résultats.
- **XP, niveau, rating et carrière ne sont pas encore mesurés** par cette
  simulation : elle mesure la maîtrise et la couverture. Les autres compteurs
  relèvent de la contre-expérience indépendante et du §11.

---

## Questions à trancher avant le §4

1. **Une compétence peut-elle être maîtrisée sans être pratiquée récemment ?**
   Détermine si la confiance est une seconde dimension ou un facteur de la
   maîtrise.
2. **Le curriculum exige-t-il une largeur, ou tolère-t-il la spécialisation ?**
   La candidate 1 suppose une largeur exigée. Un joueur qui ne veut travailler
   que sa défense de blinde doit-il pouvoir « terminer » le curriculum ?
3. **Le mode libre alimente-t-il la maîtrise au même titre que les sessions
   guidées ?** Si oui, D reste possible en mode libre et la candidate 1 est la
   seule défense. Si non, il faut assumer que le jeu libre ne fait pas progresser.
4. **Quelle granularité pour une compétence ?** 29 fuites, ~48 cellules
   mesurées, 72 à 164 familles observées : trois échelles incompatibles. La
   réponse conditionne le seuil d'occasions et donc la faisabilité statistique
   (l'audit a montré que seules 28 cellules sur 48 atteignent un effectif
   suffisant à 3 000 décisions).

---

*Contre-expérience indépendante en cours — un agent sans accès à cette
spécification conçoit son propre protocole. Ses conclusions seront intégrées ici
avant clôture du §3.*

---

# Contre-expérience indépendante — résultats

L'agent n'a lu ni la spécification ni mes scripts (vérifié : `01_ARBITRAGES.md`
et `experiments/*` exclus de son mandat, absence confirmée dans son rapport).
Il a conçu ses propres stratégies et ses propres métriques.

**Il a trouvé une faille strictement pire que la mienne, et elle invalide ma
fonction de qualité.**

## La stratégie que j'avais manquée : le fold-bot

Ma stratégie B priorisait `check → call → fold`. La sienne : `fold / check`,
sans jamais suivre. Vérifié par mes soins, 400 décisions, niveau débutant :

| Stratégie | bb perdu/déc. | Verdict OK | M proposée (c=1) |
|---|---|---|---|
| B — la mienne | 1,862 | 77,3 % | 0,602 |
| **fold-bot** | **0,323** | **93,8 %** | **0,821** |

Suivre coûte cher quand il fallait passer ; **passer ne coûte presque jamais
cher**. Le fold-bot fait donc beaucoup de petites erreurs bon marché au lieu de
quelques grosses. Mon critère AC1 (« perdre plus d'1 bb/décision ») ne le voit
pas : il ne perd que 0,32.

L'agent le chiffre en conditions de carrière : **88 % de l'XP du jeu parfait**,
badges *Précision*, *Haute précision* et *Discipline* obtenus, **1,64 fois moins
de clics**, et un rapport de session qui lui dit « continue exactement comme ça »
— en perdant 2 383 bb.

## Pourquoi ma fonction de qualité échoue

Balayage de la constante `c` sur les mêmes données :

| c | compétent | fold-bot | passif |
|---|---|---|---|
| 1,00 | 1,000 | 0,801 | 0,591 |
| 0,25 | 1,000 | 0,647 | 0,441 |
| **0,05** | 1,000 | **0,564** | 0,384 |

**Aucun réglage ne fonctionne.** Même à `c = 0,05`, le fold-bot garde 0,564. La
raison est structurelle : sa distribution de pertes est **bimodale** — une
majorité de décisions à coût nul (passer *est* souvent correct) et une minorité
très coûteuses. Une moyenne de qualité par décision est dominée par les zéros.

> **Une moyenne de qualité par décision ne peut pas punir une stratégie qui a
> raison la plupart du temps et tort catastrophiquement de temps en temps.**
> Or c'est exactement le profil du joueur perdant au poker.

## Correction de l'arbitrage n°2

La **forme** était juste (mesurer sur `lossBB`, pas sur le verdict). L'**agrégation**
était fausse. Il ne faut pas moyenner une qualité, il faut mesurer un **taux de
perte cumulé** — la grandeur native du poker :

```
M(compétence) = exp( − bbPerdues100 / K )      K = 20 bb/100
```

| Stratégie | bb/100 décisions | M |
|---|---|---|
| compétente | 0,0 | **1,000** |
| fold-bot | 38,0 | **0,150** |
| passive | 167,4 | 0,000 |
| aléatoire | 619,2 | 0,000 |

Repère : un gagnant en micro-limites réalise +2 à +8 bb/100. Perdre 38 bb/100
est une hémorragie ; la formule doit le dire, et elle le dit.

Cette formulation a un second mérite : elle est **directement lisible par un
joueur de poker**, contrairement à un score abstrait entre 0 et 1.

## Les 13 exploitations trouvées par l'agent

Au-delà du fold-bot, et toutes chiffrées :

- **L'EV affichée ne compte que les erreurs** : le fold-bot occulte **51,3 %** de
  sa perte réelle, et obtient 91/100 sur l'axe « Discipline ».
- **Le rating est atteignable sans jouer** : 3 axes sur 5 viennent des labs, dont
  les résumés ignorent la difficulté. Rating agrégé accessible en cliquant la
  première option : **1 819, palier « Avancé »**.
- **Le filet de banqueroute annule la sanction** : le maniaque perd 21 244 bb et
  termine avec sa bankroll de départ.
- **La promotion NL2→NL5 exige +5 500 bb**, soit 220 bb/100 sur le volume
  minimal — **110 fois** le winrate que le produit affiche lui-même comme cible.
  Le seul objectif non exploitable est donc inatteignable.
- Confirmation indépendante (3ᵉ) du blocage de la maîtrise, et corollaire
  nouveau : **la barre de mission est un compteur d'échecs** — l'oracle affiche
  0 mission, la rotation mécanique en affiche 4 dont une à 100 %.

**Huit axes sans exploitation trouvée** sont documentés : sanctuarisation des
spots Studio, verrous de volume des objectifs, facteur de confiance du rating,
résistance du juge au sizing, sanction du tapis systématique, absence de voie
d'écriture contournant le juge, absence de cache de spot, et la promotion de
carrière — seul objectif adossé à l'argent réellement gagné.

## Critères d'acceptation — révisés

| # | Critère | Seuil |
|---|---|---|
| **AC1** | *(remplacé)* Toute stratégie perdant plus de **15 bb/100** plafonne à M < 0,50 | fold-bot : 38 bb/100 → 0,150 ✔ |
| AC2 | Le niveau ne modifie pas M de plus de ±0,03 à jeu identique | protocole A du §2 ✔ |
| AC3 | Couverture < 50 % de la référence → < 40 % des compétences validées | après §5 |
| AC4 | Le joueur compétent n'est jamais pénalisé par un critère de couverture | garde anti-piège ✔ |
| AC5 | Toute défense testée contre les 5 stratégies **et** contre le fold-bot | le fold-bot rejoint le jeu de test |
| **AC6** | *(nouveau)* L'EV affichée à l'utilisateur doit égaler l'EV réellement perdue | écart mesuré : 51,3 % |

## Ce que cette contre-expérience démontre sur la méthode

J'avais conçu mes cinq stratégies **et** ma fonction de notation. Elles se sont
révélées complices sans que je le voie : mes stratégies faibles perdaient assez
(1,8 à 6,2 bb/décision) pour que ma formule les punisse. Le fold-bot, que je
n'avais pas imaginé, perd dix fois moins tout en progressant presque aussi vite.

C'est précisément le biais que la contre-expérience à l'aveugle devait détecter,
et elle l'a détecté. Sans elle, j'aurais présenté une formule validée par un test
qu'elle était construite pour réussir.
