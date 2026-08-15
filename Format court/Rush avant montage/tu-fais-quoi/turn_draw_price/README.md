# Tirage couleur au turn face à une grosse mise

Rushes verticaux prêts à monter — `turn_draw_price` · série « Tu fais quoi ici ? »

7 plan(s), 26.9 s de matière au total, 1080×1920, 30 im/s.

---

## Ce que dit le moteur

- Le moteur donne au héros **40.1 % d'équité**.
- L'action instinctive — Suivre 3.00 € — vaut **-2.50 bb**. Comme passer vaut 0 par construction, cela veut dire, littéralement, que ce coup coûte plus cher que de jeter la main.
- La meilleure option est **Relancer Tapis**, à **+8.68 bb**.
- L'écart entre les deux, soit le coût de l'erreur, est de **11.18 bb**. Le verdict rendu par l'application est « erreur ».

### Espérance de chaque option

Valeurs en big blinds, à partir de la décision. Passer vaut 0 : c'est la
référence commune, l'argent déjà investi étant ignoré pour toutes les options.
Un chiffre négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
| Relancer Tapis | +8.68 bb |
| Relancer Pot | +7.48 bb |
| Relancer 1/3 pot | +7.39 bb |
| Passer | 0.00 bb |
| Suivre 3.00 € | -2.50 bb |

Ces valeurs sont celles affichées à l'écran dans le plan `05-preuve-ev`. Elles
proviennent de `Judge.evaluate` et sont, comme l'indique l'application
elle-même, des estimations sur la range adverse et les profils en jeu — un
ordre de grandeur et un classement, pas une vérité au centième. Ne les présente
pas comme une sortie de solveur.

---

## Les plans

| fichier | durée | rôle |
|---|---|---|
| `01-accroche-main.webm` | 2.9 s | Accroche |
| `02-situation-large.webm` | 3.4 s | Situation |
| `02b-situation-serree.webm` | 3.3 s | Situation (variante) |
| `03-choix.webm` | 4.3 s | Choix |
| `04-verdict.webm` | 5.0 s | Verdict |
| `04b-verdict-serre.webm` | 3.4 s | Verdict (variante) |
| `05-preuve-ev.webm` | 4.6 s | Preuve |

### `01-accroche-main.webm` — Accroche

La main seule, resserrée. À poser en premier : on montre le problème avant de l'expliquer. C'est le plan qui doit retenir dans les deux premières secondes.

### `02-situation-large.webm` — Situation

La table entière, fixe. Laisse le temps de lire le board, le pot et la position. À garder si le spectateur doit vraiment comprendre la main.

### `02b-situation-serree.webm` — Situation (variante)

Même moment, resserré sur le board. Plus nerveux, moins informatif. À préférer quand le rythme prime.

### `03-choix.webm` — Choix

Descente de la table vers les options réelles, avec leurs montants. C'est ici que le spectateur décide. Ne coupe pas trop tôt : c'est le plan qui crée l'engagement.

### `04-verdict.webm` — Verdict

La décision instinctive est jouée, le moteur tranche, le coût s'affiche. Le plan de bascule.

### `04b-verdict-serre.webm` — Verdict (variante)

Resserré sur le verdict seul. Coupe plus sèche, sans le raisonnement.

### `05-preuve-ev.webm` — Preuve

L'espérance de chaque option, en big blinds. C'est ce plan qui rend le propos vérifiable — à garder même si tu raccourcis ailleurs.


---

## Montage suggéré

Un ordre qui fonctionne, à ajuster :

1. `01-accroche-main` — la main, sans contexte.
2. `02-situation-large` ou `02b-situation-serree` — une seule des deux.
3. `03-choix` — le spectateur décide.
4. `04-verdict` ou `04b-verdict-serre` — la bascule.
5. `05-preuve-ev` — les chiffres.

Les plans sont indépendants : aucun ne dépend du précédent, l'ordre et les
coupes restent entièrement libres. Chacun commence sur une image posée, donc
une coupe franche au début d'un plan ne coupe jamais un mouvement.

Les mouvements de caméra sont calculés image par image, pas enregistrés au vol :
un ralenti ou un accéléré sur ces plans reste propre.

---

## Ce qui n'est pas fait ici, volontairement

- **pas de voix off** ;
- **pas de sous-titres** ;
- **pas de texte final à l'écran** ;
- **pas de montage**.

Ces éléments t'appartiennent. Le README fournit les chiffres exacts pour que
rien de ce que tu écriras ne contredise ce qui est à l'image.

---

## Distribution

**Format livré** : WebM / VP8, 1080×1920, 30 im/s.

Ce point demande une action de ta part : le `ffmpeg` disponible dans
l'environnement de production est compilé sans multiplexeur MP4 — il ne sait
écrire que du WebM. TikTok, Reels et Shorts privilégient MP4/H.264. Les WebM
s'importent sans problème dans CapCut, Premiere, DaVinci Resolve ou Final Cut,
donc cela ne gêne pas le montage ; c'est à l'export final que le MP4 se fait.
Si tu veux convertir un rush avant montage, avec un ffmpeg complet :

```sh
ffmpeg -i 01-accroche-main.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p 01-accroche-main.mp4
```

**Zones à ne pas encombrer.** Les plans sont cadrés en tenant compte de
l'interface des plateformes : rien d'important n'est placé dans les 10 % du
haut ni les 20 % du bas, ni dans la bande droite des boutons. Garde cette
contrainte pour tes textes ajoutés.

**Durées.** La matière totale est de 27 s. En gardant une
variante sur deux aux étapes 2 et 4, il reste environ 20 s,
ce qui laisse de la marge pour resserrer vers 20–30 s.

**Ordre de publication.** Le plan de preuve est ce qui distingue ce contenu
d'une simple question de quiz : il montre le calcul. Si tu publies plusieurs
vidéos de la série, garde ce plan dans toutes — c'est lui qui installe la
crédibilité et justifie l'application.


---

## Reproduire ce spot

Le spot est défini dans le DSL Studio de Hero Lab. Ouvre l'application avec
`?admin=1` et colle ceci pour retrouver exactement la même main :

```
Hero: BB, Ah 5h, 100bb
Table: 6-max, NL25
Villains: BTN (reg, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: Kh 9h 2c | hero check, BTN bet 4bb, hero call
Turn: 3s | hero check, BTN bet 12bb, hero to act
```

Rejouer la production : `node content/produce.mjs --spot turn_draw_price`
