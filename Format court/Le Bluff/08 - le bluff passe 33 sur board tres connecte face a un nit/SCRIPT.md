# Script — 08 - le bluff passe 33 sur board tres connecte face a un nit

**Vidéo** : `video.webm` · 33.90 s · **Concept** : Le Bluff
**Situation** : Le bluff passe : 33 sur board très connecté face à un nit

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ 2.8 mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.
>
> **Le principe du Bluff** : Miser 1/3 pot demande 25 % de folds, ce
> profil en donne 53 % — **le bluff passe**.
> L'équation est écrite par le moteur lui-même à l'écran pendant le REVEAL.
> Aucun sens n'est trahi au HOOK — c'est volontaire, pour la rétention.

---

## Le script, d'une traite

Ce bluff… il paie, ou il brûle ?

En face : la grosse blinde, profil très serré.

Miser 1/3 pot. Il faut 25 % de folds pour que ce pari soit rentable.

Ce profil donne 53 %. Au-dessus des 25 exigés. Ce pari est le bon coup, à +2,50 big blinds.

La méthode : compare toujours l'exigé à ce que ce profil donne vraiment.

*(Les crochets de calage : HOOK à 00:00.00 · SITUATION à 00:04.10 · LE PARI à 00:09.10 · REVEAL à 00:17.00 · LA LEÇON à 00:25.90.)*

---

## Le détail, beat par beat

### HOOK — `00:00.00` → `00:04.10` (4.1 s · 11 mots max, proposé : 8)

**Voix off proposée**

> Ce bluff… il paie, ou il brûle ?

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Ce bluff…
- il paie, ou il brûle ?

**Note de jeu.** Ne rien trahir : ni le sens ni le verdict. Le hook est la question, gardée jusqu'au REVEAL.

### SITUATION — `00:04.10` → `00:09.10` (5.0 s · 14 mots max, proposé : 9)

**Voix off proposée**

> En face : la grosse blinde, profil très serré.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- En face : la grosse blinde, profil très serré
- C'est lui qui décide.

**Note de jeu.** Le profil est LE facteur du bluff — insister dessus, pas sur les cartes.

### LE PARI — `00:09.10` → `00:17.00` (7.9 s · 22 mots max, proposé : 15)

**Voix off proposée**

> Miser 1/3 pot. Il faut 25 % de folds pour que ce pari soit rentable.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Miser 1/3 pot
- → il faut 25 % de folds

**Note de jeu.** Le nombre exigé est LE sujet. Silence sur la fin du freeze : le spectateur estime ce que CE profil donne réellement.

### REVEAL — `00:17.00` → `00:25.90` (8.9 s · 24 mots max, proposé : 19)

**Voix off proposée**

> Ce profil donne 53 %. Au-dessus des 25 exigés. Ce pari est le bon coup, à +2,50 big blinds.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Réel : 53 % > exigé 25 %
- +2,50 bb

**Note de jeu.** L'équation est écrite par le moteur à l'écran, mot pour mot — la voix la lit, elle n'ajoute rien.

### LA LEÇON — `00:25.90` → `00:33.90` (8.0 s · 22 mots max, proposé : 13)

**Voix off proposée**

> La méthode : compare toujours l'exigé à ce que ce profil donne vraiment.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- La fold equity : pas un espoir.
- Un chiffre à comparer.

**Note de jeu.** La leçon transposable, sur la liste des espérances. Ne pas la recouvrir.

---

## Les chiffres de référence (ceux de l'écran)

| donnée | valeur |
|---|---|
| pari jugé | Miser 1/3 pot |
| EV du pari | +2,50 bb |
| meilleure action | Miser 1/3 pot (+2,50 bb) |
| fold equity exigée | 25 % |
| fold equity estimée (ce profil) | 53 % |
| marge | +28 points |
| le bluff | PASSE |
| coût / gain | +2,50 bb |

Ces valeurs viennent de `Judge.evaluate` — l'équation de fold equity est relue
dans le texte que le moteur écrit lui-même, et revérifiée par le contrôle
qualité. Comme l'indique l'application, ce sont des estimations sur la range
adverse et les profils en jeu — un ordre de grandeur et un classement, pas une
sortie de solveur. Le script ne doit pas les présenter autrement.
