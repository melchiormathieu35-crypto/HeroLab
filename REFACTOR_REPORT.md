# Hero Lab — Rapport de refactorisation architecturale

Cible : `index4.html` (fichier monolithique courant, 16 288 lignes avant, 16 537 après).
Passe **architecture / maintenabilité / sûreté uniquement**. Aucune fonctionnalité ajoutée,
retirée ou modifiée.

Branche `claude/graphifyy-cli-install-vv16zy` · 11 commits · **66/66 tests au vert**.

---

## 1. Résumé

Sept modules ont été créés, tous par extraction de code existant — aucun comportement réécrit.

| Module | Origine | Responsabilité |
|---|---|---|
| `Storage` | nouveau | point d'accès unique à la persistance |
| `Onboarding` | `App` | création du profil au premier lancement |
| `DataPort` | `App` + `Player` | export / import / réinitialisation |
| `ProfileUI` | `App` | écran de profil |
| `DailyUI` | `App` | défi du jour |
| `JourneyUI` | `App` | frise, missions, maîtrise |
| `SessionCtl` | `App` | cycle de vie session / drill / rapport |

Plus deux déplacements de primitives génériques : `HRUI.sparkline` → `UI.sparkline` et
`App.toast` → `UI.toast`.

**Ordre de travail.** La couche `Storage` a été faite *avant* les extractions : les modules à
sortir manipulaient `localStorage`, les extraire ensuite aurait imposé de déplacer deux fois le
même code.

**Méthode.** Aucune modification n'a été faite sans harnais de régression. Il n'en existait
aucun — ni dans le dépôt, ni ailleurs. Il a donc été construit d'abord (§7), et la baseline du
moteur a été figée **avant** la première ligne modifiée.

### Métriques avant / après

| métrique | avant | après | delta |
|---|---:|---:|---:|
| lignes totales | 16 288 | 16 537 | +249 |
| modules top-level | 92 | 99 | +7 |
| **App — lignes** | **1 957** | **1 414** | **−543 (−28 %)** |
| **App — méthodes** | **61** | **29** | **−32 (−52 %)** |
| App — état déclaré | 10 | 8 | −2 |
| **App — état greffé à l'exécution** | **13** | **2** | **−11 (−85 %)** |
| App — fan-out (modules appelés) | 27 | 31 | +4 |
| App — écritures DOM | 64 | 36 | −28 |
| **modules accédant à `localStorage`** | **10** | **1** | **−9** |
| accès `localStorage` directs | 28 | 5 | −23 |
| **dépendances inter-labs** | **2** | **0** | **−2** |
| moteur gelé pur | oui | oui | = |

Les +249 lignes sont de la documentation de contrat et des en-têtes de module ; le code
exécutable n'a pas grossi.

---

## 2. App — avant / après

### Avant
God Object sur les cinq marqueurs : 1 957 lignes, 61 méthodes, 9 domaines disjoints, 27 modules
sortants pour 7 entrants, et **13 champs d'état greffés à l'exécution** — sa forme réelle
n'était lisible nulle part, il fallait exécuter le programme pour la connaître.

### Après
1 416 lignes, 29 méthodes, **2 champs greffés** (`_homeChart`, `_mentorRewarded`).

Deux champs déclarés (`session`, `sessionReport`) subsistaient après l'extraction de
`SessionCtl` alors que plus rien ne les lisait — résidus morts, repérés par le second passage
Graphify et supprimés.

Composition de ce qui reste :

| bloc | lignes | statut |
|---|---:|---|
| routage / coordination | 96 | cœur légitime |
| boucle de décision (`newHand`, `choose`, `continueHand`) | 186 | cœur légitime |
| rendu de table (`renderPlay`, `renderReview`, `renderActions`…) | 459 | lié à la boucle |
| écrans restants (`renderHome`, `renderSetup`, `renderStats`, `renderLeaks`, `renderTheory`…) | 642 | **extractible — phase suivante** |

### Le fan-out a augmenté, et c'est assumé
27 → 31. `App.render()` doit désormais aiguiller vers six modules de vue supplémentaires, et le
fan-in est passé de 7 à 14 puisque ces modules rappellent `App.go` / `App.newHand`. C'est la forme
attendue d'un routeur : **plus de relations, mais chacune beaucoup plus fine**. Les réductions
qui comptent sont les lignes, les méthodes, l'état et les écritures DOM. Présenter cette hausse
comme un progrès serait malhonnête ; la masquer aussi.

