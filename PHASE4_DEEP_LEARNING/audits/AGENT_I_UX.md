# AGENT I — Audit UX / Product Design

**Cible** : `VERSION_PRODUCTION/herolab.html`
**Méthode** : produit ouvert dans Chromium (Playwright), navigué et joué réellement.
Aucun fichier applicatif modifié. Tous les chiffres ci-dessous sont **mesurés**, pas estimés.

| Sonde | Fichier | Ce qu'elle mesure |
|---|---|---|
| `ux_probe.js` | captures 3 tailles × 15 vues | inventaire visuel |
| `ux_onboarding.js` | `onboarding.json` | écrans / gestes avant la 1re décision |
| `ux_flow.js` | `flow-log.txt` | boucle décision → analyse → résultat, défi du jour de bout en bout |
| `ux_ends.js` | `ends-log.txt` | fins de parcours : 3 labs, session carrière (50 mains jouées), leaks, tracker, stats |
| `ux_collisions.js` | `collisions.json` | collisions géométriques sur la table, profondeur de l'écran d'analyse (25 mains × 3 tailles) |
| `ux_coherence.js` | `coherence-log.txt` | vocabulaire des composants, vues sans action, hauteurs |
| `ux_tracker_reach.js` / `ux_tracker_nav.js` | — | accessibilité réelle de la navigation du Tracker |
| `ux_lab_exit.js`, `ux_empty.js`, `ux_overflow.js` | — | sorties de lab, états vides, débordement horizontal |

Captures : `screens/` — 3 tailles (360×800, 390×844, 412×915) pour l'inventaire,
390×844 pour les parcours.

Les correctifs mobiles de Phase 2 (44 px, plancher typo, débordement) ne sont pas
re-signalés. Une seule exception documentée en §7, parce qu'elle n'apparaît qu'avec des
données et échappait donc au contrôle Phase 2.

---

## 1. Onboarding — comptage réel

**4 écrans, 3 taps, 2 scrolls obligatoires, 1 saisie** avant la première décision.
Identique aux trois tailles.

| # | Écran | Hauteur contenu / écran | Geste | Remarque mesurée |
|---|---|---|---|---|
| 1 | Overlay onboarding | 1329 / 844 px | saisie + **scroll** + tap | CTA « Créer mon profil » à y = 927 / 930 / 968 px → **sous la ligne de flottaison aux 3 tailles**. 1 champ obligatoire (pseudo), 2 choix décoratifs (12 symboles, 3 mentors) placés **avant** le bouton. |
| 2 | Accueil | 2048 / 844 px | **scroll** + tap | La carte « Table · COMMENCE ICI » est à y = 1191 px, soit 1,4 écran plus bas. 6 CTA concurrents ; le seul visible sans scroll est « Défi du jour », qui n'est pas celui marqué « commence ici ». |
| 3 | Interstitiel « Chaque main est nouvelle. » | 514 px | tap | 63 mots de manifeste entre l'utilisateur et le produit. Aucune information dont il ait besoin à cet instant. |
| 4 | Table — 1re décision | 918 / 844 px | tap | 4 à 6 options. **Pas de HUD, pas de compteur, pas d'objectif.** Niveau imposé : `intermediaire`. Mode : `libre`. |

Deux observations de fond :

- **Le niveau par défaut est « Intermédiaire »** (`App.cfg.level = "intermediaire"`, l. 6535)
  pour un joueur qui a zéro décision d'historique. Or `LEVELS.debutant` porte `hint: true`
  (l. 3712) : le système d'indices existe et est **désactivé précisément pour ceux qui en
  ont besoin**. Sur une session de 50 mains jouée au hasard, la sonde relève 43 % de
  décisions correctes et un verdict « Erreur » dès la première main. Le premier retour
  produit est une sanction.
- **Trois choix identitaires (pseudo, symbole, mentor) sont demandés avant la moindre
  preuve de valeur.** Duolingo demande la langue — l'information dont il a besoin pour
  servir le premier exercice. HeroLab demande un avatar. L'écran 1 pourrait tenir en un
  champ ; le reste appartient à « Mon profil ».

