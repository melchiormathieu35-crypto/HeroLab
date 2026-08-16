# Script — 02 - podium KQo continuer face a un 3bet face a une calling station

**Vidéo** : `video.webm` · 34.07 s · **Concept** : Podium des erreurs
**Situation** : Podium : KQo · 76s · 98s

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ 2.8 mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.
>
> **Le principe du podium** : trois erreurs indépendantes, classées par coût
> réel — n°3 la moins chère, n°1 la plus chère. Aucune des trois ne dépend
> des autres ; c'est le classement, pas l'histoire, qui fait tenir la vidéo.

---

## Le script, d'une traite

Trois erreurs. De la moins chère… à la pire. Regarde jusqu'au bout.

Numéro 3 : K♥ Q♣ au cutoff. Payer coûte 9,78 big blinds.

Numéro 2 : 7♥ 6♥ au cutoff. Payer coûte 11,22 big blinds.

La pire du lot. 9♠ 8♠ en grosse blinde. Payer coûte 17,22 big blinds — le sommet du classement.

*(Les crochets de calage : HOOK à 00:00.00 · ERREUR N°3 à 00:04.30 · ERREUR N°2 à 00:12.57 · ERREUR N°1 à 00:22.50.)*

---

## Le détail, beat par beat

### HOOK — `00:00.00` → `00:04.30` (4.3 s · 12 mots max, proposé : 12)

**Voix off proposée**

> Trois erreurs. De la moins chère… à la pire. Regarde jusqu'au bout.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Trois erreurs, classées.
- De la moins chère… à la pire.

**Note de jeu.** Aucun chiffre ici : l'accroche est la promesse du classement, pas la réponse.

### ERREUR N°3 — `00:04.30` → `00:12.57` (8.3 s · 23 mots max, proposé : 12)

**Voix off proposée**

> Numéro 3 : K♥ Q♣ au cutoff. Payer coûte 9,78 big blinds.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- N°3
- Payer = 9,78 bb

**Note de jeu.** Rythme rapide : une phrase, le coût, on enchaîne — ne pas ralentir le classement.

### ERREUR N°2 — `00:12.57` → `00:22.50` (9.9 s · 27 mots max, proposé : 12)

**Voix off proposée**

> Numéro 2 : 7♥ 6♥ au cutoff. Payer coûte 11,22 big blinds.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- N°2
- Payer = 11,22 bb

**Note de jeu.** Rythme rapide : une phrase, le coût, on enchaîne — ne pas ralentir le classement.

### ERREUR N°1 — `00:22.50` → `00:34.07` (11.6 s · 32 mots max, proposé : 19)

**Voix off proposée**

> La pire du lot. 9♠ 8♠ en grosse blinde. Payer coûte 17,22 big blinds — le sommet du classement.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- N°1
- Payer = 17,22 bb

**Note de jeu.** Le clou de la vidéo : la voix peut s'attarder ici, c'est le seul rang qui le permet.

---

## Les chiffres de référence (ceux de l'écran)

| rang | situation | réflexe | coût | verdict |
|---|---|---|---|---|
| N°3 | KQo — continuer face à un 3bet face à une calling station | payer | +9,78 bb | « erreur » |
| N°2 | 76s sur sec, tête haute, une surcarte tombe, face à un TAG | payer | +11,22 bb | « erreur » |
| N°1 | 98s sur deux broadway, une surcarte tombe, face à un récréatif | payer | +17,22 bb | « erreur » |

Ces valeurs viennent de `Judge.evaluate`, rejouées et revérifiées par le
contrôle qualité sur les trois erreurs. Comme l'indique l'application
elle-même, ce sont des estimations sur la range adverse et les profils en
jeu — un ordre de grandeur et un classement, pas une sortie de solveur. Le
script ne doit pas les présenter autrement.
