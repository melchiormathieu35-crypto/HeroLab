# Contre-audit adversarial de la correction P0.1

Mandat : attaquer la correction `transform:none!important` sur `#v-tracker .sidebar`
et le test `PHASE4_DEEP_LEARNING/tests/p0_1_tracker_mobile.js` qui prétend la valider.

Aucun fichier applicatif n'a été modifié. Les mutants utilisés sont des copies
placées dans `mutants/`. Tous les scripts, captures et journaux JSON de ce rapport
sont dans ce répertoire et rejouables.

| Sonde | Fichier | Objet |
|---|---|---|
| 1 | `adv1_parcours_strict.js` | parcours par clics seuls + vérification stricte de la vue obtenue |
| 2 | `adv2_parcours_reel.js` | parcours complet avec 200 vraies mains importées, à 360×800 |
| 3 | `adv3_regression_visuelle.js` | régression visuelle base/corrigé sur 9 géométries |
| 4 | `adv4_balayage_vues.js` | atteignabilité des 14 vues de l'hôte, 6 géométries |
| 5 | `adv5_signature_p01.js` | détecteur générique de la signature « tiroir hors champ » |
| 6 | `adv6_discriminant.js` | y a-t-il une commande pour rouvrir le tiroir ? |
| 7 | `adv7_cibles_tactiles.js` | taille des cibles tactiles de la navigation révélée |
| 8 | `adv8_suite_aveugle.js` | ce que `tests/browser.js` ne voit pas |

---

## 0. Ce qui résiste à l'attaque

Il faut le dire d'emblée, parce que c'est le résultat principal.

**Le défaut est réel.** Sonde 6, à 360×800, sur `VERSION_PRODUCTION/herolab.html` :
la barre latérale du Tracker a `transform: matrix(1, 0, 0, 1, -332, 0)`, son bord
gauche est à `x = -318` pour 332 px de large — 96 % hors champ. Et surtout, il
n'existe **aucune commande** pour la ramener :

```
[base] ftBurgerVisible: false   ftBurgerDisplay: "none"
       openMenuChangeClasse: false   classeApresOpenMenu: "sidebar"
```

Le burger propre au Tracker est neutralisé par `#v-tracker .burger{display:none!important}`
(l. 1706) et `FT.openMenu` est réassigné à une fonction vide (l. 16395). La règle
`#v-tracker .sidebar.open{transform:none}` de la media query est donc **du code mort** :
la classe `open` ne peut jamais être posée. Le tiroir était fermé pour toujours.

**La correction fonctionne, y compris pour un utilisateur réel.** Sonde 2, 360×800,
onboarding franchi, Tracker atteint **uniquement par des clics** (burger de l'hôte →
onglet « Tracker » du rail), 200 mains Winamax synthétiques importées par
`setInputFiles` sur le vrai champ de fichier :

```
PASS  Tracker atteint par clics
PASS  import de 200 mains pris en compte (compteur = 200)
PASS  chaque onglet active la bonne vue (avec données)
PASS  aucun débordement horizontal à 360px
PASS  la vue Analyse liste des fuites (11) avec bouton d'exercice (10)
PASS  lancer un exercice depuis une fuite mène à la table (view=play)
PASS  retour au Tracker par clics après l'exercice
10 PASS, 0 FAIL
```

Le même parcours sur la baseline : **6 PASS, 6 FAIL**. L'utilisateur peut y importer
ses 200 mains — la vue Import est celle sur laquelle le Tracker s'ouvre par défaut —
puis ne peut **plus jamais** consulter le moindre résultat : les 8 autres onglets sont
inatteignables. C'est le scénario le plus cruel possible pour le produit, et il est
corrigé.

**La correction n'introduit aucune régression de mise en page.** Sonde 3, captures
comparées par empreinte SHA-1 sur 9 géométries (les 5 imposées + 2 rotations paysage
+ les deux bornes 760/761 px) :

