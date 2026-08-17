# AGENT J — RÉTENTION / BOUCLE QUOTIDIENNE

Audit et conception de la boucle J1 → J2 → J7 → J30 → J90.
Baseline : `VERSION_PRODUCTION/herolab.html` (16 410 l.). **Aucun fichier applicatif modifié.**
Toutes les lignes citées sont vérifiées ; les comportements marqués « mesuré » ont été
exécutés via `tests/harness.js`.

---

## 1. AUDIT — ce qui existe pour faire revenir l'utilisateur

### 1.1 Inventaire des cinq mécaniques

| # | Mécanique | Emplacement | Rôle réel |
|---|---|---|---|
| 1 | `Player.data.daily` | l.6080, l.6116-6140 | État du défi du jour + série |
| 2 | `App.startDaily` / `dailyRun` | l.7158-7164, 7173, 7293-7297, 7327-7339 | Les 10 spots |
| 3 | `Progress.data.streak` / `lastDay` | l.4652, 4745-4751, 4817 | Seconde série, parallèle |
| 4 | `Journey` | l.6375-6524, rendu l.8042-8182 | Récit avant/après, missions, timeline |
| 5 | `Career` sessions | l.5382-5386, 5593-5825, rapport l.8786-8845 | Format long, badges, paliers |

### 1.2 `Player.data.daily` — l.6080

```js
daily: { day: null, done: false, score: null, target: 8, best: 0, streak: 0, lastDay: null }
```

- `dailyState()` (l.6116-6125) compare `d.day` à `todayKey()` (`new Date().toDateString()`,
  l.6114) et remet `done = false`, `score = null` au changement de date. **Il n'appelle pas
  `Player.save()`** : la remise à zéro n'est persistée qu'au prochain `Player.save()` d'ailleurs
  (`recordMastery` l.6148, `completeDaily` l.6139).
- `completeDaily()` (l.6127-6140) : `streak+1` si `lastDay === hier`, **sinon `streak = 1`**.
- `target: 8` n'est **lu nulle part** (vérifié). `best` est écrit l.6132 et **affiché nulle part**.
  Deux champs morts.

**Mesuré** (harness) : `lastDay = J-2`, `streak = 30` → après `completeDaily`, `streak = 1`.
Un seul jour manqué efface trente jours.

### 1.3 Le défi du jour — l.7158-7164

`startDaily()` pose `App.dailyRun = { i:0, total:10, correct:0 }` puis `newHand()`.
Dans `newHand()`, l.7173 : `if (App.dailyRun) cfg.mode = "cible"`.
Le mode « cible » (l.7235-7245) résout `Progress.worstLeak()` → `Progress.focusFor(key)`
→ **un mode unique appliqué aux dix spots**.

Trois conséquences structurelles :

1. **Le défi n'a qu'une seule couleur par jour.** `focusFor` (l.4829-4843) projette les 10 clés
   de fuite sur **5 configurations distinctes seulement** (mesuré) : `libre`+BB forcé, `river`,
   `turn`, `pot3bet`, `flop`. Le défi du jour est l'un de cinq objets possibles.
2. **Les mains sont abandonnées après une décision.** `continueHand` l.7334-7339 : en défi,
   chaque décision déclenche `newHand()`. Aucune main ne va au bout, aucun abattage,
   aucun résultat. « 10 spots » = 10 mains orphelines d'une décision chacune.
3. **Le thème se fige.** `summary().leaks` trie `tagStats` par `loss` **cumulé à vie**
   (l.4787-4790) ; `tagStats` n'est ni fenêtré ni amorti (l.4734-4738).
   **Mesuré** : 60 erreurs `river-call` il y a 20 jours puis 12 erreurs `fold-to-3bet`
   aujourd'hui → `worstLeak()` renvoie toujours `river-call` (180 bb cumulées).
   Le joueur qui a corrigé sa fuite continue de la travailler pendant des semaines.

