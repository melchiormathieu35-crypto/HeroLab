# Format court

Contenu vertical pour TikTok, Instagram Reels et YouTube Shorts, produit depuis
le mode Studio de Hero Lab. Tout est en 1080×1920, 30 im/s.

## Rangement

Le dossier est organisé **par concept**. Un concept est une forme narrative — ce
qui détermine la structure de la vidéo — et non un thème de poker.

| dossier | ce qu'on y trouve | état |
|---|---|---|
| [`Quizz/`](Quizz/README.md) | vidéos **montées**, un fichier par vidéo, 30 s à 1 min | prêt pour voix et sous-titres |
| [`Rush avant montage/`](Rush%20avant%20montage/README.md) | rushs bruts, un plan par fichier | à monter |

Les deux ne s'opposent pas : les rushs servent quand on veut reprendre la main
sur le montage, les vidéos montées quand on veut publier vite.

## Ce qui est fourni, ce qui ne l'est pas

**Fourni** : l'image, les mouvements de caméra, les coupes, les temps de pose,
les timecodes de chaque beat, et les chiffres exacts du moteur pour chaque
situation.

**Non fourni, volontairement** : voix off, sous-titres, textes incrustés
définitifs. Le README de chaque vidéo indique où les poser et sur quelles
données s'appuyer — jamais quoi dire.

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