| géométrie | accueil identique | Tracker identique | `transform` (corrigé) |
|---|---|---|---|
| 360×800 | OUI | NON | `none` |
| 390×844 | OUI | NON | `none` |
| 412×915 | OUI | NON | `none` |
| 768×1024 | OUI | **OUI** | `none` |
| 1280×800 | OUI | **OUI** | `none` |
| 800×360 paysage | OUI | **OUI** | `none` |
| 844×390 paysage | OUI | **OUI** | `none` |
| 760×900 (borne) | OUI | NON | `none` |
| 761×900 (borne) | OUI | **OUI** | `none` |

La correction change exactement ce qu'elle doit changer, exactement là où la media
query s'applique (`max-width:760px`), et rien ailleurs. La vue d'accueil est
**octet pour octet identique** partout. La rotation est sans effet : toutes les
largeurs en paysage dépassent 760 px.

Mieux : `contenuY`, l'ordonnée du panneau de contenu, est **identique** entre la
baseline et la copie corrigée à **toutes** les géométries (566, 490, 490, 517, 515,
517, 515, 490, 517). La correction ne déplace donc aucun pixel de contenu ; elle se
contente de remplir un vide. La baseline réservait déjà les 451 px verticaux de la
barre latérale — `position:static!important` l'emportait sur le `position:fixed` de la
media query — et n'y affichait rien. La capture `shots/adv3_base_360x800_tracker.png`
montre ce vide béant de 451 px sous la barre de titre.

**Aucune autre vue n'est inatteignable.** Sondes 4 et 5, 14 onglets du rail × 6
géométries (320×568 incluse), clics réels avec test de recouvrement par
`elementFromPoint` : `onglets non cliquables : aucun`, `vue obtenue ≠ demandée :
aucune`, `contrôles de second niveau inatteignables : AUCUN`, à toutes les
géométries. Le détecteur générique de la sonde 5 (conteneur > 90 % hors champ
horizontal contenant des éléments focusables) ne remonte plus, sur la copie corrigée,
que le rail de l'hôte — qui, lui, dispose d'un burger visible et opérant (vérifié :
les 14 onglets sont cliquables après clic sur `#burger`). Sur la baseline, le même
détecteur remonte bien `aside#sidebar.sidebar` aux quatre géométries sous 760 px,
ce qui valide qu'il n'est pas aveugle.

**Les suites existantes restent au vert** sur la copie corrigée : `tests/regression.js`
79 PASS / 0 FAIL, `tests/browser.js` 37 PASS / 0 FAIL. Le test P0.1 est déterministe
(30 PASS sur 3 exécutions consécutives).

---

## Objection 1 — FATALE (pour le test, pas pour la correction)

### Le test ne mesure pas ce qu'il annonce : trois mutants le passent à 30/30

C'est la démonstration centrale de ce contre-audit. J'ai fabriqué trois copies de la
version **corrigée** dans lesquelles le Tracker est cassé d'une manière évidente pour
un utilisateur, et j'ai relancé le test officiel, sans le modifier.

| Mutant | Ce qui est cassé | `p0_1_tracker_mobile.js` |
|---|---|---|
| `M1_nav_morte.html` | `FT.go` ne bascule plus jamais la vue affichée : les 9 onglets sont cliquables, l'onglet s'allume, mais la page ne change **jamais** de contenu | **30 PASS, 0 FAIL** |
| `M2_nav_invisible.html` | `#v-tracker .sidebar{opacity:0!important}` : la navigation est totalement invisible à l'œil | **30 PASS, 0 FAIL** |
| `M3_contenu_vide.html` | chaque vue est remplacée après le clic par « Erreur de chargement des données du Tracker. » | **30 PASS, 0 FAIL** |

Reproduction :

```
node PHASE4_DEEP_LEARNING/tests/p0_1_tracker_mobile.js \
     PHASE4_DEEP_LEARNING/audits/adv_p01/mutants/M1_nav_morte.html
```

Trois causes, toutes dans l'assertion « chaque vue affiche du contenu après clic » :