### 1.4 `Progress.data.streak` — l.4745-4751

Incrémenté à **chaque décision enregistrée**, quelle qu'elle soit ; exposé par `summary()`
l.4817 ; **rendu nulle part** (vérifié : la seule occurrence UI de `st.streak` est celle de
`HRStats`, l.10170). Deux séries coexistent avec deux définitions contradictoires
(« j'ai joué » vs « j'ai fini le défi »), l'une invisible. Dette à trancher.

### 1.5 `Journey` — l.6375-6524

- `snapshot()` (l.6390-6407) est appelé au démarrage (l.8445-8446) et à l'ouverture de l'onglet
  (l.8045). Une photo par jour, écrasée si le jour est déjà présent (l.6403), plafond 120 (l.6405).
  C'est **la seule structure réellement datée du produit** — la matière première de tout récit.
- `story()` compare à `snapAgo(14)` (l.6431).
- `activeMissions()` (l.6494-6497) : fuites avec `err >= 2` **cumulés**, top 4.
  `mission.complete` = `seen >= 20 && rate >= 0.65` (l.6471).
  Une mission accomplie **reste affichée indéfiniment** : `err` ne décroît jamais, donc rien ne
  la remplace. L'écran « Mon évolution » se fige après quelques semaines.
- `timeline()` n'apparaît qu'à partir de 2 semaines de données (`tl.length < 2` → `""`, l.8161).

### 1.6 Carrière — l.5382-5386, 8786-8845

Sessions de 50 / 200 / 500 mains. **Rien n'y est temporel** : aucune cadence, aucun repos,
aucune notion de jour. Dix sessions peuvent être enchaînées le même après-midi.
Le rapport se termine l.8842-8845 sur deux boutons : « Retour à la carrière », « Voir mes leaks ».

### 1.7 Que se passe-t-il concrètement à J+1, J+2, après 7 jours ?

| Mécanique | Le lendemain | Le surlendemain | Après 7 jours d'absence |
|---|---|---|---|
| `Player.daily` | `done=false`, **mêmes 10 spots, même mode** (même `worstLeak`), `streak+1` | Identique à J+1 | `streak → 1` quel que soit l'acquis ; écran d'intro **strictement identique** ; aucune reconnaissance du retour |
| `dailyRun` | Régénère 10 mains d'une décision dans le même mode | Idem | Idem |
| `Progress.streak` | +1 silencieux | +1 silencieux | Remis à 1, invisible : sans effet observable |
| `Journey` | Nouveau snapshot ; `story()` compare à J-14 | Idem | `spanDays` gonfle, `volumeSince = 0` → le panneau affiche « Depuis · **0 spots travaillés** » (l.8083) : l'absence est rendue visible, mais comme un reproche muet |
| `Career` | État inchangé, aucun rappel | Inchangé | Inchangé — la carrière ignore le temps |

**Aucun déclencheur de retour n'existe.** Zéro occurrence de `Notification`,
`requestPermission`, `serviceWorker` dans le fichier (vérifié). Le retour dépend
entièrement du fait que l'utilisateur rouvre l'onglet de lui-même.

---

## 2. LES MOMENTS MORTS

Classés par gravité : après quelle action l'utilisateur n'a plus aucune raison de revenir.

**M1 — L'écran de fin du défi du jour. Le moment mort n°1.** (l.7112-7123)
Un anneau de score, une phrase de verdict, une ligne de série, **un seul bouton :
« Retour à l'accueil »**. Les dix décisions viennent d'être écrites dans
`Progress.data.decisions` avec `chosen`, `best`, `lossBB`, `tags` (l.4726-4731) et **ne sont
jamais réaffichées**. Rien de ce qui a été raté n'est nommé, rien n'est appris, rien n'est
promis. Le seul lien vers demain est une phrase — « ne casse pas la série, reviens demain »
(l.7120) — c'est-à-dire une obligation, pas un intérêt.