**Chemin idéal mesurable : 1 écran, 1 tap.** L'écart est de 3 écrans et 2 scrolls.

---

## 2. Matrice vues × 6 questions

Barème 0–5. `Q1 Où suis-je ? · Q2 Pourquoi ici ? · Q3 Que faire ? · Q4 En quoi ça m'aide ? ·
Q5 Qu'ai-je gagné ? · Q6 Et ensuite ?`

| Vue | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Moy. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Onboarding | 5 | 4 | 3 | 3 | 1 | 3 | **3,2** |
| Accueil | 5 | 3 | 2 | 4 | 2 | 3 | **3,2** |
| Table — interstitiel | 4 | 3 | 5 | 4 | 0 | 2 | **3,0** |
| **Table — décision (partie libre)** | 4 | **1** | 4 | 2 | **1** | **1** | **2,2** |
| Analyse après décision (review) | 4 | 3 | 2 | 5 | 4 | 2 | **3,3** |
| Fin de main (result) | 4 | 2 | 4 | 2 | 3 | 2 | **2,8** |
| Défi du jour — intro | 5 | 4 | 5 | 4 | 1 | 3 | **3,7** |
| **Défi du jour — fin** | 4 | 3 | **0** | 2 | 4 | **0** | **2,2** |
| Carrière — accueil | 5 | 4 | 4 | 4 | 3 | 4 | **4,0** |
| Session en cours (HUD) | 5 | 5 | 4 | 3 | 4 | 4 | **4,2** |
| Rapport de session | 5 | 5 | 3 | 5 | 5 | 3 | **4,3** |
| Range Detective — intro | 5 | 4 | 5 | 5 | 2 | 3 | **4,0** |
| Range Detective — révélation | 4 | 4 | 4 | 5 | 3 | 3 | **3,8** |
| **Lab après « Terminer » (HR / PR / BL)** | 2 | 1 | 2 | 2 | **1** | **1** | **1,5** |
| Profiling Lab — intro | 5 | 4 | 5 | 5 | 2 | 3 | **4,0** |
| Blocker Finder — intro | 4 | 4 | 4 | 5 | 2 | 3 | **3,7** |
| Mes leaks | 5 | 4 | 2 | 5 | 3 | 2 | **3,5** |
| **Statistiques** | 4 | 2 | **0** | 2 | 3 | **0** | **1,8** |
| Mon évolution (état vide) | 5 | 4 | 5 | 5 | 1 | 4 | **4,0** |
| **Tracker** | **0** | 1 | 1 | 1 | 0 | **0** | **0,5** |
| Profils adverses / Notions | 4 | 3 | **0** | 4 | 1 | **0** | **2,0** |
| « Travailler mon leak » (depuis Accueil / Mes leaks) | 3 | 3 | 4 | 3 | 1 | 1 | **2,5** |
| **Entraînement ciblé — bilan (via Tracker)** | 5 | 5 | 5 | 5 | 5 | 5 | **5,0** |

**Moyenne produit : 3,1 / 5.** Écart-type très élevé : de 0,5 (Tracker) à 5,0 (bilan de
drill). Le produit n'a pas un problème de qualité moyenne, il a un problème de
**dispersion** : les mêmes intentions sont réalisées trois fois, une fois très bien et deux
fois mal, et c'est presque toujours la mauvaise version qui est atteignable.

### Justifications des notes basses

- **Table — décision (Q2 = 1, Q5 = 1, Q6 = 1).** En partie libre — l'entrée marquée
  « COMMENCE ICI » — il n'existe ni bandeau, ni compteur, ni cible, ni fin. Le HUD de
  progression est câblé pour la carrière (`.sess-hud`, l. 7444) et pour le défi du jour
  (`.daily-hud`, l. 7430) mais **pas pour le mode par défaut**. La question « pourquoi
  suis-je ici » n'a littéralement pas de réponse à l'écran : il n'y a pas de session, donc
  pas de progression, donc pas de fin.