1. **Elle ne vérifie jamais que la vue obtenue est la vue demandée.** Le code lit
   `document.querySelector("#v-tracker .ft-view.active")` — *la* vue active, quelle
   qu'elle soit — et ne la compare pas à `v`. M1 exploite exactement cela : le
   tableau de bord reste actif pour les neuf clics, ses 72 caractères passent le
   seuil, neuf fois de suite. Le message de commit affirme « les onglets passent de
   zéro à neuf sur neuf » ; l'assertion qui devrait établir ce neuf sur neuf ne
   distingue pas neuf vues d'une seule.

2. **Le seuil de 20 caractères ne distingue rien.** Sonde 1, longueurs réellement
   mesurées sur la copie corrigée sans données :
   `dashboard:72 graphs:76 preflop:75 postflop:76 positions:75 analyse:71 review:69
   hands:69 import:323`. Ce sont des **états vides** — le message « Échantillon trop
   court » et ses variantes. Le test valide donc un Tracker qui n'affiche rien d'autre
   que des placeholders, et M3 confirme qu'un message d'erreur passe tout aussi bien.
   C'est bien « compter des caractères », pas constater qu'une vue s'affiche.

3. **L'actionnabilité de Playwright ne couvre pas la visibilité perçue.** Elle vérifie
   `display`, `visibility`, la stabilité et le fait d'être dans le viewport — pas
   l'opacité. M2 le prouve : navigation invisible, test au vert.

Ma propre sonde 1 attrape M1 (5 FAIL, un par résolution, sur l'assertion « chaque clic
active EXACTEMENT la vue demandée ») mais **laisse passer M2 et M3** : je ne teste ni
l'opacité ni la sémantique du contenu. Je ne prétends donc pas avoir écrit le bon test,
seulement avoir montré que celui qui existe ne suffit pas.

**Correctif minimal proposé** — remplacer, dans la boucle de la seconde assertion :

```js
const n = await page.evaluate(() => {
  const p = document.querySelector("#v-tracker .ft-view.active");
  return p ? (p.innerText || "").trim().length : -1;
});
if (n < 20) echecs.push(`${v} (contenu ${n} car.)`);
```

par une vérification d'identité et d'unicité de la vue active, et une comparaison des
contenus deux à deux (deux onglets ne doivent pas rendre le même texte) :

```js
const st = await page.evaluate(() => {
  const a = [...document.querySelectorAll("#v-tracker .ft-view.active")];
  return { ids: a.map(e => e.id), txt: a[0] ? (a[0].innerText || "").trim() : "" };
});
if (st.ids.length !== 1 || st.ids[0] !== "v-" + v) echecs.push(`${v} -> ${st.ids.join(",") || "aucune"}`);
if (vus.has(st.txt)) echecs.push(`${v} (contenu identique à ${vus.get(st.txt)})`);
vus.set(st.txt, v);
```

Cette variante fait tomber M1 et M3. Pour M2, il faut ajouter une lecture de
`getComputedStyle(sidebar).opacity` ou une comparaison de captures.

---

## Objection 2 — SÉRIEUSE

### Deux des cinq assertions par résolution testent le code, pas l'utilisateur

Le test se présente comme « un test de PARCOURS, pas une propriété de rendu ». Deux de
ses assertions sont pourtant des appels programmatiques déguisés en gestes :

- « **le Tracker s'ouvre depuis l'accueil** » exécute `App.go("home"); App.go("tracker");
  Feutre.open();` dans `page.evaluate` et vérifie `App.view === "tracker"`. Cela vérifie
  qu'une affectation de variable a eu lieu. Personne n'a cliqué sur rien. Si l'onglet
  « Tracker » du rail était lui-même hors champ — précisément le défaut que P0.1
  corrige, un étage plus haut — l'assertion resterait verte.
- « **retour à l'accueil possible** » exécute `App.go("home")` et vérifie `App.view === "home"`.
  Même remarque.

Ces deux assertions sont vraies sur le fond : ma sonde 1 le confirme par de vrais clics
(burger → onglet du rail) aux 5 résolutions, 25 PASS / 0 FAIL sur la copie corrigée.
Mais leur intitulé promet une capacité utilisateur que leur corps ne mesure pas. C'est
exactement le mode de défaillance que le message de commit dit avoir éliminé.

