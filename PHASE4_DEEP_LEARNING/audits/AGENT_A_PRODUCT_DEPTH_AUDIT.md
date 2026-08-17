# AGENT A — Audit produit de profondeur

**Objet** : HeroLab en tant que *produit d'apprentissage*, pas en tant que code.
**Base auditée** : `VERSION_PRODUCTION/herolab.html` (16 410 l.), non modifiée.
**Convention** : `[V]` = vérifié (lecture de ligne citée ou exécution). `[H]` =
hypothèse / jugement produit, explicitement non prouvé par le code.

Toutes les lignes citées renvoient à `VERSION_PRODUCTION/herolab.html` sauf
mention contraire.

---

## 0. Trois mesures faites pour cet audit (exécution)

Ces trois-là ne sont pas dans `_CONTEXTE_PARTAGE.md` et fondent l'essentiel du
rapport.

| # | Mesure | Méthode | Résultat |
|---|---|---|---|
| M1 | Les 29 fuites du tracker se réduisent à combien de configurations d'entraînement distinctes ? | `node` + `tests/harness.js`, regroupement de `LEAK_DRILL` par `{mode, forcePos, facing}` | **10 configurations pour 29 fuites** |
| M2 | Le coût cumulé d'une fuite peut-il baisser ? | `node`, injection de 200 décisions dans `Progress`, relevé de `summary().leaks[0].loss` à 4 jalons | 23,8 → 47,6 → 70,0 → 93,8 · **strictement croissant** |
| M3 | Combien de vues déclarées sont atteignables par l'UI ? | Croisement `id="v-*"` (l.2112-2218) × onglets `data-v` (l.2073-2091) × occurrences de `App.go(` | **18 vues déclarées, 15 atteignables, 3 inatteignables** |

Détail de M1 — les regroupements réels :

```
8 fuites → {mode:"flop"}     : call-station, maniac, fold-flop, cbet-low,
                               cbet-high, bet-too-big, bet-too-small, no-checkraise
6 fuites → {mode:"preflop"}  : loose, nit, limp, low-3bet, high-3bet, vpip-pfr-gap
4 fuites → {mode:"river"}    : no-value, river-callstation, river-undervalue,
                               showdown-curious
2 → {preflop,SB} · 2 → {pot3bet} · 2 → {preflop,BB,facing} · 2 → {turn}
1 → {preflop,UTG} · 1 → {preflop,BTN} · 1 → {multiway}
```

**Conséquence produit** : une fuite et son exact opposé reçoivent le *même*
entraînement. `cbet-low` (« tu ne continues pas assez ») et `cbet-high` (« tu
continues trop ») → configuration identique. Idem `bet-too-big`/`bet-too-small`,
`bb-underdefend`/`bb-overdefend`, `loose`/`nit`, `low-3bet`/`high-3bet`,
`sb-loose`/`sb-overdefend`. [V]

---

## 1. Proposition de valeur réelle, et différenciation

### 1.1 Ce que le produit fait réellement, lu dans le code

Trois briques, techniquement solides, chacune de qualité :

1. **Un simulateur exploitatif.** `Judge.evaluate` (l.4145-4181) classe la
   décision en comparant l'EV de chaque option contre une range adverse
   *modélisée par profil*, pas contre un équilibre. Le produit le revendique
   noir sur blanc : « Ce n'est pas un solveur : aucune résolution d'équilibre
   n'est effectuée » (l.8300-8304). Les 9 profils portent de vrais paramètres
   comportementaux (VPIP/PFR/3Bet/CBet/AF, l.8249-8256) qui pilotent la
   décision adverse. [V]