- **Défi du jour — fin (Q3 = 0, Q6 = 0).** Détaillé en §3.
- **Lab après « Terminer » (Q5 = 1, Q6 = 1).** Détaillé en §3.
- **Statistiques (Q3 = 0, Q6 = 0).** Six blocs de chiffres, **zéro bouton** (`ux_coherence.js`).
  Le pire taux de la page : « Turn 29 % · 274,5 bb perdues ». L'utilisateur voit exactement
  où il perd de l'argent et n'a aucun moyen d'agir depuis cet écran. Un mode « Turn » existe
  pourtant dans `MODES`.
- **Profils adverses / Notions (Q3 = 0, Q6 = 0).** 4437 px (5,3 écrans) et 2467 px
  (2,9 écrans) de contenu de référence, zéro bouton. On décrit neuf profils avec précision
  et on n'offre jamais « affronter un LAG maintenant ».
- **Tracker (Q1 = 0).** Détaillé en §3.

---

## 3. Les 5 ruptures de parcours les plus graves

### R1 — La navigation du Tracker est hors écran sur mobile : 8 vues sur 9 sont inatteignables

Mesuré (`ux_tracker_reach.js`) :

| Largeur | `transform` de `#sidebar` | x de l'item de nav | Atteignable |
|---|---|---|---|
| 360 | `translate(-332, 0)` | −308 → −150 | **non** |
| 390 | `translate(-362, 0)` | −338 → −180 | **non** |
| 412 | `translate(-384, 0)` | −360 → −202 | **non** |
| 768 | aucune | 24 → 182 | oui |
| 1200 | aucune | 244 → 402 | oui |

Le tiroir de navigation de Feutre est translaté hors champ mais reste `position: static` :
il **occupe 375 à 451 px de hauteur invisible** en tête de la vue. Le burger qui l'ouvrirait
a été volontairement neutralisé à l'intégration (`FT.openMenu = function () {};`, ~l. 16400)
sans qu'aucune navigation de remplacement ne soit fournie.

Conséquences, dans l'ordre de gravité :

1. Taper « Tracker » affiche **un écran entièrement vide** ; il faut scroller ~740 px de
   néant avant de voir quoi que ce soit (`screens/61-tracker.png`).
2. Les 8 autres vues du Tracker — tableau de bord, graphiques, préflop, postflop, positions,
   analyse, review, mains, soit les **59 KPI** de l'inventaire — sont **définitivement
   inaccessibles sur mobile**. Le seul écran servi est l'import.
3. Le seul chemin vers l'entraînement ciblé de 10 spots (le meilleur écran du produit, R4)
   passe par ces vues : il est donc lui aussi coupé sur mobile.

Ce n'est pas un défaut cosmétique, c'est une amputation fonctionnelle qui ne se voit pas
sur un poste de développement.

### R2 — La fin du Défi du jour est une impasse qui se contredit elle-même

Écran mesuré (`screens/22-daily-end.png`) : anneau `5/10`, titre « Défi du jour terminé »,
puis ce texte, produit par `App.dailyVerdict()` (l. 7150) :

> « Score correct. **Regarde les décisions ratées** : c'est là que se trouve la marge. »