**M2 — Le rapport de session de carrière.** (l.8842-8845)
Analyse riche (`findings`, courbe, plus gros pots), puis deux boutons de navigation.
Aucune suite proposée, aucune indication de quand revenir, aucun lien vers un travail
ciblé sur ce que le rapport vient de démontrer.

**M3 — La mission Journey accomplie.** (l.6471, 6496, 8128)
Badge « ✓ accompli », puis la mission reste à l'écran pour toujours, sans remplaçante.
Le seul écran qui raconte une progression est aussi celui qui, à terme, ne bouge plus.

**M4 — Vers J20-J30 : le défi devient un rituel vide.** (l.4787-4790, 7235-7245)
`worstLeak` cumulatif ne tourne plus. Dix spots du même mode, tous les jours,
sur une fuite parfois déjà corrigée. Le produit affirme s'adapter et ne s'adapte plus.

**M5 — Le retour après absence.** (l.6136-6137)
Le seul événement produit par une absence est **une punition** : la série tombe à 1.
Aucun accueil, aucun « voilà où on en était », aucune session raccourcie.

**M6 — Les labs et le tracker sont hors boucle.**
`HRStats`/`PRStats`/`BLStats` tiennent leurs propres séries (l.9969, 11907, 13212), locales,
sans lien avec le défi du jour ni avec `Journey`. Trois moteurs de rétention isolés.

**M7 — Le défi ne montre jamais de résultat de main.** (l.7334-7339)
Pas d'abattage, pas de pot gagné ou perdu. La séquence la plus quotidienne du produit est
aussi la moins incarnée.

---

## 3. CONCEPTION — la Daily Session personnalisée

### 3.1 Les cinq types d'items

| Type | Ce que c'est | Source de données existante |
|---|---|---|
| **Révision** | Un spot rejoué dans le contexte d'une erreur passée, à échéance d'un rappel espacé | `Progress.data.decisions[].tags/ts/verdict` (l.4726-4731), `Progress.focusFor` (l.4829) |
| **Nouveau concept** | Une notion présentée en carte courte, puis appliquée sur 2 spots | Les 12 notions de `renderTheory` (l.8269-8282), `LEAK_INFO.why/fix` (l.4849-4900) |
| **Drill ciblé** | n spots consécutifs sur la fuite dominante **récente** | `focusFor` + fenêtre glissante sur `decisions` |
| **Challenge** | 2 spots au niveau au-dessus, comptés à part, **toujours sautables** | `LEVELS` (l.3709-3739) |
| **Résumé** | Écran de clôture : ce qui a été mesuré, ce qui a bougé, ce qui revient demain | `Journey.snaps` (l.6395-6400), `Player.masteryLevel` (l.6151) |

Le Résumé n'est pas un exercice : c'est **la réparation de M1**, et le seul endroit du produit
qui dit explicitement « c'est fini pour aujourd'hui ».

### 3.2 Ce que la composition lit du profil réel

Rien d'inventé : quatre sources déjà persistées.

- `Progress.data.decisions[]` — horodatées, avec `verdict`, `lossBB`, `chosen`, `best`, `tags`.
  C'est ce qui rend le rappel espacé possible **sans nouveau moteur**.
- `Progress.data.tagStats` — `{n, err, loss}` par tag, y compris `street:*` et `pos:*` (l.4682-4683),
  donc couverture par rue et par position, pas seulement par fuite.
- `Player.data.mastery` + `masteryLevel()` (l.6143-6159) — paliers 0→4, seuils 10/30/60 spots
  et 0.5/0.65/0.78 de réussite.
- `Journey.data.snaps` — 120 jours d'historique daté.

**Nouveauté de persistance minimale** : la file de rappels et le concept du jour vivent dans
`Player.data.daily.plan`, **à l'intérieur de la clé `pivot.player.v1` existante**. Aucune
10ᵉ clé `localStorage` : c'est la contrainte n°5 du contexte partagé (Phase 3 intercale une
couche de stockage sous le moteur) qui l'impose.