### Ce qui n'a pas été extrait, volontairement
La boucle de décision reste dans `App`. La sortir aurait augmenté le couplage au lieu de le
réduire : elle orchestre le rendu à chaque étape. `SessionCtl` porte l'**état** de session, la
boucle le **lit** — la frontière est explicite.

---

## 3. Storage — avant / après

**Avant** : 10 modules appelaient `localStorage` directement (28 accès), chacun avec son propre
`try/catch` et son propre parsing défensif. Une migration de schéma imposait de toucher
10 endroits, et un stockage indisponible se manifestait différemment selon le module.

**Après** : `modules métier → Storage → localStorage`. Un seul module y accède (5 appels, tous
internes).

API : `get` `set` `remove` `has` `getRaw` `setRaw` `removeAll` `snapshot` `available`.

**Compatibilité.** Aucune clé renommée — les 9 clés historiques (`pivot.v1`, `pivot.career.v1`,
`pivot.player.v1`, `pivot.rating.v1`, `pivot.journey.v1`, `pivot.hr.v1`, `pivot.pr.v1`,
`pivot.bl.v1`, `feutre.v1`) restent les clés physiques. Aucun format de données changé.

**Parité sémantique exacte.** `Storage.get` reproduit littéralement l'ancien `raw ? JSON.parse(raw)
: défaut`, y compris aux bords : une chaîne vide rend le défaut, et la chaîne `"null"` rend bien
`null`. Un test dédié verrouille ces deux cas — sans quoi la centralisation aurait introduit une
différence de comportement invisible.

**StorageGuard** ne fait plus que notifier l'échec. Il n'est plus sur le chemin de persistance.
`Storage` = accès, `StorageGuard` = erreur : les deux responsabilités sont séparées, et un test
échoue si `StorageGuard` se remet à lire ou écrire le stockage.

---

## 4. Leaks — architecture avant / après

**Inchangée, délibérément.** Ce qui a changé, c'est qu'elle est maintenant *mesurée et
documentée*.

Le pont tracker → simulateur existait déjà et fonctionne :

```
Feutre détecte une fuite sur les mains réelles importées
  └─ carte de diagnostic, bouton onclick="SessionCtl.drillLeak('<id>')"
       └─ SessionCtl.drillLeak(leakId)
            ├─ window.Feutre.drillConfig(id) → LEAK_DRILL[id]
            └─ window.Feutre.leakTitle(id)   → LEAK_PLAIN[id].title
                 └─ 10 spots de simulateur ciblés
