# Script — 06 - 76s sur board sec tete haute face a un reg

**Vidéo** : `video.webm` · 34.30 s · **Concept** : Quizz
**Situation** : 76s sur board sec, tête haute face à un reg

> **Statut de ce texte : une proposition.** Le ton, le rythme et les mots se
> reformulent librement — c'est ta voix. Les **chiffres**, en revanche, sont ceux
> que le moteur affiche à l'écran au même moment : ne les change pas, ne les
> arrondis pas autrement, n'en ajoute pas d'autres.
>
> Calibrage : environ 2.8 mots par seconde de voix posée. Chaque beat
> indique sa contrainte ; si tu reformules plus long, ça ne rentrera pas.

---

## Le script, d'une traite

7♥ 6♥ en grosse blinde. Simple, en apparence.

En face : le bouton, un régulier solide. Flop K♥ 8♣ 3♦ : tu checkes, il mise 4 bb.

Le prix : 0,40 €, dans un pot de 0,95 €.

Passer, suivre, ou relancer — les montants sont à l'écran. Tu fais quoi ?

Suivi ? Erreur, dit le moteur. Coût : 4,80 big blinds. Il fallait passer.

Passer vaut zéro. Suivre : −4,80 — pire que jeter la main. Rien ne bat le fold.

*(Les crochets de calage : HOOK à 00:00.00 · SITUATION à 00:03.70 · TENSION à 00:10.70 · CHOICE à 00:15.30 · REVEAL à 00:22.20 · PAYOFF à 00:28.10.)*

---

## Le détail, beat par beat

### HOOK — `00:00.00` → `00:03.70` (3.7 s · 10 mots max, proposé : 8)

**Voix off proposée**

> 7♥ 6♥ en grosse blinde. Simple, en apparence.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- 7♥ 6♥ en grosse blinde.
- Simple, en apparence.

**Note de jeu.** L'accroche tient par l'image des cartes ; la voix ne fait qu'ouvrir la question. Aucun chiffre ici.

### SITUATION — `00:03.70` → `00:10.70` (7.0 s · 19 mots max, proposé : 19)

**Voix off proposée**

> En face : le bouton, un régulier solide. Flop K♥ 8♣ 3♦ : tu checkes, il mise 4 bb.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- NL10 · en face : le bouton, un régulier solide
- Préflop : le bouton relance à 2,5 bb, tu paies.
- Flop K♥ 8♣ 3♦ : tu checkes, le bouton mise 4 bb.

**Note de jeu.** Tout ce qui est dit ici est aussi à l'écran (panneau « Déroulement »). Si la voix ne raconte pas toutes les rues, les sous-titres les portent.

### TENSION — `00:10.70` → `00:15.30` (4.6 s · 12 mots max, proposé : 11)

**Voix off proposée**

> Le prix : 0,40 €, dans un pot de 0,95 €.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- À payer : 0,40 €
- Pot : 0,95 €

**Note de jeu.** Silence recommandé sur le freeze final. Ne pas donner l'équité ni la réponse : c'est le moment où le spectateur se forge un avis.

### CHOICE — `00:15.30` → `00:22.20` (6.9 s · 19 mots max, proposé : 14)

**Voix off proposée**

> Passer, suivre, ou relancer — les montants sont à l'écran. Tu fais quoi ?

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Passer, suivre… ou relancer ?
- Tu fais quoi ?

**Note de jeu.** La question posée, laisser le temps de pose travailler : les ~5 dernières secondes du beat sont volontairement muettes (compte à rebours possible).

### REVEAL — `00:22.20` → `00:28.10` (5.9 s · 16 mots max, proposé : 14)

**Voix off proposée**

> Suivi ? Erreur, dit le moteur. Coût : 4,80 big blinds. Il fallait passer.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Verdict : erreur.
- Coût : 4,80 bb
- La bonne réponse : passer

**Note de jeu.** C'est ici que la voix a le plus de valeur. Les chiffres dits sont exactement ceux affichés — ne pas les arrondir autrement.

### PAYOFF — `00:28.10` → `00:34.30` (6.2 s · 17 mots max, proposé : 17)

**Voix off proposée**

> Passer vaut zéro. Suivre : −4,80 — pire que jeter la main. Rien ne bat le fold.

**Sous-titres proposés** (à caler dans la fenêtre du beat, en bas de la bande utile)

- Passer = 0 bb
- Suivre 0.40 € = −4,80 bb
- Rien ne bat le fold ici.

**Note de jeu.** Ne rien poser par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. Terminer la voix avant la dernière seconde.

---

## Les chiffres de référence (ceux de l'écran)

| donnée | valeur |
|---|---|
| équité du héros | 17.8 % |
| action jouée dans la vidéo | Suivre 0.40 € (−4,80 bb) |
| meilleure action | Passer (0,00 bb) |
| coût de l'erreur | 4,80 bb |
| verdict affiché | « erreur » |
| espérance — Passer | 0,00 bb |
| espérance — Relancer Pot | −0,26 bb |
| espérance — Relancer Tapis | −0,28 bb |
| espérance — Relancer 1/3 pot | −0,34 bb |
| espérance — Suivre 0.40 € | −4,80 bb |

Ces valeurs viennent de `Judge.evaluate` et sont affichées dans la vidéo aux
beats REVEAL et PAYOFF. Comme l'application l'indique elle-même, ce sont des
estimations sur la range adverse et les profils en jeu — un ordre de grandeur et
un classement, pas une sortie de solveur. Le script ne doit pas les présenter
autrement.