### 3.3 Algorithme de composition — pseudo-code

```
INTERVALLES = [1, 3, 7, 21, 60]        // jours, rappel espacé
FENETRE     = 14                        // jours, pour « récent »

function composerDaily(aujourdhui):

  P = Progress.data                     // l.4650
  S = Progress.summary()                // l.4758
  plan = Player.data.daily.plan || { revisions:{}, dernierConcept:null, vus:[] }

  // ---------- 0. BUDGET  (borné dans les deux sens, jamais croissant) ----------
  vol7 = nbDecisions(P.decisions, depuis = 7 jours)
  si   S.n < 40            : N = 6                      // profil neuf
  sinon                    : N = borner(round(vol7 / 7), 6, 12)
  si absent depuis >= 5 j  : N = 5                      // le retour est court, jamais rattrapé

  // ---------- 1. RÉVISION  (rappel espacé) ----------
  dues = []
  pour chaque fuite k dans clésLeak(P.tagStats):        // tags "leak:*", l.4788
      derniereErreur = maxTs(P.decisions, tag = k, verdict = "erreur")
      si derniereErreur == null: continuer
      succesConsecutifs = nbOkDepuis(P.decisions, k, derniereErreur)
      palier = min(succesConsecutifs, 4)
      echeance = derniereErreur + INTERVALLES[palier] jours
      si aujourdhui >= echeance:
          dues.ajouter({ k, retard: aujourdhui - echeance,
                         cout: P.tagStats["leak:"+k].loss })
  trier dues par (retard desc, cout desc)
  R = min(taille(dues), plafond(N * 0.40))

  // ---------- 2. DRILL  (fuite dominante RÉCENTE, pas cumulée) ----------
  // Corrige le défaut mesuré : summary().leaks est un cumul à vie.
  recent = coutParFuite(P.decisions, fenetre = FENETRE)
  fuiteDrill = argmax(recent)  ?: Progress.worstLeak()?.key
  m = Player.masteryLevel(fuiteDrill)                   // l.6151
  si m.tier <= 2 : D = plafond(N * 0.35)                // Découverte → Familier : on insiste
  sinon          : D = plafond(N * 0.20)                // Solide / Maîtrisé : entretien

  // ---------- 3. NOUVEAU CONCEPT  (au plus 1 par jour) ----------
  precedent = plan.dernierConcept
  digere = (precedent == null)
        || (Player.masteryLevel(precedent.cle).tier >= 2)      // "Familier", l.6156
        || (aujourdhui - precedent.jour >= 3 jours)            // filet anti-blocage
  si digere ET S.n >= 20:
      concept = premierNonVu(CURRICULUM, plan.vus)             // ordre fixe, pas de tirage
      Nc = (concept != null) ? 1 : 0
  sinon:
      Nc = 0

  // ---------- 4. CHALLENGE  (seulement quand le socle tient) ----------
  eligible = S.n >= 150
          ET precision(P.decisions, fenetre = 7 j) >= 0.65
          ET m.tier >= 2
  C = eligible ? 2 : 0

  // ---------- 5. AJUSTEMENT AU BUDGET ----------
  // Priorité descendante : réviser ce qui est dû > corriger le récent >
  // découvrir > se tester. On rogne par le bas.
  tant que R + D + 2*Nc + C > N:
      si C > 0        : C = 0
      sinon si Nc > 0 : Nc = 0
      sinon si D > 1  : D = D - 1
      sinon           : R = R - 1

  // ---------- 6. ORDRE DE PASSAGE ----------
  // Échauffement (révision, contexte connu) → apprentissage (concept, esprit frais)
  // → effort (drill) → test (challenge) → clôture.
  items = []
  items += Revision(dues[0..R-1])
  si Nc == 1 : items += CarteConcept(concept) + Spot(concept) x2
  items += Drill(fuiteDrill) x D
  si C > 0   : items += Challenge(niveauSuperieur) x C
  items += Resume()                                     // toujours exactement 1

  retourner items
```

