# Format court

Contenu vertical pour TikTok, Instagram Reels et YouTube Shorts, produit depuis
le mode Studio de Hero Lab. Tout est en 1080×1920, 30 im/s.

## Rangement

Le dossier est organisé **par concept**. Un concept est une forme narrative — ce
qui détermine la structure de la vidéo — et non un thème de poker.

| dossier | ce qu'on y trouve | état |
|---|---|---|
| [`Quizz/`](Quizz/README.md) | vidéos **montées**, un fichier par vidéo, 30 s à 1 min | prêt pour voix et sous-titres |
| [`Duel de profils/`](Duel%20de%20profils/README.md) | même main, deux adversaires, la même action bascule | prêt pour voix et sous-titres |
| [`Podium/`](Podium/README.md) | trois erreurs classées par coût réel, dans une seule vidéo | prêt pour voix et sous-titres |
| [`Rush avant montage/`](Rush%20avant%20montage/README.md) | rushs bruts, un plan par fichier | à monter |

Les deux ne s'opposent pas : les rushs servent quand on veut reprendre la main
sur le montage, les vidéos montées quand on veut publier vite.

## Ce qui est fourni, ce qui ne l'est pas

**Fourni** : l'image, les mouvements de caméra, les coupes, les temps de pose,
les timecodes de chaque beat, et les chiffres exacts du moteur pour chaque
situation.

**Non fourni** : l'enregistrement de la voix et l'incrustation des textes.
Chaque vidéo montée est en revanche livrée avec un `SCRIPT.md` — une
proposition de voix off et de sous-titres calée sur les timecodes, à reformuler
librement sans changer les chiffres.

## Règles tenues à la production

- **Aucun chiffre inventé.** Profils, actions, montants, options, espérances et
  équités viennent tous de `Spot.options` et `Judge.evaluate`. Aucune valeur
  n'est écrite à la main.
- **Aucun effet décoratif.** Chaque mouvement de caméra porte une raison
  narrative, reprise telle quelle dans le README de la vidéo.
- **Safe area mobile respectée.** Rien d'essentiel dans les 10 % du haut, les
  20 % du bas, ni la bande droite des boutons.
- **Le moteur est gelé.** `index.html` et `tests/baseline.json` ne sont jamais
  modifiés pour faciliter la production de contenu.
- **Une vidéo n'est jamais déclarée conforme parce que le fichier est valide.**
  Le contrôle mesure l'image réelle, beat par beat, et compare les chiffres
  livrés à ce que le moteur redonne en rejouant le spot.

## La chaîne

| étape | commande |
|---|---|
| énumération des situations | `content/generate.mjs` |
| notation sur 100 | `node content/scan.mjs` |
| rushs (un plan par fichier) | `node content/engine.mjs --count 10` |
| vidéos montées, par concept | `node content/montage.mjs --concept quizz --count 2` |
| duels de profils | `node content/duel.mjs --count 3` |
| podiums de 3 erreurs | `node content/podium.mjs --count 10` |
| scripts voix off + sous-titres | `node content/script.mjs` (aussi appelé par les commandes ci-dessus) |
| conversion CapCut (sur le Mac) | `./outils/capcut/collecter.sh` puis `./outils/capcut/convert_videos.sh` — voir `outils/capcut/README.md` |