### « Aucune régression, 37 tests navigateur au vert » est un artefact

Sonde 8. `tests/browser.js` applique son assertion tactile à
`document.querySelectorAll("button, .btn, [onclick]")` en ignorant les éléments de
taille nulle. Comme la suite **n'ouvre jamais le Tracker**, `#v-tracker` reste
`display:none` et ses boutons sont exclus du décompte. J'ai rejoué la même assertion,
mot pour mot, une fois le Tracker ouvert :

```
[base] 360x800  Tracker fermé : 0 cible(s) < 44px | Tracker ouvert : 9
[p4]   360x800  Tracker fermé : 0 cible(s) < 44px | Tracker ouvert : 9
```

Le vert des 37 tests ne dit donc rien du Tracker, ni avant ni après P0.1. Il ne peut pas
servir de preuve de non-régression pour une correction dont le Tracker est l'unique
objet. La preuve de non-régression tient, mais elle vient d'ailleurs : de la comparaison
de captures de la sonde 3, pas de cette suite.

### La navigation révélée viole le seuil tactile que l'application s'impose

Sonde 7. Les 9 onglets du Tracker mesurent **32 px** de haut à 360×800, 412×915 et
768×1024, contre **44 px** pour les onglets du rail de l'hôte. Le bloc
`@media (max-width:820px)` porte le commentaire « 44px est le seuil au-delà duquel une
cible se vise sans erreur au pouce » et relève `.tab`, `.btn`, `.burger`, `.ob-avatar`,
`.ob-link` — mais pas `#v-tracker .ft-nav-item`, dont le `padding:7px 13px!important`
verrouille la hauteur.

Ce n'est pas une régression : les 32 px préexistaient. Mais avant P0.1 ils étaient hors
champ et sans conséquence ; après P0.1 ils constituent **la** navigation du Tracker sur
mobile. Le titre de commit « le Tracker devient utilisable sur mobile » est donc en
avance sur la mesure : il devient atteignable, il n'est pas encore conforme au standard
tactile que le projet s'est donné.

---

## Objection 3 — MINEURE

### Le correctif est au bon endroit, mais laisse quatre règles mortes derrière lui

`transform:none!important` est la correction la plus sûre : une propriété, portée
strictement limitée à `#v-tracker .sidebar`, gagnante par `!important` quel que soit
l'ordre des sources, sans effet au-dessus de 760 px (vérifié : `transform` valait déjà
`none` sur la baseline à 768, 800, 844, 1280 et 761 px). Aucune animation ne dépend du
`transform` de cet élément. Je ne trouve rien à lui reprocher sur le plan du risque.

La correction plus juste évoquée dans le mandat existe pourtant. Le bloc

```css
@media (max-width:760px){
#v-tracker .sidebar{ position:fixed;left:0;top:0;bottom:0;
    transform:translateX(-100%);transition:transform .26s ...; }
#v-tracker .sidebar.open{transform:none}
#v-tracker .scrim.on{display:block;...}
#v-tracker .burger{display:block}
  ...
}
```

est **intégralement mort** dans le contexte d'intégration, et la sonde 6 le prouve :
`.open` ne peut jamais être posée (`FT.openMenu` vidé), `.scrim` et `.burger` sont
déjà neutralisés par `display:none!important` (l. 1706). Supprimer ces quatre règles
de la media query aurait supprimé la cause au lieu de la contrer, et rendu inutiles
trois des cinq `!important` du bloc l. 1707.

Le choix retenu ajoute une quatrième surcharge à un bloc qui en comptait déjà quatre
(`position`, `width`, `height`, `z-index`) sans corriger le fait que ce bloc **est**
la fragilité : toute propriété future ajoutée à la media query et absente de la liste
de surcharge reproduira le défaut à l'identique. Le mutant M2 illustre la classe
exacte : `opacity` n'est pas dans la liste, et ni le test officiel ni le mien ne
verraient passer une régression de ce type. La correction est bonne ; le piège reste
armé pour le prochain qui touchera ce bloc.