2. **Trois laboratoires de déduction** : Range Detective (lire la main
   adverse), Profiling Lab (identifier le type de joueur), Blocker Finder
   (l'effet de ses propres cartes). `RangeModel.prior/applyAction/posterior`
   (l.8868+) rend le raisonnement *traçable* : chaque pondération renvoie une
   raison affichable (l.8859-8861). [V]
3. **Un tracker de mains réelles intégré** : parsing de historiques,
   9 vues, 59 KPI, détection de 29 fuites (`Leaks.detect`, appelée l.15928),
   avec traduction grand public (`LEAK_PLAIN`) et un mode Débutant/Expert
   (l.15940-15969). [V]

### 1.2 Différenciation, honnêtement

| | GTO Wizard | PokerTracker / HM3 | Upswing | HeroLab |
|---|---|---|---|---|
| Référence de vérité | solveur (équilibre) | aucune (stats brutes) | l'auteur du cours | **modèle exploitatif par profil** [V l.8300] |
| Adversaire | nœud d'arbre | absent | absent | **9 profils comportementaux** [V l.8244-8262] |
| Entraîne la *lecture* | non | non | partiellement | **oui, 3 labs dédiés** [V] |
| Vos vraies mains | non | oui | non | **oui, importées** [V l.13913-13939] |
| Verdict sur vos vraies mains | non | non | non | **non plus** — voir §2.3 |
| Prix / friction | abonnement | licence + install | abonnement | fichier unique, hors-ligne, sans compte [V : 9 clés `localStorage`, aucun appel réseau] |
| Langue | EN | EN | EN | FR |

**La proposition de valeur réelle et défendable** : *le seul outil qui te dise
quoi faire contre **ce joueur-là**, puis qui t'entraîne à le reconnaître.*
Ni GTOW (qui suppose l'adversaire parfait), ni PT4 (qui décrit sans juger),
ni Upswing (qui explique sans mesurer) ne couvrent ça.

**La proposition de valeur *promise* mais non tenue** : *« importe tes vraies
mains → on trouve tes fuites → on t'entraîne dessus → on vérifie que c'est
corrigé »*. Le produit affiche ce récit (l.7400 : « Réimporte tes prochaines
sessions pour confirmer que ça tient à la table ») mais deux maillons sur
quatre sont cassés (§2.3 et §2.4). [V]

### 1.3 Le contre-positionnement le plus fort, non exploité

`Judge.evaluate` (l.4145) prend une table et une décision et rend un verdict +
un coût en bb. `Parser.parseFile` (l.13914) produit des mains réelles
normalisées. **Les deux ne se rencontrent jamais.** Aucune main importée n'est
jamais passée au juge : la vue « Mains à revoir » (l.16013-16049) se contente
de *trier* par taille de pot et de conseiller au joueur de faire le travail
lui-même (« Reprends chaque main street par street et cherche le moment où tu
aurais pu passer », l.16043). `handRow` (l.16153-16202) n'affiche qu'un
déroulé textuel ; `bindHandRows` (l.16203-16207) ne fait qu'ouvrir/fermer. [V]

Or « voici l'EV de ce que tu as fait vs. la meilleure ligne, sur **ta** main
d'hier soir » est exactement ce qu'aucun concurrent ne propose. Le produit a
les deux moitiés et ne les branche pas. [V pour le constat ; [H] pour la
valeur marché]

---

## 2. La core loop

### 2.1 La boucle telle qu'elle est câblée

```
                        ┌──────────────────────────┐
                        │  ACCUEIL (l.6629)        │
                        │  rating · radar · récit  │
                        │  1 bouton « reprendre »  │
                        └────────────┬─────────────┘
                                     │ resumeAction() l.6778
                     ┌───────────────┼────────────────┬─────────────────┐
                     │ si défi non   │ si carrière    │ si leak         │ sinon
                     │ fait          │ commencée      │ détecté         │
                     ▼               ▼                ▼                 ▼
             ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
             │ DÉFI DU JOUR │ │  CARRIÈRE   │ │ trainLeak()  │ │  TABLE libre │
             │  10 spots    │ │ 50/200/500  │ │  l.8220      │ │  l.7167      │
             │  l.7158      │ │  mains      │ │              │ │              │
             └──────┬───────┘ └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
                    │                │               │                │
                    └────────────────┴───────┬───────┴────────────────┘
                                             ▼
                                 ┌───────────────────────┐
                                 │  TABLE — 1 décision   │
                                 │  Judge.evaluate 4145  │
                                 │  Progress.record 4724 │
                                 └───────────┬───────────┘
                                             │
                       ┌─────────────────────┼──────────────────────┐
                       ▼                     ▼                      ▼
              ┌────────────────┐    ┌─────────────────┐   ┌──────────────────┐
              │ tagStats +=    │    │ mastery +=      │   │ session.leakCounts│
              │ (l.4735) ─────┐│    │ (l.7289)        │   │ (l.7276)          │
              └────────────────┘│   └─────────────────┘   └──────────────────┘
                                │
                       ┌────────▼─────────┐
                       │ worstLeak 4823   │────► « Ta priorité » (accueil 6715)
                       │ focusFor 4829    │────► mode du défi / du ciblé
                       └──────────────────┘

    ────────── BOUCLE PARALLÈLE, PRESQUE DISJOINTE ──────────

     ┌──────────────┐   ┌────────────────┐   ┌──────────────────────┐
     │ IMPORT .txt  │──►│ Leaks.detect   │──►│ App.drillLeak(id)    │
     │ l.16287      │   │ 29 fuites      │   │ l.8327 · 10 spots    │
     │ Store feutre │   │ vue « Analyse »│   │ via Feutre.drillConfig│
     └──────────────┘   └────────────────┘   └──────────┬───────────┘
              ▲                                          │
              │                                          ▼
              │                            ┌──────────────────────────┐
              └────────────────────────────│ bilan drill (l.7392)     │
                 « réimporte pour vérifier »│ endDrill → tracker 8344  │
                 (message l.7400)           └──────────────────────────┘

    ────────── TROISIÈME BOUCLE, ISOLÉE ──────────

     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ HR lab   │  │ PR lab   │  │ BL lab   │   1 spot → révélation → « spot
     │ l.10060  │  │ l.11xxx  │  │ l.13xxx  │   suivant » ou « terminer »
     └────┬─────┘  └────┬─────┘  └────┬─────┘   (l.10547-10550)
          └─────────────┴─────────────┘
                        ▼
             HRStats / PRStats / BLStats
                        ▼
               Rating.skills() l.6260  ──► rating affiché sur l'accueil
```

**Il y a donc trois boucles, pas une.** Elles ne se croisent qu'en un seul
point : `Rating.compute()` (l.6309) qui agrège Progress + HRStats + PRStats +
BLStats en un nombre. [V]

Et ce point de jonction **exclut le tracker** : `Rating.skills()` (l.6260-6294)
ne lit que `Progress`, `HRStats`, `PRStats`, `BLStats`. Les mains réelles
importées — le signal le plus précieux du produit — pèsent **0 %** du Poker
Rating. [V]

### 2.2 Rupture n°1 — le compteur de fuites ne peut pas descendre *(la plus grave)*

`Progress.record` (l.4734-4738) :

```js
const st = d.tagStats[tag] = d.tagStats[tag] || { n: 0, err: 0, loss: 0 };
st.n++;
if (a.verdict === "erreur") { st.err++; st.loss += entry.lossBB; }
```

`lossBB` = `loss / t.bb` avec `loss = best.ev - picked.ev` (l.4164, l.4173) →
toujours ≥ 0. `tagStats` n'est **jamais** décrémenté, ni fenêtré, ni décayé, ni
purgé. `summary().leaks` trie sur ce `loss` (l.4786-4790). **Mesure M2** :
strictement croissant sur 200 décisions injectées. [V par exécution]

Cascade de conséquences produit :

- **`Journey.story()` l.6446** : `if (beforeLoss > 0 && (nowLoss < beforeLoss * 0.85 || (m && m.seen >= 15)))`.
  La première branche est **arithmétiquement inatteignable**. [V]
- **`dropPct` l.6447** : `Math.round((1 - nowLoss / beforeLoss) * 100)` est
  toujours ≤ 0, donc `Math.max(0, dropPct)` = 0, donc l'écran affiche
  « en cours » au lieu d'un pourcentage (l.8084). [V]
- **`journeyHeadline` l.8105** : la branche `st.improved.dropPct >= 15` →
  « **Tu progresses vraiment.** » ne peut jamais s'afficher. [V]
- **« Ta priorité » sur l'accueil (l.6715-6722)** : une fois qu'une fuite a
  pris la tête, aucune autre ne peut la dépasser tant qu'elle continue à
  cumuler ne serait-ce qu'un peu. L'utilisateur voit le même chantier
  indéfiniment, même s'il l'a corrigé. [V par déduction sur M2]
- **Divergence silencieuse** : `decisions` est tronqué à 3000 (l.4672) mais
  `tagStats` ne l'est pas. Au-delà de ~650 mains (à 4,6 décisions/main), le
  coût des fuites est calculé sur toute la vie tandis que `s.n` ne compte que
  les 3000 dernières. Les deux chiffres affichés côte à côte sur l'écran
  Diagnostic (l.8003 « N décisions analysées » et l.8015 « −X bb ») ne portent
  plus sur le même échantillon. [V]

**Traduit en produit : il est mathématiquement impossible, dans HeroLab, de
voir sa principale faiblesse diminuer.** Toute la couche de coaching — Journey,
missions, priorité de l'accueil, mode « cible », défi du jour — est branchée sur
un compteur qui ne peut que monter.

### 2.3 Rupture n°2 — l'entraînement ciblé n'est pas ciblé

**Mesure M1** : 29 diagnostics → 10 générateurs, opposés confondus. Le bouton
« *M'entraîner · 10 spots →* » (l.15952-15955) promet de corriger une fuite
nommée ; il lance en réalité 10 mains génériques sur la rue concernée. Le score
final (l.7394-7395) mesure la précision globale sur ces 10 spots, **pas** la
fréquence qui définissait la fuite. [V]

Le bilan de drill (l.7404-7418) est par ailleurs **entièrement volatile** :
`endDrill` (l.8344-8349) remet `App.drillRun` à `null` sans rien persister.
Aucun historique de « j'ai fait 3 séries sur cette fuite, 4/10 puis 7/10 puis
9/10 ». Aucune écriture vers `Store`/Feutre : le diagnostic du tracker reste
identique après le drill. Le seul moyen de « fermer » la fuite est d'aller
jouer sur une vraie table et de réimporter — ce que le message l.7400 admet
explicitement. [V]

### 2.4 Rupture n°3 — deux systèmes de fuites parallèles et incompatibles

| | Système A | Système B |
|---|---|---|
| Source | décisions simulées (`Progress.tagStats`) | mains réelles importées (`Leaks.detect`) |
| Taxonomie | `LEAK_INFO`, **10 fuites** (l.4849-4900) | `LEAK_PLAIN`/`LEAK_DRILL`, **29 fuites** |
| Entraînement | `trainLeak` / `trainSpecificLeak` (l.8184, 8220) | `drillLeak` (l.8327) |
| Format | **infini, sans compteur, sans fin, sans score** | 10 spots + écran de bilan |
| Affiché dans | accueil, Mes leaks, Mon évolution, Carrière | onglet Tracker uniquement |

Intersection exacte des identifiants : **2 sur 29** (`bb-underdefend`,
`bb-overdefend`). `fold-to-3bet` (A) et `fold-3bet` (B) désignent la même chose
avec deux chaînes différentes. [V]

Le même utilisateur, la même faiblesse, deux diagnostics qui ne se parlent pas,
deux boutons « entraîne-moi » aux comportements radicalement différents.

### 2.5 Rupture n°4 — `trainLeak()` n'a ni fin ni sortie, et casse les réglages

`trainLeak()` (l.8220-8230) — le bouton le plus mis en avant du produit
(accueil l.6721 et l.6798, Mes leaks l.8009, Mon évolution l.8094) :

```js
trainLeak(leakKey) {
  if (leakKey && Progress.focusFor) { ... App.cfg.mode = f.mode; App.focusLeak = leakKey; }
  else { App.cfg.mode = "cible"; }
  App.go("play"); App.newHand();
}
```

Trois défauts vérifiés :

1. **Écriture durable sur `App.cfg`.** Le mode choisi par l'utilisateur dans
   Réglages est écrasé définitivement. Le code du défi du jour évite
   explicitement ce piège et l'explique en commentaire (l.7168-7171 : « jamais
   à `App.cfg` — sinon le mode choisi par le joueur serait écrasé
   durablement ») — la même équipe a identifié le risque et `trainLeak` le
   commet. [V]
2. **`App.focusLeak` n'est jamais lu.** Écrit l.8187 et l.8224, aucune lecture
   dans les 16 410 lignes. `newHand()` (l.7167-7256) ne le consulte pas. Le
   « ciblage » se réduit donc au `mode` (ex. `"river"`), c'est-à-dire à un
   filtre de rue. [V]
3. **Aucun compteur, aucun écran de fin.** L'utilisateur clique « Travailler ça
   maintenant » et se retrouve dans une partie libre infinie, sans savoir
   quand il a fini, ni s'il a réussi. `drillLeak`, à 100 lignes de là, fait
   exactement l'inverse (10 spots + bilan). [V]

Défaut annexe : `focusFor` (l.4829-4842) retombe sur `{mode:"libre"}` pour
toute clé inconnue. Un clic « S'entraîner » depuis une mission Journey sur une
clé non mappée lance donc une partie libre étiquetée « entraînement ciblé ». [V]

### 2.6 Rupture n°5 — seuils incohérents sur la détection de fuite

`worstLeak()` (l.4823-4826) n'a **aucun seuil de volume** : une seule erreur
crée une fuite et pilote le mode « cible » (l.7236-7241). L'accueil (l.6645) et
Mes leaks (l.7984) exigent au contraire `n >= 30`, et Mes leaks filtre encore
sur `err >= 2` (l.7997). Résultat : dès la 2ᵉ décision, le défi du jour peut se
verrouiller sur une fuite de bruit que l'interface refuse d'afficher parce
qu'elle la juge non fiable. [V]

---

## 3. Qu'est-ce qui donne envie de revenir demain ? Après 30 jours ?

### 3.1 Demain — un seul mécanisme, sous-exploité

Le **défi du jour** + la **série** (`Player.completeDaily`, l.6127-6139).
C'est la seule mécanique de retour quotidien du produit. Elle est :

- **peu visible** : la série n'apparaît qu'à deux endroits, l'écran de fin de
  défi (l.7120) et une proposition subordonnée du récit d'accueil (l.6857).
  Aucun compteur dans la barre latérale, aucun badge de série, aucune
  récompense. Les 11 badges (`Career.BADGES`, l.5780-5792) sont **tous**
  liés à la carrière : aucun ne récompense la régularité, le défi, ni les
  labs. [V]
- **potentiellement vide de contenu spécifique** : `startDaily` (l.7161) force
  `mode = "cible"` qui, sans fuite détectée, retombe sur `"libre"`
  (l.7241-7242). Pour un nouvel utilisateur, le « défi du jour » est
  littéralement 10 mains de partie libre. [V]
- **sans notification possible** : application mono-fichier, `localStorage`,
  aucun serveur. Rien ne peut rappeler l'utilisateur. [V]

**Verdict honnête : le retour à J+1 repose entièrement sur la volonté propre de
l'utilisateur.** Le produit n'a aucun crochet.

### 3.2 Après 30 jours — rien de solide. Il faut le dire.

Je liste les candidats et pourquoi chacun échoue :

| Candidat | Pourquoi ça ne tient pas à J+30 |
|---|---|
| Voir sa fuite se refermer | **Impossible par construction** (§2.2, M2). C'est le motif de rétention le plus fort d'un produit d'apprentissage, et il est arithmétiquement neutralisé. [V] |
| Monter en carrière | NL2 → NL5 exige **2 500 mains** (`reqHands`, l.4938). À 4,6 décisions/main, ≈ 11 500 décisions, chacune avec une analyse à lire. La carrière complète NL2→NL50 : 2 500+5 000+8 000+12 000+20 000 = **47 500 mains** ≈ 218 500 décisions. Même à 10 s par décision, sortir de NL2 demande ≈ 32 h de jeu. [V sur les chiffres ; [H] sur le temps par décision] |
| Faire monter le Poker Rating | Il monte, mais `skillScore` (l.6250-6256) plafonne à `0.35 + 0.65 × min(1, volume/plein)`. Les seuils de volume plein sont 400 (table), 120 (range), 100 (profiling), 120 (blockers). Une fois ces volumes atteints, le rating devient quasi statique : il ne bouge plus qu'avec la performance moyenne *cumulée*, très inerte. [V] |
| Les 3 labs | **Aucune structure de session** : un spot, une révélation, « spot suivant » à l'infini (l.10547-10550). Aucun objectif, aucun palier, aucun déblocage, aucune fin. Le seul écran qui donnerait un sens à l'effort — les stats du lab — est **inatteignable** (§5.1). [V] |
| Les badges | 11, tous carrière, la plupart volumétriques (1 000 / 5 000 / 20 000 mains). Un seul (`fixer`, l.5790) récompense la correction d'une fuite — et il dépend du compteur cassé de §2.2. [V] |
| Le mentor | Le lien (`mentorBond`) monte de 0,8 par décision correcte (l.6057), plafonné à 100 : il est **saturé en ~125 bonnes décisions**, soit ≈ 30 mains. Puis plus rien. [V] |
| XP / niveau | **Mort** (§5.2). [V] |

**Réponse honnête : rien de solide.** Le seul moteur crédible à 30 jours serait
« je vois mes fuites reculer », et c'est précisément celui qui est cassé. Ce qui
reste est un grind volumétrique dont le premier palier est à ~32 h.

---

## 4. Ce qui manque pour passer d'« outil » à « plateforme d'apprentissage »

Un outil répond à une question ponctuelle. Une plateforme d'apprentissage
possède une **boucle de mesure fermée** : elle mesure, prescrit, entraîne,
**re-mesure**, et montre la différence.

HeroLab possède aujourd'hui *mesure* (excellente), *prescription* (bonne),
*entraînement* (approximatif, §2.3), et **pas de re-mesure**. Les quatre
manques, par ordre d'impact :

1. **Une métrique de fuite qui peut baisser.** Aujourd'hui `loss` cumulé
   (l.4735). Il faut une mesure fenêtrée — coût en bb/100 sur les N dernières
   décisions portant ce tag — assortie d'un volume minimum. Sans ça, aucune
   des trois autres pierres ne peut tenir. [V pour le constat]
2. **Un état de fuite explicite et persistant.** Il n'existe nulle part de
   notion « fuite ouverte / en cours de correction / refermée ». `Player.mastery`
   (l.6143-6160) s'en approche mais compte des *occurrences vues*, pas la
   fermeture d'un diagnostic, et n'existe que pour les 10 clés de `LEAK_INFO`.
   Rien pour les 29 du tracker. [V]
3. **Le juge appliqué aux mains réelles.** `Judge.evaluate` (l.4145) et
   `Parser` (l.13914) ne se rencontrent jamais (§1.3). C'est le seul chemin
   qui permettrait de re-mesurer une fuite *dans la vraie vie*, et c'est aussi
   le contre-positionnement le plus fort face à GTOW et PT4. [V]
4. **Une unité de séance.** À part la session de carrière, rien n'a de début
   ni de fin : ni la table libre, ni les labs, ni `trainLeak`. Une plateforme
   d'apprentissage a des séances qui se terminent par un bilan. [V]

Manque secondaire mais coûteux : **la persistance ne couvre pas tout.**
`Player.exportAll` (l.6162-6174) exporte 8 clés et **omet `feutre.v1`**
(l.14349) — toute la base de mains importées. Or l'interface promet « L'export
génère un fichier .json qui contient **tout** » (l.7029-7030). Un utilisateur
qui a importé 20 000 mains et change d'appareil les perd. [V] — à traiter en
lien avec la couche de stockage de la Phase 3.

---

## 5. Fonctionnalités ORPHELINES (nommément)

### 5.1 Les trois écrans de statistiques de labs — inatteignables *(le plus flagrant)*

`hrstats` (« Stats de lecture »), `prstats` (« Stats profiling »), `blstats`
(« Stats bloqueurs »).

Chacun est **entièrement implémenté** :
- section HTML déclarée : l.2116, l.2118, l.2210
- titre déclaré : l.6546, l.6547, l.6548
- routé dans `App.render()` : l.6575, l.6577, l.6579
- rendu complet : `HRUI.renderStats` l.10667-10773 (KPI, progression 30 j,
  courbe, précision par position / profil / street / difficulté, points
  forts / à travailler) ; `PRUI.renderStats` l.12380+ ; `BLUI.renderStats`
  l.13748+

Et **aucun chemin ne les atteint** : absents des onglets du rail (l.2073-2091),
zéro `App.go('hrstats'|'prstats'|'blstats')` dans le fichier — vérifié par grep
exhaustif : les seules occurrences des trois chaînes sont les déclarations et
le routage ci-dessus. [V — mesure M3]

Ironie vérifiable : ces écrans contiennent des boutons de **sortie** vers les
labs (l.10679, l.10771 ; l.12388, l.12448 ; l.13756, l.13799). Il y a des
portes de sortie, pas de porte d'entrée. Ce sont, en volume, plusieurs centaines
de lignes d'analyse pédagogique — la couche qui donnerait un sens à long terme
aux trois labs (§3.2) — invisibles.

### 5.2 Le système XP / Niveau — mort

`Progress.data.xp` s'incrémente à chaque décision (l.4742), `level` en dérive
(l.4743), `nextLevelXp` est calculé et exporté par `summary()` (l.4818). La
fonction `App.renderXP()` (l.6593-6626) porte son nom — et n'affiche **aucun
XP** : elle rend le rating, le nom, l'avatar et deux pastilles. La seule
apparition de `level` dans toute l'UI est une ligne de métadonnée sur la page
Profil : « Membre depuis le … · Niveau ${s.level} · … » (l.7006). Pas de barre,
pas d'événement de montée de niveau, pas de récompense. [V]

### 5.3 `Progress.data.streak` — calculé, jamais affiché

Incrémenté l.4746-4750, exposé par `summary()` l.4817, **rendu nulle part**.
Doublon complet de `Player.data.daily.streak` (l.6136), qui est, lui, affiché
deux fois. [V]

### 5.4 `App.focusLeak` — écrit, jamais lu

l.8187 et l.8224. Aucune lecture. (§2.5) [V]

### 5.5 Vues atteignables uniquement par le rail, jamais liées contextuellement

`journey` (« Mon évolution »), `theory` (« Notions »), `profiles` (« Profils
adverses »), `stats` (« Statistiques »), `setup` (« Réglages »), `profile`.
Zéro `App.go('journey')`, `App.go('theory')`, `App.go('profiles')`,
`App.go('setup')` hors des onglets `data-v` — vérifié par grep. [V]

Deux cas particulièrement dommageables :
- **`theory`** : le panneau d'analyse emploie « équité », « MDF », « cote du
  pot », « fold equity », « polarisation »… et le glossaire qui les définit
  (l.8269-8281) n'est jamais lié depuis une analyse. Un débutant lit le jargon
  sans chemin vers l'explication. [V]
- **`journey`** : c'est *le* récit de coaching du produit (l.8042-8101), et
  aucun écran n'y renvoie. Il ne s'atteint que si l'utilisateur ouvre le menu
  et clique « Mon évolution ». [V]

### 5.6 Le parseur PokerStars — supporté, nié par l'interface

`Parser.parseFile` détecte automatiquement la room et route vers
`parseHandStars` (l.13913-13930). L'interface dit l'inverse à trois endroits :
« Cash Game · Winamax » (l.2129), « fichiers .txt Winamax » (l.2182), et le
message d'erreur « **Seuls** les fichiers .txt exportés par Winamax sont
lisibles » (l.16292). Une capacité livrée, invisible et activement démentie. [V]

### 5.7 Le Studio (`?admin=1`)

l.2560-2572, l.16408. Éditeur de spots réservé à l'administration ; hors
parcours utilisateur. Orphelin *assumé*, mentionné pour l'exhaustivité. [V]

---

## 6. Fonctionnalités REDONDANTES

### 6.1 Deux systèmes de diagnostic de fuites

Détaillé §2.4 : 10 fuites simulées vs 29 fuites réelles, deux vocabulaires,
2 identifiants communs sur 29, deux boutons d'entraînement au comportement
opposé (infini sans score vs 10 spots avec bilan). [V]

### 6.2 Deux systèmes d'entraînement ciblé

`trainLeak`/`trainSpecificLeak` (l.8184, l.8220) vs `drillLeak` (l.8327). Même
intention produit, deux implémentations, une seule correcte. [V]

### 6.3 Sept systèmes de progression, dont deux morts

Poker Rating (l.6233, vivant, bien fait) · Carrière : bankroll + palier + goals
(l.4923, l.5280, vivant) · Badges (l.5780, vivant, carrière seulement) ·
Maîtrise par notion (l.6143, vivant, affichée dans 2 écrans) · Lien mentor
(l.6056, vivant mais saturé en ~30 mains) · Série quotidienne (l.6136, vivante,
quasi invisible) · **XP/Niveau (l.4742, mort)**. Plus `Progress.streak`, doublon
mort. Sept vocabulaires de progression pour un seul utilisateur : aucun ne
devient le repère. [V]

### 6.4 Quatre écrans qui racontent la même chose

- **Accueil** (l.6629) : rating, radar 5 compétences, récit, leak prioritaire,
  graphe 14 jours
- **Mon évolution** (l.8042) : leak actuel, leak amélioré, missions, maîtrise,
  timeline
- **Mes leaks** (l.7981) : diagnostic classé, erreurs par street, maîtrise
- **Statistiques** (l.7900+) : taux, heat map par position, activité par jour

Le panneau de maîtrise est rendu **deux fois** : `App.masteryPanel()` dans Mes
leaks (l.8037) et `App.journeyMastery()` dans Mon évolution (l.8099). Le leak
prioritaire est affiché **quatre fois** avec quatre mises en forme. [V]

### 6.5 Trois exports, deux d'entre eux irrécupérables

| Bouton | Fichier | Contenu | Réimportable ? |
|---|---|---|---|
| Profil → « Exporter ma progression » (l.7025 → l.7053) | `pivot-sauvegarde-DATE.json` | 8 clés, **sans `feutre.v1`** | oui |
| Réglages → « Exporter mes données » (l.7883 → l.8416) | `pivot-progression.json` | `Progress` seul, **sans `_format`** | **non** |
| Carrière → « Exporter la carrière » (l.8379) | `pivot-carriere.json` | `Career` seul, **sans `_format`** | **non** |

`importAll` rejette tout fichier sans `_format: "pivot-save"` (l.6169). Deux des
trois boutons d'export produisent donc des fichiers que le produit refuse. [V]

### 6.6 Quatre boutons de remise à zéro

Réglages « Effacer ma progression » (l.8425), Profil « Tout effacer » (l.7091),
Carrière « Recommencer une carrière » (l.8388), Tracker « Tout effacer »
(l.16371). Portées différentes, libellés proches. [V]

### 6.7 Deux séries quotidiennes

§5.3. [V]

---

## 7. Ruptures de parcours (l'utilisateur finit et ne sait pas quoi faire)

Classées par gravité. Toutes vérifiées.

| # | Où | Ce qui se passe | Pourquoi c'est une rupture |
|---|---|---|---|
| R1 | **Fin du défi du jour** — l.7113-7122 | Anneau de score, un verdict, un unique bouton « Retour à l'accueil » | Le verdict promet explicitement « **Regarde les décisions ratées** : c'est là que se trouve la marge » (l.7154) et **aucun écran ne liste les décisions ratées**. Promesse formulée puis non tenue dans la même phrase. Un seul chemin, vers l'écran d'où l'on venait. |
| R2 | **Fin d'un spot de lab** — l.10547-10550 (idem BL l.13541) | « Spot suivant → » / « Terminer » ; `quit()` (l.10659) remet à l'écran d'intro | Aucun bilan de la série qu'on vient de faire (« 7 spots, 64 % »), aucun lien vers l'écran de stats… qui existe et est inatteignable (§5.1). L'effort n'est capitalisé nulle part de visible. |
| R3 | **Entrée dans `trainLeak()`** — l.8220 | Partie libre infinie sur un mode de rue | Pas de compteur, pas de fin, pas de score, pas de retour. L'utilisateur ne sait ni quand s'arrêter ni s'il a progressé. Et ses réglages ont été écrasés (§2.5). |
| R4 | **Fin de main en partie libre** — l.7806-7813 | « Main suivante » / « Voir mes statistiques » | Boucle infinie sans unité de séance. Aucun « tu as joué 24 mains aujourd'hui, voici ce qui en ressort ». |
| R5 | **Après un import de mains** — l.16308-16324 | Tableau fichiers / mains lues / ajoutées / doublons | **Aucun CTA.** L'utilisateur vient d'accomplir l'action la plus coûteuse du produit (aller chercher ses historiques) et n'est pas conduit vers le diagnostic. Il doit deviner « Analyse des leaks » dans la barre latérale du tracker. |
| R6 | **Fin d'un drill** — l.7404-7418 | « Refaire 10 spots » / « Retour au diagnostic » | Les deux sorties bouclent sur elles-mêmes : le diagnostic est **inchangé** (le drill n'écrit rien dans `Store`). Le message l.7400 renvoie l'utilisateur hors du produit (« réimporte tes prochaines sessions »). |
| R7 | **Fin de session de carrière** — l.8842-8845 | « Retour à la carrière » / « Voir mes leaks » | La moins mauvaise des sorties. Mais « Voir mes leaks » mène au diagnostic **cumulatif** (système A), pas aux `findings` de la session qu'on vient de terminer et qui sont affichés juste au-dessus (l.8812-8822). Deux analyses côte à côte, non reliées. |
| R8 | **Panneau d'analyse d'une décision** — l.7567+ | Verdict, EV des options, ligne du mentor | Le jargon (MDF, équité, cote) n'est lié à aucune définition ; `theory` (l.8268) n'est jamais atteint depuis là (§5.5). |
| R9 | **Fin de l'onboarding** — l.6974-6980 | `App.go("home")` | Aucune calibration, aucun objectif demandé, aucune invitation à importer ses mains. L'accueil affiche un rating à 0, un radar vide et un défi du jour qui, sans historique, est une partie libre (§3.1). Premier écran = promesse vide. |