### 3.4 Ce que ça donne concrètement (N et répartition)

| Profil réel | Lecture des données | N | Rév. | Concept | Drill | Chall. |
|---|---|---|---|---|---|---|
| J1, profil vierge | `S.n = 0` | 6 | 0 | 0 (seuil `S.n >= 20`) | 0 → remplacé par 6 spots `libre` | 0 |
| J3, 90 décisions, 1 fuite nette | `S.n = 90`, `mastery.tier = 0` | 6 | 2 | 1 (+2 spots) | 2 | 0 |
| J30, régulier, fuite en cours | `vol7 = 70`, `tier = 1` | 10 | 4 | 1 (+2) | 3 | 0 |
| J45, fuite passée à « Familier » | `tier = 2`, précision 7 j = 71 % | 10 | 3 | 1 (+2) | 2 | 2 |
| J90, socle solide | `tier = 4`, précision 74 % | 12 | 4 | 1 (+2) | 2 | 2 |
| Retour après 12 jours | absence ≥ 5 j | 5 | 3 | 0 | 2 | 0 |

Le retard de révision **ne s'accumule jamais** : `R` est plafonné à 40 % de `N`, et `N` baisse
au retour. Une absence ne produit pas de dette.

---

## 4. PROGRESSION J1 / J7 / J30 / J90

Principe : **ce qui se débloque, c'est ce qui n'existait pas** — les constats mesurés sur
l'utilisateur. Aucune fonctionnalité existante n'est cachée : les 15 onglets de la barre
latérale (l.2073-2089) restent tous accessibles dès la première minute. Verrouiller un onglet
déjà écrit pour créer une attente serait de la rareté fabriquée.

| Palier | Ce que l'utilisateur découvre | Ce qui change dans la Daily | Pourquoi ça ne peut pas être vu à J1 |
|---|---|---|---|
| **J1** | Son premier constat chiffré : « voilà ta précision, voilà où tu perds ». Le Résumé nomme la première fuite dès que `S.n >= 30` (seuil déjà en place, l.6645) | 6 spots variés, un Résumé qui présente les mesures | `Progress` est vide : il n'y a **rien** à dire |
| **J2-J6** | Le produit se souvient : la première Révision reprend une erreur nommée de la veille (intervalle 1 j) | La Révision apparaît, puis s'espace à 3 j | Il faut une erreur **datée** pour qu'un rappel existe |
| **J7** | Le premier bilan hebdomadaire réel, construit sur `Journey.snaps` (l.6395) : précision semaine 1, fuite dominante, volume | Déblocage du **Challenge** si précision 7 j ≥ 65 % ; recommandation de la Carrière comme format long | 7 snapshots datés sont nécessaires ; on ne peut pas les fabriquer |
| **J30** | La première **mission accomplie** (`seen >= 20 && rate >= 0.65`, l.6471) et son remplacement par la fuite suivante ; le palier de maîtrise « Familier » → « Solide » (l.6156-6157) ; la timeline hebdo devient lisible (≥ 2 semaines, l.8161) | Le drill passe en entretien (20 % au lieu de 35 %) et le budget s'ouvre à 10-12 | Les seuils sont des **volumes de répétition**, pas des délais |
| **J90** | « Maîtrisé » (60 spots, 78 % de réussite, l.6158) sur 2-3 thèmes ; 12 semaines de timeline ; le récit avant/après de `Journey.story()` porte sur un vrai trimestre | Révision majoritaire, intervalles à 21 et 60 jours, drill résiduel, challenges réguliers | Un intervalle de 60 jours ne peut pas exister avant 60 jours |

