# Script — 08 - la cote dit non KTs sur paire une surcarte tombe face a un reg

**Vidéo** : `video.webm` · 33.50 s · **Concept** : La Cote
**Situation** : La cote dit non : KTs sur pairé, une surcarte tombe, face à un reg

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ 2.8 mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.
>
> **Le principe de La Cote** : le prix exige 31 % d'équité, le héros en
> a 11.5 % — **la cote dit non**. La phrase de comparaison est
> écrite par le moteur lui-même à l'écran pendant le REVEAL.

---

## Le script, d'une traite

Payer ou pas ? Fais le calcul avec moi.

En face : la grosse blinde, un régulier solide.

Payer 0,90 € dans un pot de 2,05 € : ça exige 31 % d'équité. C'est la cote.

Ton équité réelle : 11,5 %. Loin sous les 31. Payer coûte 8,09 big blinds.

Retiens la méthode, pas la main : le prix exige un pourcentage, ton équité répond. Compare les deux — avant de payer.

*(Les crochets de calage : HOOK à 00:00.00 · SITUATION à 00:04.40 · LA COTE à 00:09.80 · REVEAL à 00:16.40 · ÉQUITÉ à 00:24.10.)*

---

## Le détail, beat par beat

### HOOK — `00:00.00` → `00:04.40` (4.4 s · 12 mots max, proposé : 9)

**Voix off proposée**

> Payer ou pas ? Fais le calcul avec moi.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Payer ou pas ?
- Fais le calcul.

**Note de jeu.** Aucun chiffre : la promesse est le calcul, pas la réponse.

### SITUATION — `00:04.40` → `00:09.80` (5.4 s · 15 mots max, proposé : 9)

**Voix off proposée**

> En face : la grosse blinde, un régulier solide.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- En face : la grosse blinde, un régulier solide
- Turn A♣ : il mise 9 bb.

**Note de jeu.** Le déroulement complet est à l'écran ; la voix ne raconte que l'essentiel.

### LA COTE — `00:09.80` → `00:16.40` (6.6 s · 18 mots max, proposé : 18)

**Voix off proposée**

> Payer 0,90 € dans un pot de 2,05 € : ça exige 31 % d'équité. C'est la cote.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Prix : 0,90 € · Pot : 2,05 €
- → il faut 31 %

**Note de jeu.** Le nombre exigé est LE sujet du beat. Silence sur la fin du freeze : le spectateur estime son équité.

### REVEAL — `00:16.40` → `00:24.10` (7.7 s · 21 mots max, proposé : 15)

**Voix off proposée**

> Ton équité réelle : 11,5 %. Loin sous les 31. Payer coûte 8,09 big blinds.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Réel : 11,5 % < exigé 31 %
- Payer = 8,09 bb de perdus

**Note de jeu.** La phrase de comparaison est écrite par le moteur à l'écran, mot pour mot — la voix la lit, elle n'affirme rien de plus.

### ÉQUITÉ — `00:24.10` → `00:33.50` (9.4 s · 26 mots max, proposé : 22)

**Voix off proposée**

> Retiens la méthode, pas la main : le prix exige un pourcentage, ton équité répond. Compare les deux — avant de payer.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Le prix exige. Ton équité répond.
- Compare — avant de payer.

**Note de jeu.** La leçon transposable, sur la dernière image. Ne pas recouvrir le panneau d'équité.

---

## Les chiffres de référence (ceux de l'écran)

| donnée | valeur |
|---|---|
| à payer | 0,90 € |
| pot | 2,05 € |
| équité exigée par le prix | 31 % |
| équité réelle du héros | 11,5 % |
| la cote dit | NON |
| verdict affiché | « erreur » |
| coût du call | 8,09 bb |

Ces valeurs viennent de `Judge.evaluate` — l'exigence de la cote est relue
dans le texte que le moteur écrit lui-même, et revérifiée par le contrôle
qualité. Comme l'indique l'application, ce sont des estimations sur la range
adverse et les profils en jeu — un ordre de grandeur et un classement, pas une
sortie de solveur. Le script ne doit pas les présenter autrement.