---

## 8. Synthèse et recommandation P0

### Le diagnostic en une phrase

HeroLab a un moteur d'évaluation de qualité, trois laboratoires que personne
d'autre ne propose, et un tracker de vraies mains — mais **la boucle
d'apprentissage n'est jamais refermée** : on ne peut ni voir une fuite reculer
(§2.2, mesure M2), ni s'entraîner spécifiquement dessus (§2.3, mesure M1), ni
faire juger ses vraies mains (§1.3), ni consulter le bilan de ses labs (§5.1).

### P0 unique

> **Remplacer le compteur cumulatif de fuites (`Progress.tagStats.loss`,
> l.4735) par une mesure fenêtrée et comparable dans le temps — coût en bb/100
> sur les N dernières décisions portant ce tag, avec un volume minimum — puis
> afficher l'avant/après partout où la fuite est déjà nommée.**

Pourquoi celle-là et pas une autre :

- C'est la seule qui débloque **quatre fonctionnalités déjà écrites** :
  `Journey.story()` (l.6446, branche inatteignable), `journeyHeadline`
  (l.8105, phrase jamais affichée), les missions Journey (l.6459), et le badge
  `fixer` (l.5790).
- C'est le prérequis de toutes les autres corrections : affiner le mapping
  fuite→drill (M1) ne sert à rien tant qu'on ne peut pas mesurer l'effet du
  drill ; brancher le juge sur les mains réelles ne sert à rien tant que le
  résultat alimente un compteur monotone.
- C'est la réponse produit à « pourquoi revenir dans 30 jours ». Aujourd'hui il
  n'y en a pas (§3.2). Avec ça, il y en a une, et c'est la bonne : *parce que
  je vois que ça marche.*
- Le périmètre est resserré : `Progress.record` (l.4734-4738), `Progress.summary`
  (l.4786-4790), `Journey.story` (l.6436-6451). Le moteur DF-B n'est pas
  touché ; les 79+37 tests de Phase 2 ne portent pas sur ces fonctions [H — à
  confirmer par l'agent chargé des tests].

**P1 immédiatement derrière** (hors mandat de la P0, listés pour l'orchestration) :
exposer les trois écrans de stats de labs (§5.1, coût : 3 onglets) ; unifier
`trainLeak` sur le format 10-spots-et-bilan de `drillLeak` (§2.5) ; ajouter un
CTA « Voir mon diagnostic » après l'import (R5) ; ajouter l'écran « tes
décisions ratées » en fin de défi du jour (R1).