### 4.1 Comment éviter que tout soit vu en trois jours

Trois garde-fous, aucun n'est une horloge :

1. **Un concept par jour au maximum, conditionné à la digestion du précédent**
   (`masteryLevel(precedent).tier >= 2`, soit ≥ 10 spots vus et ≥ 50 % de réussite, l.6154-6156).
   Le gros consommateur ne débloque pas plus vite en jouant 5 h : il débloque plus vite en
   jouant **juste**. C'est la seule accélération offerte, et elle est méritée.
2. **Le rappel espacé étale mécaniquement le contenu.** Une fuite vue à J1 revient à J2, J5,
   J12, J33, J93. La Daily de J40 contient nécessairement de la matière de J1 : le contenu ne
   s'épuise pas, il se recycle avec un espacement croissant.
3. **La porte de sortie est explicite.** Le Résumé propose toujours « continuer librement »
   (Table, Carrière, Labs, tous déjà accessibles). Celui qui veut tout voir tout de suite le
   peut — simplement, il quitte le format guidé. On ne l'en empêche pas, on ne lui ment pas
   sur ce qu'il gagne à rester.

Le filet `aujourdhui - precedent.jour >= 3 jours` garantit qu'un utilisateur bloqué sous le
seuil de maîtrise n'est jamais privé de nouveauté plus de trois jours.

---

## 5. RÈGLE ABSOLUE — aucun dark pattern

### 5.1 La série : diagnostic et version saine

**Ce qui existe est un pattern d'aversion à la perte.** Trois éléments, tous vérifiés :
`streak = 1` après un jour manqué (l.6137, mesuré : 30 → 1) ; la formule
« 🔥 ${streak} jours d'affilée — **ne casse pas la série**, reviens demain » (l.7120) ; et
« série de X jours **à entretenir** » sur l'accueil (l.6857). Le produit crée un capital,
le rend visible, puis menace de le détruire. C'est précisément la mécanique interdite.

**Version saine proposée — trois compteurs, aucun ne peut baisser :**

| Compteur | Définition | Peut-il diminuer ? |
|---|---|---|
| **Jours actifs** | Total cumulé de jours où une Daily a été faite | **Non, jamais.** Acquis définitif |
| **Rythme** | « 4 jours sur les 7 derniers » — fenêtre glissante | Il varie, mais **ne se remet pas à zéro** : il décrit, il ne sanctionne pas |
| **Série en cours** | Jours consécutifs, avec **2 gels par mois** appliqués automatiquement et **en silence** | Elle peut se terminer, sans emphase, sans flamme, sans injonction |