### La navigation occupe 71 % du premier écran (et 100 % en paysage)

Sonde 3, colonne `partNav` = ordonnée du premier pixel de contenu ÷ hauteur du viewport :
0,71 à 360×800 ; **1,44 à 800×360** et **1,32 à 844×390**. En orientation paysage, le
premier écran du Tracker ne montre **que** de la navigation, pas une ligne de contenu
(capture `shots/adv3_p4_800x360-paysage_tracker.png`).

Ce n'est pas imputable à P0.1 — `contenuY` est identique sur la baseline, et en paysage
la media query ne s'applique même pas — mais cela relativise « le Tracker devient
utilisable sur mobile ». `FT.go` termine par `window.scrollTo({top:0})` : après chaque
changement d'onglet, l'utilisateur est ramené en haut, face au pavé de navigation, avec
le contenu qu'il vient de demander sous la ligne de flottaison.

### Fausse alerte que j'ai levée moi-même

Ma première passe de la sonde 3 signalait une différence de capture entre baseline et
copie corrigée en 800×360 sur l'état « menu de l'hôte ouvert ». C'était un artefact de
ma propre mesure : la capture tombait pendant la transition de 0,26 s du rail. Avec
900 ms d'attente, les trois empreintes (base, base rejouée, corrigé) sont identiques —
`30d9f93681`. Aucune régression sur le menu de l'hôte ouvert depuis le Tracker, à
aucune géométrie ; et la sortie du Tracker par ce menu fonctionne partout
(`sortie menu = home`, 9 géométries sur 9).

---

## Verdict

**Le défaut P0.1 est réellement corrigé. La preuve avancée pour l'établir ne vaut pas.**

Ce sont deux jugements distincts et il faut les tenir séparés.

Sur la correction : elle est juste, correctement portée, sans régression mesurable, et
elle débloque un parcours utilisateur complet — onboarding, import de 200 mains
réelles, consultation des 11 fuites détectées, lancement d'un exercice, retour — qui
était impossible à 360×800 et qui l'est encore sur `VERSION_PRODUCTION/herolab.html`.
Aucune autre vue inatteignable n'a été trouvée, à aucune des six géométries balayées,
ni au premier ni au second niveau de navigation.

Sur le test : il passe à 30/30 sur trois mutants qui rendent le Tracker inutilisable —
navigation morte, navigation invisible, contenu remplacé par un message d'erreur. Son
assertion centrale ne vérifie pas que le clic mène à la vue demandée, et son seuil de
20 caractères est franchi par des états vides de 69 à 76 caractères. Deux de ses cinq
assertions appellent `App.go()` au lieu de cliquer. Le « 37 tests navigateur au vert »
invoqué comme preuve de non-régression provient d'une suite qui n'ouvre jamais le
Tracker et ignore ses 9 boutons.

Le commit a documenté avec honnêteté trois défauts du test corrigés pendant sa mise au
point, en concluant qu'il mesurait enfin ce qu'il prétend. Ce contre-audit établit
qu'il en restait un quatrième, de la même famille : un résultat plausible et faux.
La correction P0.1 est acquise ; le test qui la garde ne la garderait pas.

**À faire avant de considérer P0.1 clos :**

1. Réparer l'assertion de contenu (identité et unicité de la vue active, unicité des
   contenus entre onglets) — fait tomber M1 et M3, correctif fourni ci-dessus.
2. Remplacer les deux `App.go()` par des clics réels sur `#burger` puis
   `.rail .tab[data-v="tracker"]` — la sonde 1 montre que cela passe.
3. Étendre `tests/browser.js` pour qu'il ouvre le Tracker avant ses assertions
   tactiles, puis porter `#v-tracker .ft-nav-item` à 44 px sous 820 px.
4. Décider du sort du bloc mort de `@media (max-width:760px)` : le supprimer clôt la
   classe de défaut au lieu de la contenir.