```

`drillLeak` ayant changé de propriétaire, les chaînes `onclick` générées ont suivi. Un test
vérifie qu'aucun handler ne pointe vers l'ancien propriétaire — une erreur qui ne se serait
sinon manifestée qu'au clic de l'utilisateur.

**Mesure du recouvrement.** Sur les 10 identifiants `LEAK_INFO` (simulateur), **seuls 2 existent
aussi côté tracker** : `bb-underdefend` et `bb-overdefend`. Les 8 autres (`river-call`,
`river-fold`, `overbluff`, `underbluff`, `missed-value`, `thin-value`, `fold-to-3bet`,
`too-passive`) n'ont pas d'équivalent.

**Pourquoi la table canonique n'a pas été écrite.** Établir la correspondance demanderait de
trancher des équivalences métier : `river-call` et `river-callstation` désignent-ils la même
fuite ? `too-passive` recouvre-t-il `call-station` ? Ces réponses engagent la pédagogie du
produit. Les inventer reviendrait à inventer des règles de progression — ce que la mission
interdit explicitement. C'est donc une **TODO documentée** dans le code, au-dessus de
`LEAK_INFO`, avec un test qui fige le recouvrement 2/10 et échouera dès qu'une correspondance
sera ajoutée.

**Conséquence connue et assumée** : une fuite détectée par le tracker déclenche bien un
entraînement ciblé, mais n'apparaît pas comme mission dans `Journey`, dont les missions ne se
construisent que depuis `LEAK_INFO`.

---

## 5. UI — couplages supprimés

`PRUI` et `BLUI` appelaient `HRUI.sparkline()` : une primitive générique de courbe 0–100 logée
dans un lab particulier, et le **seul couplage inter-labs du fichier**. Elle est passée dans
`UI`, corps inchangé — même markup, mêmes classes CSS, même rendu.

Dépendances inter-labs : **2 → 0**.

### Le couplage `renderPlay` → `BoardTex` a été analysé puis **laissé en place**

`App.renderPlay` appelle `BoardTex.madeHand()` pour afficher le nom de la main. La cible
demandée était `ENGINE → GAME RESULT → UI` plutôt que `UI → ENGINE`.

L'analyse montre que la réutilisation est possible mais **indésirable** :

- `Judge.evaluate` retourne bien `made` et `tex`, et `App.analysis` est correctement remis à
  `null` par `newHand` — donc en phase *review* la réutilisation serait exacte.
- Mais `renderPlay` est appelé **majoritairement en phase `decide`, avant toute analyse**. Il
  n'existe alors aucun résultat à réutiliser.
- Le changement imposerait donc une branche conditionnelle sur `App.phase` et sur la fraîcheur
  de `App.analysis`, créant deux chemins pour la même valeur affichée et un risque d'analyse
  périmée que le code actuel **ne peut pas avoir**.

On échangerait un appel pur, sans état et déterministe contre une dépendance à l'état. La
consigne était de ne faire la modification que si elle conserve exactement le comportement, et
le principe final demande d'éviter les abstractions inutiles. **Non fait, à raison.**

---

## 6. Moteur — preuve qu'il est inchangé

Les 8 modules gelés (`Deck`, `HandEval`, `Ranges`, `BoardTex`, `Equity`, `Odds`, `CAT`, `RANKS`)
n'ont **aucune ligne modifiée**. Deux preuves indépendantes.

### 6.1 Empreinte comportementale

Une batterie fixe d'appels moteur est exécutée et hachée. `Equity` dérivant déjà son RNG d'une
signature de ses entrées, et `Deck.shuffle` étant piloté par ce même générateur seedé,
l'empreinte est **exacte et non statistique**.

| sonde | hash | sonde | hash |
|---|---|---|---|
| `deck_full` | `f49bc5f9858770ed` | `boardtex_analyse` | `40185847003e981d` |
| `deck_shuffle` | `53fb6b4f66f37a6f` | `boardtex_made` | `8e6627128dc740d1` |
| `deck_encoding` | `3eefef4f408f454c` | `boardtex_made2` | `82b7aa61c86919e8` |
| `handeval` | `cb73082baf134760` | `equity` | `3a024af7a1f75c67` |
| `ranges` | `35b036a2610503f1` | `odds` | `ee763842e7b3ed45` |

**Ces valeurs ont été figées dans `tests/baseline.json` au commit `f60b3e1`, avant la première
ligne modifiée, et le fichier n'a jamais été réécrit depuis** (`git log --follow` ne montre
qu'un seul commit). Chaque exécution depuis compare le moteur à sa mesure d'avant refactor.

### 6.2 Pureté

Une sonde lit `Function.toString()` de chaque méthode du code **réellement chargé** — pas le
fichier — et cherche `document`, `localStorage`, `innerHTML`, `window.`, `App.`, `UI.`,
`alert(`, `Chart` :

```
Deck      9 méthodes   aucune violation
HandEval  7 méthodes   aucune violation
Ranges   12 méthodes   aucune violation
BoardTex  2 méthodes   aucune violation
Equity    5 méthodes   aucune violation
Odds      7 méthodes   aucune violation
```

Aucune modification n'a nécessité de toucher au moteur ; la condition d'arrêt correspondante
n'a jamais été déclenchée.

---

## 7. Tests

Aucune suite n'existait. `npm test` exécute maintenant un contrôle de syntaxe hors navigateur
puis 65 tests dans Chromium via Playwright.

| famille | n | couverture |
|---|---:|---|
| moteur — empreinte | 14 | `Deck`, `HandEval`, `Ranges`, `BoardTex`, `Equity`, `Odds`, `CAT`, `RANKS` |
| moteur — pureté | 6 | absence de DOM / stockage / couche supérieure |
| intégrité de l'état | 1 | aucun champ orphelin sur `App` (10 champs, propriétaire unique) |
| contrat `Progress.summary` | 3 | 16 champs typés, forme des leaks, stabilité inter-appels |
| stockage | 15 | API, clés historiques, non-renommage, JSON corrompu, clé absente, sémantique historique, quota refusé, stockage indisponible, accès direct interdit |
| intégrité du refactor | 3 | membres fantômes (10 modules croisés), membres déplacés, onboarding fonctionnel |
| ponts Feutre ↔ App | 7 | `drillConfig`, `leakTitle`, fallbacks, workflow drill, alignement des handlers |
| leaks | 2 | recouvrement des taxonomies, résolution des libellés |
| moteur / Studio | 2 | Studio n'écrit pas dans la progression, garde `_studio` présent |
| UI | 5 | navigation 9 vues, rendu racine, ouverture des labs, Modal, sparkline |
| boucle de jeu | 3 | `newHand`, `Judge.evaluate`, déterminisme du verdict |
| export / import | 4 | payload versionné, round-trip sans perte, rejet fichier étranger, rejet illisible |
| santé runtime | 1 | aucune erreur JS en console |

**Résultat : 66/66.** Baseline reproductible sur trois exécutions consécutives avant démarrage.

### Régressions réellement attrapées par le harnais

Le harnais n'a pas servi de décoration — il a arrêté trois erreurs :

1. **Collision de préfixe.** Le renommage `App.renderProfile → ProfileUI.renderProfile` a aussi
   frappé `App.renderProfiles` (écran des profils de vilains), cassant la navigation. Trois
   tests ont été ajoutés pour rendre cette classe d'erreur impossible à laisser passer.
2. **JS invalide.** `importAll` étant le dernier membre de `Player`, il n'avait pas de virgule
   finale ; la concaténation produisait un fichier non parsable. D'où le contrôle de syntaxe
   préalable, qui échoue en une seconde avec un numéro de ligne au lieu de faire expirer
   Playwright.
3. **Pont déplacé.** `drillLeak` changeant de propriétaire, un test vérifie que les chaînes
   `onclick` générées suivent — sinon la panne n'apparaîtrait qu'au clic.

Deux bugs de mon propre outil d'extraction ont aussi été corrigés plutôt que contournés : le
scanner d'accolades ne gérait pas les interpolations de template (`${…}` augmentait la
profondeur sans jamais la réduire), puis fermait une interpolation au premier bloc imbriqué. Il
mémorise désormais la profondeur d'entrée de chaque interpolation, et refuse toute coupe de
taille implausible.

---

## 8. Graphify — comparaison avant / après

Deux extractions indépendantes, avant et après. **Précaution de lecture** : ce sont deux passes
LLM distinctes (100 nœuds / 215 arêtes avant, 89 / 188 après), donc les valeurs absolues ne sont
pas strictement comparables. Le graphe sert d'instrument de comparaison, pas de vérité — les
métriques statiques du §1 restent la mesure de référence.

### Hubs

| avant (degré) | après (degré) |
|---|---|
| App — 23 | App — 26 |
| Studio — 22 | **SessionCtl — 14** |
| Deck — 13 | **Storage — 11** |
| Ranges — 13 | **DataPort — 11** |
| StorageGuard — 11 | LEAK_INFO — 9 |
| BoardTex — 10 | Spot / Progress / Player / ProfileUI / HRUI — 8 |

Lecture favorable : `Storage`, `SessionCtl` et `DataPort` apparaissent comme des hubs **nommés**
là où il n'y avait rien — la responsabilité qu'ils portent était auparavant diffuse dans `App`.
`StorageGuard`, qui figurait en 5ᵉ hub avant, quitte le classement : il n'est plus sur le chemin
de persistance. Communautés : 7 → 9, décomposition plus fine.

### Ce que Graphify a trouvé et que j'avais manqué

L'extraction a signalé que `App` déclarait encore `session` et `sessionReport` après l'extraction
de `SessionCtl`, alors que toutes les lectures avaient été renommées : **deux champs morts,
résidus de ma propre extraction**. Vérifié, confirmé, corrigé. Mon test de membres fantômes ne
pouvait pas le voir — il n'inspecte que les sites d'appel. Un test dédié aux champs d'état a été
ajouté.

### Le résultat défavorable

**La centralité d'intermédiarité d'`App` a augmenté : 0,325 → 0,554.**

C'est l'inverse du critère §22 « réduire le couplage de App ». Ce n'est pas un artefact
d'échantillonnage : la métrique statique le confirme indépendamment — fan-out 27 → 31, fan-in
7 → 14.

Mécanisme mesuré : les six modules extraits rappellent `App` 49 fois, dominées par trois
primitives — `App.toast` ×15, `App.go` ×12, `App.newHand` ×6. Chaque écran passe désormais par
`App` pour naviguer et notifier, ce qui place `App` sur davantage de plus courts chemins.

**Correctif appliqué immédiatement** : `App.toast` → `UI.toast`. C'est une primitive de
notification générique, exactement le même cas que `HRUI.sparkline` — la laisser dans le routeur
obligeait six modules à le rappeler pour afficher un message. Rappels vers `App` : **49 → 34
(−31 %)**, corps et CSS inchangés.

**Diagnostic honnête.** Par *responsabilité*, `App` n'est plus un God Object : 1 428 lignes,
30 méthodes, 2 champs greffés, un métier cohérent. Par *connectivité*, il est plus central
qu'avant : c'est le point de passage obligé de toutes les vues. C'est le compromis réel d'une
extraction de vues hors d'un monolithe sans introduire de médiateur ou de bus d'événements — et
introduire l'un des deux aurait été précisément l'abstraction artificielle que le §22 interdit.
Le critère §22 est donc **partiellement atteint**, et la voie de réduction est identifiée (§10).

---

## 9. Risques restants — non modifiés volontairement

| # | Sujet | Pourquoi laissé en l'état |
|---|---|---|
| 1 | **642 lignes d'écrans encore dans `App`** (`renderHome` 149, `renderStats` 78, `renderSetup` 77, `renderLeaks` 70, `renderTheory` 54…) | Hors du périmètre listé. Extractibles proprement en phase suivante (`HomeUI`, `StatsUI`). |
| 2 | **`V` — 758 lignes, second God Object** | La mission demande de ne pas le refactorer agressivement. Vérification faite : `V` et `FT` ne sont **pas** globaux (`window.V === undefined`), la frontière Feutre est mécaniquement étanche, surface publique de 4 exports. Aucune fuite. `TODO — phase suivante`. |
| 3 | **`Feutre.controller: FT` exporté** | Expose l'objet contrôleur entier alors que seuls `open`/`drillConfig`/`leakTitle` sont utilisés côté Pivot. Réduction possible, mais toucher la surface publique sans nécessité aurait été un risque gratuit. |
| 4 | **`HRStats` / `PRStats` / `BLStats` triplés** | Analysés (§12 de la mission) : API quasi identique, mais `summary()` retourne des formes **réellement divergentes** — HR `{avg,avgTime,perfect,spots,streak}`, PR ajoute `avgHands,exact`, BL ajoute `bestStreak,exact,exactRate` ; BL a en plus `diagnostics`/`hasFlushBoard` et n'a pas `last30`/`strengths`. Une primitive commune devrait abstraire trois payloads différents : **gain non démontrable, abstraction artificielle refusée.** |
| 5 | **`RangeModel` / `ProfileModel` — même algorithme bayésien** | Même raisonnement. Duplication simple et lisible préférée à une abstraction couplée. |
| 6 | **2 champs encore greffés sur `App`** (`_homeChart`, `_mentorRewarded`) | Liés respectivement au graphe d'accueil et à la boucle de décision, tous deux restés dans `App`. À déclarer lors de l'extraction de `HomeUI`. |
| 8 | **Centralité d'`App` en hausse** (betweenness 0,325 → 0,554) | Seul critère §22 non atteint. Mécanisme identifié et partiellement corrigé (§8) ; la suite est le point 1 du §10. |
| 7 | **Portée globale** | Non convertie en modules ES, conformément à la mission. Aucun global inutile ajouté : les 7 nouveaux sont tous des propriétaires de responsabilité. |

---

## 10. Prochaines étapes

Par valeur décroissante, et uniquement ce qui reste réellement pertinent :

1. **Réduire la centralité d'`App`** — c'est le point faible restant (§8). Les 34 rappels sont
   maintenant dominés par `App.go` (navigation) et `App.newHand` (entrée de boucle). Un objet
   `Router` minimal portant `go`/`view`/`TITLES` retirerait la navigation d'`App` sans médiateur
   ni bus d'événements. À faire **avant** toute nouvelle extraction, sinon chaque module ajouté
   aggrave la centralité.
2. **Extraire `HomeUI` et `StatsUI`** — ~640 lignes, même patron que les six extractions
   réussies. Ramènerait `App` sous les 800 lignes, essentiellement routage + boucle + rendu de
   table. Les deux derniers champs greffés disparaîtraient avec.
3. **Trancher la table canonique des identifiants de fuites** (§4). C'est une décision produit,
   pas technique. Une fois prise, le câblage est trivial : le pont existe déjà et le test de
   recouvrement signalera le changement.
4. **Réduire la surface publique de Feutre** en retirant `controller: FT` si rien ne le consomme
   côté Pivot — à vérifier avant.
5. **Étendre le harnais aux parcours utilisateur complets** (session entière, drill de bout en
   bout, import Winamax réel). Les tests actuels couvrent les contrats et les points d'entrée,
   pas des scénarios longs.
6. **Ne pas** fusionner les trois `*Stats` ni les deux modèles bayésiens tant qu'un besoin réel
   ne l'impose pas.