Un seul bouton existe : `App.go('home')`. **L'écran demande explicitement une action qu'il
rend impossible.** Il n'existe aucun moyen de revoir les 5 décisions ratées : ni liste, ni
rejeu, ni lien vers « Mes leaks », ni lien vers un entraînement ciblé. Les trois autres
variantes du verdict font la même promesse (« quelques spots à revoir », « ce sont
justement les spots où tu perds le plus qu'il faut retravailler ») avec la même sortie
unique.

S'y ajoute que le contenu occupe 890 px sur 1748 px de page : **la moitié inférieure de
l'écran est vide au moment exact où la motivation est maximale.** C'est la place d'un
« Rejouer ces 5 spots », d'une série, d'un cap. Duolingo place là trois choses ; HeroLab en
place zéro.

Note : le champ `streak` existe et est calculé (`daily.streak`), mais tant qu'il vaut 1 la
seule phrase servie est « Reviens demain pour lancer une série » — une promesse différée,
jamais une récompense présente.

### R3 — « Terminer » un lab ramène à la page marketing, sans score de la série

Les trois labs partagent la même sortie (`HRUI.quit` l. 10659, `PRUI.quit` l. 12374,
`BLUI.quit` l. 13625) : remise à `null` du spot, `render()`, et l'utilisateur retombe sur
l'écran d'accueil du lab — titre publicitaire, lede de vente, bouton « Commencer un
exercice ». Mesuré après trois exercices de Blocker Finder (`ux_lab_exit.js`) :

- Premières lignes de l'écran : `Exercices / Combo Calculator / LE LABORATOIRE DES
  BLOQUEURS / Blocker Finder`. Le produit se re-présente à quelqu'un qui vient de
  travailler dedans.
- La carte « Ta progression » est à **y = 970 px**, soit 126 px sous la ligne de
  flottaison, et n'affiche que des cumuls à vie — jamais « tu viens d'en faire 3, voici
  lesquels ».
- **Aucun bilan de série.** Les données sont pourtant enregistrées spot par spot
  (`HRStats.record`, `PRStats.record`, `BLStats.record`).

Pire : les pages `hrstats`, `prstats`, `blstats` sont **entièrement implémentées**
(courbes, sparklines, forces/faiblesses, précision par position et par profil), déclarées
dans `App.TITLES` et routées dans `App.render()` — et **aucun élément de l'interface n'y
mène**. Une recherche exhaustive sur `hrstats|prstats|blstats` ne retourne que trois
occurrences : les titres et le routeur. Le lien sortant a été construit (l'état vide de
`hrstats` propose « Aller au mode ») ; le lien entrant, jamais. Trois pages de statistiques
complètes sont du code mort du point de vue de l'utilisateur.

Enfin, les labs n'ont **aucune longueur définie** : HR et BL enchaînent des spots à
l'infini. Il n'existe pas d'unité « une séance », donc pas de fin, donc rien à célébrer.

### R4 — Deux « travailler mon leak » incompatibles : le bon est inaccessible, l'atteignable n'a pas de fin

| | `App.trainLeak()` (l. 8220) | `App.drillLeak(id)` (l. 8328) |
|---|---|---|
| Atteint depuis | Accueil, Mes leaks | **Tracker uniquement** → coupé sur mobile (R1) |
| Format | flux **infini** de mains | **10 spots** bornés |
| Compteur à l'écran | aucun | non mesuré (bandeau absent) mais `i / total` tenu |
| Écran de fin | **aucun** | score, mention, message adapté, **« Refaire 10 spots » + « Retour au diagnostic »** |
| Effet de bord | écrase `App.cfg.mode` en `"cible"` **silencieusement** et durablement | copie locale, `App.cfg` préservé |

L'écran de fin de `drillLeak` est **le seul du produit à noter 5/5 sur les six axes** : il
dit où on est, pourquoi, ce qu'on a gagné, ce que ça vaut, et il propose une boucle
(refaire) *et* une sortie (diagnostic). C'est le modèle que le reste du produit devrait
copier — et il est derrière une porte fermée.

Le second point mérite d'être noté : `trainLeak` réécrit `App.cfg.mode` alors que le code
du défi du jour prend explicitement soin de ne pas le faire, avec un commentaire qui
explique pourquoi (l. 7168 : *« sinon le mode choisi par le joueur serait écrasé
durablement »*). La même précaution n'a pas été appliquée au chemin voisin. L'utilisateur
tape « Travailler ça maintenant » et sa pastille de mode change définitivement sans qu'on
le lui dise.

### R5 — Les vues de diagnostic ne mènent nulle part

| Vue | Hauteur | Boutons | Ce qu'elle montre |
|---|---|---|---|
| **Statistiques** | 163 px (vide) / 1900 px (pleine) | **0** | 6 KPI, précision par street, par position, courbe |
| **Mes leaks** (à vide) | 207 px | **0** | « 0 / 30 » |
| **Mes leaks** (pleine) | — | **1** | 4 leaks décrits, **une seule action**, sur le premier |
| **Profils adverses** | 4437 px | **0** | 9 profils, VPIP/PFR/3Bet/AF, tells |
| **Notions** | 2467 px | **0** | glossaire complet |

`Mes leaks` est le cas le plus net : la sonde relève 4 tendances détectées, chacune assortie
d'une ligne « Correction — … », et un unique bouton « Travailler mon principal leak »
(l. 8009). Les leaks n° 2, 3 et 4 sont **diagnostiqués, expliqués, corrigés en texte, et
inactionnables**. On dit au joueur ce qu'il fait mal trois fois de suite sans lui donner de
prise.

Incohérence aggravante : les états vides de `hrstats`, `prstats`, `blstats` et de
`Mon évolution` ont tous un CTA de sortie (« Aller au mode », « Jouer quelques mains »).
Ceux de `stats`, `leaks`, `profiles`, `theory` n'en ont aucun. **Le même motif est appliqué
correctement dans 4 vues sur 8.**

---

## 4. Densité d'information

Le poker est dense par nature. La question n'est pas « y a-t-il beaucoup de chiffres » mais
« l'interface hiérarchise-t-elle ou empile-t-elle ». Mesures sur 25 mains × 3 tailles
(`collisions.json`) :

### 4.1 L'écran d'analyse enterre sa propre conclusion

| Mesure | 360 | 390 | 412 |
|---|---|---|---|
| Hauteur moyenne de l'analyse | **3 668 px** | 3 453 px | 3 621 px |
| Hauteur maximale | 4 109 px | 4 001 px | 4 026 px |
| Caractères moyens | **3 407** | 3 216 | 3 406 |
| y du bouton « Continuer la main » | 883 | 839 | 832 |

Soit **4,1 écrans et ~3 300 caractères par décision**. Avec 4,6 décisions par main
(contexte partagé), une seule main produit **~15 000 caractères et ~16 000 px de défilement**.

Le problème n'est pas le volume, c'est l'ordre. Le bouton « Continuer la main » est placé
**au-dessus** des 8 cartes d'analyse (`screens/11-review.png`), à hauteur exacte de la ligne
de flottaison. Le geste naturel — scroller — amène d'abord à la sortie. Résultat mécanique :
l'utilisateur tape « Continuer » et **ne lit jamais** l'espérance par option, l'équité, la
grille de range, les nombres de la situation, les profils adverses et l'erreur fréquente.
**Toute la valeur du produit est située après la porte de sortie.**

Les 8 cartes servies après chaque décision :

1. Verdict + phrase du coach + réplique du mentor + détail de l'option choisie + détail de
   la meilleure option
2. Espérance de chaque option (5 lignes) + avertissement de 3 lignes sur la fiabilité
3. Votre équité (%, barre gagne/partage/perd, projection turn)
4. Range adverse estimée — **grille 13 × 13, 169 cellules sur 330 px de large**
5. Ce qui vous bat / ce que vous dominez + effet de blocage
6. Les nombres de la situation (5 KPI)
7. Vos adversaires (2 cartes × 4 stats + tell)
8. L'erreur fréquente aux micro-limites (+ Déroulement)

Rien n'est faux. Mais aucun de ces blocs n'est conditionné à la question posée. Une erreur
de fold préflop et un bluff river raté reçoivent le **même appareil de 3 300 caractères**.
Un produit qui enseigne trie ; celui-ci publie.

### 4.2 La table se chevauche à elle-même

| Largeur | Collisions sur 25 mains | Par main |
|---|---|---|
| 360 | **112** | 4,5 |
| 390 | 84 | 3,4 |
| 412 | 96 | 3,8 |

Il ne s'agit pas de recouvrements marginaux : la sonde ignore les rapports
conteneur/enfant et ne compte qu'au-delà de 60 px² d'aire commune. Les cas relevés
atteignent 1 642 px² — un siège entièrement recouvert par le libellé du pot.

Familles récurrentes, dans l'ordre de fréquence :

- `pot` × `seat` — le badge « Pot 0,40 € · 4,0 bb » recouvre le nom, le profil et le stack
  d'un adversaire (jusqu'à 1 642 px²)
- `bet` × `pot` — la mise au centre passe sous le badge du pot (jusqu'à 484 px²)
- `bet` × `seat hero` — la mise du héros recouvre ses propres cartes (jusqu'à 557 px²)
- `seat` × `seat` — deux sièges se chevauchent (752 px²)

Sur `screens/03-play-hand@390.png`, trois informations sont superposées au même endroit :
« Pot 0,59 € », « 0,22 € » et « 5,9 bb ». La position d'un joueur (`CO · 13.24 €`) est
tronquée par un jeton de mise. Ce sont exactement les données dont dépend la décision qu'on
demande à l'utilisateur de prendre.

À quoi s'ajoute une redondance systématique : les cartes du héros, sa position et son stack
sont affichés **deux fois** — sur la table puis dans la carte « Votre main » juste dessous.

### 4.3 Douze monnaies de progression

Recensées à l'écran : Poker Rating (+ palier + delta hebdomadaire), Niveau, lien avec le
mentor (0–100 + palier + libellé), série quotidienne, score journalier /10, 16 succès,
bankroll €, palier de carrière NL2→NL50, winrate bb/100, % de décisions correctes,
espérance perdue en bb, radar à 5 compétences.

Douze systèmes de récompense, aucun n'englobe les autres. L'accueil en présente cinq
simultanément. Sur un premier lancement, le chiffre mis en avant en haut de page est un
**« 0 » en grand** avec un radar dont les cinq axes valent 0 (`screens/01-home@390.png`) :
la première impression du produit est un bilan de nullité. La glose « à construire — joue
pour l'affiner » n'annule pas ce que l'œil a déjà lu.

---

## 5. Cohérence

Un même composant se comporte-t-il pareil partout ? Non — et la mesure est nette
(`coherence-log.txt`).

**Le sélecteur segmenté « choisir un niveau » est implémenté cinq fois :**

| Vue | Classe | Rendu |
|---|---|---|
| Range Detective | `hr-diff-opt` | cartes empilées avec description |
| Profiling Lab | `pr-diff-opt` | cartes avec suffixe « jusqu'à N mains » |
| Blocker Finder | `bl-diff-opt` | cartes avec liste de types |
| Réglages de table | `pick` | pastilles compactes |
| Carrière | `sess-pick` | grandes cartes |

Même intention, même geste, cinq langages visuels. Linear en a un.

**Deux systèmes de boutons coexistent dans le même fichier** : `btn pri` (HeroLab) et
`btn primary` (Feutre/Tracker) ; `btn gh` pour le destructif côté HeroLab et
`btn sm danger` côté Tracker. Au total **8 variantes de `.btn`** relevées sur une seule
vue, plus 12 familles de boutons non-`.btn` (`mode-card`, `home-resume`, `tab`,
`sess-pick`, `pick`, `ob-avatar`, `mentor-card`, `bl-tab`, `hr-mode-opt`, `ft-nav-item`,
`rail-profile`, `bl-opt`).

**Trois façons d'entrer dans un mode depuis l'accueil** : la carte de reprise
(`home-resume`), les cartes Netflix (`mode-card`), et le rail (`tab`). La carte marquée
« COMMENCE ICI » n'est pas celle qui est visible sans scroll.

**Vocabulaire de sortie non stabilisé** : « Terminer » (labs, sans bilan), « Terminer la
session maintenant » (carrière, avec rapport), « Retour à l'accueil » (défi), « Retour au
diagnostic » (drill), « Reprendre l'entraînement » (stats de lab). Cinq mots pour une même
famille d'action, avec des conséquences opposées : « Terminer » dans un lab **jette** la
séance, « Terminer » dans une session **produit un rapport**.

**Surface de navigation** : 14 destinations au rail, plus 3 pages de stats de lab sans
entrée, plus 9 vues de Tracker inaccessibles sur mobile. Et **quatre endroits distincts où
regarder ses propres chiffres** — Statistiques, Mes leaks, Mon évolution, Tracker — qui ne
partagent ni vocabulaire (10 fuites coachées côté moteur, 29 côté tracker), ni source de
données (décisions simulées vs historiques Winamax), ni renvoi mutuel. Deux produits
cohabitent sous un même toit sans se parler.

**Ce qui est cohérent, et qu'il faut préserver** : la typographie (display / mono / sans)
est tenue de bout en bout ; la palette est stable ; les états vides de `hrstats`,
`prstats`, `blstats` et `journey` suivent tous le même patron irréprochable
(titre → promesse → CTA). C'est un design system qui existe mais n'a été appliqué qu'à la
moitié du produit.

---

## 6. Feedback après décision

Ce que l'utilisateur voit exactement, dans l'ordre, mesuré :

1. **Un verdict binaire coloré** : « Bien joué » / « Défendable » / **« Erreur »**, avec
   le coût en bb.
2. Une phrase de coach, puis une réplique du mentor. Sur un premier lancement, la réplique
   de Vera est : « Non. Regarde l'EV : tu laissais de l'argent sur la table. »
3. Le détail de l'option choisie, puis celui de la meilleure option.
4. Le bouton de sortie.
5. 2 600 px d'analyse que personne ne lira (§4.1).

Trois problèmes de conception, distincts du volume :

- **Le lexique est punitif.** « Erreur » et « Coût estimé : 1,23 bb » sur une décision
  prise avec zéro entraînement, à un niveau « Intermédiaire » que l'utilisateur n'a pas
  choisi. Sur 50 mains, 57 % des décisions reçoivent « Erreur ». Aucun produit de learning
  premium ne notifie l'échec 57 % du temps sans ajuster la difficulté. Duolingo remet la
  question ratée en fin de leçon ; ici elle disparaît.
- **Rien n'est capitalisé.** Le verdict est enregistré dans `Progress` mais l'écran ne dit
  jamais « c'est la 3ᵉ fois que tu surmises au turn » — alors que `Progress.tagStats` et
  `Progress.worstLeak()` contiennent exactement cette information. Le produit sait détecter
  un motif et ne le renvoie qu'après 30 décisions, sur une autre page, sans notification.
- **La décision ratée n'est jamais rejouable.** Il n'existe aucun « refaire ce spot »,
  aucun « me reproposer cette situation ». Le seul mécanisme de répétition espacée du
  produit — l'entraînement ciblé de 10 spots — est celui de R1/R4, coupé sur mobile.

À l'autre bout, la boucle **fin de main** (`renderResult`) est correcte : verdict de pot,
abattage, « Main suivante » + « Voir mes statistiques ». Mais elle propose comme action
secondaire une page qui n'a **aucun bouton** (§R5) : la sortie mène à un cul-de-sac.

---

## 7. Observation résiduelle (hors périmètre Phase 2)

`ux_overflow.js` relève un débordement horizontal **au niveau du document** sur la vue
`Statistiques` : `scrollWidth = 413 px` pour un `clientWidth` de 360, 390 **et 412**. La
grille « Précision par position » (6 colonnes) n'est pas dans un conteneur
`overflow-x: auto` et pousse le `<body>`. `Mes leaks` déborde également de 8 px à 360.

Ce n'est pas une régression des correctifs Phase 2 : le débordement **n'apparaît qu'une
fois les six positions renseignées**, donc jamais sur un état vide. Il échappait
structurellement au contrôle. Même symptôme visible sur le rapport de session, dont la
colonne de gains dépasse le cadre (`screens/52-session-report.png`).

---

## 8. Recommandations

### P0 — Rendre chaque parcours conclusif, et rebrancher le Tracker

Une seule intervention, parce que les cinq ruptures sont le même défaut : **le produit sait
commencer, il ne sait pas finir.** Trois chantiers, dans cet ordre.

**P0.a — Donner une navigation au Tracker sur mobile.** Le tiroir translaté hors champ doit
devenir un bandeau d'onglets horizontal défilant sous le titre, comme `bl-tabs` qui existe
déjà et fonctionne. Neuf vues et 59 KPI redeviennent atteignables, et avec elles
l'entraînement ciblé de 10 spots. Coût : le composant existe, il s'agit de le réutiliser.
Sans ce point, tout travail sur le tracker, les fuites ou le drill est invisible pour un
utilisateur mobile.

**P0.b — Généraliser l'écran de fin de `drillLeak` comme patron unique.** Il note 5/5 sur
les six axes ; il est le seul. Le patron est : *score de la série → mention → une phrase qui
explique ce que le score signifie → un bouton qui rejoue → un bouton qui sort vers l'action
suivante*. À appliquer, sans en inventer un sixième, à :

- la fin du **Défi du jour** — remplacer le bouton unique par « Revoir mes 5 ratés » +
  « Enchaîner sur mon leak ». La promesse du texte devient tenue ;
- « **Terminer** » dans les **trois labs** — afficher le bilan de la série (les données sont
  déjà enregistrées) au lieu de retomber sur le hero marketing, et **y placer le lien vers
  `hrstats` / `prstats` / `blstats`**, qui résout du même geste les trois pages orphelines ;
- la **partie libre** — lui donner une longueur. Une « séance » de 10 ou 20 mains, avec le
  `sess-hud` déjà écrit, transforme le mode d'entrée par défaut en boucle finie.

**P0.c — Un bouton d'action sur chaque écran de diagnostic.** `Statistiques`,
`Mes leaks` (sur *chaque* leak, pas seulement le premier), `Profils adverses`, `Notions`.
La règle : *aucune vue ne décrit un problème sans offrir le geste qui le travaille*. Le
moteur a déjà tout ce qu'il faut — `MODES` contient un mode par rue, `focusFor()` sait
convertir une fuite en configuration. Il manque le lien, pas la mécanique.

### P1

1. **Onboarding en un écran** : pseudo seulement, symbole et mentor déplacés dans « Mon
   profil » — ou proposés *après* la première main, quand ils récompensent au lieu de
   retarder. Supprimer l'interstitiel « Chaque main est nouvelle » : distribuer directement.
2. **Calibrer le niveau de départ sur `debutant`** (qui porte `hint: true`), ou proposer
   trois mains de calibration. 57 % de verdicts « Erreur » au premier contact est un
   paramétrage, pas une fatalité.
3. **Inverser l'ordre de l'écran d'analyse** : verdict → *une* raison → bouton en bas,
   collant. Réduire les 8 cartes à 2 par défaut (espérance des options + équité), le reste
   derrière un « Voir l'analyse complète ». Conditionner le contenu à la rue et au type
   d'erreur.
4. **Corriger les collisions de la table** : ancrer le badge de pot au-dessus du board plutôt
   qu'au centre géométrique, et sortir les jetons de mise de l'orbite des sièges. 3 à 4,5
   collisions par main sur les données mêmes de la décision.

### P2

5. Réduire les douze monnaies de progression à trois lisibles ; ne pas ouvrir sur un « 0 »
   et un radar à zéro.
6. Unifier `btn` / `btn primary`, `btn gh` / `btn sm danger`, et les cinq sélecteurs de
   difficulté.
7. Stabiliser le vocabulaire de sortie (« Terminer » ne doit pas jeter ici et rapporter là).
8. Réconcilier les deux systèmes de fuites (10 coachées / 29 tracker) ou, à défaut, nommer
   clairement lequel on regarde.
9. Placer la grille 13 × 13 dans un conteneur `overflow-x: auto` ; idem pour la grille de
   positions de `Statistiques` (§7).