Pourquoi c'est sain : le compteur qui porte l'identité (« j'ai fait 47 jours ») est
**monotone croissant** — l'utilisateur ne peut rien perdre en s'absentant. Le rythme sur 7
jours est une mesure, pas un score : passer de 5/7 à 3/7 est une information sur soi, pas une
punition. Les gels sont automatiques et silencieux parce qu'un gel qu'il faut « dépenser »
ou « acheter » recrée exactement l'angoisse qu'il prétend soigner.

**Réécriture des formules :**
- l.7120 → `« 12 jours actifs · 4 des 7 derniers jours. »` (constat, pas ordre)
- l.6857 → retirer entièrement le fragment « à entretenir »
- Retour après absence → `« Content de te revoir. On reprend là où on s'était arrêtés : {fuite}. »`

### 5.2 Les six autres règles, appliquées

| Règle | Application ici |
|---|---|
| **Pas de fausse urgence** | Aucun compte à rebours, jamais. La Daily se réinitialise à minuit (`toDateString`, l.6114) mais ce minuit n'est **jamais affiché**. Une Daily non faite n'est pas « perdue » : ses items étaient des révisions dues, et une révision due le reste — la file de rappel absorbe naturellement le rattrapage |
| **Pas de récompense aléatoire** | Zéro tirage. Le score de la Daily est la performance. Les badges (l.5780-5792) sont déjà des seuils déterministes et annoncés — on garde le modèle. Aucun coffre, aucune surprise, aucun bonus variable |
| **Pas de pression de volume** | `N` est **plafonné à 12** et n'augmente jamais tout seul : il suit le volume observé (`vol7 / 7`) et redescend quand l'utilisateur ralentit. Le produit ne demande jamais plus que ce que la personne fait déjà |
| **L'absence n'est pas punie** | Après 5 jours, `N = 5`, aucun arriéré, aucun « tu as X révisions en retard ». Le retard de révision est plafonné à 40 % de `N` par construction |
| **Fin claire** | Le Résumé dit explicitement que la séance est finie et que revenir demain suffit. C'est l'inverse d'un flux infini : la boucle a un terminus assumé |
| **Rien d'inventé** | Chaque chiffre du Résumé vient de `Progress`, `Player.mastery` ou `Journey.snaps`. Contrainte n°3 du contexte partagé, non négociable |

### 5.3 Sur les notifications

Le produit n'en a aucune (0 occurrence de `Notification`/`serviceWorker`, vérifié).
**Recommandation : ne pas en ajouter en Phase 4.** Au mieux, plus tard, un rappel unique,
à heure choisie par l'utilisateur, **désactivé par défaut**, sans relance en cas d'absence.
Une notification de réengagement après plusieurs jours d'inactivité est un dark pattern :
elle exploite l'absence au lieu de la respecter.

### 5.4 Ce que je refuse explicitement de proposer

Monnaie virtuelle ; boutique ; coffres ; bonus de connexion escaladant ; classement entre
utilisateurs ; « ton ami a fait sa Daily » ; barre de progression qui régresse ; compte à
rebours de série ; notification de relance. Aucun n'apporte de valeur d'apprentissage,
et chacun contredit la règle absolue.

---

## 6. RECOMMANDATION P0

**Livrer la Daily Session v1 en un seul incrément cohérent, sans nouveau contenu.**
Trois pièces, indissociables :

1. **Fenêtre glissante de 14 jours pour choisir la fuite du jour.**
   `worstLeak()` cumulé à vie (l.4787-4790) est le défaut le plus structurant du produit :
   mesuré, il verrouille le défi sur une fuite inactive depuis 20 jours. Sans cette
   correction, toute personnalisation reste cosmétique et M4 est inévitable.
   La correction est locale (un filtre sur `decisions[].ts`) et **ne touche pas** `Progress.summary()`,
   donc n'affecte ni le Tracker, ni Journey, ni les 79 + 37 tests de Phase 2.

2. **L'écran Résumé, en remplacement de l'écran de fin actuel (l.7112-7123).**
   C'est la réparation de M1, le moment mort n°1. Les données sont déjà écrites
   (`decisions[].chosen/best/lossBB`, l.4726-4731) : il s'agit de **les afficher**.
   Contenu : les décisions ratées du jour nommées, ce qui a bougé depuis 7 jours
   (`Journey.snaps`), ce qui revient demain, et une phrase de clôture.
   Modèle de référence déjà présent dans le code : le bilan de drill (l.7404-7418) fait
   exactement cela — score, verdict, deux actions concrètes.

3. **L'assainissement de la série** (l.6136-6137, 7120, 6857) — une quinzaine de lignes.
   À faire dans le même incrément, sans quoi le nouveau Résumé afficherait une série
   culpabilisante juste sous un écran conçu pour rassurer.

**Ensuite** : P1 = file de rappel espacé (`plan.revisions` dans la clé `pivot.player.v1`).
P2 = curriculum de concepts et Challenge. P3 = raccrochage des labs à la boucle (M6).

**Impact attendu du P0 seul** : le défi cesse de se répéter à l'identique après trois semaines,
et son terminus devient le point d'accroche du lendemain au lieu d'un bouton « Retour ».
