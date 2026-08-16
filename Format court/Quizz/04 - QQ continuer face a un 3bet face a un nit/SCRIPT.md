# Script — 04 - QQ continuer face a un 3bet face a un nit

**Vidéo** : `video.webm` · 33.30 s · **Concept** : Quizz
**Situation** : QQ — continuer face à un 3bet face à un nit

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ 2.8 mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.

---

## Le script, d'une traite

Q♥ Q♠ au bouton. Simple, en apparence.

Préflop : tu relances à 2,5 bb, il relance à 11 bb.

Le prix : 4,25 €, dans un pot de 7,25 €.

Passer, suivre, ou relancer — les montants sont à l'écran. Tu fais quoi ?

Suivi ? Erreur, dit le moteur. Coût : 7,65 big blinds. Il fallait relancer 2.5 bb.

Relancer 2.5 bb : +6,17. Suivre : −1,48 — pire que jeter la main.

*(Les crochets de calage : HOOK à 00:00.00 · SITUATION à 00:03.70 · TENSION à 00:09.70 · CHOICE à 00:14.30 · REVEAL à 00:21.20 · PAYOFF à 00:27.10.)*

---

## Le détail, beat par beat

### HOOK — `00:00.00` → `00:03.70` (3.7 s · 10 mots max, proposé : 7)

**Voix off proposée**

> Q♥ Q♠ au bouton. Simple, en apparence.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Q♥ Q♠ au bouton.
- Simple, en apparence.

**Note de jeu.** L'accroche tient par l'image des cartes ; la voix ne fait qu'ouvrir la question. Aucun chiffre ici.

### SITUATION — `00:03.70` → `00:09.70` (6.0 s · 16 mots max, proposé : 12)

**Voix off proposée**

> Préflop : tu relances à 2,5 bb, il relance à 11 bb.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- NL50 · en face : la petite blinde, profil très serré
- Préflop : tu relances à 2,5 bb, la petite blinde relance à 11 bb.

**Note de jeu.** Tout ce qui est dit ici est aussi à l'écran (panneau « Déroulement »). Si la voix ne raconte pas toutes les rues, les sous-titres les portent.

### TENSION — `00:09.70` → `00:14.30` (4.6 s · 12 mots max, proposé : 11)

**Voix off proposée**

> Le prix : 4,25 €, dans un pot de 7,25 €.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- À payer : 4,25 €
- Pot : 7,25 €

**Note de jeu.** Silence recommandé sur le freeze final. Ne pas donner l'équité ni la réponse : c'est le moment où le spectateur se forge un avis.

### CHOICE — `00:14.30` → `00:21.20` (6.9 s · 19 mots max, proposé : 14)

**Voix off proposée**

> Passer, suivre, ou relancer — les montants sont à l'écran. Tu fais quoi ?

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Passer, suivre… ou relancer ?
- Tu fais quoi ?

**Note de jeu.** La question posée, laisser le temps de pose travailler : les ~5 dernières secondes du beat sont volontairement muettes (compte à rebours possible).

### REVEAL — `00:21.20` → `00:27.10` (5.9 s · 16 mots max, proposé : 16)

**Voix off proposée**

> Suivi ? Erreur, dit le moteur. Coût : 7,65 big blinds. Il fallait relancer 2.5 bb.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Verdict : erreur.
- Coût : 7,65 bb
- La bonne réponse : relancer 2.5 bb

**Note de jeu.** C'est ici que la voix a le plus de valeur. Les chiffres dits sont exactement ceux affichés — ne pas les arrondir autrement.

### PAYOFF — `00:27.10` → `00:33.30` (6.2 s · 17 mots max, proposé : 14)

**Voix off proposée**

> Relancer 2.5 bb : +6,17. Suivre : −1,48 — pire que jeter la main.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Relancer 2.5 bb = +6,17 bb
- Suivre 4.25 € = −1,48 bb

**Note de jeu.** Ne rien poser par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. Terminer la voix avant la dernière seconde.

---

## Les chiffres de référence (ceux de l'écran)

| donnée | valeur |
|---|---|
| équité du héros | 41.4 % |
| action jouée dans la vidéo | Suivre 4.25 € (−1,48 bb) |
| meilleure action | Relancer 2.5 bb (+6,17 bb) |
| coût de l'erreur | 7,65 bb |
| verdict affiché | « erreur » |
| espérance — Relancer 2.5 bb | +6,17 bb |
| espérance — Relancer Tapis | +5,75 bb |
| espérance — Passer | 0,00 bb |
| espérance — Suivre 4.25 € | −1,48 bb |

Ces valeurs viennent de `Judge.evaluate` et sont affichées dans la vidéo aux
beats REVEAL et PAYOFF. Comme l'application l'indique elle-même, ce sont des
estimations sur la range adverse et les profils en jeu — un ordre de grandeur et
un classement, pas une sortie de solveur. Le script ne doit pas les présenter
autrement.
